// Web Push subscriptions, the medicine notification actions (signed token, no login), and scheduled jobs
// (cron secret). /med-action and /jobs/* are public paths in app.ts; they authenticate themselves here.
import { createRoute, z } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import { timingSafeEqual } from 'node:crypto';

import { MedActionSchema, OkSchema, PushEndpointSchema, PushSubscriptionSchema, PushTestResultSchema } from '../contract.ts';
import { localDateTime } from '../core/dates.ts';
import { runJob, tick, type JobName } from '../jobs/tick.ts';
import { verifyMedToken } from '../services/medToken.ts';
import { DuplicateKeyError } from '../store/collection.ts';
import { jsonBody, jsonRes, profileOf, type App, type AppDeps } from './shared.ts';

const sec = [{ firebase: [] }];

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function registerPush(app: App, deps: AppDeps) {
  const s = deps.services;

  app.openapi(
    createRoute({ method: 'post', path: '/push/subscription', tags: ['push'], security: sec, request: { body: jsonBody(PushSubscriptionSchema) }, responses: { 200: jsonRes(OkSchema, 'Saved for this device') } }),
    async (c) => {
      const { endpoint, keys } = c.req.valid('json');
      const uid = c.get('uid');
      // An endpoint belongs to one browser; if it was registered by another account on this device, move it.
      await s.store.unscoped.push_subscriptions.deleteMany({ endpoint, user_id: { $ne: uid } });
      try {
        await s.store.user(uid).push_subscriptions.updateOne(
          { endpoint },
          { p256dh: keys.p256dh, auth: keys.auth, user_agent: c.req.header('User-Agent')?.slice(0, 200) ?? null },
          { upsert: true },
        );
      } catch (e) {
        if (!(e instanceof DuplicateKeyError)) throw e;
      }
      return c.json({ ok: true as const }, 200);
    },
  );

  app.openapi(
    createRoute({ method: 'delete', path: '/push/subscription', tags: ['push'], security: sec, request: { body: jsonBody(PushEndpointSchema) }, responses: { 200: jsonRes(OkSchema, 'Removed') } }),
    async (c) => {
      await s.store.user(c.get('uid')).push_subscriptions.deleteMany({ endpoint: c.req.valid('json').endpoint });
      return c.json({ ok: true as const }, 200);
    },
  );

  app.openapi(
    createRoute({ method: 'post', path: '/push/test', tags: ['push'], security: sec, responses: { 200: jsonRes(PushTestResultSchema, 'Sends a test notification to her devices') } }),
    async (c) => {
      const p = await profileOf(s.store.user(c.get('uid')));
      const ta = p.ui_language === 'ta';
      const result = await s.push.send(
        c.get('uid'),
        { kind: 'test', title: ta ? 'அறிவிப்புகள் வேலை செய்கின்றன 💛' : 'Notifications are on 💛', body: ta ? 'இப்படித்தான் நினைவூட்டல்கள் வரும்.' : "This is how reminders will look.", url: '/me/settings' },
        { force: true },
      );
      return c.json({ result }, 200);
    },
  );

  // ---------------------------------------------------------------- medicine notification actions (public)
  app.openapi(
    createRoute({ method: 'post', path: '/med-action', tags: ['push'], request: { body: jsonBody(MedActionSchema) }, responses: { 200: jsonRes(OkSchema, 'Recorded') } }),
    async (c) => {
      const secret = s.env.MED_ACTION_SECRET;
      const { token, action } = c.req.valid('json');
      const t = secret ? verifyMedToken(token, secret, s.now().getTime()) : null;
      if (!t) throw new HTTPException(401, { message: 'invalid_token' });
      const u = s.store.user(t.uid);
      const med = await u.medications.findOne({ id: t.medication_id });
      if (!med) throw new HTTPException(404, { message: 'not_found' });
      if (action === 'taken') {
        const p = await profileOf(u);
        await u.med_intake.updateOne(
          { medication_id: med.id, scheduled_for: localDateTime(t.day, t.time, p.timezone) },
          { taken: true, taken_at: s.now().toISOString() },
          { upsert: true },
        );
      } else {
        await u.snoozes.insertOne({ medication_id: med.id, time: t.time, day: t.day, due_at: new Date(s.now().getTime() + 30 * 60_000).toISOString(), sent: false });
      }
      return c.json({ ok: true as const }, 200);
    },
  );

  // ---------------------------------------------------------------- scheduled jobs (public, cron secret)
  const checkCron = (header: string | undefined) => {
    const secret = s.env.CRON_SECRET;
    if (!secret || !header || !safeEqual(header, secret)) throw new HTTPException(401, { message: 'unauthorized' });
  };

  app.openapi(
    createRoute({
      method: 'post',
      path: '/jobs/tick',
      tags: ['jobs'],
      request: { headers: z.object({ 'x-cron-secret': z.string().optional() }) },
      responses: { 200: jsonRes(z.record(z.string(), z.unknown()), 'Runs due jobs: reminders + retries every call; daily/weekly jobs once per period') },
    }),
    async (c) => {
      checkCron(c.req.header('x-cron-secret'));
      return c.json(await tick(s, deps.apiUrl), 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/jobs/{name}',
      tags: ['jobs'],
      request: { params: z.object({ name: z.enum(['reminders', 'retry-queue', 'cycle-check', 'daily-summary', 'model-health', 'llm-check']) }), headers: z.object({ 'x-cron-secret': z.string().optional() }) },
      responses: { 200: jsonRes(z.object({ result: z.unknown() }), 'Runs one job now (manual trigger)') },
    }),
    async (c) => {
      checkCron(c.req.header('x-cron-secret'));
      return c.json({ result: await runJob(s, c.req.valid('param').name as JobName, deps.apiUrl) }, 200);
    },
  );
}
