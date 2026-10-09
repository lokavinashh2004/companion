// Model list: names resolve to OpenRouter ids, old rows retire, and the startup / manual check reports per model.
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createLlmClient } from '../src/services/llm.ts';
import { checkKey, resolveSeedModel, type OrModel } from '../src/services/models.ts';
import { syncModels } from '../src/store/seed.ts';
import { createMemoryStore } from '../src/store/index.ts';
import seed from '../src/store/seed/llm-models.json' with { type: 'json' };

const free = (id: string, name: string, extra: Partial<OrModel> = {}): OrModel => ({ id, name, pricing: { prompt: '0', completion: '0' }, ...extra });
const CATALOG: OrModel[] = [
  free('nvidia/nemotron-3-ultra:free', 'NVIDIA: Nemotron 3 Ultra (free)', { supported_parameters: ['response_format'] }),
  free('nvidia/nemotron-3.5-lightning:free', 'NVIDIA: Nemotron 3.5 Lightning (free)'),
  free('thinkingmachines/inkling:free', 'Thinking Machines: Inkling (free)', { architecture: { input_modalities: ['text', 'image', 'audio'] } }),
  { id: 'nvidia/nemotron-3-ultra', name: 'NVIDIA: Nemotron 3 Ultra', pricing: { prompt: '0.000001', completion: '0.000002' } },
];

afterEach(() => vi.restoreAllMocks());

describe('seed list', () => {
  it('lists the requested fallback order and leaves the moderation model out', () => {
    const names = seed.models.map((m) => m.name);
    expect(names[0]).toBe('NVIDIA: Nemotron 3 Ultra (free)');
    expect(names).toHaveLength(12);
    expect(names.some((n) => /content safety/i.test(n))).toBe(false);
    expect(seed.models.map((m) => m.priority)).toEqual(names.map((_, i) => i + 1));
    // models whose free tier may train on prompts start disabled (health data)
    expect(seed.models.filter((m) => !m.enabled).map((m) => m.name)).toEqual(['Poolside: Laguna S 2.1 (free)', 'Poolside: Laguna XS 2.1 (free)', 'LiquidAI: LFM2.5-2.6B (free)']);
  });

  it('resolves display names to the free variant, with or without the vendor prefix', () => {
    expect(resolveSeedModel({ name: 'NVIDIA: Nemotron 3 Ultra (free)', priority: 1, caps: [], enabled: true }, CATALOG)?.id).toBe('nvidia/nemotron-3-ultra:free');
    expect(resolveSeedModel({ name: 'Inkling (free)', priority: 1, caps: [], enabled: true }, CATALOG)?.id).toBe('thinkingmachines/inkling:free');
    expect(resolveSeedModel({ name: 'Nope (free)', priority: 1, caps: [], enabled: true }, CATALOG)).toBeNull();
  });

  it('syncs resolved models with catalog caps, reports unknown names and retires old rows', async () => {
    const store = createMemoryStore();
    await store.shared.llm_models.insertOne({ model_id: 'google/gemini-2.0-flash-exp:free', priority: 1, caps: ['chat', 'json'], enabled: true, supports_response_format: true, notes: null, health_disabled: false, unhealthy_until: null, consecutive_fails: 0, success_count: 0, fail_count: 0, avg_latency_ms: null, last_error: null });
    const r = await syncModels(store, CATALOG);
    expect(r.synced.map((m) => m.model_id)).toEqual(['nvidia/nemotron-3-ultra:free', 'nvidia/nemotron-3.5-lightning:free', 'thinkingmachines/inkling:free']);
    expect(r.synced.find((m) => m.model_id === 'thinkingmachines/inkling:free')?.caps).toEqual(['chat', 'json', 'vision']);
    expect(r.unresolved).toHaveLength(9);
    expect(r.retired).toEqual(['google/gemini-2.0-flash-exp:free']);
    expect((await store.shared.llm_models.findOne({ model_id: 'nvidia/nemotron-3-ultra:free' }))?.supports_response_format).toBe(true);
  });

  it('keeps existing rows when the catalog is unreachable', async () => {
    const store = createMemoryStore();
    await store.shared.llm_models.insertOne({ model_id: 'x/old:free', priority: 1, caps: ['chat', 'json'], enabled: true, supports_response_format: false, notes: null, health_disabled: false, unhealthy_until: null, consecutive_fails: 0, success_count: 0, fail_count: 0, avg_latency_ms: null, last_error: null });
    const r = await syncModels(store, null);
    expect(r.retired).toEqual([]);
    expect((await store.shared.llm_models.findOne({ model_id: 'x/old:free' }))?.enabled).toBe(true);
  });
});

describe('llm check', () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  it('reports a rejected key without probing', async () => {
    const f = vi.fn(async () => json({ error: { message: 'User not found.', code: 401 } }, 401)) as unknown as typeof fetch;
    expect((await checkKey(f, 'sk-bad')).status).toBe('invalid');
    expect((await checkKey(f, undefined)).status).toBe('missing');
    const proxy = vi.fn(async () => new Response('<html><body>Access blocked</body></html>', { status: 403 })) as unknown as typeof fetch;
    expect(await checkKey(proxy, 'sk-x')).toMatchObject({ status: 'unreachable' });
  });

  it('checks the key, probes models in order, and marks failures unhealthy', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const store = createMemoryStore();
    await syncModels(store, CATALOG);
    const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      if (u.endsWith('/key')) {
        expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer sk-good');
        return json({ data: { label: 'companion', is_free_tier: true, usage: 0, limit: null } });
      }
      const model = (JSON.parse(String(init?.body)) as { model: string }).model;
      if (model === 'nvidia/nemotron-3-ultra:free') return json({ error: { message: 'No endpoints found', code: 404 } }, 404);
      return json({ choices: [{ message: { content: '{"ok":true}' } }] });
    }) as unknown as typeof fetch;
    const llm = createLlmClient(store, 'sk-good', 50, f);
    const r = await llm.check!({ probe: true });
    expect(r.key.status).toBe('ok');
    expect(r.models.map((m) => [m.model_id, m.ok])).toEqual([
      ['nvidia/nemotron-3-ultra:free', false],
      ['nvidia/nemotron-3.5-lightning:free', true],
      ['thinkingmachines/inkling:free', true],
    ]);
    expect(r.first_working).toBe('nvidia/nemotron-3.5-lightning:free');
    expect((await store.shared.llm_models.findOne({ model_id: 'nvidia/nemotron-3-ultra:free' }))?.unhealthy_until).not.toBeNull();
    expect(await llm.remaining()).toBe(47); // probes use the daily budget
    // the key never appears in logs
    expect(JSON.stringify((console.log as unknown as { mock: { calls: unknown[] } }).mock.calls)).not.toContain('sk-good');
  });
});
