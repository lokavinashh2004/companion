// Daily goals: 3 meals logged, 8 glasses of water and the step goal. A day's progress is the average of the three
// (each capped at 100%); a day is complete only when all three are met. Pure functions used by /today and /progress.
import { addDays, type ISODate } from './dates.ts';
import { STEP_GOAL } from './walks.ts';

export const DAILY_GOALS = { meals: 3, water_ml: 2000, steps: STEP_GOAL } as const;

export interface DayTotals {
  day: ISODate;
  /** distinct meal slots with at least one food logged */
  meals: number;
  water_ml: number;
  steps: number;
}

export interface DayProgress extends DayTotals {
  percent: number;
  complete: boolean;
}

export function dayProgress(t: DayTotals): DayProgress {
  const parts = [t.meals / DAILY_GOALS.meals, t.water_ml / DAILY_GOALS.water_ml, t.steps / DAILY_GOALS.steps].map((x) => Math.min(1, Math.max(0, x)));
  const complete = parts.every((x) => x >= 1);
  // Never show 100% unless every goal is met (rounding could otherwise reach it at 99.6%).
  const percent = complete ? 100 : Math.min(99, Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100));
  return { ...t, percent, complete };
}

/** Per-day totals from food logs (meal slots) and lifestyle rows (water, steps), zero-filled from `from` to `to`. */
export function dailyProgress(
  foods: { day: ISODate; meal: string }[],
  lifestyle: { day: ISODate; water_ml: number | null; steps: number | null }[],
  from: ISODate,
  to: ISODate,
): DayProgress[] {
  const meals = new Map<ISODate, Set<string>>();
  for (const f of foods) {
    if (!meals.has(f.day)) meals.set(f.day, new Set());
    meals.get(f.day)!.add(f.meal);
  }
  const life = new Map(lifestyle.map((l) => [l.day, l]));
  const out: DayProgress[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const l = life.get(d);
    out.push(dayProgress({ day: d, meals: meals.get(d)?.size ?? 0, water_ml: l?.water_ml ?? 0, steps: l?.steps ?? 0 }));
  }
  return out;
}

/** Complete days in a row, ending today (or yesterday while today is still in progress). */
export function completeStreak(days: DayProgress[], today: ISODate): number {
  const done = new Set(days.filter((d) => d.complete).map((d) => d.day));
  let d = done.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (done.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}
