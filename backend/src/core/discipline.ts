// Overall progress ("discipline") from everything she logs. Each day, each habit scores 0–1: meals (3 logged),
// water (2 L), steps (the step goal), medicine doses taken (only on days doses were due), a mood check-in and
// sleep logged. The day's score is the average of the habits that applied, as a percentage. This week (the
// last 7 full days) is compared with the week before: 5 points or more is a real change, less is steady.
// Pure functions used by /overview.
import { addDays, type ISODate } from './dates.ts';
import { DAILY_GOALS } from './progress.ts';

export const FACTORS = ['meals', 'water', 'steps', 'meds', 'checkin', 'sleep'] as const;
export type Factor = (typeof FACTORS)[number];
export type Trend = 'up' | 'down' | 'steady';

/** Points of change (out of 100) that count as up or down. */
export const TREND_POINTS = 5;

export interface DayFacts {
  day: ISODate;
  meals: number;
  water_ml: number;
  steps: number;
  doses_due: number;
  doses_taken: number;
  mood_logged: boolean;
  sleep_logged: boolean;
}

export function dayFactors(f: DayFacts): Partial<Record<Factor, number>> {
  const part = (x: number) => Math.min(1, Math.max(0, x));
  return {
    meals: part(f.meals / DAILY_GOALS.meals),
    water: part(f.water_ml / DAILY_GOALS.water_ml),
    steps: part(f.steps / DAILY_GOALS.steps),
    ...(f.doses_due > 0 ? { meds: part(f.doses_taken / f.doses_due) } : {}),
    checkin: f.mood_logged ? 1 : 0,
    sleep: f.sleep_logged ? 1 : 0,
  };
}

export function dayScore(f: DayFacts): number {
  const parts = Object.values(dayFactors(f));
  return Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100);
}

export function trendOf(now: number | null, before: number | null): Trend {
  if (now == null || before == null) return 'steady';
  return now - before >= TREND_POINTS ? 'up' : before - now >= TREND_POINTS ? 'down' : 'steady';
}

const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

/**
 * `facts` must cover today-29 … today (missing days count as nothing logged). Returns today's score so far,
 * this week vs last week, each habit's week-on-week trend, the 30-day series and how many days had any log.
 */
export function overview(facts: DayFacts[], today: ISODate) {
  const byDay = new Map(facts.map((f) => [f.day, f]));
  const empty = (day: ISODate): DayFacts => ({ day, meals: 0, water_ml: 0, steps: 0, doses_due: 0, doses_taken: 0, mood_logged: false, sleep_logged: false });
  const get = (day: ISODate) => byDay.get(day) ?? empty(day);
  const range = (from: ISODate, to: ISODate) => {
    const out: DayFacts[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) out.push(get(d));
    return out;
  };

  const yesterday = addDays(today, -1);
  const thisWeek = range(addDays(yesterday, -6), yesterday);
  const lastWeek = range(addDays(yesterday, -13), addDays(yesterday, -7));
  const week = mean(thisWeek.map(dayScore));
  const previous = mean(lastWeek.map(dayScore));

  const factorAvg = (days: DayFacts[], k: Factor) => {
    const xs = days.map((d) => dayFactors(d)[k]).filter((x): x is number => x !== undefined);
    return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) : null;
  };
  const factors = FACTORS.map((key) => {
    const score = factorAvg(thisWeek, key);
    const prev = factorAvg(lastWeek, key);
    return { key, score, previous: prev, trend: trendOf(score, prev) };
  }).filter((f) => f.score != null || f.previous != null);

  const month = range(addDays(today, -29), today);
  const logged = (f: DayFacts) => f.meals > 0 || f.water_ml > 0 || f.steps > 0 || f.doses_taken > 0 || f.mood_logged || f.sleep_logged;
  return {
    today,
    today_score: dayScore(get(today)),
    week: { score: week ?? 0, previous: previous ?? 0, change: (week ?? 0) - (previous ?? 0), trend: trendOf(week, previous) },
    factors,
    days: month.map((f) => ({ day: f.day, score: dayScore(f) })),
    active_days: month.filter(logged).length,
  };
}
