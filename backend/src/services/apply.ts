// Applies a validated companion response. Code owns every date and number: relative_day offsets become
// dates here, foods are resolved here, and period events become confirm chips (never written directly).
import { addDays, localDateTime, localTimeIn, minutesOf } from '../core/dates.ts';
import type { CompanionResponse } from '../core/schemas.ts';
import type { UserScope } from '../store/index.ts';
import type { LifestyleDoc, PendingPeriod, UndoLog } from '../store/types.ts';
import type { Services } from './context.ts';
import { logFoods } from './foods.ts';
import { addFacts } from './memory.ts';

export interface Applied {
  logs: UndoLog[];
  pending: PendingPeriod[];
  factsAdded: number;
}

export function mealForHour(hour: number): 'breakfast' | 'lunch' | 'snack' | 'dinner' {
  if (hour >= 4 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 16) return 'lunch';
  if (hour >= 16 && hour < 19) return 'snack';
  return 'dinner';
}

export async function applyExtracted(
  s: Services,
  u: UserScope,
  timezone: string,
  today: string,
  messageId: string,
  r: CompanionResponse,
): Promise<Applied> {
  const x = r.extracted;
  const logs: UndoLog[] = [];
  const pending: PendingPeriod[] = [];
  const { hour, minute } = localTimeIn(timezone, s.now());

  if (x.foods.length) {
    const fallbackMeal = mealForHour(hour);
    const rows = await logFoods(
      s, u, today,
      x.foods.map((f) => ({ name: f.name, quantity: f.quantity, unit: f.unit, meal: f.meal ?? fallbackMeal })),
      'text', messageId,
    );
    for (const row of rows) logs.push({ table: 'food_logs', id: row.id, label: row.item_name });
  }

  const pe = x.period_event;
  if (pe && pe.type !== 'none') {
    pending.push({ kind: pe.type === 'started' ? 'period_start' : 'period_end', date: addDays(today, pe.relative_day), flow: pe.flow, pain: pe.pain });
  }

  if (x.symptoms.length) {
    const rows = await u.symptom_logs.insertMany(
      x.symptoms.map((sy) => ({ day: today, symptom: sy.symptom, severity: sy.severity, note: null, source_message_id: messageId })),
    );
    for (const row of rows) logs.push({ table: 'symptom_logs', id: row.id, label: row.symptom });
  }

  if (x.mood && (x.mood.mood ?? x.mood.energy ?? x.mood.stress) !== null) {
    const row = await u.mood_logs.insertOne({ day: today, mood: x.mood.mood, energy: x.mood.energy, stress: x.mood.stress, note: null, source_message_id: messageId });
    logs.push({ table: 'mood_logs', id: row.id, label: 'mood' });
  }

  // Lifestyle: one row per day. Water and exercise add up; sleep and flags overwrite.
  const l = x.lifestyle;
  if (l && Object.values(l).some((v) => v !== null)) {
    const existing = await u.lifestyle_logs.findOne({ day: today });
    const next: Partial<LifestyleDoc> = {};
    if (l.sleep_hours !== null) next.sleep_hours = l.sleep_hours;
    if (l.water_ml !== null) next.water_ml = (existing?.water_ml ?? 0) + l.water_ml;
    if (l.exercise_minutes !== null) next.exercise_minutes = (existing?.exercise_minutes ?? 0) + l.exercise_minutes;
    if (l.exercise_type !== null) next.exercise_type = l.exercise_type;
    if (l.illness !== null) next.illness = l.illness;
    if (l.travel !== null) next.travel = l.travel;
    const prev = Object.fromEntries(Object.keys(next).map((k) => [k, (existing as Record<string, unknown> | null)?.[k] ?? null]));
    const row = await u.lifestyle_logs.updateOne({ day: today }, next, {
      upsert: true,
      setOnInsert: { sleep_hours: null, water_ml: null, steps: null, exercise_minutes: null, exercise_type: null, illness: null, travel: null, ...next },
    });
    if (row) logs.push({ table: 'lifestyle_logs', id: row.id, label: Object.keys(next).join(','), prev });
  }

  // Medication taken: match by name, attach to the nearest scheduled time today.
  if (x.med_taken.length) {
    const meds = await u.medications.find({ active: true });
    const nowMin = hour * 60 + minute;
    for (const m of x.med_taken.filter((t) => t.taken)) {
      const said = m.name.toLowerCase();
      const med = meds.find((d) => d.name.toLowerCase().includes(said) || said.includes(d.name.toLowerCase()));
      if (!med) continue;
      const nearest = med.schedule_times.length
        ? med.schedule_times.reduce((a, b) => (Math.abs(minutesOf(b) - nowMin) < Math.abs(minutesOf(a) - nowMin) ? b : a))
        : `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      const row = await u.med_intake.updateOne(
        { medication_id: med.id, scheduled_for: localDateTime(today, nearest, timezone) },
        { taken: true, taken_at: s.now().toISOString() },
        { upsert: true },
      );
      if (row) logs.push({ table: 'med_intake', id: row.id, label: med.name });
    }
  }

  if (r.flags.red_flag_symptom) {
    await u.insights
      .updateOne({ type: 'red_flag', key: `chat:${today}` }, {}, { upsert: true, setOnInsert: { day: today, payload: { rule: 'chat_symptom' }, shown: false, dismissed: false } })
      .catch(() => null);
  }

  const factsAdded = await addFacts(s, u, x.new_facts, messageId).catch(() => 0);
  return { logs, pending, factsAdded };
}
