import { describe, expect, it } from 'vitest';

import { addDays } from '../src/core/dates.ts';
import { dayFactors, dayScore, overview, trendOf, type DayFacts } from '../src/core/discipline.ts';
import { harness, onboard } from './helpers.ts';

const A = 'token-a';
const TODAY = '2026-10-08';

const facts = (day: string, o: Partial<DayFacts> = {}): DayFacts => ({
  day,
  meals: 0,
  water_ml: 0,
  steps: 0,
  doses_due: 0,
  doses_taken: 0,
  mood_logged: false,
  sleep_logged: false,
  ...o,
});
const perfect = (day: string) => facts(day, { meals: 3, water_ml: 2000, steps: 5000, mood_logged: true, sleep_logged: true });

type Overview = {
  today: string;
  today_score: number;
  week: { score: number; previous: number; change: number; trend: string };
  factors: { key: string; score: number | null; previous: number | null; trend: string }[];
  days: { day: string; score: number }[];
  active_days: number;
};

describe('discipline maths', () => {
  it('scores a day from the habits that applied', () => {
    expect(dayScore(facts(TODAY))).toBe(0);
    expect(dayScore(perfect(TODAY))).toBe(100);
    // 5 habits (no medicines due): meals 2/3, water 1/2, steps 0, mood 1, sleep 0
    expect(dayScore(facts(TODAY, { meals: 2, water_ml: 1000, mood_logged: true }))).toBe(43);
    // medicines only count on days doses were due
    expect(dayFactors(facts(TODAY)).meds).toBeUndefined();
    expect(dayFactors(facts(TODAY, { doses_due: 2, doses_taken: 1 })).meds).toBe(0.5);
    expect(dayScore({ ...perfect(TODAY), doses_due: 2, doses_taken: 0 })).toBe(83);
  });

  it('calls a change of 5 points or more up or down', () => {
    expect(trendOf(60, 54)).toBe('up');
    expect(trendOf(60, 55)).toBe('up');
    expect(trendOf(60, 56)).toBe('steady');
    expect(trendOf(50, 55)).toBe('down');
    expect(trendOf(null, 40)).toBe('steady');
  });

  it('compares the last 7 full days with the 7 before, per habit too', () => {
    const days: DayFacts[] = [];
    // the week before: only water, every day
    for (let i = 8; i <= 14; i++) days.push(facts(addDays(TODAY, -i), { water_ml: 2000 }));
    // this week: everything, every day
    for (let i = 1; i <= 7; i++) days.push(perfect(addDays(TODAY, -i)));
    // today (in progress) doesn't count towards the week
    days.push(facts(TODAY, { water_ml: 500 }));
    const o = overview(days, TODAY);
    expect(o.week).toEqual({ score: 100, previous: 20, change: 80, trend: 'up' });
    expect(o.today_score).toBe(5);
    expect(o.factors.find((f) => f.key === 'water')).toEqual({ key: 'water', score: 100, previous: 100, trend: 'steady' });
    expect(o.factors.find((f) => f.key === 'steps')).toEqual({ key: 'steps', score: 100, previous: 0, trend: 'up' });
    expect(o.factors.some((f) => f.key === 'meds')).toBe(false); // no medicines at all
    expect(o.days).toHaveLength(30);
    expect(o.days[0]!.day).toBe(addDays(TODAY, -29));
    expect(o.days.at(-1)).toEqual({ day: TODAY, score: 5 });
    expect(o.active_days).toBe(15);
  });

  it('shows a slip as down', () => {
    const days: DayFacts[] = [];
    for (let i = 8; i <= 14; i++) days.push(perfect(addDays(TODAY, -i)));
    for (let i = 1; i <= 7; i++) days.push(facts(addDays(TODAY, -i), { meals: 3, water_ml: 2000 }));
    expect(overview(days, TODAY).week).toMatchObject({ score: 40, previous: 100, change: -60, trend: 'down' });
  });
});

describe('/overview', () => {
  it('builds the dashboard from food, water, steps, mood, sleep and medicine logs', async () => {
    const h = await harness(); // Thu 2026-10-08, 10:00 IST
    await onboard(h, A, { medications: [{ name: 'Metformin', dose: '500 mg', schedule_times: ['08:00'] }] });
    const med = (await h.json<{ medications: { id: string }[] }>('/meds', { token: A })).body.medications[0]!;

    // last week: nothing. This week: water and a mood check-in on 3 days.
    for (const day of ['2026-10-05', '2026-10-06', '2026-10-07']) {
      await h.json('/today/water', { token: A, body: { day, ml: 2000 } });
      await h.json('/today/quick-log', { token: A, body: { day, mood: 4 } });
    }
    // today: breakfast, sleep and the morning dose
    await h.json('/food/logs', { token: A, body: { items: [{ name: 'idli', quantity: 2, unit: null }], meal: 'breakfast', day: TODAY, source: 'manual' } });
    await h.json('/today/quick-log', { token: A, body: { day: TODAY, sleep_hours: 7 } });
    await h.json(`/meds/${med.id}/dose`, { token: A, body: { day: TODAY, time: '08:00', taken: true } });

    const o = await h.json<Overview>('/overview', { token: A });
    expect(o.status).toBe(200);
    expect(o.body.today).toBe(TODAY);
    // this week: 3 days × (water 1 + check-in 1) of 5 habits = 40 each, 4 empty days → round(120 / 7)
    expect(o.body.week).toEqual({ score: 17, previous: 0, change: 17, trend: 'up' });
    expect(o.body.factors.find((f) => f.key === 'water')).toMatchObject({ score: 43, previous: 0, trend: 'up' });
    expect(o.body.factors.find((f) => f.key === 'checkin')).toMatchObject({ score: 43, trend: 'up' });
    // the medicine was added today, so it only counts from today (not in the past weeks)
    expect(o.body.factors.some((f) => f.key === 'meds')).toBe(false);
    // today: meals 1/3, water 0, steps 0, meds 1/1, check-in 0, sleep 1 → round(2.333 / 6 × 100)
    expect(o.body.today_score).toBe(39);
    expect(o.body.days).toHaveLength(30);
    expect(o.body.active_days).toBe(4);
  });

  it('starts at zero for a new user', async () => {
    const h = await harness();
    await onboard(h);
    const o = await h.json<Overview>('/overview', { token: A });
    expect(o.body).toMatchObject({ today_score: 0, week: { score: 0, previous: 0, change: 0, trend: 'steady' }, active_days: 0 });
    expect((await h.req('/overview')).status).toBe(401);
  });
});
