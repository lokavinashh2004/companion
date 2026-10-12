import { describe, expect, it } from 'vitest';

import { monthStart, periodTotals, todayByMeal, weekStart } from '../src/core/calories.ts';
import { harness, onboard } from './helpers.ts';

const A = 'token-a';

type Calories = {
  hidden: boolean;
  target: number;
  target_is_default: boolean;
  today: { day: string; kcal: number; by_meal: { meal: string; kcal: number }[]; unknown_items: number } | null;
  week: { from: string; days: { day: string; kcal: number }[]; total: number; average: number | null } | null;
  month: { from: string; days: { day: string; kcal: number }[]; total: number; average: number | null } | null;
};

describe('calorie maths', () => {
  it('weeks start on Monday and months on the 1st', () => {
    expect(weekStart('2026-10-08')).toBe('2026-10-05'); // Thursday → Monday
    expect(weekStart('2026-10-05')).toBe('2026-10-05');
    expect(weekStart('2026-10-11')).toBe('2026-10-05'); // Sunday belongs to the week before
    expect(monthStart('2026-10-08')).toBe('2026-10-01');
  });

  it('totals per day, averaging only days with food logged', () => {
    const rows = [
      { day: '2026-10-05', meal: 'breakfast' as const, kcal: 300 },
      { day: '2026-10-05', meal: 'lunch' as const, kcal: 500 },
      { day: '2026-10-07', meal: 'dinner' as const, kcal: 400 },
      { day: '2026-10-07', meal: 'snack' as const, kcal: null },
    ];
    const p = periodTotals(rows, '2026-10-05', '2026-10-08');
    expect(p.days).toEqual([
      { day: '2026-10-05', kcal: 800 },
      { day: '2026-10-06', kcal: 0 },
      { day: '2026-10-07', kcal: 400 },
      { day: '2026-10-08', kcal: 0 },
    ]);
    expect(p.total).toBe(1200);
    expect(p.average).toBe(600);
    expect(periodTotals([], '2026-10-05', '2026-10-06').average).toBeNull();
    expect(todayByMeal(rows, '2026-10-07')).toEqual({ day: '2026-10-07', kcal: 400, by_meal: [{ meal: 'snack', kcal: 0 }, { meal: 'dinner', kcal: 400 }], unknown_items: 1 });
  });
});

describe('/food/calories, /food/search, /food/estimate', () => {
  it('sends no numbers while calories are off, then today, week and month against her guide', async () => {
    const h = await harness(); // Thu 2026-10-08
    await onboard(h);
    await h.json('/food/logs', { token: A, body: { items: [{ name: 'idli', quantity: 3, unit: null }], meal: 'breakfast', day: '2026-10-08', source: 'manual' } });
    await h.json('/food/logs', { token: A, body: { items: [{ name: 'dosai', quantity: 2, unit: null }], meal: 'dinner', day: '2026-10-06', source: 'manual' } });
    await h.json('/food/logs', { token: A, body: { items: [{ name: 'idli', quantity: 2, unit: null }], meal: 'breakfast', day: '2026-10-02', source: 'manual' } });

    let c = await h.json<Calories>('/food/calories', { token: A });
    expect(c.body).toEqual({ hidden: true, target: 1800, target_is_default: true, today: null, week: null, month: null });

    await h.json('/me', { method: 'PATCH', token: A, body: { calorie_display: 'show', calorie_target: 1600 } });
    c = await h.json<Calories>('/food/calories', { token: A });
    expect(c.body.hidden).toBe(false);
    expect(c.body.target).toBe(1600);
    expect(c.body.target_is_default).toBe(false);
    const idli3 = c.body.today!.kcal;
    expect(idli3).toBeGreaterThan(0);
    expect(c.body.today!.by_meal).toEqual([{ meal: 'breakfast', kcal: idli3 }]);
    expect(c.body.week!.from).toBe('2026-10-05');
    expect(c.body.week!.days.map((d) => d.day)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08']);
    expect(c.body.week!.days[1]!.kcal).toBeGreaterThan(0);
    expect(c.body.month!.from).toBe('2026-10-01');
    expect(c.body.month!.days).toHaveLength(8);
    expect(c.body.month!.total).toBe(c.body.month!.days.reduce((n, d) => n + d.kcal, 0));
    expect(c.body.month!.total).toBeGreaterThan(c.body.week!.total);
    // average over the 3 days with food logged, not all 8
    expect(c.body.month!.average).toBe(Math.round(c.body.month!.total / 3));
  });

  it('rejects an out-of-range calorie guide', async () => {
    const h = await harness();
    await onboard(h);
    expect((await h.req('/me', { method: 'PATCH', token: A, body: { calorie_target: 500 } })).status).toBe(400);
    expect((await h.json<{ calorie_target: number | null }>('/me', { method: 'PATCH', token: A, body: { calorie_target: null } })).body.calorie_target).toBeNull();
  });

  it('suggests known foods as she types', async () => {
    const h = await harness();
    await onboard(h);
    const r = await h.json<{ results: { name: string; kcal_per_100g: number; piece_g: number | null }[] }>('/food/search?q=idl', { token: A });
    expect(r.status).toBe(200);
    expect(r.body.results.length).toBeGreaterThan(0);
    expect(r.body.results.length).toBeLessThanOrEqual(8);
    expect(r.body.results[0]!.name.startsWith('idl')).toBe(true);
    expect(r.body.results[0]!.kcal_per_100g).toBeGreaterThan(0);
    expect((await h.json<{ results: unknown[] }>('/food/search?q=zzzzqq', { token: A })).body.results).toEqual([]);
  });

  it('previews calories from quantity and unit without saving, scaling with size', async () => {
    const h = await harness();
    await onboard(h);
    const est = (body: object) => h.json<{ found: boolean; grams: number; kcal: number; is_estimate: boolean }>('/food/estimate', { token: A, body });
    const one = (await est({ name: 'idli', quantity: 1, unit: null })).body;
    const three = (await est({ name: 'idli', quantity: 3, unit: null })).body;
    expect(one.found).toBe(true);
    expect(three.grams).toBe(one.grams * 3);
    expect(Math.abs(three.kcal - one.kcal * 3)).toBeLessThanOrEqual(1);
    const big = (await est({ name: 'periya dosai', quantity: 2, unit: null })).body;
    const plain = (await est({ name: 'dosai', quantity: 2, unit: null })).body;
    expect(big.grams).toBe(Math.round(plain.grams * 1.4));
    expect((await est({ name: 'idli', quantity: 200, unit: 'g' })).status).toBe(400); // quantity over 50
    expect((await est({ name: 'white rice', quantity: 0.5, unit: 'kg' })).body).toMatchObject({ found: true, grams: 500 });
    expect((await est({ name: 'idli', quantity: 1, unit: 'bucket' })).body.is_estimate).toBe(true);
    expect((await est({ name: 'mystery stew from mars', quantity: 1, unit: null })).body).toEqual({ found: false, name: null, grams: null, kcal: null, is_estimate: true });
    // nothing was saved, and no AI request was spent
    expect((await h.json<{ foods: unknown[] }>('/today', { token: A })).body.foods).toEqual([]);
    expect(h.llm.calls).toHaveLength(0);
  });
});
