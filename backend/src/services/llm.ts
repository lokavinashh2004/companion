// OpenRouter :free models with our own fallback loop (core/llm-router.ts): up to 10 models in priority order,
// per-model timeout, overall deadline, circuit breaker and a daily request budget, all stored in the database.
import { routeLLM, type RouteOptions, type RouteResult, type RouterDeps } from '../core/llm-router.ts';
import { todayIn } from '../core/dates.ts';
import type { Store } from '../store/index.ts';
import { checkKey, describeKey, probeModel, type KeyStatus, type ProbeResult } from './models.ts';

export interface LlmClient {
  call<T>(opts: Omit<RouteOptions<T>, 'dailyBudget'>): Promise<RouteResult<T>>;
  /** Requests left today (the free quota resets at 00:00 UTC). */
  remaining(): Promise<number>;
  /** Key check, plus (probe: true) one tiny request to every enabled model. Logs a line per model. */
  check?(opts: { probe: boolean }): Promise<LlmCheckReport>;
}

export interface LlmCheckReport {
  key: KeyStatus;
  models: ProbeResult[];
  answering: number;
  first_working: string | null;
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

export function createLlmClient(store: Store, apiKey: string | undefined, dailyBudget: number, fetchFn: typeof fetch = fetch): LlmClient {
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
    async check({ probe }) {
      const key = await checkKey(fetchFn, apiKey);
      console.log(`llm: ${describeKey(key)}`);
      const report: LlmCheckReport = { key, models: [], answering: 0, first_working: null };
      if (!probe || key.status !== 'ok' || !apiKey) return report;
      const deps = storeRouterDeps(store, apiKey, fetchFn);
      const rows = (await store.shared.llm_models.find({ enabled: true, health_disabled: { $ne: true } }, { sort: { priority: 1 } })).slice(0, 12);
      if (!rows.length) console.warn('llm: no enabled models in llm_models; check src/store/seed/llm-models.json');
      for (const [i, row] of rows.entries()) {
        await deps.bumpUsage(); // probes count against the free daily quota
        const r = await probeModel(fetchFn, apiKey, row.model_id);
        await deps.recordAttempt(row.model_id, r.ok, r.latency_ms, r.error);
        report.models.push(r);
        console.log(`llm: probe ${i + 1}/${rows.length} ${row.model_id} ${r.ok ? `ok ${r.latency_ms}ms` : `FAILED ${r.error}`}`);
        if (r.ok) report.first_working ??= row.model_id;
        if (r.error && /^http_429/.test(r.error) && /per[- _]?day|daily|free-models-per-day/i.test(r.error)) {
          console.warn('llm: daily free-model limit reached; stopping the probe');
          break;
        }
      }
      report.answering = report.models.filter((m) => m.ok).length;
      console.log(
        report.first_working
          ? `llm: ${report.answering}/${report.models.length} models answering; replies start with ${report.first_working}`
          : `llm: NO model answered (${report.models.length} tried). Chat will use the fallback message until one does.`,
      );
      return report;
    },
  };
}
