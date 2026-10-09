// OpenRouter helpers shared by startup, the llm-check job and scripts/check-models.ts:
// the public model catalog, matching seed entries to it by id or display name, a key check and a tiny probe.
// Never logs or returns the API key.
import { OPENROUTER_URL } from '../core/llm-router.ts';
import { isFree } from '../jobs/modelHealth.ts';

export interface OrModel {
  id: string;
  name: string;
  pricing?: { prompt?: string; completion?: string };
  supported_parameters?: string[];
  architecture?: { input_modalities?: string[] };
}

export interface SeedModel {
  /** OpenRouter display name, e.g. "NVIDIA: Nemotron 3 Ultra (free)". Resolved to an id from the catalog. */
  name?: string;
  /** Exact OpenRouter id, when known. Wins over the name if it is in the catalog. */
  model_id?: string | null;
  priority: number;
  caps: string[];
  enabled: boolean;
  supports_response_format?: boolean;
  notes?: string | null;
}

export async function fetchCatalog(fetchFn: typeof fetch = fetch, timeoutMs = 15_000): Promise<OrModel[]> {
  const res = await fetchFn('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`openrouter_models_${res.status}`);
  const { data } = (await res.json()) as { data: OrModel[] };
  return data;
}

/** A corporate proxy / captive portal answers with an HTML page instead of OpenRouter's JSON. */
const looksLikeHtml = (text: string) => /^\s*<(!doctype|html)/i.test(text);
const PROXY = 'blocked by a network proxy (got an HTML page, not OpenRouter); run this from a network that can reach openrouter.ai';

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\(free\)/g, '')
    .replace(/[^a-z0-9]+/g, '');
/** "NVIDIA: Nemotron 3 Ultra (free)" → "nemotron3ultra" (drops the vendor prefix). */
const bare = (s: string) => norm(s.replace(/^[^:]+:\s*/, ''));

/** The free catalog model a seed entry refers to: exact id first, then display name (with or without vendor). */
export function resolveSeedModel(entry: SeedModel, catalog: OrModel[]): OrModel | null {
  if (entry.model_id) {
    const byId = catalog.find((m) => m.id === entry.model_id);
    if (byId) return byId;
  }
  if (!entry.name) return null;
  const free = catalog.filter(isFree);
  return free.find((m) => norm(m.name) === norm(entry.name!)) ?? free.find((m) => bare(m.name) === bare(entry.name!)) ?? null;
}

export type KeyStatus =
  | { status: 'ok'; label: string | null; free_tier: boolean | null; usage: number | null; limit: number | null; limit_remaining: number | null }
  | { status: 'invalid'; http: number; error: string }
  | { status: 'missing' }
  | { status: 'unreachable'; error: string };

/** GET /api/v1/key: tells whether the key works (does not use any model quota). */
export async function checkKey(fetchFn: typeof fetch, apiKey: string | undefined): Promise<KeyStatus> {
  if (!apiKey) return { status: 'missing' };
  let res: Response;
  try {
    res = await fetchFn('https://openrouter.ai/api/v1/key', { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15_000) });
  } catch (e) {
    return { status: 'unreachable', error: e instanceof Error ? e.message : String(e) };
  }
  const text = await res.text();
  if (looksLikeHtml(text)) return { status: 'unreachable', error: PROXY };
  if (!res.ok) return { status: 'invalid', http: res.status, error: text.slice(0, 160) };
  try {
    const d = (JSON.parse(text) as { data?: Record<string, unknown> }).data ?? {};
    const num = (v: unknown) => (typeof v === 'number' ? v : null);
    return {
      status: 'ok',
      label: typeof d.label === 'string' ? d.label : null,
      free_tier: typeof d.is_free_tier === 'boolean' ? d.is_free_tier : null,
      usage: num(d.usage),
      limit: num(d.limit),
      limit_remaining: num(d.limit_remaining),
    };
  } catch {
    return { status: 'invalid', http: res.status, error: 'unexpected response (is a proxy in the way?)' };
  }
}

export interface ProbeResult {
  model_id: string;
  ok: boolean;
  latency_ms: number;
  error?: string;
}

/** One tiny request to a model: does it answer at all with this key? */
export async function probeModel(fetchFn: typeof fetch, apiKey: string, modelId: string, timeoutMs = 25_000): Promise<ProbeResult> {
  const t0 = Date.now();
  const done = (ok: boolean, error?: string): ProbeResult => ({ model_id: modelId, ok, latency_ms: Date.now() - t0, ...(error ? { error } : {}) });
  let res: Response;
  try {
    res = await fetchFn(OPENROUTER_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-Title': 'Companion' },
      body: JSON.stringify({
        model: modelId,
        temperature: 0,
        max_tokens: 400, // reasoning models spend tokens thinking before they answer
        reasoning: { effort: 'low', exclude: true },
        messages: [{ role: 'user', content: 'Reply with exactly {"ok":true} and nothing else.' }],
      }),
    });
  } catch (e) {
    return done(false, e instanceof Error && e.name === 'TimeoutError' ? 'timeout' : `network: ${e instanceof Error ? e.message : e}`);
  }
  const body = await res.text();
  if (looksLikeHtml(body)) return done(false, PROXY);
  if (!res.ok) return done(false, `http_${res.status}: ${body.slice(0, 160)}`);
  try {
    const parsed = JSON.parse(body) as { error?: unknown; choices?: { finish_reason?: string; message?: { content?: unknown; reasoning?: unknown } }[] };
    if (parsed.error) return done(false, `provider_error: ${JSON.stringify(parsed.error).slice(0, 160)}`);
    const choice = parsed.choices?.[0];
    const text = typeof choice?.message?.content === 'string' ? choice.message.content.trim() : '';
    if (text) return done(true);
    if (choice?.finish_reason === 'length' || choice?.message?.reasoning) return done(false, 'empty_content: still reasoning when the token limit hit');
    return done(false, `empty_content (finish_reason ${choice?.finish_reason ?? 'none'})`);
  } catch {
    return done(false, 'bad_envelope');
  }
}

/** One log line for the key status, without the key. */
export function describeKey(k: KeyStatus): string {
  switch (k.status) {
    case 'ok': {
      const parts = [k.label ? `label "${k.label}"` : null, k.free_tier === null ? null : k.free_tier ? 'free tier' : 'paid', k.usage === null ? null : `usage $${k.usage.toFixed(2)}`, k.limit === null ? 'no credit limit' : `limit $${k.limit}`];
      return `OpenRouter key OK (${parts.filter(Boolean).join(', ')})`;
    }
    case 'invalid':
      return `OpenRouter key REJECTED (HTTP ${k.http}): ${k.error}. Create a new key at openrouter.ai/keys and set OPENROUTER_API_KEY on Render.`;
    case 'missing':
      return 'OPENROUTER_API_KEY is not set: chat replies will use the built-in fallback message.';
    case 'unreachable':
      return `OpenRouter unreachable: ${k.error}`;
  }
}
