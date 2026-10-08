// Food name normalisation, unit conversion and nutrient scaling. The LLM only names foods
// and quantities; everything numeric happens here.

export type GiBand = 'low' | 'medium' | 'high' | 'unknown';

export interface FoodRow {
  id: string;
  canonical_name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  added_sugar_g: number;
  veg_fraction: number;
  typical_serving_g: number | null;
  gi_band: GiBand;
  is_liquid: boolean;
}

export interface UnitRow {
  unit_name: string;
  grams_or_ml: number;
  applies_to: string | null;
}

export interface Nutrients {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  added_sugar_g: number;
  veg_g: number;
}

/** Lowercase, trim, strip punctuation. Keeps Tamil letters and vowel signs intact. */
export function normalizeFoodName(raw: string): string {
  return raw
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Collapses Tanglish spelling variants to one key: dosa/dosai/thosai, idli/idly/itli,
 * sadam/saadham/satham, kuzhambu/kulambu. Tamil script has one letter for k/g, t/d, p/b, s/ch/j,
 * so those pairs fold together. Tamil-script text is returned unchanged.
 */
export function foldTanglish(normalized: string): string {
  if (/[஀-௿]/.test(normalized)) return normalized;
  return normalized
    .split(' ')
    .map((w) =>
      w
        .replace(/oo/g, 'u')
        .replace(/ee/g, 'i')
        .replace(/zh/g, 'l')
        .replace(/ch/g, 's')
        .replace(/([tdkgpbs])h/g, '$1')
        .replace(/[gdbjcwyz]/g, (c) => ({ g: 'k', d: 't', b: 'p', j: 's', c: 'k', w: 'v', y: 'i', z: 'l' })[c]!)
        .replace(/(.)\1+/g, '$1')
        .replace(/ai$/, 'a')
        .replace(/(?<=[^aeiou])u$/, ''),
    )
    .join(' ');
}

/** Leading quantity words in Tamil/Tanglish/English, in case the model leaves them in the name. */
const NUMBER_WORDS: Record<string, number> = {
  oru: 1, onnu: 1, one: 1, a: 1, an: 1, ஒரு: 1, ஒன்று: 1,
  rendu: 2, irandu: 2, two: 2, இரண்டு: 2, ரெண்டு: 2,
  moonu: 3, munu: 3, three: 3, மூன்று: 3, மூணு: 3,
  naalu: 4, four: 4, நாலு: 4, நான்கு: 4,
  anju: 5, ainthu: 5, five: 5, அஞ்சு: 5, ஐந்து: 5,
  half: 0.5, ara: 0.5, arai: 0.5, அரை: 0.5,
};

export function stripQuantityWords(normalized: string): { name: string; quantity: number | null } {
  const [first, ...rest] = normalized.split(' ');
  if (first !== undefined && rest.length > 0 && first in NUMBER_WORDS) {
    return { name: rest.join(' '), quantity: NUMBER_WORDS[first]! };
  }
  return { name: normalized, quantity: null };
}

const UNIT_ALIASES: Record<string, string> = {
  pieces: 'piece', pcs: 'piece', pc: 'piece', nos: 'piece', no: 'piece',
  ladle: 'karandi', ladles: 'karandi', karandis: 'karandi', கரண்டி: 'karandi',
  tumblers: 'tumbler', டம்ளர்: 'tumbler', glasses: 'glass',
  cups: 'cup', bowls: 'bowl', kinnam: 'bowl', plates: 'plate', thattu: 'plate',
  gram: 'g', grams: 'g', gm: 'g', gms: 'g', millilitre: 'ml', milliliter: 'ml',
  spoons: 'spoon', tbsp: 'tablespoon', tsp: 'teaspoon',
};

export function canonicalUnit(unit: string | null | undefined): string | null {
  if (!unit) return null;
  const u = normalizeFoodName(unit);
  return UNIT_ALIASES[u] ?? u;
}

/**
 * Grams (or ml) for a quantity + unit. Food-specific unit rows win over generic ones.
 * No unit means "pieces/servings": use the food's piece weight, then its typical serving.
 */
export function toGrams(
  quantity: number | null,
  unit: string | null,
  food: Pick<FoodRow, 'id' | 'typical_serving_g'>,
  units: UnitRow[],
): number {
  const qty = quantity && quantity > 0 ? quantity : 1;
  const u = canonicalUnit(unit);
  if (u === 'g' || u === 'ml') return qty;

  const lookup = (name: string) =>
    units.find((r) => r.unit_name === name && r.applies_to === food.id) ??
    units.find((r) => r.unit_name === name && r.applies_to === null);

  if (u === null || u === 'piece') {
    const piece = units.find((r) => r.unit_name === 'piece' && r.applies_to === food.id);
    return qty * (piece?.grams_or_ml ?? food.typical_serving_g ?? 100);
  }
  const row = lookup(u);
  return qty * (row?.grams_or_ml ?? food.typical_serving_g ?? 100);
}

export function nutrientsFor(food: FoodRow, grams: number): Nutrients {
  const f = grams / 100;
  const r = (x: number) => Math.round(x * f * 10) / 10;
  return {
    kcal: Math.round(food.kcal * f),
    protein_g: r(food.protein_g),
    carbs_g: r(food.carbs_g),
    fat_g: r(food.fat_g),
    fiber_g: r(food.fiber_g),
    sugar_g: r(food.sugar_g),
    added_sugar_g: r(food.added_sugar_g),
    veg_g: Math.round(grams * food.veg_fraction),
  };
}

/** Combine ingredient rows (from an LLM breakdown) into one per-100 g composite. */
export function compositeFood(
  parts: { food: FoodRow; grams: number }[],
): Omit<FoodRow, 'id' | 'canonical_name'> {
  const total = parts.reduce((s, p) => s + p.grams, 0) || 1;
  const sum = (k: keyof Nutrients) => parts.reduce((s, p) => s + nutrientsFor(p.food, p.grams)[k], 0);
  const per100 = (k: keyof Nutrients) => Math.round((sum(k) / total) * 1000) / 10;
  const carbs = parts.reduce((s, p) => s + p.food.carbs_g * p.grams, 0);
  const giWeighted = parts.filter((p) => p.food.gi_band !== 'unknown');
  const highCarb = giWeighted.filter((p) => p.food.gi_band === 'high').reduce((s, p) => s + p.food.carbs_g * p.grams, 0);
  const lowCarb = giWeighted.filter((p) => p.food.gi_band === 'low').reduce((s, p) => s + p.food.carbs_g * p.grams, 0);
  const gi_band: GiBand =
    carbs === 0 || giWeighted.length === 0 ? 'unknown' : highCarb / carbs > 0.5 ? 'high' : lowCarb / carbs > 0.5 ? 'low' : 'medium';
  return {
    kcal: Math.round((sum('kcal') / total) * 100),
    protein_g: per100('protein_g'),
    carbs_g: per100('carbs_g'),
    fat_g: per100('fat_g'),
    fiber_g: per100('fiber_g'),
    sugar_g: per100('sugar_g'),
    added_sugar_g: per100('added_sugar_g'),
    veg_fraction: Math.min(1, Math.round((sum('veg_g') / total) * 100) / 100),
    typical_serving_g: Math.round(total),
    gi_band,
    is_liquid: false,
  };
}
