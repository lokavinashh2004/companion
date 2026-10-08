// Nightly (after 23:30 her time): a 3–4 sentence English summary of the day, embedded for memory search.
// Also retires facts the model says are outdated. One LLM request per active day; skipped when the
// budget is nearly spent (caught up the next night).
import { addDays, localMidnight, todayIn } from '../core/dates.ts';
import { dailySummaryPrompt } from '../core/prompts/companion.ts';
import { scrubPII } from '../core/safety.ts';
import { SummaryResponse } from '../core/schemas.ts';
import type { ProfileDoc } from '../store/types.ts';
import type { Services } from '../services/context.ts';

export async function summariseDay(s: Services, p: ProfileDoc, day: string): Promise<string> {
  const u = s.store.user(p.user_id);
  if (await u.daily_summaries.findOne({ day })) return 'exists';
  const from = new Date(localMidnight(day, p.timezone)).toISOString();
  const to = new Date(localMidnight(addDays(day, 1), p.timezone)).toISOString();
  const [msgs, foods, moods, symptoms, life, facts] = await Promise.all([
    u.messages.find({ status: 'done', created_at: { $gte: from, $lt: to } }, { sort: { created_at: 1 }, limit: 80 }),
    u.food_logs.find({ day }),
    u.mood_logs.find({ day }),
    u.symptom_logs.find({ day }),
    u.lifestyle_logs.findOne({ day }),
    u.facts.find({ active: true }),
  ]);
  const chat = msgs.filter((m) => !m.meta?.fallback);
  if (chat.length === 0 && foods.length === 0 && moods.length === 0) return 'no_activity';

  const lines: string[] = [];
  if (foods.length) lines.push(`Food: ${foods.map((f) => `${f.item_name} (${f.meal})`).join(', ')}`);
  if (moods.length) lines.push(`Mood logs (1-5): ${moods.map((m) => `mood ${m.mood ?? '-'} energy ${m.energy ?? '-'} stress ${m.stress ?? '-'}`).join('; ')}`);
  if (symptoms.length) lines.push(`Symptoms: ${symptoms.map((x) => `${x.symptom} (${x.severity}/3)`).join(', ')}`);
  if (life) lines.push(`Sleep ${life.sleep_hours ?? '-'} h, water ${life.water_ml ?? '-'} ml, exercise ${life.exercise_minutes ?? '-'} min`);
  lines.push('Chat:');
  for (const m of chat.slice(-40)) lines.push(`${m.role === 'user' ? 'She' : 'Friend'}: ${scrubPII(m.content).slice(0, 300)}`);

  const r = await s.llm.call({
    caps: ['chat', 'json'],
    temperature: 0.2,
    schema: SummaryResponse,
    maxTokens: 500,
    messages: [{ role: 'user', content: dailySummaryPrompt(lines.join('\n'), facts.map((f) => f.fact)) }],
  });
  if (!r.ok) return `llm_${r.reason}`;

  const moodVals = moods.map((m) => m.mood).filter((x): x is number => x !== null);
  const embedding = await s.embed(r.data.summary).catch(() => null);
  await u.daily_summaries.updateOne(
    { day },
    { summary: r.data.summary, mood_avg: moodVals.length ? Math.round((moodVals.reduce((a, b) => a + b, 0) / moodVals.length) * 10) / 10 : null, embedding },
    { upsert: true },
  );
  const retire = new Set(r.data.facts_to_retire.map((f) => f.trim().toLowerCase()));
  const ids = facts.filter((f) => retire.has(f.fact.trim().toLowerCase())).map((f) => f.id);
  if (ids.length) await u.facts.updateMany({ id: { $in: ids } }, { active: false, updated_at: s.now().toISOString() });
  return `ok${ids.length ? `_retired_${ids.length}` : ''}`;
}

export async function runDailySummary(s: Services): Promise<string[]> {
  const out: string[] = [];
  for (const p of await s.store.unscoped.profiles.find({ onboarding_done: true })) {
    const now = s.now();
    const today = todayIn(p.timezone, now);
    const hm = new Intl.DateTimeFormat('en-GB', { timeZone: p.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
    // Yesterday first (catch-up), then today once it's 23:30 or later for her.
    const days = hm >= '23:30' ? [addDays(today, -1), today] : [addDays(today, -1)];
    for (const day of days) {
      if ((await s.llm.remaining()) <= s.env.LLM_SUMMARY_RESERVE - 1) {
        out.push(`${day}:skipped_budget`);
        continue;
      }
      out.push(`${day}:${await summariseDay(s, p, day)}`);
    }
  }
  return out;
}
