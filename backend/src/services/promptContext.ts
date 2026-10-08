// Builds the English, identifier-free context block and chat history for one companion call.
// Budget ~6,000 tokens: trims oldest messages first, then memories, then older summaries and facts.
import { describeCycleStatus } from '../core/describe.ts';
import { addDays, localMidnight, todayIn, weekdayName } from '../core/dates.ts';
import type { ChatMessage } from '../core/llm-router.ts';
import { scrubPII } from '../core/safety.ts';
import { balanceScore, type ScoreItem } from '../core/score.ts';
import type { UserScope } from '../store/index.ts';
import type { ProfileDoc } from '../store/types.ts';
import type { Services } from './context.ts';
import { loadCycle } from './cycle.ts';
import { relatedSummaries } from './memory.ts';

export function estimateTokens(text: string): number {
  const tamil = text.match(/[஀-௿]/g)?.length ?? 0;
  return Math.ceil(tamil + (text.length - tamil) / 4);
}

export const PROMPT_TOKEN_BUDGET = 6000;

export interface BuiltContext {
  contextBlock: string;
  history: ChatMessage[];
  today: string;
  pendingInsightIds: string[];
}

const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export async function buildPromptContext(
  s: Services,
  u: UserScope,
  profile: ProfileDoc,
  currentMessageId: string,
  currentText: string,
  basePromptTokens: number,
): Promise<BuiltContext> {
  const today = todayIn(profile.timezone, s.now());
  const since3 = addDays(today, -2);

  const [cycle, foods, moods, life, meds, intake, facts, summaries, history, insights] = await Promise.all([
    loadCycle(u, profile.typical_cycle_length, today),
    u.food_logs.find({ day: today }),
    u.mood_logs.find({ day: { $gte: since3 } }, { sort: { created_at: 1 } }),
    u.lifestyle_logs.find({ day: { $gte: since3 } }, { sort: { day: 1 } }),
    u.medications.find({ active: true }),
    u.med_intake.find({ scheduled_for: { $gte: localMidnight(today, profile.timezone) } }),
    u.facts.find({ active: true }, { sort: { updated_at: -1 }, limit: 60 }),
    u.daily_summaries.find({}, { sort: { day: -1 }, limit: 3 }),
    u.messages.find({ id: { $ne: currentMessageId }, status: 'done' }, { sort: { created_at: -1 }, limit: 8 }),
    u.insights.find({ shown: false, dismissed: false, type: { $in: ['delay', 'red_flag'] } }, { sort: { created_at: -1 }, limit: 1 }),
  ]);
  const memories = await relatedSummaries(s, u, currentText, new Set(summaries.map((x) => x.day)));

  const lines: string[] = [];
  lines.push(`Today: ${weekdayName(today)}, ${fmt(today)} ${today.slice(0, 4)}.`);
  lines.push(describeCycleStatus(cycle.status, cycle.prediction));

  if (foods.length) {
    const score = balanceScore(foods as ScoreItem[]);
    const items = foods.map((f) => `${f.item_name}${f.quantity ? ` x${f.quantity}${f.unit ? ` ${f.unit}` : ''}` : ''} (${f.meal})`).join(', ');
    const kcal = profile.calorie_display === 'show' && score ? `, about ${score.totals.kcal} kcal` : '';
    lines.push(
      `Food logged today: ${items}. Totals: protein ${score?.totals.protein_g ?? 0} g, fiber ${score?.totals.fiber_g ?? 0} g${kcal}. Balance score ${score?.score ?? 0}/10${score?.highlights.length ? ` (good: ${score.highlights.join(', ')})` : ''}.`,
    );
  } else {
    lines.push('Food logged today: nothing yet.');
  }
  if (moods.length) lines.push(`Recent mood (1-5): ${moods.map((m) => `${m.day.slice(5)} mood ${m.mood ?? '-'} energy ${m.energy ?? '-'} stress ${m.stress ?? '-'}`).join('; ')}.`);
  if (life.length) lines.push(`Recent sleep/water/exercise: ${life.map((l) => `${l.day.slice(5)} sleep ${l.sleep_hours ?? '-'}h, water ${l.water_ml ?? '-'} ml, exercise ${l.exercise_minutes ?? '-'} min`).join('; ')}.`);
  if (meds.length) {
    const taken = new Set(intake.filter((i) => i.taken).map((i) => i.medication_id));
    lines.push(`Active medications: ${meds.map((m) => `${m.name}${m.dose ? ` ${m.dose}` : ''} (${taken.has(m.id) ? 'taken today' : 'not marked taken today'})`).join(', ')}. Never comment on whether a medication is right for her.`);
  }
  if (profile.goals.length || profile.diet_type || profile.allergies.length) {
    lines.push(`Preferences: goals ${profile.goals.join(', ') || '-'}; diet ${profile.diet_type ?? '-'}; allergies ${profile.allergies.join(', ') || 'none'}.`);
  }
  const insight = insights[0];
  if (insight) lines.push(`Something to mention gently if it fits (once): ${JSON.stringify(insight.payload)}.`);

  const factLines = facts.map((f) => `- ${f.fact}`);
  const summaryLines = [...summaries].reverse().map((x) => `- ${x.day}: ${x.summary}`);
  const memoryLines = memories.map((m) => `- ${m.day}: ${m.summary}`);
  let hist: ChatMessage[] = history
    .filter((m) => !m.meta?.fallback && m.role !== 'system')
    .reverse()
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.role === 'user' ? scrubPII(m.content) : m.content }));

  const assemble = () =>
    [
      ...lines,
      factLines.length ? `What you know about her:\n${factLines.join('\n')}` : '',
      summaryLines.length ? `Recent days:\n${summaryLines.join('\n')}` : '',
      memoryLines.length ? `Related memories:\n${memoryLines.join('\n')}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  const total = () =>
    basePromptTokens + estimateTokens(assemble()) + hist.reduce((n, m) => n + estimateTokens(String(m.content)), 0) + estimateTokens(currentText);
  while (total() > PROMPT_TOKEN_BUDGET && hist.length > 2) hist = hist.slice(1);
  while (total() > PROMPT_TOKEN_BUDGET && memoryLines.length) memoryLines.pop();
  while (total() > PROMPT_TOKEN_BUDGET && summaryLines.length > 1) summaryLines.shift();
  while (total() > PROMPT_TOKEN_BUDGET && factLines.length > 20) factLines.pop();

  return { contextBlock: assemble(), history: hist, today, pendingInsightIds: insight ? [insight.id] : [] };
}
