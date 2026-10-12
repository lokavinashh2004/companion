import { describe, expect, it } from 'vitest';

import { dailyTotals, goalStreak } from '../src/core/walks.ts';
import { harness, onboard } from './helpers.ts';

const A = 'token-a';
const B = 'token-b';
const ID1 = '11111111-1111-4111-8111-111111111111';
const ID2 = '22222222-2222-4222-8222-222222222222';
const ID3 = '33333333-3333-4333-8333-333333333333';

type Walks = {
  today: string;
  goal: number;
  weight_kg: number | null;
  days: { day: string; steps: number; sessions: number; duration_s: number }[];
  streak: number;
  totals: { steps: number; duration_s: number; sessions: number; active_days: number; goal_days: number };
  best: { day: string; steps: number } | null;
  recent: { id: string; day: string; steps: number }[];
};

describe('walk maths', () => {
  it('zero-fills days and sums sessions', () => {
    const days = dailyTotals(
      [
        { day: '2026-10-07', steps: 1200, duration_s: 600 },
        { day: '2026-10-07', steps: 800, duration_s: 400 },
        { day: '2026-09-01', steps: 9999, duration_s: 1 },
      ],
      '2026-10-06',
      '2026-10-08',
    );
    expect(days).toEqual([
      { day: '2026-10-06', steps: 0, duration_s: 0, sessions: 0 },
      { day: '2026-10-07', steps: 2000, duration_s: 1000, sessions: 2 },
      { day: '2026-10-08', steps: 0, duration_s: 0, sessions: 0 },
    ]);
  });

  it('counts the goal streak, letting today still be in progress', () => {
    const d = (day: string, steps: number) => ({ day, steps, duration_s: 0, sessions: 1 });
    const days = [d('2026-10-05', 6000), d('2026-10-06', 3000), d('2026-10-07', 5000), d('2026-10-08', 200)];
    expect(goalStreak(days, '2026-10-08')).toBe(1);
    expect(goalStreak([...days.slice(0, 3), d('2026-10-08', 7000)], '2026-10-08')).toBe(2);
    expect(goalStreak(days, '2026-10-10')).toBe(0);
  });
});

describe('/walks', () => {
  it('saves walks, adds steps to the day, and builds the dashboard', async () => {
    const h = await harness(); // 2026-10-08 10:00 IST
    await onboard(h);
    const w1 = await h.json<{ id: string; day: string }>('/walks', { token: A, body: { client_id: ID1, started_at: '2026-10-08T03:00:00Z', duration_s: 1800, steps: 3200 } });
    expect(w1.status).toBe(200);
    expect(w1.body.day).toBe('2026-10-08');
    // 23:00 IST on the 7th is still the 7th in her timezone
    await h.json('/walks', { token: A, body: { client_id: ID2, started_at: '2026-10-07T17:30:00Z', duration_s: 3000, steps: 6100 } });
    await h.json('/today/weight', { token: A, body: { day: '2026-10-08', weight_kg: 62 } });

    const today = await h.json<{ lifestyle: { steps: number } }>('/today', { token: A });
    expect(today.body.lifestyle.steps).toBe(3200);

    const d = await h.json<Walks>('/walks?days=7', { token: A });
    expect(d.status).toBe(200);
    expect(d.body.today).toBe('2026-10-08');
    expect(d.body.goal).toBe(5000);
    expect(d.body.weight_kg).toBe(62);
    expect(d.body.days).toHaveLength(7);
    expect(d.body.days.at(-1)).toEqual({ day: '2026-10-08', steps: 3200, duration_s: 1800, sessions: 1 });
    expect(d.body.days.at(-2)!.steps).toBe(6100);
    expect(d.body.streak).toBe(1);
    expect(d.body.totals).toEqual({ steps: 9300, duration_s: 4800, sessions: 2, active_days: 2, goal_days: 1 });
    expect(d.body.best).toMatchObject({ day: '2026-10-07', steps: 6100 });
    expect(d.body.recent.map((r) => r.steps)).toEqual([3200, 6100]);
  });

  it('a retried save is stored once', async () => {
    const h = await harness();
    await onboard(h);
    const body = { client_id: ID1, started_at: '2026-10-08T03:00:00Z', duration_s: 600, steps: 900 };
    const a = await h.json<{ id: string }>('/walks', { token: A, body });
    const b = await h.json<{ id: string }>('/walks', { token: A, body });
    expect(b.body.id).toBe(a.body.id);
    expect((await h.json<Walks>('/walks', { token: A })).body.totals.sessions).toBe(1);
    expect((await h.json<{ lifestyle: { steps: number } }>('/today', { token: A })).body.lifestyle.steps).toBe(900);
  });

  it('deleting a walk takes its steps off the day', async () => {
    const h = await harness();
    await onboard(h);
    const w = await h.json<{ id: string }>('/walks', { token: A, body: { client_id: ID1, started_at: '2026-10-08T03:00:00Z', duration_s: 600, steps: 900 } });
    await h.json('/walks', { token: A, body: { client_id: ID3, started_at: '2026-10-08T04:00:00Z', duration_s: 300, steps: 400 } });
    expect((await h.req(`/walks/${w.body.id}`, { method: 'DELETE', token: A })).status).toBe(200);
    expect((await h.json<{ lifestyle: { steps: number } }>('/today', { token: A })).body.lifestyle.steps).toBe(400);
    expect((await h.req(`/walks/${w.body.id}`, { method: 'DELETE', token: A })).status).toBe(404);
  });

  it('keeps walks private to each user and rejects bad input', async () => {
    const h = await harness();
    await onboard(h);
    await onboard(h, B);
    const w = await h.json<{ id: string }>('/walks', { token: A, body: { client_id: ID1, started_at: '2026-10-08T03:00:00Z', duration_s: 600, steps: 900 } });
    expect((await h.json<Walks>('/walks', { token: B })).body.recent).toEqual([]);
    expect((await h.req(`/walks/${w.body.id}`, { method: 'DELETE', token: B })).status).toBe(404);
    expect((await h.req('/walks', { token: A, body: { client_id: 'nope', started_at: '2026-10-08T03:00:00Z', duration_s: 1, steps: 1 } })).status).toBe(400);
    expect((await h.req('/walks', { token: A, body: { client_id: ID2, started_at: '2026-10-09T03:00:00Z', duration_s: 1, steps: 1 } })).status).toBe(400);
    expect((await h.req('/walks', { token: A, body: { client_id: ID2, started_at: '2026-10-08T03:00:00Z', duration_s: 1, steps: -5 } })).status).toBe(400);
    expect((await h.req('/walks')).status).toBe(401);
  });
});
