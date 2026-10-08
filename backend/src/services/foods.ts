// Food resolver wiring (synonyms → cache → USDA → Open Food Facts → LLM ingredient breakdown) and turning
// resolved foods into food_logs. The LLM only names foods; every number is computed here.
import { offSearch, resolveFood, usdaSearch, type NewFood, type ResolverDeps } from '../core/food-resolver.ts';
import { canonicalUnit, nutrientsFor, toGrams, type FoodRow, type UnitRow } from '../core/food.ts';
import { ingredientBreakdownPrompt } from '../core/prompts/companion.ts';
import { IngredientBreakdown } from '../core/schemas.ts';
import { DuplicateKeyError } from '../store/collection.ts';
import type { Store, UserScope } from '../store/index.ts';
import type { FoodDoc, FoodLogDoc, Meal } from '../store/types.ts';
import type { Services } from './context.ts';

const toRow = (f: FoodDoc): FoodRow => ({
  id: f.id,
  canonical_name: f.canonical_name,
  kcal: f.kcal,
  protein_g: f.protein_g,
  carbs_g: f.carbs_g,
  fat_g: f.fat_g,
  fiber_g: f.fiber_g,
  sugar_g: f.sugar_g,
  added_sugar_g: f.added_sugar_g,
  veg_fraction: f.veg_fraction,
  typical_serving_g: f.typical_serving_g,
  gi_band: f.gi_band,
  is_liquid: f.is_liquid,
});

// Per-process caches of small reference tables (refreshed when new foods are learned).
let synonymCache: { store: Store; rows: { alias: string; food_id: string }[] } | null = null;
let unitCache: { store: Store; rows: UnitRow[] } | null = null;

export async function loadUnits(store: Store): Promise<UnitRow[]> {
  if (unitCache?.store !== store) {
    const rows = (await store.shared.household_units.find()).map((u) => ({ unit_name: u.unit_name, grams_or_ml: u.grams_or_ml, applies_to: u.applies_to }));
    unitCache = { store, rows };
  }
  return unitCache.rows;
}

export function resolverDeps(s: Services): ResolverDeps {
  const { store } = s;
  return {
    synonyms: async () => {
      if (synonymCache?.store !== store) {
        const rows = (await store.shared.food_synonyms.find()).map((x) => ({ alias: x.alias, food_id: x.food_id }));
        synonymCache = { store, rows };
      }
      return synonymCache.rows;
    },
    foodById: async (id) => {
      const f = await store.shared.foods.findOne({ id });
      return f ? toRow(f) : null;
    },
    foodByCanonical: async (name) => {
      const f = await store.shared.foods.findOne({ canonical_name: { $in: [name, `~${name}`] } });
      return f ? toRow(f) : null;
    },
    usda: (name) => (s.env.USDA_API_KEY ? usdaSearch(name, s.env.USDA_API_KEY, s.fetch) : Promise.resolve(null)),
    off: (name) => offSearch(name, s.fetch),
    breakdown: async (name) => {
      const r = await s.llm.call({
        caps: ['chat', 'json'],
        messages: [{ role: 'user', content: ingredientBreakdownPrompt(name) }],
        temperature: 0.2,
        schema: IngredientBreakdown,
        maxModels: 3,
        maxTokens: 400,
      });
      return r.ok ? r.data : null;
    },
    saveFood: async (food: NewFood, alias) => {
      const existing = await store.shared.foods.findOne({ canonical_name: food.canonical_name });
      const saved = existing ?? (await store.shared.foods.insertOne({ ...food, external_id: food.external_id ?? null }));
      const language = /[஀-௿]/.test(alias) ? 'ta' : 'en';
      try {
        await store.shared.food_synonyms.insertOne({ food_id: saved.id, alias, language });
        synonymCache?.rows.push({ alias, food_id: saved.id });
      } catch (e) {
        if (!(e instanceof DuplicateKeyError)) throw e;
      }
      return toRow(saved);
    },
  };
}

export interface FoodInput {
  name: string;
  quantity: number | null;
  unit: string | null;
  grams?: number | null;
  meal: Meal;
}

/** Resolves foods and inserts food_logs. Returns the inserted logs (for undo chips). */
export async function logFoods(
  s: Services,
  u: UserScope,
  day: string,
  items: FoodInput[],
  source: FoodLogDoc['source'],
  messageId: string | null,
): Promise<FoodLogDoc[]> {
  if (items.length === 0) return [];
  const deps = resolverDeps(s);
  const units = await loadUnits(s.store);
  const rows: Omit<FoodLogDoc, 'id' | 'created_at' | 'user_id'>[] = [];
  for (const item of items) {
    const r = await resolveFood(item.name, deps);
    const quantity = item.quantity ?? r.quantityFromName ?? 1;
    const base = {
      day,
      meal: item.meal,
      item_name: item.name,
      quantity,
      unit: canonicalUnit(item.unit),
      source,
      source_message_id: messageId,
    };
    if (!r.food) {
      rows.push({
        ...base, matched_food_id: null, grams: null, kcal: null, protein_g: null, carbs_g: null, fat_g: null,
        fiber_g: null, sugar_g: null, added_sugar_g: null, veg_g: null, gi_band: 'unknown', is_estimate: true,
      });
      continue;
    }
    const grams = item.grams ?? toGrams(quantity, item.unit, r.food, units);
    rows.push({
      ...base,
      matched_food_id: r.food.id,
      grams: Math.round(grams),
      ...nutrientsFor(r.food, grams),
      gi_band: r.food.gi_band,
      is_estimate: r.isEstimate || source === 'photo',
    });
  }
  return u.food_logs.insertMany(rows);
}
