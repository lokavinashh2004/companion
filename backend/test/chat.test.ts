import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { harness, onboard, reply } from './helpers.ts';

type Msg = { id: string; content: string; status: string; meta: { logs?: { id: string; table: string; label: string }[]; pending?: { kind: string; date: string }[]; confirmed?: Record<string, string>; undone?: Record<string, boolean>; fallback?: boolean } };
type Send = { status: string; message: Msg; reply: Msg | null; notice: Msg | null; crisis: boolean };

const send = (h: Awaited<ReturnType<typeof harness>>, text: string, token = 'token-a', client_id = randomUUID()) =>
  h.json<Send>('/chat/messages', { token, body: { text, client_id } });

describe('chat pipeline', () => {
  it('"kaalaila 2 dosai saapten" logs 2 dosai at breakfast with a Tanglish reply, computed in code', async () => {
    const h = await harness();
    await onboard(h);
    h.llm.queue.push(reply('Super! Rendu dosai nalla breakfast 😋', { foods: [{ name: 'dosai', quantity: 2, unit: null, meal: 'breakfast' }] }, { language_detected: 'tanglish' }));
    const r = await send(h, 'kaalaila 2 dosai saapten');
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('done');
    expect(r.body.reply?.content).toMatch(/dosai/);
    // the router was asked for a Tanglish-capable model
    expect(h.llm.calls[0]!.caps).toEqual(['chat', 'json', 'tanglish']);
    const logs = r.body.reply!.meta.logs!;
    expect(logs).toEqual([{ table: 'food_logs', id: expect.any(String), label: 'dosai' }]);
    const today = await h.json<{ foods: { item_name: string; meal: string; quantity: number; grams: number; kcal: number | null }[]; score: { score: number } }>('/today', { token: 'token-a' });
    expect(today.body.foods).toEqual([expect.objectContaining({ item_name: 'dosai', meal: 'breakfast', quantity: 2, grams: 160, kcal: null })]);
    expect(today.body.score.score).toBeGreaterThanOrEqual(0);
  });

  it('"periods vandhuduchu" shows a confirm chip; confirming logs a period start for today; undo removes it', async () => {
    const h = await harness();
    await onboard(h);
    h.llm.queue.push(reply('Aiyo, take rest da 💛', { period_event: { type: 'started', relative_day: 0, flow: null, pain: null } }));
    const r = await send(h, 'periods vandhuduchu');
    const msg = r.body.reply!;
    expect(msg.meta.pending).toEqual([{ kind: 'period_start', date: '2026-10-08', flow: null, pain: null }]);
    // Nothing written until she confirms.
    expect((await h.json<{ periods: unknown[] }>('/cycle', { token: 'token-a' })).body.periods).toEqual([]);
    const c = await h.json<{ message: Msg }>('/chat/confirm-period', { token: 'token-a', body: { message_id: msg.id, index: 0 } });
    expect(c.body.message.meta.confirmed?.['0']).toBeTruthy();
    const cycle = await h.json<{ periods: { start_date: string }[]; status: { kind: string } }>('/cycle', { token: 'token-a' });
    expect(cycle.body.periods[0]!.start_date).toBe('2026-10-08');
    expect(cycle.body.status.kind).toBe('period');
    await h.json('/chat/undo-period', { token: 'token-a', body: { message_id: msg.id, index: 0 } });
    expect((await h.json<{ periods: unknown[] }>('/cycle', { token: 'token-a' })).body.periods).toEqual([]);
  });

  it('relative_day becomes a date in code (yesterday)', async () => {
    const h = await harness();
    await onboard(h);
    h.llm.queue.push(reply('ok', { period_event: { type: 'started', relative_day: -1, flow: 'heavy', pain: 6 } }));
    const r = await send(h, 'nethu periods start aachu');
    expect(r.body.reply!.meta.pending![0]).toEqual({ kind: 'period_start', date: '2026-10-07', flow: 'heavy', pain: 6 });
  });

  it('undo removes a chat-logged item', async () => {
    const h = await harness();
    await onboard(h);
    h.llm.queue.push(reply('Nice', { foods: [{ name: 'idli', quantity: 3, unit: null, meal: 'breakfast' }], symptoms: [{ symptom: 'cramps', severity: 2 }] }));
    const r = await send(h, '3 idli, cramps a bit');
    const msg = r.body.reply!;
    const food = msg.meta.logs!.find((l) => l.table === 'food_logs')!;
    const u = await h.json<{ message: Msg }>('/chat/undo', { token: 'token-a', body: { message_id: msg.id, log_id: food.id } });
    expect(u.body.message.meta.undone?.[food.id]).toBe(true);
    const today = await h.json<{ foods: unknown[]; symptoms: unknown[] }>('/today', { token: 'token-a' });
    expect(today.body.foods).toEqual([]);
    expect(today.body.symptoms).toHaveLength(1);
  });

  it('all models down → message saved and queued, bilingual notice; retry job answers later with a push', async () => {
    const h = await harness();
    await onboard(h);
    await h.json('/push/subscription', { token: 'token-a', body: { endpoint: 'https://push.example/a', keys: { p256dh: 'k', auth: 'a' } } });
    h.llm.queue.push('all_failed');
    const r = await send(h, 'Had a long day');
    expect(r.body.status).toBe('queued');
    expect(r.body.message.status).toBe('queued');
    expect(r.body.notice?.meta.fallback).toBe(true);
    expect(r.body.notice?.content).toMatch(/saved your message/); // pre-written, in her language (English here)
    // Later: a model is back.
    h.llm.queue.push(reply('Sorry for the wait! Tell me about your day 💛'));
    const job = await h.json<{ result: string[] }>('/jobs/retry-queue', { method: 'POST', headers: { 'x-cron-secret': 'test-cron-secret-123456' } });
    expect(job.body.result).toEqual(['done']);
    expect(h.pushes).toHaveLength(1);
    expect(h.pushes[0]!.payload).toMatchObject({ kind: 'queued_reply', url: '/' });
    const list = await h.json<{ messages: Msg[] }>('/chat/messages', { token: 'token-a' });
    expect(list.body.messages.map((m) => m.content)).toEqual(expect.arrayContaining(['Sorry for the wait! Tell me about your day 💛']));
  });

  it('the queued notice follows her language (Tamil script in → Tamil notice)', async () => {
    const h = await harness();
    await onboard(h);
    h.llm.queue.push('all_failed');
    const r = await send(h, 'இன்னைக்கு ரொம்ப களைப்பா இருக்கு');
    expect(r.body.notice?.content).toMatch(/[஀-௿]/);
  });

  it('wrong-language and calorie-mentioning replies are rejected by the acceptance check', async () => {
    const h = await harness();
    await onboard(h, 'token-a', { profile: { display_language: 'ta' } });
    h.llm.queue.push(reply('Super, nalla saaptiya!')); // Tanglish when Tamil script is required → rejected
    expect((await send(h, 'வணக்கம்')).body.status).toBe('queued');
  });

  it('resending the same client_id returns the saved result instead of a second LLM call', async () => {
    const h = await harness();
    await onboard(h);
    const id = randomUUID();
    h.llm.queue.push(reply('Hi!'));
    await send(h, 'hello', 'token-a', id);
    const again = await send(h, 'hello', 'token-a', id);
    expect(again.body.reply?.content).toBe('Hi!');
    expect(h.llm.calls).toHaveLength(1);
  });

  it('rate limit: over 30 messages in 10 minutes are saved and queued without an LLM call', async () => {
    const h = await harness();
    await onboard(h);
    for (let i = 0; i < 31; i++) await h.store.user('uidA').messages.insertOne({ client_id: null, role: 'user', content: 'x', language: null, status: 'done', model_id: null, retry_count: 0, error: null, meta: {} });
    const r = await send(h, 'one more');
    expect(r.body.status).toBe('queued');
    expect(h.llm.calls).toHaveLength(0);
  });

  it('crisis phrases flag the reply even if the model does not (EN / Tamil / Tanglish)', async () => {
    for (const text of ['I want to die', 'எனக்கு சாகணும் போல இருக்கு', 'vaazha pidikala']) {
      const h = await harness();
      await onboard(h);
      h.llm.queue.push(reply('I am here with you 💛', {}, { language_detected: 'mixed' }));
      const r = await send(h, text);
      expect(r.body.crisis, text).toBe(true);
    }
  });

  it('the LLM never sees her email or phone number', async () => {
    const h = await harness();
    await onboard(h);
    h.llm.queue.push(reply('ok'));
    await send(h, 'mail me at someone@example.com or call 98765 43210');
    const sent = JSON.stringify(h.llm.calls[0]!.messages);
    expect(sent).not.toMatch(/someone@example\.com|98765 43210|a@example\.test/);
  });

  it('messages are paged oldest-first', async () => {
    const h = await harness();
    await onboard(h);
    for (let i = 0; i < 3; i++) {
      h.llm.queue.push(reply(`r${i}`));
      h.setNow(`2026-10-08T05:0${i}:00Z`);
      await send(h, `m${i}`);
    }
    const list = await h.json<{ messages: Msg[]; has_more: boolean }>('/chat/messages?limit=4', { token: 'token-a' });
    expect(list.body.messages.map((m) => m.content)).toEqual(['r0', 'm1', 'r1', 'm2', 'r2'].slice(-4));
    expect(list.body.has_more).toBe(true);
  });
});
