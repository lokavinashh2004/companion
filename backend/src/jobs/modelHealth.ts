// Weekly: disables models that no longer exist on OpenRouter or are no longer free, re-enables ones that
// came back, and refreshes response_format / vision support. Logs every change.
import type { Store } from '../store/index.ts';

interface OrModel {
  id: string;
  pricing?: { prompt?: string; completion?: string };
  supported_parameters?: string[];
  architecture?: { input_modalities?: string[] };
}

export function isFree(m: OrModel): boolean {
  return m.id.endsWith(':free') || (Number(m.pricing?.prompt ?? 1) === 0 && Number(m.pricing?.completion ?? 1) === 0);
}

export async function runModelHealth(store: Store, fetchFn: typeof fetch = fetch): Promise<{ checked: number; changes: string[] }> {
  const res = await fetchFn('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`openrouter_${res.status}`);
  const { data } = (await res.json()) as { data: OrModel[] };
  const live = new Map(data.map((m) => [m.id, m]));
  const changes: string[] = [];
  const rows = await store.shared.llm_models.find();
  for (const row of rows) {
    const m = live.get(row.model_id);
    const healthy = !!m && isFree(m);
    if (!healthy && !row.health_disabled) {
      await store.shared.llm_models.updateOne({ model_id: row.model_id }, { health_disabled: true, notes: `disabled by model-health: ${m ? 'no longer free' : 'not found'}` });
      changes.push(`disabled ${row.model_id}`);
      continue;
    }
    if (healthy && row.health_disabled) {
      await store.shared.llm_models.updateOne({ model_id: row.model_id }, { health_disabled: false, notes: 're-enabled by model-health' });
      changes.push(`re-enabled ${row.model_id}`);
    }
    if (!m) continue;
    const rf = m.supported_parameters?.includes('response_format') ?? false;
    if (rf !== row.supports_response_format) {
      await store.shared.llm_models.updateOne({ model_id: row.model_id }, { supports_response_format: rf });
      changes.push(`${row.model_id} response_format=${rf}`);
    }
    const vision = m.architecture?.input_modalities?.includes('image') ?? false;
    if (row.caps.includes('vision') && !vision) {
      await store.shared.llm_models.updateOne({ model_id: row.model_id }, { caps: row.caps.filter((c) => c !== 'vision') });
      changes.push(`${row.model_id} lost vision`);
    }
  }
  console.log('model-health', JSON.stringify(changes));
  return { checked: rows.length, changes };
}
