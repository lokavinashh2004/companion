// Seeds shared reference data on startup: the Tamil food list and the LLM model registry.
// Foods are inserted once (later edits in the database are kept). Models: new ones are added and config
// fields (priority, caps, response_format) follow the JSON file; runtime health fields are never reset.
import foodsSeed from './seed/foods.json' with { type: 'json' };
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

export async function syncModels(store: Store): Promise<number> {
  let n = 0;
  for (const m of modelsSeed.models) {
    await store.shared.llm_models.updateOne(
      { model_id: m.model_id },
      { priority: m.priority, caps: m.caps, enabled: m.enabled, supports_response_format: m.supports_response_format },
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
    n++;
  }
  return n;
}
