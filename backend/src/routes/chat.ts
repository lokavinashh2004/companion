import { createRoute } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';

import {
  ChatListQuery,
  ChatListSchema,
  MessageUpdatedSchema,
  PeriodChipRequest,
  SendMessageSchema,
  SendResultSchema,
  UndoLogRequest,
} from '../contract.ts';
import { resolveReplyLanguage } from '../core/language.ts';
import { pick, SERVER_MESSAGES } from '../core/messages.ts';
import { matchesCrisis } from '../core/safety.ts';
import { processMessage, RATE_LIMIT, saveQueuedNotice } from '../services/chat.ts';
import { logPeriod } from '../services/cycle.ts';
import type { UserScope } from '../store/index.ts';
import type { MessageDoc } from '../store/types.ts';
import { jsonBody, jsonRes, profileOf, toMessage, type App, type AppDeps } from './shared.ts';

const sec = [{ firebase: [] }];

async function ownMessage(u: UserScope, id: string): Promise<MessageDoc> {
  const m = await u.messages.findOne({ id });
  if (!m) throw new HTTPException(404, { message: 'not_found' });
  return m;
}

export function registerChat(app: App, { services: s }: AppDeps) {
  app.openapi(
    createRoute({
      method: 'get',
      path: '/chat/messages',
      tags: ['chat'],
      security: sec,
      request: { query: ChatListQuery },
      responses: { 200: jsonRes(ChatListSchema, 'Messages, oldest first (the latest page, or older than `before`)') },
    }),
    async (c) => {
      const { before, limit = 50 } = c.req.valid('query');
      const u = s.store.user(c.get('uid'));
      const rows = await u.messages.find(before ? { created_at: { $lt: before } } : {}, { sort: { created_at: -1 }, limit: limit + 1 });
      const has_more = rows.length > limit;
      return c.json({ messages: rows.slice(0, limit).reverse().map(toMessage), has_more }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/chat/messages',
      tags: ['chat'],
      security: sec,
      request: { body: jsonBody(SendMessageSchema) },
      responses: { 200: jsonRes(SendResultSchema, 'Reply, or a queued notice if no model is available right now') },
    }),
    async (c) => {
      const { text, client_id } = c.req.valid('json');
      const u = s.store.user(c.get('uid'));
      const profile = await profileOf(u);
      const lang = resolveReplyLanguage(profile.display_language, text);
      const crisisKeyword = matchesCrisis(text);

      // Idempotent resend (the browser retried after a dropped connection).
      const existing = await u.messages.findOne({ client_id });
      if (existing && existing.status !== 'pending') {
        const reply = await u.messages.findOne({ 'meta.reply_to': existing.id });
        return c.json({ status: existing.status === 'done' ? ('done' as const) : ('queued' as const), message: toMessage(existing), reply: reply && !reply.meta.fallback ? toMessage(reply) : null, notice: reply?.meta.fallback ? toMessage(reply) : null, crisis: crisisKeyword }, 200);
      }

      // Step 1: save first, before anything can fail.
      const msg =
        existing ??
        (await u.messages.insertOne({
          client_id, role: 'user', content: text, language: /[஀-௿]/.test(text) ? 'ta' : null,
          status: 'pending', model_id: null, retry_count: 0, error: null, meta: {},
        }));

      // Per-user rate limit protects the shared daily budget; the message stays saved and queued.
      const since = new Date(s.now().getTime() - RATE_LIMIT.windowMinutes * 60_000).toISOString();
      if ((await u.messages.count({ role: 'user', created_at: { $gte: since } })) > RATE_LIMIT.messages) {
        const queued = (await u.messages.updateOne({ id: msg.id }, { status: 'queued', error: 'rate_limited' }))!;
        const notice = await saveQueuedNotice(u, msg.id, pick(SERVER_MESSAGES.rateLimited, lang), crisisKeyword);
        return c.json({ status: 'queued' as const, message: toMessage(queued), reply: null, notice: toMessage(notice), crisis: crisisKeyword }, 200);
      }

      const r = await processMessage(s, u, profile, msg);
      const saved = (await u.messages.findOne({ id: msg.id }))!;
      if (r.status === 'done') {
        return c.json({ status: 'done' as const, message: toMessage(saved), reply: toMessage(r.reply), notice: null, crisis: !!r.reply.meta.flags?.crisis }, 200);
      }
      const notice = await saveQueuedNotice(u, msg.id, r.notice, r.crisis);
      return c.json({ status: 'queued' as const, message: toMessage(saved), reply: null, notice: toMessage(notice), crisis: r.crisis }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/chat/undo',
      tags: ['chat'],
      security: sec,
      request: { body: jsonBody(UndoLogRequest) },
      responses: { 200: jsonRes(MessageUpdatedSchema, 'The log was removed (or restored, for water/sleep/exercise)') },
    }),
    async (c) => {
      const { message_id, log_id } = c.req.valid('json');
      const u = s.store.user(c.get('uid'));
      const msg = await ownMessage(u, message_id);
      const log = msg.meta.logs?.find((l) => l.id === log_id);
      if (!log) throw new HTTPException(404, { message: 'not_found' });
      if (!msg.meta.undone?.[log.id]) {
        if (log.table === 'lifestyle_logs') await u.lifestyle_logs.updateOne({ id: log.id }, (log.prev ?? {}) as never);
        else await u[log.table].deleteOne({ id: log.id });
      }
      const updated = (await u.messages.updateOne({ id: msg.id }, { meta: { ...msg.meta, undone: { ...msg.meta.undone, [log.id]: true } } }))!;
      return c.json({ message: toMessage(updated) }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/chat/confirm-period',
      tags: ['chat'],
      security: sec,
      request: { body: jsonBody(PeriodChipRequest) },
      responses: { 200: jsonRes(MessageUpdatedSchema, 'Period start/end logged from a confirm chip') },
    }),
    async (c) => {
      const { message_id, index } = c.req.valid('json');
      const u = s.store.user(c.get('uid'));
      const msg = await ownMessage(u, message_id);
      const p = msg.meta.pending?.[index];
      if (!p) throw new HTTPException(404, { message: 'not_found' });
      if (msg.meta.confirmed?.[String(index)]) return c.json({ message: toMessage(msg) }, 200);
      const period = await logPeriod(u, p.kind, p.date, { flow: p.flow, pain: p.pain, source_message_id: msg.meta.reply_to ?? null });
      if (!period) throw new HTTPException(409, { message: 'no_period_to_end' });
      const updated = (await u.messages.updateOne({ id: msg.id }, { meta: { ...msg.meta, confirmed: { ...msg.meta.confirmed, [String(index)]: period.id } } }))!;
      return c.json({ message: toMessage(updated) }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/chat/undo-period',
      tags: ['chat'],
      security: sec,
      request: { body: jsonBody(PeriodChipRequest) },
      responses: { 200: jsonRes(MessageUpdatedSchema, 'A confirmed period chip was undone') },
    }),
    async (c) => {
      const { message_id, index } = c.req.valid('json');
      const u = s.store.user(c.get('uid'));
      const msg = await ownMessage(u, message_id);
      const p = msg.meta.pending?.[index];
      const periodId = msg.meta.confirmed?.[String(index)];
      if (!p || !periodId) throw new HTTPException(404, { message: 'not_found' });
      if (p.kind === 'period_start') await u.periods.deleteOne({ id: periodId });
      else await u.periods.updateOne({ id: periodId }, { end_date: null });
      const confirmed = { ...msg.meta.confirmed };
      delete confirmed[String(index)];
      const updated = (await u.messages.updateOne({ id: msg.id }, { meta: { ...msg.meta, confirmed } }))!;
      return c.json({ message: toMessage(updated) }, 200);
    },
  );
}
