// Simple weekly correlations ("you might notice..."). Only reported with 3+ completed cycles of data.
import { addDays, diffDays, type ISODate } from './dates.ts';
import type { PeriodRow } from './cycle.ts';

export type CyclePhase = 'menstrual' | 'follicular' | 'luteal';

export type Pattern =
  | { kind: 'mood_by_phase'; lowest: CyclePhase; averages: Partial<Record<CyclePhase, number>> }
  | { kind: 'cravings_luteal'; lutealRate: number; otherRate: number }
  | { kind: 'sugar_acne'; afterSugarRate: number; otherRate: number };

export const MIN_COMPLETED_CYCLES = 3;

/** Phase of `day` using completed cycles only (needs the next start to know the luteal window). */
export function phaseOf(day: ISODate, periods: PeriodRow[]): CyclePhase | null {
  const sorted = [...periods].sort((a, b) => a.start_date.localeCompare(b.start_date));
  for (let i = 0; i < sorted.length - 1; i++) {
    const p = sorted[i]!;
    const next = sorted[i + 1]!;
    if (day < p.start_date || day >= next.start_date) continue;
    const end = p.end_date ?? addDays(p.start_date, 4);
    if (day <= end) return 'menstrual';
    return diffDays(day, next.start_date) <= 14 ? 'luteal' : 'follicular';
  }
  return null;
}

export function completedCycles(periods: PeriodRow[]): number {
  return Math.max(0, periods.length - 1);
}

export function findPatterns(input: {
  periods: PeriodRow[];
  moods: { day: ISODate; mood: number | null }[];
  symptoms: { day: ISODate; symptom: string }[];
  sugarByDay: { day: ISODate; added_sugar_g: number }[];
}): Pattern[] {
  if (completedCycles(input.periods) < MIN_COMPLETED_CYCLES) return [];
  const out: Pattern[] = [];

  // Mood by phase: needs 3+ readings per phase and a clear gap.
  const byPhase: Record<CyclePhase, number[]> = { menstrual: [], follicular: [], luteal: [] };
  for (const m of input.moods) {
    const ph = m.mood !== null ? phaseOf(m.day, input.periods) : null;
    if (ph) byPhase[ph].push(m.mood!);
  }
  const avgs: Partial<Record<CyclePhase, number>> = {};
  for (const [ph, xs] of Object.entries(byPhase) as [CyclePhase, number[]][]) {
    if (xs.length >= 3) avgs[ph] = Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;
  }
  const entries = Object.entries(avgs) as [CyclePhase, number][];
  if (entries.length >= 2) {
    const lo = entries.reduce((a, b) => (b[1] < a[1] ? b : a));
    const hi = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
    if (hi[1] - lo[1] >= 0.8) out.push({ kind: 'mood_by_phase', lowest: lo[0], averages: avgs });
  }

  // Cravings in the luteal phase vs the rest (per day with a known phase).
  const cravingDays = new Set(input.symptoms.filter((s) => s.symptom === 'cravings').map((s) => s.day));
  const phasedDays = new Map<ISODate, CyclePhase>();
  const first = [...input.periods].sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
  const last = [...input.periods].sort((a, b) => a.start_date.localeCompare(b.start_date)).at(-1);
  if (first && last) {
    for (let d = first.start_date; d < last.start_date; d = addDays(d, 1)) {
      const ph = phaseOf(d, input.periods);
      if (ph) phasedDays.set(d, ph);
    }
  }
  const lutealDays = [...phasedDays].filter(([, p]) => p === 'luteal').map(([d]) => d);
  const otherDays = [...phasedDays].filter(([, p]) => p !== 'luteal').map(([d]) => d);
  const rate = (days: ISODate[]) => (days.length ? days.filter((d) => cravingDays.has(d)).length / days.length : 0);
  const lutealRate = rate(lutealDays);
  const otherRate = rate(otherDays);
  if (cravingDays.size >= 3 && lutealRate >= 2 * otherRate && lutealRate > 0.1) {
    out.push({ kind: 'cravings_luteal', lutealRate: Math.round(lutealRate * 100) / 100, otherRate: Math.round(otherRate * 100) / 100 });
  }

  // Acne within 2 days after a higher-sugar day (> 25 g added sugar) vs other days.
  const acneDays = new Set(input.symptoms.filter((s) => s.symptom === 'acne').map((s) => s.day));
  if (acneDays.size >= 3 && input.sugarByDay.length >= 14) {
    const hiSugar = input.sugarByDay.filter((s) => s.added_sugar_g > 25).map((s) => s.day);
    const loSugar = input.sugarByDay.filter((s) => s.added_sugar_g <= 25).map((s) => s.day);
    const acneAfter = (d: ISODate) => acneDays.has(addDays(d, 1)) || acneDays.has(addDays(d, 2));
    const a = hiSugar.length ? hiSugar.filter(acneAfter).length / hiSugar.length : 0;
    const b = loSugar.length ? loSugar.filter(acneAfter).length / loSugar.length : 0;
    if (hiSugar.length >= 3 && a >= 1.5 * b && a > 0.2) {
      out.push({ kind: 'sugar_acne', afterSugarRate: Math.round(a * 100) / 100, otherRate: Math.round(b * 100) / 100 });
    }
  }
  return out;
}
