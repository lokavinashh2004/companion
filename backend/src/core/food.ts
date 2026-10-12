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

/** Size words scale a portion: "big dosai", "chinna idli", "large bowl". */
const SIZE_WORDS: Record<string, number> = {
  small: 0.7, chinna: 0.7, sinna: 0.7, siriya: 0.7, mini: 0.7, சின்ன: 0.7, சிறிய: 0.7,
  medium: 1, regular: 1, normal: 1,
  large: 1.4, big: 1.4, periya: 1.4, perusa: 1.4, பெரிய: 1.4,
  half: 0.5, ara: 0.5, arai: 0.5, அரை: 0.5, quarter: 0.25, kaal: 0.25, கால்: 0.25, full: 1, mulu: 1,
};

/** Leading number word, then an optional size word: "rendu periya dosai" → 2 × 1.4 × dosai. */
export function stripQuantityWords(normalized: string): { name: string; quantity: number | null; size: number | null } {
  const words = normalized.split(' ');
  let quantity: number | null = null;
  let size: number | null = null;
  if (words.length > 1 && words[0]! in NUMBER_WORDS) quantity = NUMBER_WORDS[words.shift()!]!;
  if (words.length > 1 && words[0]! in SIZE_WORDS) size = SIZE_WORDS[words.shift()!]!;
  return { name: words.join(' '), quantity, size };
}

const UNIT_ALIASES: Record<string, string> = {
  pieces: 'piece', pcs: 'piece', pc: 'piece', nos: 'piece', no: 'piece',
  ladle: 'karandi', ladles: 'karandi', karandis: 'karandi', கரண்டி: 'karandi',
  tumblers: 'tumbler', டம்ளர்: 'tumbler', glasses: 'glass',
  cups: 'cup', bowls: 'bowl', kinnam: 'bowl', plates: 'plate', thattu: 'plate',
  gram: 'g', grams: 'g', gm: 'g', gms: 'g', millilitre: 'ml', milliliter: 'ml',
  spoons: 'spoon', tbsp: 'tablespoon', tsp: 'teaspoon', tbsps: 'tablespoon', tsps: 'teaspoon',
  tablespoons: 'tablespoon', teaspoons: 'teaspoon', slices: 'slice', katori: 'bowl', katoris: 'bowl',
  kilogram: 'kg', kilograms: 'kg', kgs: 'kg', kilo: 'kg', milligram: 'mg', milligrams: 'mg',
  litre: 'l', liter: 'l', litres: 'l', liters: 'l', ltr: 'l', ounce: 'oz', ounces: 'oz', pound: 'lb', pounds: 'lb', lbs: 'lb',
  ml: 'ml', mls: 'ml',
};

/** Weight/volume units with a fixed size in grams (ml counted as grams). */
const METRIC: Record<string, number> = { g: 1, ml: 1, kg: 1000, mg: 0.001, l: 1000, oz: 28.35, lb: 453.6 };

export function canonicalUnit(unit: string | null | undefined): string | null {
  if (!unit) return null;
  const u = normalizeFoodName(unit);
  return UNIT_ALIASES[u] ?? u;
}

/**
 * Grams (or ml) for a quantity + unit, and whether the unit was understood. Metric/imperial units convert exactly;
 * household units use food-specific rows first, then generic ones. A size word in the unit scales it ("large bowl",
 * "half plate"). No unit means "pieces/servings": the food's piece weight, then its typical serving. An unknown
 * unit falls back to one typical serving per quantity and is reported as not understood (so it's an estimate).
 */
export function measure(
  quantity: number | null,
  unit: string | null,
  food: Pick<FoodRow, 'id' | 'typical_serving_g'>,
  units: UnitRow[],
): { grams: number; known: boolean } {
  const qty = quantity && quantity > 0 ? quantity : 1;
  let size = 1;
  let u: string | null = null;
  if (unit) {
    const words = normalizeFoodName(unit).split(' ').filter(Boolean);
    while (words.length > 0 && words[0]! in SIZE_WORDS) size *= SIZE_WORDS[words.shift()!]!;
    u = words.length ? canonicalUnit(words.join(' ')) : null;
  }
  const g = (x: number) => Math.round(x * 10) / 10;
  if (u && u in METRIC) return { grams: g(qty * size * METRIC[u]!), known: true };

  const serving = food.typical_serving_g ?? 100;
  if (u === null || u === 'piece') {
    const piece = units.find((r) => r.unit_name === 'piece' && r.applies_to === food.id);
    return { grams: g(qty * size * (piece?.grams_or_ml ?? serving)), known: true };
  }
  const row = units.find((r) => r.unit_name === u && r.applies_to === food.id) ?? units.find((r) => r.unit_name === u && r.applies_to === null);
  return { grams: g(qty * size * (row?.grams_or_ml ?? serving)), known: !!row };
}

export function toGrams(quantity: number | null, unit: string | null, food: Pick<FoodRow, 'id' | 'typical_serving_g'>, units: UnitRow[]): number {
  return measure(quantity, unit, food, units).grams;
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
