// /admin/usage: owner-only LLM usage. Built-in admin account, 403 for everyone else, token tracking.
import { describe, expect, it } from 'vitest';

import { routeLLM } from '../src/core/llm-router.ts';
import { CompanionResponse } from '../src/core/schemas.ts';
import { storeRouterDeps, usageDay } from '../src/services/llm.ts';
import { syncModels } from '../src/store/seed.ts';
import { createMemoryStore } from '../src/store/index.ts';
import { harness } from './helpers.ts';

describe('admin usage', () => {
  it('is refused to normal users and shows is_admin only for the admin', async () => {
    const h = await harness();
    expect((await h.req('/admin/usage', { token: 'token-a' })).status).toBe(403);
    expect((await h.req('/admin/usage')).status).toBe(401);
    expect((await h.json<{ is_admin: boolean }>('/me', { token: 'token-a' })).body.is_admin).toBe(false);
    expect((await h.json<{ is_admin: boolean }>('/me', { token: 'token-admin' })).body.is_admin).toBe(true);
  });

  it('reports today, a 14-day history with tokens, and every model', async () => {
    const h = await harness();
    const day = usageDay(h.services.now());
    await h.store.shared.llm_usage.insertOne({ day, requests: 7, prompt_tokens: 1200, completion_tokens: 300 });
    await h.store.shared.llm_models.insertOne({ model_id: 'x/m:free', priority: 1, caps: ['chat', 'json'], enabled: true, supports_response_format: false, notes: null, health_disabled: false, unhealthy_until: null, consecutive_fails: 0, success_count: 5, fail_count: 1, avg_latency_ms: 900, last_error: null });
    h.llm.budgetLeft = 43;
    const r = await h.json<{ used: number; remaining: number; budget: number; tokens: { total: number }; history: { day: string; requests: number }[]; models: { model_id: string; success_count: number }[]; key: { status: string } }>('/admin/usage', { token: 'token-admin' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ used: 7, remaining: 43, budget: 50, tokens: { total: 1500 } });
    expect(r.body.history).toHaveLength(14);
    expect(r.body.history.at(-1)).toMatchObject({ day, requests: 7 });
    expect(r.body.models[0]).toMatchObject({ model_id: 'x/m:free', success_count: 5 });
    expect(r.body.key.status).toBe('unreachable'); // the fake LLM has no key check
  });
});

describe('token tracking', () => {
  it('adds the tokens OpenRouter reports to today', async () => {
    const store = createMemoryStore();
    await syncModels(store, [{ id: 'nvidia/nemotron-3-ultra:free', name: 'NVIDIA: Nemotron 3 Ultra (free)', pricing: { prompt: '0', completion: '0' } }]);
    const fetchFn = (async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: '{"reply":"hi"}' } }], usage: { prompt_tokens: 812, completion_tokens: 64 } }), { status: 200 })) as unknown as typeof fetch;
    const r = await routeLLM(storeRouterDeps(store, 'sk', fetchFn), { caps: ['chat', 'json'], messages: [{ role: 'user', content: 'hi' }], temperature: 0.5, schema: CompanionResponse, dailyBudget: 50 });
    expect(r.attempts.length).toBe(1);
    const row = await store.shared.llm_usage.findOne({ day: usageDay() });
    expect(row).toMatchObject({ requests: 1, prompt_tokens: 812, completion_tokens: 64 });
  });
});
