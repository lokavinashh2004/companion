// One user message end to end: save first → detect language → check budget → build context → one LLM call
// (10-model fallback) → validate → apply extracted data in code → save reply. If every model fails, the
// message is queued, a pre-written bilingual notice is shown, and the retry job finishes it later.
import { checkReply, detectScript, resolveReplyLanguage, type ReplyLanguage } from '../core/language.ts';
import type { Cap } from '../core/llm-router.ts';
import { pick, SERVER_MESSAGES } from '../core/messages.ts';
import { companionSystemPrompt } from '../core/prompts/companion.ts';
import { matchesCrisis, scrubPII } from '../core/safety.ts';
import { CompanionResponse } from '../core/schemas.ts';
import type { UserScope } from '../store/index.ts';
import type { MessageDoc, MessageMeta, ProfileDoc } from '../store/types.ts';
import { applyExtracted, type Applied } from './apply.ts';
import type { Services } from './context.ts';
import { buildPromptContext, estimateTokens } from './promptContext.ts';

export const RATE_LIMIT = { messages: 30, windowMinutes: 10 };

export type ProcessResult =
  | { status: 'done'; reply: MessageDoc }
  | { status: 'queued'; reason: string; notice: string; crisis: boolean };

export function capsFor(lang: ReplyLanguage): Cap[] {
  if (lang === 'ta') return ['chat', 'json', 'tamil_script'];
  if (lang === 'tanglish' || lang === 'mixed') return ['chat', 'json', 'tanglish'];
  return ['chat', 'json'];
}

export async function processMessage(s: Services, u: UserScope, profile: ProfileDoc, msg: MessageDoc): Promise<ProcessResult> {
  const text = scrubPII(msg.content);
  const replyLanguage = resolveReplyLanguage(profile.display_language, msg.content);
  const crisisKeyword = matchesCrisis(msg.content);

  const queue = async (reason: string, bundle: 'queued' | 'budget'): Promise<ProcessResult> => {
    await u.messages.updateOne({ id: msg.id }, { status: 'queued', error: reason, retry_count: msg.retry_count + (bundle === 'budget' ? 0 : 1) });
    return { status: 'queued', reason, notice: pick(SERVER_MESSAGES[bundle], replyLanguage), crisis: crisisKeyword };
  };

  if ((await s.llm.remaining()) <= 0) return queue('budget', 'budget');

  const probe = { companionName: profile.companion_name, personaTone: profile.persona_tone, addressForm: profile.tamil_address_form, replyLanguage, calorieDisplay: profile.calorie_display, contextBlock: '' };
  const ctx = await buildPromptContext(s, u, profile, msg.id, text, estimateTokens(companionSystemPrompt(probe)));
  const system = companionSystemPrompt({ ...probe, contextBlock: ctx.contextBlock });
  const messages = [{ role: 'system' as const, content: system }, ...ctx.history, { role: 'user' as const, content: text }];

  const accept = (d: CompanionResponse) => {
    const c = checkReply(replyLanguage, d.reply);
    if (!c.ok) return c.reason;
    if (profile.calorie_display === 'hide' && /\b\d+\s*(k?cal|calories)\b/i.test(d.reply)) return 'calories_mentioned';
    return null;
  };

  let result = await s.llm.call({ caps: capsFor(replyLanguage), messages, temperature: 0.7, schema: CompanionResponse, accept });
  // Before the language eval has tagged models, fall back to any chat model.
  if (!result.ok && result.reason === 'no_models' && replyLanguage !== 'en') {
    result = await s.llm.call({ caps: ['chat', 'json'], messages, temperature: 0.7, schema: CompanionResponse, accept });
  }
  if (!result.ok) return queue(result.reason, result.reason === 'budget_exhausted' || result.reason === 'daily_limit' ? 'budget' : 'queued');

  const data = result.data;
  let applied: Applied = { logs: [], pending: [], factsAdded: 0 };
  try {
    applied = await applyExtracted(s, u, profile.timezone, ctx.today, msg.id, data);
  } catch (e) {
    console.error('apply failed', e instanceof Error ? e.message : e); // never lose the reply
  }

  const meta: MessageMeta = {
    reply_to: msg.id,
    logs: applied.logs,
    pending: applied.pending,
    flags: { crisis: data.flags.crisis || crisisKeyword, red_flag: data.flags.red_flag_symptom },
  };
  const reply = await u.messages.insertOne({
    client_id: null,
    role: 'assistant',
    content: data.reply,
    language: detectScript(data.reply) === 'ta' ? 'ta' : data.language_detected,
    status: 'done',
    model_id: result.modelId,
    retry_count: 0,
    error: null,
    meta,
  });
  await u.messages.updateOne({ id: msg.id }, { status: 'done', error: null, language: data.language_detected });
  if (ctx.pendingInsightIds.length) await u.insights.updateMany({ id: { $in: ctx.pendingInsightIds } }, { shown: true });
  return { status: 'done', reply };
}

/** Saves a pre-written notice when a message is queued (excluded from LLM context). */
export async function saveQueuedNotice(u: UserScope, replyTo: string, notice: string, crisis: boolean): Promise<MessageDoc> {
  return u.messages.insertOne({
    client_id: null,
    role: 'assistant',
    content: notice,
    language: null,
    status: 'done',
    model_id: null,
    retry_count: 0,
    error: null,
    meta: { fallback: true, reply_to: replyTo, flags: { crisis, red_flag: false } },
  });
}
