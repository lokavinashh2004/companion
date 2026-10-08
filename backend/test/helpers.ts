// Test harness: the real app on an in-memory store, with a scripted LLM, recorded pushes and a fixed clock.
import type { RouteOptions, RouteResult } from '../src/core/llm-router.ts';
import { createApp } from '../src/app.ts';
import type { Services } from '../src/services/context.ts';
import type { LlmClient } from '../src/services/llm.ts';
import { createPushSender, type Transport } from '../src/services/push.ts';
import { createMemoryStore, type Store } from '../src/store/index.ts';
import { seedFoods, syncModels } from '../src/store/seed.ts';

export const ORIGIN = 'https://companion.vercel.app';
export const TOKENS: Record<string, { uid: string; email: string | null }> = {
  'token-a': { uid: 'uidA', email: 'a@example.test' },
  'token-b': { uid: 'uidB', email: null },
};

/** Each call pops the next scripted LLM result ({reply,...} object → ok; string → failure reason). */
export class FakeLlm implements LlmClient {
  queue: (unknown | string)[] = [];
  calls: RouteOptions<unknown>[] = [];
  budgetLeft = 50;
  async call<T>(opts: Omit<RouteOptions<T>, 'dailyBudget'>): Promise<RouteResult<T>> {
    this.calls.push(opts as RouteOptions<unknown>);
    const next = this.queue.shift();
    if (next === undefined || typeof next === 'string') {
      return { ok: false, reason: (next as 'all_failed') ?? 'all_failed', attempts: [] };
    }
    const parsed = opts.schema.safeParse(next);
    if (!parsed.success) return { ok: false, reason: 'all_failed', attempts: [] };
    const rejection = opts.accept?.(parsed.data);
    if (rejection) return { ok: false, reason: 'all_failed', attempts: [] };
    this.budgetLeft--;
    return { ok: true, data: parsed.data, modelId: 'fake/model:free', attempts: [] };
  }
  async remaining() {
    return this.budgetLeft;
  }
}

export interface Harness {
  app: ReturnType<typeof createApp>;
  store: Store;
  llm: FakeLlm;
  pushes: { endpoint: string; payload: Record<string, unknown> }[];
  services: Services;
  setNow(iso: string): void;
  req(path: string, init?: { method?: string; token?: string; body?: unknown; headers?: Record<string, string> }): Promise<Response>;
  json<T = Record<string, unknown>>(path: string, init?: { method?: string; token?: string; body?: unknown; headers?: Record<string, string> }): Promise<{ status: number; body: T }>;
}

export async function harness(opts: { now?: string; withFoods?: boolean; store?: Store } = {}): Promise<Harness> {
  const store = opts.store ?? createMemoryStore();
  if (opts.withFoods !== false) await seedFoods(store);
  await syncModels(store);
  const llm = new FakeLlm();
  const pushes: Harness['pushes'] = [];
  const transport: Transport = async (sub, payload) => {
    pushes.push({ endpoint: sub.endpoint, payload: JSON.parse(payload) as Record<string, unknown> });
    return 201;
  };
  let now = new Date(opts.now ?? '2026-10-08T04:30:00Z'); // 10:00 IST
  const services: Services = {
    store,
    env: { USDA_API_KEY: undefined, LLM_SUMMARY_RESERVE: 2, MED_ACTION_SECRET: 'test-med-secret-123456', CRON_SECRET: 'test-cron-secret-123456' },
    llm,
    embed: async () => null,
    push: createPushSender(store, transport, () => now),
    fetch: (async () => new Response('{}', { status: 404 })) as unknown as typeof fetch,
    now: () => now,
  };
  const app = createApp({
    services,
    allowedOrigins: [ORIGIN],
    apiUrl: 'https://api.example.test',
    auth: {
      verifyToken: async (t) => {
        const u = TOKENS[t];
        if (!u) throw new Error('bad token');
        return u;
      },
      deleteUser: async () => undefined,
    },
  });
  const req: Harness['req'] = async (path, init = {}) =>
    app.request(path, {
      method: init.method ?? (init.body ? 'POST' : 'GET'),
      headers: {
        Origin: ORIGIN,
        ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  return {
    app,
    store,
    llm,
    pushes,
    services,
    setNow: (iso) => {
      now = new Date(iso);
    },
    req,
    json: async (path, init) => {
      const r = await req(path, init);
      return { status: r.status, body: (await r.json()) as never };
    },
  };
}

/** A companion reply in the JSON contract shape. */
export function reply(text: string, extracted: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
  return { reply: text, language_detected: 'en', extracted, flags: { crisis: false, red_flag_symptom: false }, ...extra };
}

export async function onboard(h: Harness, token = 'token-a', body: Record<string, unknown> = {}) {
  return h.json('/me/onboarding', { token, body: { profile: {}, medications: [], last_period_start: null, ...body } });
}
