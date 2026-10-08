// Cycle math. Pure functions only; the database and the LLM never compute these.
import { addDays, diffDays, type ISODate } from './dates.ts';

export type Confidence = 'low' | 'medium' | 'high';

export interface PeriodRow {
  start_date: ISODate;
  end_date: ISODate | null;
  flow?: 'spotting' | 'light' | 'medium' | 'heavy' | null;
  pain?: number | null;
}

export interface Prediction {
  earliest: ISODate;
  likely: ISODate;
  latest: ISODate;
  confidence: Confidence;
  cyclesUsed: number;
  medianLength: number;
  spread: number;
}

export const MIN_CYCLE_LENGTH = 15;
export const MAX_CYCLES_USED = 6;
export const DEFAULT_CYCLE_LENGTH = 35;
/** With fewer than 2 usable cycles there is no measured variability, so use a wider window. */
export const SPARSE_DATA_SPREAD = 7;
export const AUTO_CLOSE_DAYS = 10;

/** Days between consecutive starts, oldest first. Includes short (<15 day) lengths. */
export function cycleLengths(startDates: ISODate[]): number[] {
  const sorted = [...new Set(startDates)].sort();
  const out: number[] = [];
  for (let i = 1; i < sorted.length; i++) out.push(diffDays(sorted[i - 1]!, sorted[i]!));
  return out;
}

/** Lengths used for prediction: drop < 15 days (likely spotting), keep the most recent 6. */
export function usableLengths(lengths: number[]): number[] {
  return lengths.filter((l) => l >= MIN_CYCLE_LENGTH).slice(-MAX_CYCLES_USED);
}

export function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Quantile with linear interpolation (same as numpy's default). */
export function quantile(xs: number[], q: number): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo]! + (s[hi]! - s[lo]!) * (pos - lo);
}

export function iqr(xs: number[]): number {
  return xs.length < 2 ? 0 : quantile(xs, 0.75) - quantile(xs, 0.25);
}

/** Sample standard deviation. */
export function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

export function confidenceFor(cycles: number, spread: number): Confidence {
  if (cycles >= 6 && spread <= 4) return 'high';
  if (cycles >= 3 && spread <= 8) return 'medium';
  return 'low';
}

/**
 * Next-period window from logged start dates.
 * Returns null when there is no start date at all (nothing to anchor on).
 */
export function predictNextPeriod(
  startDates: ISODate[],
  typicalCycleLength: number | null,
): Prediction | null {
  if (startDates.length === 0) return null;
  const lastStart = [...startDates].sort().at(-1)!;
  const lengths = usableLengths(cycleLengths(startDates));

  let medianLength: number;
  let spread: number;
  let confidence: Confidence;
  if (lengths.length === 0) {
    medianLength = typicalCycleLength ?? DEFAULT_CYCLE_LENGTH;
    spread = SPARSE_DATA_SPREAD;
    confidence = 'low';
  } else {
    medianLength = Math.round(median(lengths));
    spread = Math.max(3, Math.round(iqr(lengths)), Math.ceil(stdDev(lengths)));
    if (lengths.length < 2) spread = Math.max(spread, SPARSE_DATA_SPREAD);
    confidence = confidenceFor(lengths.length, spread);
  }

  return {
    earliest: addDays(lastStart, medianLength - spread),
    likely: addDays(lastStart, medianLength),
    latest: addDays(lastStart, medianLength + spread),
    confidence,
    cyclesUsed: lengths.length,
    medianLength,
    spread,
  };
}

export type Phase = 'menstrual' | 'follicular' | 'luteal' | 'late' | 'unknown';

export type CycleStatus =
  | { kind: 'none' }
  | { kind: 'period'; periodDay: number; cycleDay: number; phase: 'menstrual' }
  | { kind: 'cycle'; cycleDay: number; phase: Phase }
  | { kind: 'late'; cycleDay: number; daysLate: number; phase: 'late' };

/**
 * Where she is today. Phase is a rough guide (luteal ≈ the 14 days before the likely start);
 * ovulation and fertile windows are deliberately not computed.
 */
export function cycleStatus(
  today: ISODate,
  periods: PeriodRow[],
  prediction: Prediction | null,
): CycleStatus {
  if (periods.length === 0) return { kind: 'none' };
  const sorted = [...periods].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const last = sorted.at(-1)!;
  const cycleDay = diffDays(last.start_date, today) + 1;
  if (cycleDay < 1) return { kind: 'none' };

  const ongoing = last.end_date === null ? cycleDay <= AUTO_CLOSE_DAYS : today <= last.end_date;
  if (ongoing) return { kind: 'period', periodDay: cycleDay, cycleDay, phase: 'menstrual' };

  if (prediction && today > prediction.latest) {
    return { kind: 'late', cycleDay, daysLate: diffDays(prediction.latest, today), phase: 'late' };
  }
  if (!prediction) return { kind: 'cycle', cycleDay, phase: 'unknown' };
  const daysToLikely = diffDays(today, prediction.likely);
  return { kind: 'cycle', cycleDay, phase: daysToLikely <= 14 ? 'luteal' : 'follicular' };
}

export function shouldAutoClose(openStart: ISODate, today: ISODate): boolean {
  return diffDays(openStart, today) >= AUTO_CLOSE_DAYS;
}

/** Delay check-ins happen once when late, then at 7 and 14 days late — never daily. */
export function dueDelayKey(daysLate: number): 'late-0' | 'late-7' | 'late-14' | null {
  if (daysLate >= 14) return 'late-14';
  if (daysLate >= 7) return 'late-7';
  if (daysLate >= 1) return 'late-0';
  return null;
}

// ---------------------------------------------------------------- contributing factors

export type FactorId =
  | 'high_stress'
  | 'poor_sleep'
  | 'weight_change'
  | 'exercise_change'
  | 'illness_or_travel'
  | 'medication_change'
  | 'low_intake_days'
  | 'usual_pattern';

export interface FactorInput {
  expectedStart: ISODate; // prediction.likely
  today: ISODate;
  lastStart: ISODate;
  historyLengths: number[]; // all past cycle lengths
  moods: { day: ISODate; stress: number | null }[];
  lifestyle: {
    day: ISODate;
    sleep_hours: number | null;
    exercise_minutes: number | null;
    illness: boolean | null;
    travel: boolean | null;
  }[];
  weights: { day: ISODate; weight_kg: number }[];
  medications: { start_date: ISODate | null; end_date: ISODate | null }[];
  intakeByDay: { day: ISODate; kcal: number }[];
}

export const FACTOR_WINDOW_DAYS = 45;

function inWindow(day: ISODate | null, from: ISODate, to: ISODate): boolean {
  return day !== null && day >= from && day <= to;
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}

/** Things that may have played a role in a late period. Never presented as a cause. */
export function contributingFactors(input: FactorInput): FactorId[] {
  const to = input.expectedStart < input.today ? input.expectedStart : input.today;
  const from = addDays(input.expectedStart, -FACTOR_WINDOW_DAYS);
  const out: FactorId[] = [];

  // High stress: per-day mean stress >= 4 on at least 7 days.
  const stressByDay = new Map<ISODate, number[]>();
  for (const m of input.moods) {
    if (m.stress === null || !inWindow(m.day, from, to)) continue;
    stressByDay.set(m.day, [...(stressByDay.get(m.day) ?? []), m.stress]);
  }
  if ([...stressByDay.values()].filter((v) => mean(v) >= 4).length >= 7) out.push('high_stress');

  const life = input.lifestyle.filter((l) => inWindow(l.day, from, to));

  // Poor sleep: mean < 6 h across 14+ logged days.
  const sleep = life.map((l) => l.sleep_hours).filter((s): s is number => s !== null);
  if (sleep.length >= 14 && mean(sleep) < 6) out.push('poor_sleep');

  // Weight change >= 5% between earliest and latest log in the window.
  const w = input.weights.filter((x) => inWindow(x.day, from, to)).sort((a, b) => a.day.localeCompare(b.day));
  if (w.length >= 2) {
    const first = w[0]!.weight_kg;
    const last = w.at(-1)!.weight_kg;
    if (Math.abs(last - first) / first >= 0.05) out.push('weight_change');
  }

  // Exercise: last 7 days at least double the weekly average of the 4 weeks before.
  const recentFrom = addDays(to, -6);
  const priorFrom = addDays(to, -34);
  const priorTo = addDays(to, -7);
  const minutes = (a: ISODate, b: ISODate) =>
    life.filter((l) => inWindow(l.day, a, b)).reduce((s, l) => s + (l.exercise_minutes ?? 0), 0);
  const recent = minutes(recentFrom, to);
  const priorWeekly = minutes(priorFrom, priorTo) / 4;
  if (priorWeekly > 0 && recent >= 2 * priorWeekly) out.push('exercise_change');

  if (life.some((l) => l.illness || l.travel)) out.push('illness_or_travel');

  if (input.medications.some((m) => inWindow(m.start_date, from, to) || inWindow(m.end_date, from, to))) {
    out.push('medication_change');
  }

  // Low intake: 5+ logged days far below her own average (< 60%). Needs 10+ logged days to mean anything.
  const intake = input.intakeByDay.filter((d) => inWindow(d.day, from, to) && d.kcal > 0);
  if (intake.length >= 10) {
    const avg = mean(intake.map((d) => d.kcal));
    if (intake.filter((d) => d.kcal < 0.6 * avg).length >= 5) out.push('low_intake_days');
  }

  // Usual pattern: she has had a cycle at least this long before.
  const currentLength = diffDays(input.lastStart, input.today);
  if (input.historyLengths.some((l) => l >= currentLength)) out.push('usual_pattern');

  return out;
}

// ---------------------------------------------------------------- red flags

export type RedFlagRule =
  | 'no_period_90'
  | 'heavy_bleeding'
  | 'long_bleeding'
  | 'intermenstrual_bleeding'
  | 'severe_pelvic_pain'
  | 'fainting';

export interface RedFlag {
  rule: RedFlagRule;
  key: string; // dedupe key for the insights table
}

export interface RedFlagInput {
  today: ISODate;
  periods: PeriodRow[];
  symptoms: { day: ISODate; symptom: string; severity: number }[];
}

function inAnyPeriod(day: ISODate, periods: PeriodRow[], today: ISODate): boolean {
  return periods.some((p) => day >= p.start_date && day <= (p.end_date ?? today));
}

export function redFlags(input: RedFlagInput): RedFlag[] {
  const { today, periods, symptoms } = input;
  const out: RedFlag[] = [];
  const sorted = [...periods].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const last = sorted.at(-1);

  if (last && last.end_date !== null && diffDays(last.start_date, today) >= 90) {
    out.push({ rule: 'no_period_90', key: `no_period_90:${last.start_date}` });
  }

  for (const p of sorted) {
    if (p.flow === 'heavy' && (p.pain ?? 0) >= 8) {
      out.push({ rule: 'heavy_bleeding', key: `heavy_bleeding:${p.start_date}` });
    }
    const length = diffDays(p.start_date, p.end_date ?? today) + 1;
    if (length > 8) out.push({ rule: 'long_bleeding', key: `long_bleeding:${p.start_date}` });
  }

  // Bleeding between periods on 3+ days within the current cycle.
  if (last) {
    const spottingDays = new Set(
      symptoms
        .filter((s) => s.symptom === 'spotting' && s.day > last.start_date && !inAnyPeriod(s.day, sorted, today))
        .map((s) => s.day),
    );
    if (spottingDays.size >= 3) {
      out.push({ rule: 'intermenstrual_bleeding', key: `intermenstrual:${last.start_date}` });
    }
  }

  for (const s of symptoms) {
    if (s.symptom === 'pelvic_pain' && s.severity >= 3 && !inAnyPeriod(s.day, sorted, today)) {
      out.push({ rule: 'severe_pelvic_pain', key: `pelvic_pain:${s.day}` });
    }
    if (s.symptom === 'fainting') out.push({ rule: 'fainting', key: `fainting:${s.day}` });
  }

  // De-duplicate keys (several symptoms on one day).
  return out.filter((f, i) => out.findIndex((g) => g.key === f.key) === i);
}
