import { describe, expect, it } from 'vitest';

import { addDays } from '../src/core/dates.ts';
import { signMedToken, verifyMedToken } from '../src/services/medToken.ts';
import { harness, onboard, reply, type Harness } from './helpers.ts';

const A = 'token-a';
const CRON = { 'x-cron-secret': 'test-cron-secret-123456' };
const ist = (hhmm: string, day = '2026-10-08') => new Date(`${day}T${hhmm}:00+05:30`).toISOString();

async function subscribed(h: Harness) {
  await h.json('/push/subscription', { token: A, body: { endpoint: 'https://push.example/device-1', keys: { p256dh: 'p', auth: 'a' } } });
}
const job = (h: Harness, name: string) => h.json<{ result: unknown }>(`/jobs/${name}`, { method: 'POST', headers: CRON });

describe('cron auth', () => {
  it('jobs need the cron secret', async () => {
    const h = await harness();
    expect((await h.req('/jobs/tick', { method: 'POST' })).status).toBe(401);
    expect((await h.req('/jobs/tick', { method: 'POST', headers: { 'x-cron-secret': 'wrong' } })).status).toBe(401);
    expect((await h.req('/jobs/tick', { method: 'POST', headers: CRON })).status).toBe(200);
  });
});

describe('reminders', () => {
  it('morning check-in is sent once, within an hour of her time', async () => {
    const h = await harness({ now: ist('08:25') });
    await onboard(h);
    await subscribed(h);
    await job(h, 'reminders');
    expect(h.pushes).toHaveLength(0); // too early
    h.setNow(ist('08:32'));
    await job(h, 'reminders');
    await job(h, 'reminders');
    expect(h.pushes.map((p) => p.payload.kind)).toEqual(['checkin']);
    expect(h.pushes[0]!.payload.title).toMatch(/Good morning/);
  });

  it('never during quiet hours, and Tamil text when her app is in Tamil', async () => {
    const h = await harness({ now: ist('23:05') });
    await onboard(h, A, { profile: { evening_checkin: '23:00', ui_language: 'ta' } });
    await subscribed(h);
    await job(h, 'reminders');
    expect(h.pushes).toHaveLength(0);
    h.setNow(ist('21:10'));
    await h.json('/me', { method: 'PATCH', token: A, body: { evening_checkin: '21:00' } });
    await job(h, 'reminders');
    expect(String(h.pushes[0]!.payload.title)).toMatch(/[஀-௿]/);
  });

  it('medicine reminder has Taken / Snooze; the signed token records the dose without a login', async () => {
    const h = await harness({ now: ist('08:05') });
    await onboard(h, A, { medications: [{ name: 'Metformin', dose: '500 mg', schedule_times: ['08:00'] }] });
    await subscribed(h);
    await job(h, 'reminders');
    const p = h.pushes.find((x) => x.payload.kind === 'med')!;
    expect(p.payload.actions).toEqual([{ action: 'taken', title: 'Taken' }, { action: 'snooze', title: 'Snooze 30 min' }]);
    const data = p.payload.data as { token: string; api: string };
    expect(data.api).toBe('https://api.example.test');
    expect((await h.req('/med-action', { body: { token: data.token, action: 'taken' } })).status).toBe(200);
    const t = await h.json<{ meds: { doses: { taken: boolean }[] }[] }>('/today', { token: A });
    expect(t.body.meds[0]!.doses[0]!.taken).toBe(true);
    // Already taken → no repeat reminder in the same window.
    h.pushes.length = 0;
    await h.store.unscoped.reminder_log.deleteMany({});
    await job(h, 'reminders');
    expect(h.pushes.filter((x) => x.payload.kind === 'med')).toHaveLength(0);
  });

  it('snooze sends the medicine reminder again 30 minutes later', async () => {
    const h = await harness({ now: ist('20:01') });
    await onboard(h, A, { medications: [{ name: 'Inositol', dose: null, schedule_times: ['20:00'] }] });
    await subscribed(h);
    await job(h, 'reminders');
    const token = (h.pushes[0]!.payload.data as { token: string }).token;
    await h.req('/med-action', { body: { token, action: 'snooze' } });
    h.pushes.length = 0;
    h.setNow(ist('20:20'));
    await job(h, 'reminders');
    expect(h.pushes).toHaveLength(0);
    h.setNow(ist('20:32'));
    await job(h, 'reminders');
    expect(h.pushes.map((p) => p.payload.body)).toEqual(['Inositol']);
  });

  it('forged or expired medicine tokens are rejected', async () => {
    const h = await harness();
    const secret = 'test-med-secret-123456';
    const good = signMedToken({ uid: 'uidA', medication_id: 'm', day: '2026-10-08', time: '08:00', exp: Date.now() + 1000 }, secret);
    expect(verifyMedToken(good, secret)).toBeTruthy();
    expect(verifyMedToken(good, 'other-secret')).toBeNull();
    expect(verifyMedToken(good.replace(/.$/, 'x'), secret)).toBeNull();
    expect(verifyMedToken(signMedToken({ uid: 'uidA', medication_id: 'm', day: 'd', time: 't', exp: Date.now() - 1 }, secret), secret)).toBeNull();
    expect((await h.req('/med-action', { body: { token: 'forged.token.value', action: 'taken' } })).status).toBe(401);
  });

  it('daily cap: at most 4 non-medicine pushes per day', async () => {
    const h = await harness({ now: ist('12:00') });
    await onboard(h);
    await subscribed(h);
    const results = [];
    for (let i = 0; i < 6; i++) results.push(await h.services.push.send('uidA', { kind: 'queued_reply', title: 't', body: 'b' }));
    expect(results.filter((r) => r === 'sent')).toHaveLength(4);
    expect(results.at(-1)).toBe('cap');
    expect(await h.services.push.send('uidA', { kind: 'med', title: 't', body: 'b' })).toBe('sent');
  });
});

describe('cycle check', () => {
  async function latePeriodUser(h: Harness) {
    await onboard(h, A, { profile: { typical_cycle_length: 30 } });
    await subscribed(h);
    const u = h.store.user('uidA');
    for (const s of ['2026-06-01', '2026-07-01', '2026-07-31']) {
      await u.periods.insertOne({ start_date: s, end_date: addDays(s, 4), flow: 'medium', pain: 3, notes: null, auto_closed: false, source_message_id: null });
    }
    for (let i = 0; i < 8; i++) await u.mood_logs.insertOne({ day: addDays('2026-08-10', i), mood: 2, energy: null, stress: 5, note: null, source_message_id: null });
  }

  it('a late period gets one gentle check-in with factors, again only at 7 and 14 days', async () => {
    const h = await harness({ now: ist('09:10', '2026-09-05') });
    await latePeriodUser(h);
    await job(h, 'cycle-check');
    await job(h, 'cycle-check'); // same day: no repeat
    let msgs = (await h.json<{ messages: { content: string }[] }>('/chat/messages', { token: A })).body.messages;
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.content).toMatch(/past the predicted range/);
    expect(msgs[0]!.content).toMatch(/stressful days/);
    expect(msgs[0]!.content).toMatch(/pregnancy/);
    expect(msgs[0]!.content).toMatch(/doctor/);
    expect(h.pushes.filter((p) => p.payload.kind === 'delay')).toHaveLength(1);
    for (const day of ['2026-09-06', '2026-09-07', '2026-09-08']) {
      h.setNow(ist('09:10', day));
      await job(h, 'cycle-check');
    }
    msgs = (await h.json<{ messages: { content: string }[] }>('/chat/messages', { token: A })).body.messages;
    expect(msgs).toHaveLength(1); // no daily repetition
    h.setNow(ist('09:10', '2026-09-11'));
    await job(h, 'cycle-check');
    expect((await h.json<{ messages: unknown[] }>('/chat/messages', { token: A })).body.messages).toHaveLength(2);
    const cycle = await h.json<{ insights: { type: string; payload: { factors: string[] } }[] }>('/cycle', { token: A });
    expect(cycle.body.insights[0]!.payload.factors).toContain('high_stress');
  });

  it('red flag (period longer than 8 days) creates one calm card', async () => {
    const h = await harness({ now: ist('09:30') });
    await onboard(h);
    await h.store.user('uidA').periods.insertOne({ start_date: '2026-09-01', end_date: '2026-09-11', flow: 'heavy', pain: 4, notes: null, auto_closed: false, source_message_id: null });
    await job(h, 'cycle-check');
    await job(h, 'cycle-check');
    const c = await h.json<{ insights: { type: string; payload: { rule: string } }[] }>('/cycle', { token: A });
    expect(c.body.insights.filter((i) => i.type === 'red_flag').map((i) => i.payload.rule)).toEqual(['long_bleeding']);
  });

  it('an open period is auto-closed after 10 days for her to confirm', async () => {
    const h = await harness({ now: ist('09:30') });
    await onboard(h);
    await h.store.user('uidA').periods.insertOne({ start_date: '2026-09-20', end_date: null, flow: null, pain: null, notes: null, auto_closed: false, source_message_id: null });
    await job(h, 'cycle-check');
    const c = await h.json<{ periods: { end_date: string; auto_closed: boolean }[] }>('/cycle', { token: A });
    expect(c.body.periods[0]).toMatchObject({ end_date: '2026-09-29', auto_closed: true });
  });
});

describe('daily summary', () => {
  it('summarises an active day once, and retires facts the model marks outdated', async () => {
    // The store stamps created_at from the real clock (never backwards), so run this day on today's date in IST.
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const h = await harness({ now: ist('23:40', day) });
    await onboard(h);
    const u = h.store.user('uidA');
    await u.facts.insertOne({ fact: 'Has an exam on Friday', category: 'event', source_message_id: null, active: true, embedding: null, updated_at: '2026-10-01' });
    h.llm.queue.push(reply('Exam went well!'));
    await h.json('/chat/messages', { token: A, body: { text: 'exam went well', client_id: crypto.randomUUID() } });
    h.llm.queue.push({ summary: 'She finished her exam and felt relieved. Follow up on results next week.', facts_to_retire: ['Has an exam on Friday'] });
    const r = await job(h, 'daily-summary');
    expect(r.body.result).toEqual(expect.arrayContaining([`${day}:ok_retired_1`]));
    expect(await u.daily_summaries.count()).toBe(1);
    expect(await u.facts.count({ active: true })).toBe(0);
    const again = await job(h, 'daily-summary');
    expect(again.body.result).toEqual(expect.arrayContaining([`${day}:exists`]));
  });
});

describe('tick', () => {
  it('daily jobs run once per day; reminders every tick', async () => {
    const h = await harness({ now: ist('09:05') });
    await onboard(h);
    const first = await h.json<Record<string, unknown>>('/jobs/tick', { method: 'POST', headers: CRON });
    expect(Object.keys(first.body)).toEqual(['reminders', 'retry-queue', 'cycle-check']);
    const second = await h.json<Record<string, unknown>>('/jobs/tick', { method: 'POST', headers: CRON });
    expect(Object.keys(second.body)).toEqual(['reminders', 'retry-queue']);
  });
});
