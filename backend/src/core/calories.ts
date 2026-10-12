// Calorie summaries for the Food screen: today by meal, and per-day totals for this week (Monday on) and this month.
// Pure functions used by /food/calories. Foods without calorie data count as 0 and are reported separately.
import { addDays, type ISODate } from './dates.ts';
import { MEALS } from './schemas.ts';

type Meal = (typeof MEALS)[number];

/** A general daily guide when she hasn't set her own; not medical advice. */
export const DEFAULT_CALORIE_TARGET = 1800;

export interface KcalRow {
  day: ISODate;
  meal: Meal;
  kcal: number | null;
}

/** Monday of the week containing `day`. */
export function weekStart(day: ISODate): ISODate {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, -((dow + 6) % 7));
}

export function monthStart(day: ISODate): ISODate {
  return `${day.slice(0, 7)}-01`;
}

/** Per-day totals from `from` to `to`, zero-filled; the average is over days with any food logged. */
export function periodTotals(rows: KcalRow[], from: ISODate, to: ISODate) {
  const byDay = new Map<ISODate, number>();
  const logged = new Set<ISODate>();
  for (const r of rows) {
    if (r.day < from || r.day > to) continue;
    logged.add(r.day);
    byDay.set(r.day, (byDay.get(r.day) ?? 0) + (r.kcal ?? 0));
  }
  const days: { day: ISODate; kcal: number }[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push({ day: d, kcal: Math.round(byDay.get(d) ?? 0) });
  const total = days.reduce((n, d) => n + d.kcal, 0);
  const loggedDays = days.filter((d) => logged.has(d.day));
  return { from, days, total, average: loggedDays.length ? Math.round(loggedDays.reduce((n, d) => n + d.kcal, 0) / loggedDays.length) : null };
}

/** Today's total and per-meal totals, and how many items had no calorie data. */
export function todayByMeal(rows: KcalRow[], day: ISODate) {
  const today = rows.filter((r) => r.day === day);
  const by = new Map<Meal, number>();
  for (const r of today) by.set(r.meal, (by.get(r.meal) ?? 0) + (r.kcal ?? 0));
  return {
    day,
    kcal: Math.round(today.reduce((n, r) => n + (r.kcal ?? 0), 0)),
    by_meal: MEALS.filter((m) => by.has(m)).map((meal) => ({ meal, kcal: Math.round(by.get(meal)!) })),
    unknown_items: today.filter((r) => r.kcal == null).length,
  };
}
