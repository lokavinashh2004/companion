import { describe, expect, it } from 'vitest';

import { addDays } from '../src/core/dates.ts';
import { harness, onboard } from './helpers.ts';

const A = 'token-a';

describe('today', () => {
  it('water, quick log and weight', async () => {
    const h = await harness();
    await onboard(h, A, { profile: { weight_tracking: true } });
    await h.json('/today/water', { token: A, body: { day: '2026-10-08', ml: 250 } });
    await h.json('/today/water', { token: A, body: { day: '2026-10-08', ml: 250 } });
    await h.json('/today/quick-log', { token: A, body: { day: '2026-10-08', mood: 4, stress: 2, symptoms: ['acne', 'bloating'], sleep_hours: 6.5 } });
    let t = await h.json<{ lifestyle: { water_ml: number; sleep_hours: number }; moods: { mood: number }[]; symptoms: unknown[]; weight_due: boolean }>('/today', { token: A });
    expect(t.body.lifestyle).toMatchObject({ water_ml: 500, sleep_hours: 6.5 });
    expect(t.body.moods[0]!.mood).toBe(4);
    expect(t.body.symptoms).toHaveLength(2);
    expect(t.body.weight_due).toBe(true);
    await h.json('/today/weight', { token: A, body: { day: '2026-10-08', weight_kg: 61.2 } });
    t = await h.json('/today', { token: A });
    expect(t.body.weight_due).toBe(false);
  });

  it('kcal only reaches the browser when calories are shown', async () => {
    const h = await harness();
    await onboard(h);
    await h.json('/food/logs', { token: A, body: { items: [{ name: 'idli', quantity: 2, unit: null }], meal: 'breakfast', day: '2026-10-08', source: 'manual' } });
    let t = await h.json<{ foods: { kcal: number | null }[]; score: { kcal: number | null } }>('/today', { token: A });
    expect(t.body.foods[0]!.kcal).toBeNull();
    expect(t.body.score.kcal).toBeNull();
    await h.json('/me', { method: 'PATCH', token: A, body: { calorie_display: 'show' } });
    t = await h.json('/today', { token: A });
    expect(t.body.foods[0]!.kcal).toBeGreaterThan(0);
  });

  it('medicine doses: today checklist and toggling', async () => {
    const h = await harness();
    await onboard(h, A, { medications: [{ name: 'Metformin', dose: '500 mg', schedule_times: ['08:00', '20:00'] }] });
    const med = (await h.json<{ medications: { id: string }[] }>('/meds', { token: A })).body.medications[0]!;
    await h.json(`/meds/${med.id}/dose`, { token: A, body: { day: '2026-10-08', time: '08:00', taken: true } });
    const t = await h.json<{ meds: { doses: { time: string; taken: boolean }[] }[] }>('/today', { token: A });
    expect(t.body.meds[0]!.doses).toEqual([{ time: '08:00', taken: true }, { time: '20:00', taken: false }]);
    await h.json(`/meds/${med.id}/dose`, { token: A, body: { day: '2026-10-08', time: '08:00', taken: false } });
    expect((await h.json<{ meds: { doses: { taken: boolean }[] }[] }>('/today', { token: A })).body.meds[0]!.doses[0]!.taken).toBe(false);
    // stopping records the end date
    const stopped = await h.json<{ active: boolean; end_date: string }>(`/meds/${med.id}`, { method: 'PATCH', token: A, body: { active: false } });
    expect(stopped.body).toMatchObject({ active: false, end_date: '2026-10-08' });
  });
});

describe('cycle', () => {
  it('logs periods from the calendar, predicts a range, and rejects future dates', async () => {
    const h = await harness();
    await onboard(h);
    for (const [start, end] of [['2026-07-01', '2026-07-05'], ['2026-08-02', '2026-08-06'], ['2026-09-03', '2026-09-07']]) {
      await h.json('/cycle/periods', { token: A, body: { kind: 'start', date: start, flow: 'medium' } });
      await h.json('/cycle/periods', { token: A, body: { kind: 'end', date: end } });
    }
    const c = await h.json<{ periods: { start_date: string; cycle_length: number | null; length_days: number }[]; prediction: { earliest: string; latest: string; confidence: string }; status: { kind: string; cycle_day: number } }>('/cycle', { token: A });
    expect(c.body.periods.map((p) => p.start_date)).toEqual(['2026-09-03', '2026-08-02', '2026-07-01']);
    expect(c.body.periods[1]!.cycle_length).toBe(32);
    expect(c.body.periods[0]!.length_days).toBe(5);
    expect(c.body.prediction.earliest < c.body.prediction.latest).toBe(true);
    expect(c.body.status).toMatchObject({ kind: 'cycle', cycle_day: 36 });
    expect((await h.req('/cycle/periods', { token: A, body: { kind: 'start', date: '2026-12-01' } })).status).toBe(400);
  });

  it('edits and deletes a period', async () => {
    const h = await harness();
    await onboard(h);
    const p = (await h.json<{ id: string }>('/cycle/periods', { token: A, body: { kind: 'start', date: '2026-10-01' } })).body;
    const patched = await h.json<{ end_date: string }>(`/cycle/periods/${p.id}`, { method: 'PATCH', token: A, body: { end_date: '2026-10-05' } });
    expect(patched.body.end_date).toBe('2026-10-05');
    expect((await h.req(`/cycle/periods/${p.id}`, { method: 'PATCH', token: A, body: { end_date: '2026-09-01' } })).status).toBe(400);
    expect((await h.req(`/cycle/periods/${p.id}`, { method: 'DELETE', token: A })).status).toBe(200);
  });
});

describe('labs and memory', () => {
  it('labs show only within / outside the range on her report', async () => {
    const h = await harness();
    await onboard(h);
    const l1 = await h.json<{ within_range: boolean | null }>('/labs', { token: A, body: { test_date: '2026-09-01', test_name: 'TSH', test_label: null, value: 2.1, unit: 'mIU/L', reference_range: '0.4 - 4.0' } });
    const l2 = await h.json<{ within_range: boolean | null }>('/labs', { token: A, body: { test_date: '2026-09-01', test_name: 'HbA1c', test_label: null, value: 6.1, unit: '%', reference_range: '< 5.7' } });
    const l3 = await h.json<{ within_range: boolean | null }>('/labs', { token: A, body: { test_date: '2026-09-01', test_name: 'other', test_label: 'Prolactin', value: 12, unit: null, reference_range: null } });
    expect([l1.body.within_range, l2.body.within_range, l3.body.within_range]).toEqual([true, false, null]);
  });

  it('facts from chat are deduplicated, editable and deletable', async () => {
    const h = await harness();
    await onboard(h);
    const { addFacts } = await import('../src/services/memory.ts');
    const u = h.store.user('uidA');
    expect(await addFacts(h.services, u, ['Has an exam on Friday', 'has an exam on friday!', 'Likes filter coffee'], null)).toBe(2);
    const facts = (await h.json<{ facts: { id: string; fact: string; category: string }[] }>('/facts', { token: A })).body.facts;
    expect(facts.map((f) => f.category).sort()).toEqual(['event', 'preference']);
    const edited = await h.json<{ fact: string }>(`/facts/${facts[0]!.id}`, { method: 'PATCH', token: A, body: { fact: 'Exam moved to Monday' } });
    expect(edited.body.fact).toBe('Exam moved to Monday');
    await h.req(`/facts/${facts[1]!.id}`, { method: 'DELETE', token: A });
    expect((await h.json<{ facts: unknown[] }>('/facts', { token: A })).body.facts).toHaveLength(1);
  });

  it('facts are capped at 60 active (oldest retired)', async () => {
    const h = await harness();
    await onboard(h);
    const { addFacts } = await import('../src/services/memory.ts');
    const u = h.store.user('uidA');
    for (let i = 0; i < 13; i++) await addFacts(h.services, u, [0, 1, 2, 3, 4].map((j) => `Unique fact number ${i * 5 + j}`), null);
    expect(await u.facts.count({ active: true })).toBe(60);
  });
});

describe('insights', () => {
  it('trends, weekly numbers and patterns after 3+ cycles', async () => {
    const h = await harness();
    await onboard(h);
    const u = h.store.user('uidA');
    const starts = ['2026-06-01', '2026-07-01', '2026-07-31', '2026-08-30'];
    for (const s of starts) await u.periods.insertOne({ start_date: s, end_date: addDays(s, 4), flow: 'medium', pain: null, notes: null, auto_closed: false, source_message_id: null });
    // Lower mood in the 14 days before each next period.
    for (let d = '2026-06-01'; d < '2026-08-30'; d = addDays(d, 1)) {
      const luteal = starts.some((s) => s > d && addDays(d, 14) >= s);
      await u.mood_logs.insertOne({ day: d, mood: luteal ? 2 : 4, energy: null, stress: null, note: null, source_message_id: null });
    }
    await h.json('/food/logs', { token: A, body: { items: [{ name: 'idli', quantity: 2, unit: null }], meal: 'breakfast', day: '2026-10-07', source: 'manual' } });
    const r = await h.json<{ cycle_lengths: number[]; balance_trend: unknown[]; insights: { type: string; payload: { kind?: string } }[]; week: { days_with_food_logged: number } }>('/insights', { token: A });
    expect(r.body.cycle_lengths).toEqual([30, 30, 30]);
    expect(r.body.balance_trend).toHaveLength(1);
    expect(r.body.week.days_with_food_logged).toBe(1);
    expect(r.body.insights.some((i) => i.type === 'pattern' && i.payload.kind === 'mood_by_phase')).toBe(true);
  });
});
