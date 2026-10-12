import { describe, expect, it } from 'vitest';

import { completeStreak, dailyProgress, dayProgress } from '../src/core/progress.ts';
import { harness, onboard } from './helpers.ts';

const A = 'token-a';
const B = 'token-b';

type Progress = { percent: number; complete: boolean; food: { done: number; goal: number }; water: { done: number; goal: number }; steps: { done: number; goal: number } };
type Month = {
  month: string;
  today: string;
  goals: { meals: number; water_ml: number; steps: number };
  days: { day: string; percent: number; complete: boolean; meals: number; water_ml: number; steps: number }[];
  complete_days: number;
  streak: number;
};

describe('daily goal maths', () => {
  it('averages the three goals, each capped at 100%', () => {
    expect(dayProgress({ day: 'd', meals: 0, water_ml: 0, steps: 0 })).toMatchObject({ percent: 0, complete: false });
    expect(dayProgress({ day: 'd', meals: 3, water_ml: 1000, steps: 0 })).toMatchObject({ percent: 50, complete: false });
    // over-achieving one goal can't make up for another
    expect(dayProgress({ day: 'd', meals: 5, water_ml: 4000, steps: 0 }).percent).toBe(67);
    expect(dayProgress({ day: 'd', meals: 3, water_ml: 2000, steps: 5000 })).toMatchObject({ percent: 100, complete: true });
  });

  it('never rounds up to 100% before every goal is met', () => {
    expect(dayProgress({ day: 'd', meals: 3, water_ml: 2000, steps: 4990 })).toMatchObject({ percent: 99, complete: false });
  });

  it('counts meal slots, not food items, and zero-fills days', () => {
    const days = dailyProgress(
      [
        { day: '2026-10-07', meal: 'breakfast' },
        { day: '2026-10-07', meal: 'breakfast' },
        { day: '2026-10-07', meal: 'lunch' },
      ],
      [{ day: '2026-10-07', water_ml: 500, steps: null }],
      '2026-10-06',
      '2026-10-07',
    );
    expect(days.map((d) => [d.day, d.meals, d.water_ml, d.steps])).toEqual([
      ['2026-10-06', 0, 0, 0],
      ['2026-10-07', 2, 500, 0],
    ]);
  });

  it('streaks count complete days up to today, letting today still be in progress', () => {
    const p = (day: string, complete: boolean) => ({ day, complete, percent: complete ? 100 : 40, meals: 0, water_ml: 0, steps: 0 });
    const days = [p('2026-10-05', true), p('2026-10-06', true), p('2026-10-07', true), p('2026-10-08', false)];
    expect(completeStreak(days, '2026-10-08')).toBe(3);
    expect(completeStreak([...days.slice(0, 3), p('2026-10-08', true)], '2026-10-08')).toBe(4);
    expect(completeStreak(days, '2026-10-10')).toBe(0);
  });
});

describe('/today progress and /progress', () => {
  it("adds today's goal progress to /today", async () => {
    const h = await harness(); // 2026-10-08 10:00 IST
    await onboard(h);
    let t = await h.json<{ progress: Progress }>('/today', { token: A });
    expect(t.body.progress).toEqual({ percent: 0, complete: false, food: { done: 0, goal: 3 }, water: { done: 0, goal: 2000 }, steps: { done: 0, goal: 5000 } });

    for (const meal of ['breakfast', 'lunch', 'dinner']) {
      await h.json('/food/logs', { token: A, body: { items: [{ name: 'idli', quantity: 2, unit: null }], meal, day: '2026-10-08', source: 'manual' } });
    }
    await h.json('/today/water', { token: A, body: { day: '2026-10-08', ml: 2000 } });
    t = await h.json('/today', { token: A });
    expect(t.body.progress).toMatchObject({ percent: 67, complete: false, food: { done: 3 }, water: { done: 2000 } });

    await h.json('/walks', { token: A, body: { client_id: '11111111-1111-4111-8111-111111111111', started_at: '2026-10-08T03:00:00Z', duration_s: 3000, steps: 5200 } });
    t = await h.json('/today', { token: A });
    expect(t.body.progress).toMatchObject({ percent: 100, complete: true, steps: { done: 5200 } });
  });

  it('builds the month calendar with complete days and the streak', async () => {
    const h = await harness();
    await onboard(h);
    const completeDay = async (day: string, n: number) => {
      for (const meal of ['breakfast', 'lunch', 'dinner']) {
        await h.json('/food/logs', { token: A, body: { items: [{ name: 'idli', quantity: 1, unit: null }], meal, day, source: 'manual' } });
      }
      await h.json('/today/water', { token: A, body: { day, ml: 2000 } });
      await h.json('/walks', { token: A, body: { client_id: `1111111${n}-1111-4111-8111-111111111111`, started_at: `${day}T03:00:00Z`, duration_s: 3000, steps: 5000 } });
    };
    await completeDay('2026-09-30', 1);
    await completeDay('2026-10-06', 2);
    await completeDay('2026-10-07', 3);
    await h.json('/today/water', { token: A, body: { day: '2026-10-08', ml: 1000 } });

    const m = await h.json<Month>('/progress', { token: A });
    expect(m.status).toBe(200);
    expect(m.body.month).toBe('2026-10');
    expect(m.body.today).toBe('2026-10-08');
    expect(m.body.goals).toEqual({ meals: 3, water_ml: 2000, steps: 5000 });
    expect(m.body.days.map((d) => d.day)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08']);
    expect(m.body.days.filter((d) => d.complete).map((d) => d.day)).toEqual(['2026-10-06', '2026-10-07']);
    expect(m.body.days.at(-1)).toMatchObject({ percent: 17, complete: false, water_ml: 1000 });
    expect(m.body.complete_days).toBe(2);
    expect(m.body.streak).toBe(2);

    const sep = await h.json<Month>('/progress?month=2026-09', { token: A });
    expect(sep.body.days).toHaveLength(30);
    expect(sep.body.complete_days).toBe(1);
    expect((await h.json<Month>('/progress?month=2026-11', { token: A })).body.days).toEqual([]);
  });

  it('is private to each user and validates the month', async () => {
    const h = await harness();
    await onboard(h);
    await onboard(h, B);
    await h.json('/today/water', { token: A, body: { day: '2026-10-08', ml: 2000 } });
    expect((await h.json<Month>('/progress', { token: B })).body.days.at(-1)!.water_ml).toBe(0);
    expect((await h.req('/progress?month=2026-13', { token: A })).status).toBe(400);
    expect((await h.req('/progress?month=oct', { token: A })).status).toBe(400);
    expect((await h.req('/progress')).status).toBe(401);
  });
});
