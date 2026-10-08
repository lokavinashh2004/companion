import { assert, assertEquals } from './assert.ts';
import { test } from 'vitest';
import { routeLLM, selectModels, type ModelRow, type RouterDeps } from '../src/core/llm-router.ts';
import { CompanionResponse } from '../src/core/schemas.ts';
import { checkReply } from '../src/core/language.ts';

function models(n: number, overrides: Partial<ModelRow>[] = []): ModelRow[] {
  return Array.from({ length: n }, (_, i) => ({
    model_id: `m${i + 1}:free`,
    priority: i + 1,
    caps: ['chat', 'json', 'tanglish', 'tamil_script'],
    enabled: true,
    supports_response_format: true,
    unhealthy_until: null,
    ...overrides[i],
  }));
}

type Behaviour = (model: string) => Response | Promise<Response> | 'hang';

function envelope(content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
}
const good = (reply = 'Super! Rendu dosai nalla breakfast.') =>
  envelope(JSON.stringify({ reply, language_detected: 'tanglish', extracted: { foods: [{ name: 'dosai', quantity: 2, unit: null, meal: 'breakfast' }] } }));

function makeDeps(rows: ModelRow[], behaviour: Behaviour, usageStart = 0) {
  let usage = usageStart;
  const recorded: { id: string; ok: boolean; error?: string }[] = [];
  const called: string[] = [];
  const deps: RouterDeps = {
    loadModels: () => Promise.resolve(rows),
    recordAttempt: (id, ok, _l, error) => {
      recorded.push({ id, ok, error });
      return Promise.resolve();
    },
    getUsage: () => Promise.resolve(usage),
    bumpUsage: () => Promise.resolve(++usage),
    apiKey: 'test',
    now: () => Date.now(),
    fetch: ((_url: string, init: RequestInit) => {
      const model = JSON.parse(String(init.body)).model as string;
      called.push(model);
      const r = behaviour(model);
      if (r === 'hang') {
        return new Promise((_res, rej) => init.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))));
      }
      return Promise.resolve(r);
    }) as typeof fetch,
  };
  return { deps, recorded, called, usage: () => usage };
}

const baseOpts = {
  caps: ['chat', 'json', 'tanglish'] as const,
  messages: [{ role: 'user' as const, content: 'kaalaila 2 dosai saapten' }],
  temperature: 0.7,
  schema: CompanionResponse,
  accept: (d: CompanionResponse) => {
    const c = checkReply('tanglish', d.reply);
    return c.ok ? null : c.reason;
  },
  dailyBudget: 50,
};

test('first healthy model answers', async () => {
  const { deps, called } = makeDeps(models(10), () => good());
  const r = await routeLLM(deps, { ...baseOpts, caps: [...baseOpts.caps] });
  assert(r.ok);
  assertEquals(r.ok && r.modelId, 'm1:free');
  assertEquals(called, ['m1:free']);
});

test('9 disabled models -> 10th answers', async () => {
  const rows = models(10, Array.from({ length: 9 }, () => ({ enabled: false })));
  const { deps } = makeDeps(rows, () => good());
  const r = await routeLLM(deps, { ...baseOpts, caps: [...baseOpts.caps] });
  assert(r.ok);
  assertEquals(r.ok && r.modelId, 'm10:free');
});

test('falls through every failure type and records them', async () => {
  const fails: Record<string, () => Response> = {
    'm1:free': () => new Response('boom', { status: 500 }),
    'm2:free': () => new Response('rate limited per minute', { status: 429 }),
    'm3:free': () => envelope(''),
    'm4:free': () => envelope('not json at all'),
    'm5:free': () => envelope(JSON.stringify({ language_detected: 'en' })), // schema: no reply
    'm6:free': () => good('சூப்பர், நல்லா சாப்பிட்டியா!'), // wrong language for tanglish
    'm7:free': () => good('As an AI language model I think dosai is fine.'),
    'm8:free': () => new Response(JSON.stringify({ error: { code: 502, message: 'upstream' } }), { status: 200 }),
  };
  const { deps, recorded } = makeDeps(models(10), (m) => (fails[m] ? fails[m]!() : good()));
  const r = await routeLLM(deps, { ...baseOpts, caps: [...baseOpts.caps] });
  assert(r.ok);
  assertEquals(r.ok && r.modelId, 'm9:free');
  assertEquals(recorded.filter((x) => !x.ok).length, 8);
  assertEquals(r.attempts.length, 9);
});

test('timeout moves on to next model', async () => {
  const { deps } = makeDeps(models(3), (m) => (m === 'm1:free' ? 'hang' : good()));
  const r = await routeLLM(deps, { ...baseOpts, caps: [...baseOpts.caps], perModelTimeoutMs: 50 });
  assert(r.ok);
  assertEquals(r.attempts[0]!.reason, 'timeout');
});

test('daily-limit 429 stops the loop immediately', async () => {
  const { deps, called, recorded } = makeDeps(models(10), () =>
    new Response('{"error":{"message":"Rate limit exceeded: free-models-per-day"}}', { status: 429 }));
  const r = await routeLLM(deps, { ...baseOpts, caps: [...baseOpts.caps] });
  assertEquals(r.ok, false);
  assertEquals(!r.ok && r.reason, 'daily_limit');
  assertEquals(called.length, 1);
  assertEquals(recorded.length, 0);
});

test('unhealthy models are skipped (circuit breaker)', async () => {
  const future = new Date(Date.now() + 10 * 60_000).toISOString();
  const { deps, called } = makeDeps(models(3, [{ unhealthy_until: future }]), () => good());
  const r = await routeLLM(deps, { ...baseOpts, caps: [...baseOpts.caps] });
  assert(r.ok);
  assertEquals(called, ['m2:free']);
});

test('capability filter', () => {
  const rows = models(3, [{ caps: ['chat', 'json'] }, {}, { caps: ['vision'] }]);
  assertEquals(selectModels(rows, ['chat', 'tanglish'], Date.now()).map((m) => m.model_id), ['m2:free']);
  assertEquals(selectModels(rows, ['vision'], Date.now()).map((m) => m.model_id), ['m3:free']);
});

test('budget: every attempt counts, stops when exhausted', async () => {
  const { deps, usage } = makeDeps(models(10), () => new Response('x', { status: 500 }), 47);
  const r = await routeLLM(deps, { ...baseOpts, caps: [...baseOpts.caps] });
  assertEquals(!r.ok && r.reason, 'budget_exhausted');
  assertEquals(usage(), 50);
  assertEquals(r.attempts.length, 3);
});

test('no matching models', async () => {
  const { deps } = makeDeps([], () => good());
  const r = await routeLLM(deps, { ...baseOpts, caps: [...baseOpts.caps] });
  assertEquals(!r.ok && r.reason, 'no_models');
});
