// Resolves a food name to a foods row: synonyms -> cached foods -> USDA -> Open Food Facts -> LLM ingredient
// breakdown (is_estimate). Dependencies are injected so the order and caching are unit-testable.
import {
  compositeFood,
  foldTanglish,
  normalizeFoodName,
  stripQuantityWords,
  type FoodRow,
} from './food.ts';
import type { IngredientBreakdown } from './schemas.ts';

export type NewFood = Omit<FoodRow, 'id'> & { source: 'usda' | 'off' | 'custom'; external_id: string | null };

export interface ResolverDeps {
  /** All synonyms (alias -> food id); small table, loaded once per instance. */
  synonyms(): Promise<{ alias: string; food_id: string }[]>;
  foodById(id: string): Promise<FoodRow | null>;
  foodByCanonical(name: string): Promise<FoodRow | null>;
  usda(name: string): Promise<NewFood | null>;
  off(name: string): Promise<NewFood | null>;
  breakdown(name: string): Promise<IngredientBreakdown | null>;
  saveFood(food: NewFood, alias: string): Promise<FoodRow>;
}

export interface Resolved {
  food: FoodRow | null;
  isEstimate: boolean;
  via: 'synonym' | 'fold' | 'cache' | 'usda' | 'off' | 'llm' | 'none';
  /** Quantity found inside the name ("rendu dosai"), if the model left it there. */
  quantityFromName: number | null;
  name: string;
}

async function lookupLocal(name: string, deps: ResolverDeps): Promise<{ food: FoodRow; via: 'synonym' | 'fold' | 'cache' } | null> {
  const syns = await deps.synonyms();
  const exact = syns.find((s) => s.alias === name);
  if (exact) {
    const food = await deps.foodById(exact.food_id);
    if (food) return { food, via: 'synonym' };
  }
  const folded = foldTanglish(name);
  const fuzzy = syns.find((s) => foldTanglish(s.alias) === folded);
  if (fuzzy) {
    const food = await deps.foodById(fuzzy.food_id);
    if (food) return { food, via: 'fold' };
  }
  const cached = await deps.foodByCanonical(name);
  if (cached) return { food: cached, via: 'cache' };
  return null;
}

export async function resolveFood(raw: string, deps: ResolverDeps, allowLLM = true): Promise<Resolved> {
  const { name, quantity } = stripQuantityWords(normalizeFoodName(raw));
  const base = { quantityFromName: quantity, name };
  if (!name) return { ...base, food: null, isEstimate: true, via: 'none' };

  const local = await lookupLocal(name, deps);
  if (local) return { ...base, food: local.food, isEstimate: local.food.canonical_name.startsWith('~'), via: local.via };

  // Tamil-script names are not searchable in USDA/OFF; go straight to the breakdown.
  const latin = !/[஀-௿]/.test(name);
  if (latin) {
    for (const [via, search] of [['usda', deps.usda], ['off', deps.off]] as const) {
      const hit = await search(name).catch(() => null);
      if (hit) return { ...base, food: await deps.saveFood(hit, name), isEstimate: false, via };
    }
  }

  if (allowLLM) {
    const bd = await deps.breakdown(name).catch(() => null);
    if (bd) {
      const parts: { food: FoodRow; grams: number }[] = [];
      for (const ing of bd.ingredients) {
        const r = await resolveFood(ing.name, deps, false);
        if (r.food) parts.push({ food: r.food, grams: ing.grams });
      }
      if (parts.length > 0) {
        const composite = compositeFood(parts);
        const saved = await deps.saveFood(
          {
            ...composite,
            // '~' marks an estimated composite so later lookups keep is_estimate = true
            canonical_name: `~${name}`,
            typical_serving_g: bd.serving_grams ?? composite.typical_serving_g,
            source: 'custom',
            external_id: null,
          },
          name,
        );
        return { ...base, food: saved, isEstimate: true, via: 'llm' };
      }
    }
  }
  return { ...base, food: null, isEstimate: true, via: 'none' };
}

// ---------------------------------------------------------------- external APIs

const USDA_NUTRIENTS: Record<string, keyof NewFood> = {
  '208': 'kcal',
  '203': 'protein_g',
  '205': 'carbs_g',
  '204': 'fat_g',
  '291': 'fiber_g',
  '269': 'sugar_g',
};

/** Accept an external hit only if every query word appears in its description. */
export function plausibleMatch(query: string, description: string): boolean {
  const d = description.toLowerCase();
  return query.split(' ').filter((w) => w.length > 2).every((w) => d.includes(w));
}

export async function usdaSearch(name: string, apiKey: string, fetchFn: typeof fetch = fetch): Promise<NewFood | null> {
  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
  url.searchParams.set('query', name);
  url.searchParams.set('pageSize', '5');
  url.searchParams.set('dataType', 'Foundation,SR Legacy');
  url.searchParams.set('api_key', apiKey);
  const res = await fetchFn(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) return null;
  const body = await res.json() as { foods?: { fdcId: number; description: string; foodNutrients: { nutrientNumber?: string; value?: number }[] }[] };
  const hit = body.foods?.find((f) => plausibleMatch(name, f.description));
  if (!hit) return null;
  const food: NewFood = {
    canonical_name: name, source: 'usda', external_id: String(hit.fdcId),
    kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0, added_sugar_g: 0,
    veg_fraction: 0, typical_serving_g: 100, gi_band: 'unknown', is_liquid: false,
  };
  for (const n of hit.foodNutrients) {
    const key = n.nutrientNumber ? USDA_NUTRIENTS[n.nutrientNumber] : undefined;
    if (key && typeof n.value === 'number') (food as unknown as Record<string, number>)[key] = n.value;
  }
  return food.kcal > 0 || food.protein_g > 0 || food.carbs_g > 0 ? food : null;
}

export async function offSearch(name: string, fetchFn: typeof fetch = fetch): Promise<NewFood | null> {
  const url = new URL('https://world.openfoodfacts.org/cgi/search.pl');
  url.searchParams.set('search_terms', name);
  url.searchParams.set('search_simple', '1');
  url.searchParams.set('json', '1');
  url.searchParams.set('page_size', '5');
  url.searchParams.set('fields', 'code,product_name,nutriments');
  const res = await fetchFn(url, {
    headers: { 'User-Agent': 'CompanionPCOSApp/1.0 (private, non-commercial)' },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return null;
  const body = await res.json() as { products?: { code: string; product_name?: string; nutriments?: Record<string, number> }[] };
  const hit = body.products?.find((p) => p.product_name && p.nutriments?.['energy-kcal_100g'] !== undefined && plausibleMatch(name, p.product_name));
  if (!hit?.nutriments) return null;
  const n = hit.nutriments;
  return {
    canonical_name: name, source: 'off', external_id: hit.code,
    kcal: n['energy-kcal_100g'] ?? 0, protein_g: n['proteins_100g'] ?? 0, carbs_g: n['carbohydrates_100g'] ?? 0,
    fat_g: n['fat_100g'] ?? 0, fiber_g: n['fiber_100g'] ?? 0, sugar_g: n['sugars_100g'] ?? 0,
    // Packaged foods: treat listed sugars as added unless it's plainly fruit/dairy (conservative, used only for the score).
    added_sugar_g: n['sugars_100g'] ?? 0,
    veg_fraction: 0, typical_serving_g: 100, gi_band: 'unknown', is_liquid: false,
  };
}
