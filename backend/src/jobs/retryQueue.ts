// Every 5 minutes: finishes messages that were queued (all models down, budget spent or rate-limited),
// then pushes "reply ready". Gives up after about an hour of retries (status failed).
import { resolveReplyLanguage } from '../core/language.ts';
import { pick, SERVER_MESSAGES } from '../core/messages.ts';
import type { Services } from '../services/context.ts';
import { processMessage } from '../services/chat.ts';

export const MAX_PER_RUN = 3;
export const MAX_RETRIES = 12;
const MAX_AGE_HOURS = 48;

export async function runRetryQueue(s: Services): Promise<string[]> {
  if ((await s.llm.remaining()) <= 0) return ['skipped_budget'];
  const since = new Date(s.now().getTime() - MAX_AGE_HOURS * 3_600_000).toISOString();
  const queued = await s.store.unscoped.messages.find({ status: 'queued', role: 'user', created_at: { $gte: since } }, { sort: { created_at: 1 }, limit: MAX_PER_RUN });
  const results: string[] = [];
  for (const msg of queued) {
    const u = s.store.user(msg.user_id);
    const profile = await u.profiles.findOne();
    if (!profile) continue;
    const r = await processMessage(s, u, profile, msg);
    if (r.status === 'done') {
      const lang = resolveReplyLanguage(profile.display_language, msg.content);
      await s.push.send(msg.user_id, { kind: 'queued_reply', title: pick(SERVER_MESSAGES.replyReadyTitle, lang), body: r.reply.content.slice(0, 140), url: '/' }, { ref: msg.id });
      results.push('done');
    } else {
      if (msg.retry_count + 1 >= MAX_RETRIES) await u.messages.updateOne({ id: msg.id }, { status: 'failed' });
      results.push(r.reason);
      if (['budget', 'daily_limit', 'budget_exhausted'].includes(r.reason)) break;
    }
  }
  return results;
}
