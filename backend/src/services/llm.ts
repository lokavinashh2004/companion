// OpenRouter :free models with our own fallback loop (core/llm-router.ts): up to 10 models in priority order,
// per-model timeout, overall deadline, circuit breaker and a daily request budget, all stored in the database.
import { routeLLM, type RouteOptions, type RouteResult, type RouterDeps } from '../core/llm-router.ts';
import { todayIn } from '../core/dates.ts';
import type { Store } from '../store/index.ts';

export interface LlmClient {
  call<T>(opts: Omit<RouteOptions<T>, 'dailyBudget'>): Promise<RouteResult<T>>;
  /** Requests left today (the free quota resets at 00:00 UTC). */
  remaining(): Promise<number>;
}

export const usageDay = (now = new Date()) => todayIn('UTC', now);

export function storeRouterDeps(store: Store, apiKey: string, fetchFn: typeof fetch = fetch, now: () => number = Date.now): RouterDeps {
  const models = store.shared.llm_models;
  return {
    loadModels: async () =>
      (await models.find({ enabled: true, health_disabled: { $ne: true } }, { sort: { priority: 1 } })).map((m) => ({
        model_id: m.model_id,
        priority: m.priority,
        caps: m.caps,
        enabled: m.enabled,
        supports_response_format: m.supports_response_format,
        unhealthy_until: m.unhealthy_until,
      })),
    recordAttempt: async (modelId, ok, latencyMs, error) => {
      const m = await models.findOne({ model_id: modelId });
      if (!m) return;
      if (ok) {
        const n = Math.min(m.success_count, 50);
        await models.updateOne(
          { model_id: modelId },
          {
            success_count: m.success_count + 1,
            consecutive_fails: 0,
            unhealthy_until: null,
            last_error: null,
            avg_latency_ms: m.avg_latency_ms === null ? Math.round(latencyMs) : Math.round((m.avg_latency_ms * n + latencyMs) / (n + 1)),
          },
        );
      } else {
        const fails = m.consecutive_fails + 1;
        // Circuit breaker: skip for 15 min, or 30 min after three consecutive failures.
        const minutes = fails >= 3 ? 30 : 15;
        await models.updateOne(
          { model_id: modelId },
          {
            fail_count: m.fail_count + 1,
            consecutive_fails: fails,
            last_error: (error ?? '').slice(0, 300),
            unhealthy_until: new Date(now() + minutes * 60_000).toISOString(),
          },
        );
      }
    },
    getUsage: async () => (await store.shared.llm_usage.findOne({ day: usageDay(new Date(now())) }))?.requests ?? 0,
    bumpUsage: () => store.shared.llm_usage.inc({ day: usageDay(new Date(now())) }, 'requests', 1, { upsert: true }),
    fetch: fetchFn,
    apiKey,
    now,
  };
}

export function createLlmClient(store: Store, apiKey: string | undefined, dailyBudget: number): LlmClient {
  return {
    async call(opts) {
      if (!apiKey) return { ok: false, reason: 'no_models', attempts: [] };
      const result = await routeLLM(storeRouterDeps(store, apiKey), { ...opts, dailyBudget });
      // Model ids and reasons only; never prompt or reply text.
      console.log('llm', JSON.stringify({ ok: result.ok, attempts: result.attempts.map((a) => [a.modelId, a.ok ? 'ok' : a.reason]) }));
      return result;
    },
    async remaining() {
      const used = (await store.shared.llm_usage.findOne({ day: usageDay() }))?.requests ?? 0;
      return dailyBudget - used;
    },
  };
}
