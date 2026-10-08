// LLM router: walks enabled OpenRouter :free models in priority order, with its own validation,
// per-model timeout, overall deadline, circuit breaker and daily request budget.
// Model IDs come from the llm_models table only; nothing is hardcoded here.
import type { z } from 'zod';
import { extractJson } from './schemas.ts';

export type Cap = 'chat' | 'json' | 'vision' | 'tamil_script' | 'tanglish';

export interface ModelRow {
  model_id: string;
  priority: number;
  caps: string[];
  enabled: boolean;
  supports_response_format: boolean;
  unhealthy_until: string | null;
}

export type ChatContent = string | ({ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } })[];
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: ChatContent;
}

export interface RouterDeps {
  loadModels(): Promise<ModelRow[]>;
  recordAttempt(modelId: string, ok: boolean, latencyMs: number, error?: string): Promise<void>;
  getUsage(): Promise<number>;
  bumpUsage(): Promise<number>;
  fetch: typeof fetch;
  apiKey: string;
  now(): number;
}

export interface RouteOptions<T> {
  caps: Cap[];
  messages: ChatMessage[];
  temperature: number;
  schema: z.ZodType<T>;
  /** Extra acceptance check on parsed data; return a reason string to reject. */
  accept?: (data: T) => string | null;
  dailyBudget: number;
  maxModels?: number;
  perModelTimeoutMs?: number;
  overallTimeoutMs?: number;
  maxTokens?: number;
}

export interface Attempt {
  modelId: string;
  ok: boolean;
  reason?: string;
  latencyMs: number;
}

export type RouteResult<T> =
  | { ok: true; data: T; modelId: string; attempts: Attempt[] }
  | { ok: false; reason: 'budget_exhausted' | 'daily_limit' | 'all_failed' | 'no_models' | 'deadline'; attempts: Attempt[] };

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export function selectModels(models: ModelRow[], caps: Cap[], nowMs: number, max = 10): ModelRow[] {
  return models
    .filter((m) => m.enabled)
    .filter((m) => caps.every((c) => m.caps.includes(c)))
    .filter((m) => !m.unhealthy_until || Date.parse(m.unhealthy_until) <= nowMs)
    .sort((a, b) => a.priority - b.priority)
    .slice(0, max);
}

class AttemptError extends Error {
  constructor(public reason: string, public dailyLimit = false) {
    super(reason);
  }
}

function isDailyLimit(status: number, body: string): boolean {
  return status === 429 && /per[- _]?day|daily|free-models-per-day/i.test(body);
}

export async function routeLLM<T>(deps: RouterDeps, opts: RouteOptions<T>): Promise<RouteResult<T>> {
  const start = deps.now();
  const deadline = start + (opts.overallTimeoutMs ?? 50_000);
  const perModel = opts.perModelTimeoutMs ?? 15_000;
  const attempts: Attempt[] = [];

  const candidates = selectModels(await deps.loadModels(), opts.caps, start, opts.maxModels ?? 10);
  if (candidates.length === 0) return { ok: false, reason: 'no_models', attempts };

  for (const model of candidates) {
    const remaining = deadline - deps.now();
    if (remaining <= 1000) return { ok: false, reason: 'deadline', attempts };
    if ((await deps.getUsage()) >= opts.dailyBudget) return { ok: false, reason: 'budget_exhausted', attempts };

    await deps.bumpUsage(); // every attempt may count against the provider's daily cap
    const t0 = deps.now();
    try {
      const data = await attempt(deps, model, opts, Math.min(perModel, remaining));
      const latency = deps.now() - t0;
      attempts.push({ modelId: model.model_id, ok: true, latencyMs: latency });
      await deps.recordAttempt(model.model_id, true, latency);
      return { ok: true, data, modelId: model.model_id, attempts };
    } catch (e) {
      const latency = deps.now() - t0;
      const reason = e instanceof AttemptError ? e.reason : e instanceof Error ? e.message : String(e);
      attempts.push({ modelId: model.model_id, ok: false, reason, latencyMs: latency });
      if (e instanceof AttemptError && e.dailyLimit) {
        // The account-wide free quota is gone: other models will fail too. Don't mark this model unhealthy.
        return { ok: false, reason: 'daily_limit', attempts };
      }
      await deps.recordAttempt(model.model_id, false, latency, reason);
    }
  }
  return { ok: false, reason: 'all_failed', attempts };
}

async function attempt<T>(deps: RouterDeps, model: ModelRow, opts: RouteOptions<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await deps.fetch(OPENROUTER_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${deps.apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'Companion',
      },
      body: JSON.stringify({
        model: model.model_id,
        messages: opts.messages,
        temperature: opts.temperature,
        max_tokens: opts.maxTokens ?? 900,
        ...(model.supports_response_format ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
  } catch (e) {
    throw new AttemptError(controller.signal.aborted ? 'timeout' : `network: ${e instanceof Error ? e.message : e}`);
  } finally {
    clearTimeout(timer);
  }

  const body = await res.text();
  if (!res.ok) throw new AttemptError(`http_${res.status}: ${body.slice(0, 160)}`, isDailyLimit(res.status, body));

  let content: unknown;
  try {
    const parsed = JSON.parse(body);
    // OpenRouter sometimes returns 200 with an error object inside.
    if (parsed?.error) {
      const msg = JSON.stringify(parsed.error).slice(0, 160);
      throw new AttemptError(`provider_error: ${msg}`, isDailyLimit(Number(parsed.error.code), msg));
    }
    content = parsed?.choices?.[0]?.message?.content;
  } catch (e) {
    if (e instanceof AttemptError) throw e;
    throw new AttemptError('bad_envelope');
  }
  if (typeof content !== 'string' || !content.trim()) throw new AttemptError('empty_content');

  let json: unknown;
  try {
    json = extractJson(content);
  } catch {
    throw new AttemptError('invalid_json');
  }
  const result = opts.schema.safeParse(json);
  if (!result.success) throw new AttemptError(`schema: ${result.error.issues[0]?.path.join('.') ?? ''} ${result.error.issues[0]?.message ?? ''}`);
  const rejection = opts.accept?.(result.data);
  if (rejection) throw new AttemptError(rejection);
  return result.data;
}
