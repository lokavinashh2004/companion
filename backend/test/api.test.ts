import { describe, expect, it } from 'vitest';

import { harness, onboard, ORIGIN } from './helpers.ts';

describe('system', () => {
  it('health needs no auth and reports the store', async () => {
    const h = await harness();
    const r = await h.json('/health');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, version: expect.any(String), store: 'memory' });
  });

  it('serves an OpenAPI 3.1 document with all feature routes', async () => {
    const h = await harness();
    const doc = (await h.json<{ openapi: string; paths: Record<string, unknown> }>('/openapi.json')).body;
    expect(doc.openapi).toBe('3.1.0');
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining(['/me', '/chat/messages', '/today', '/cycle', '/meds', '/labs', '/facts', '/insights', '/push/subscription', '/med-action', '/jobs/tick']),
    );
  });

  it('CORS allows the frontend origin only', async () => {
    const h = await harness();
    const ok = await h.app.request('/me', { method: 'OPTIONS', headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'GET' } });
    expect(ok.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    const evil = await h.app.request('/me', { method: 'OPTIONS', headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'GET' } });
    expect(evil.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('unknown routes: 401 without a token, 404 with one', async () => {
    const h = await harness();
    expect((await h.req('/nope')).status).toBe(401);
    expect((await h.req('/nope', { token: 'token-a' })).status).toBe(404);
  });
});

describe('auth and profile', () => {
  it('rejects missing and forged tokens', async () => {
    const h = await harness();
    expect((await h.req('/me')).status).toBe(401);
    expect((await h.req('/me', { token: 'forged' })).status).toBe(401);
  });

  it('provisions the user with a default profile on first call', async () => {
    const h = await harness();
    const r = await h.json<{ uid: string; profile: { timezone: string; onboarding_done: boolean } }>('/me', { token: 'token-a' });
    expect(r.body.uid).toBe('uidA');
    expect(r.body.profile.timezone).toBe('Asia/Kolkata');
    expect(r.body.profile.onboarding_done).toBe(false);
  });

  it('PATCH /me updates only the caller and rejects unknown fields', async () => {
    const h = await harness();
    await h.req('/me', { token: 'token-b' });
    const ok = await h.json<{ display_language: string }>('/me', { method: 'PATCH', token: 'token-a', body: { display_language: 'tanglish', morning_checkin: '07:45' } });
    expect(ok.body.display_language).toBe('tanglish');
    expect((await h.json<{ profile: { display_language: string } }>('/me', { token: 'token-b' })).body.profile.display_language).toBe('auto');
    expect((await h.req('/me', { method: 'PATCH', token: 'token-a', body: { onboarding_done: true } })).status).toBe(400);
    expect((await h.req('/me', { method: 'PATCH', token: 'token-a', body: { morning_checkin: '25:00' } })).status).toBe(400);
  });

  it('onboarding saves profile, medicines and the last period (old start gets a 5-day end)', async () => {
    const h = await harness();
    const r = await onboard(h, 'token-a', {
      profile: { companion_name: 'Thozhi', persona_tone: 'calm', calorie_display: 'show', typical_cycle_length: 32 },
      medications: [{ name: 'Inositol', dose: '2 g', schedule_times: ['08:00', '20:00'] }],
      last_period_start: '2026-09-20',
    });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ companion_name: 'Thozhi', onboarding_done: true });
    const meds = await h.json<{ medications: { name: string }[] }>('/meds', { token: 'token-a' });
    expect(meds.body.medications.map((m) => m.name)).toEqual(['Inositol']);
    const cycle = await h.json<{ periods: { start_date: string; end_date: string }[]; prediction: { confidence: string } }>('/cycle', { token: 'token-a' });
    expect(cycle.body.periods[0]).toMatchObject({ start_date: '2026-09-20', end_date: '2026-09-24' });
    expect(cycle.body.prediction.confidence).toBe('low');
  });
});

describe('isolation: user B can never reach user A data', () => {
  it('reads, edits and deletes by id all return 404 or empty for another user', async () => {
    const h = await harness();
    await onboard(h, 'token-a', { medications: [{ name: 'Metformin', dose: '500 mg', schedule_times: ['08:00'] }], last_period_start: '2026-09-25' });
    await onboard(h, 'token-b');
    const a = 'token-a';
    const lab = (await h.json<{ id: string }>('/labs', { token: a, body: { test_date: '2026-09-01', test_name: 'TSH', test_label: null, value: 2.1, unit: 'mIU/L', reference_range: '0.4 - 4.0' } })).body;
    const food = (await h.json<{ logs: { id: string }[] }>('/food/logs', { token: a, body: { items: [{ name: 'idli', quantity: 2, unit: null }], meal: 'breakfast', day: '2026-10-08', source: 'manual' } })).body.logs[0]!;
    const med = (await h.json<{ medications: { id: string }[] }>('/meds', { token: a })).body.medications[0]!;
    const period = (await h.json<{ periods: { id: string }[] }>('/cycle', { token: a })).body.periods[0]!;
    await h.store.user('uidA').facts.insertOne({ fact: 'Has an exam on Friday', category: 'event', source_message_id: null, active: true, embedding: null, updated_at: '2026-10-08' });
    const fact = (await h.json<{ facts: { id: string }[] }>('/facts', { token: a })).body.facts[0]!;

    const b = 'token-b';
    expect((await h.json<{ labs: unknown[] }>('/labs', { token: b })).body.labs).toEqual([]);
    expect((await h.json<{ medications: unknown[] }>('/meds', { token: b })).body.medications).toEqual([]);
    expect((await h.json<{ facts: unknown[] }>('/facts', { token: b })).body.facts).toEqual([]);
    expect((await h.json<{ periods: unknown[] }>('/cycle', { token: b })).body.periods).toEqual([]);
    expect((await h.json<{ foods: unknown[] }>('/today?day=2026-10-08', { token: b })).body.foods).toEqual([]);
    expect((await h.req(`/labs/${lab.id}`, { method: 'DELETE', token: b })).status).toBe(404);
    expect((await h.req(`/food/logs/${food.id}`, { method: 'DELETE', token: b })).status).toBe(404);
    expect((await h.req(`/meds/${med.id}`, { method: 'PATCH', token: b, body: { name: 'x' } })).status).toBe(404);
    expect((await h.req(`/meds/${med.id}/dose`, { token: b, body: { day: '2026-10-08', time: '08:00', taken: true } })).status).toBe(404);
    expect((await h.req(`/cycle/periods/${period.id}`, { method: 'DELETE', token: b })).status).toBe(404);
    expect((await h.req(`/facts/${fact.id}`, { method: 'DELETE', token: b })).status).toBe(404);
    // A's data is untouched
    expect((await h.json<{ labs: unknown[] }>('/labs', { token: a })).body.labs).toHaveLength(1);
    expect((await h.json<{ facts: unknown[] }>('/facts', { token: a })).body.facts).toHaveLength(1);
  });
});
