// Walking dashboard maths: daily totals, today's progress towards the step goal, and the goal streak.
// Pure functions used by the /walks route.
import { addDays, type ISODate } from './dates.ts';

export const STEP_GOAL = 5000;

export interface WalkRow {
  day: ISODate;
  steps: number;
  duration_s: number;
}

export interface WalkDay {
  day: ISODate;
  steps: number;
  duration_s: number;
  sessions: number;
}

/** One entry per day from `from` to `to` (inclusive), zero-filled. */
export function dailyTotals(rows: WalkRow[], from: ISODate, to: ISODate): WalkDay[] {
  const byDay = new Map<ISODate, WalkDay>();
  for (let d = from; d <= to; d = addDays(d, 1)) byDay.set(d, { day: d, steps: 0, duration_s: 0, sessions: 0 });
  for (const r of rows) {
    const t = byDay.get(r.day);
    if (!t) continue;
    t.steps += r.steps;
    t.duration_s += r.duration_s;
    t.sessions += 1;
  }
  return [...byDay.values()];
}

/** Days in a row that reached the goal, ending today (or yesterday while today is still in progress). */
export function goalStreak(days: WalkDay[], today: ISODate, goal = STEP_GOAL): number {
  const steps = new Map(days.map((d) => [d.day, d.steps]));
  let d = (steps.get(today) ?? 0) >= goal ? today : addDays(today, -1);
  let n = 0;
  while ((steps.get(d) ?? 0) >= goal) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}
