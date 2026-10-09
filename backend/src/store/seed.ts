// Seeds shared reference data on startup: the Tamil food list and the LLM model registry.
// Foods are inserted once (later edits in the database are kept). Models: new ones are added and config
// fields (priority, caps, response_format) follow the JSON file; runtime health fields are never reset.
import foodsSeed from './seed/foods.json' with { type: 'json' };
import type { OrModel, SeedModel } from '../services/models.ts';
import { resolveSeedModel } from '../services/models.ts';
import modelsSeed from './seed/llm-models.json' with { type: 'json' };
import type { Store } from './index.ts';
import type { FoodDoc, GiBand } from './types.ts';

export async function seedFoods(store: Store): Promise<{ foods: number; synonyms: number; units: number }> {
  const s = store.shared;
  if ((await s.foods.count()) > 0) return { foods: 0, synonyms: 0, units: 0 };
  const foods = await s.foods.insertMany(
    foodsSeed.foods.map((f) => ({
      canonical_name: f.canonical_name,
      source: f.source as FoodDoc['source'],
      external_id: null,
      kcal: f.kcal ?? 0,
      protein_g: f.protein_g ?? 0,
      carbs_g: f.carbs_g ?? 0,
      fat_g: f.fat_g ?? 0,
      fiber_g: f.fiber_g ?? 0,
      sugar_g: f.sugar_g ?? 0,
      added_sugar_g: f.added_sugar_g ?? 0,
      veg_fraction: f.veg_fraction ?? 0,
      typical_serving_g: f.typical_serving_g,
      gi_band: f.gi_band as GiBand,
      is_liquid: f.is_liquid,
    })),
  );
  const idOf = new Map(foods.map((f) => [f.canonical_name, f.id]));
  const synonyms = await s.food_synonyms.insertMany(
    foodsSeed.synonyms
      .filter((x) => idOf.has(x.food))
      .map((x) => ({ food_id: idOf.get(x.food)!, alias: x.alias, language: x.language as 'en' | 'ta' | 'tanglish' })),
  );
  const units = await s.household_units.insertMany(
    foodsSeed.units.map((u) => ({
      unit_name: u.unit_name,
      language: u.language as 'en' | 'ta' | 'tanglish',
      grams_or_ml: u.grams_or_ml,
      applies_to: u.food ? (idOf.get(u.food) ?? null) : null,
      note: (u as { note?: string }).note ?? null,
    })),
  );
  return { foods: foods.length, synonyms: synonyms.length, units: units.length };
}

export interface ModelSync {
  synced: { model_id: string; priority: number; enabled: boolean; caps: string[] }[];
  /** Seed rows that could not be matched to a free model in the catalog. */
  unresolved: string[];
  /** Database rows no longer in the seed list, now disabled. */
  retired: string[];
}

/**
 * Seed list → llm_models. Names are resolved to ids through the live OpenRouter catalog (when we could fetch it);
 * vision and response_format support come from the catalog. Rows that left the list are disabled, but only when
 * the catalog was reachable, so a network blip at startup never switches every model off.
 */
export async function syncModels(store: Store, catalog: OrModel[] | null = null): Promise<ModelSync> {
  const out: ModelSync = { synced: [], unresolved: [], retired: [] };
  const keep = new Set<string>();
  for (const m of modelsSeed.models as SeedModel[]) {
    const live = catalog ? resolveSeedModel(m, catalog) : null;
    const id = live?.id ?? m.model_id ?? null;
    if (!live && catalog) out.unresolved.push(m.name ?? m.model_id ?? '?');
    if (!id) continue;
    keep.add(id);
    const vision = live ? (live.architecture?.input_modalities?.includes('image') ?? false) : m.caps.includes('vision');
    const caps = [...new Set([...m.caps.filter((c) => c !== 'vision'), ...(vision ? ['vision'] : [])])];
    const rf = live ? (live.supported_parameters?.includes('response_format') ?? false) : (m.supports_response_format ?? false);
    await store.shared.llm_models.updateOne(
      { model_id: id },
      { priority: m.priority, caps, enabled: m.enabled, supports_response_format: rf },
      {
        upsert: true,
        setOnInsert: {
          notes: m.notes ?? null,
          health_disabled: false,
          unhealthy_until: null,
          consecutive_fails: 0,
          success_count: 0,
          fail_count: 0,
          avg_latency_ms: null,
          last_error: null,
        },
      },
    );
    out.synced.push({ model_id: id, priority: m.priority, enabled: m.enabled, caps });
  }
  if (catalog && keep.size) {
    for (const row of await store.shared.llm_models.find({ enabled: true })) {
      if (keep.has(row.model_id)) continue;
      await store.shared.llm_models.updateOne({ model_id: row.model_id }, { enabled: false, notes: 'retired: no longer in the seed list' });
      out.retired.push(row.model_id);
    }
  }
  return out;
}
