// PCOS-friendly "balance" score, 0–10, computed from the day's food logs.
// Shown as encouragement ("good protein today"), never as a grade.

export interface ScoreItem {
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fiber_g: number | null;
  added_sugar_g: number | null;
  veg_g: number | null;
  gi_band: 'low' | 'medium' | 'high' | 'unknown';
}

export type Highlight = 'protein' | 'fiber' | 'low_gi' | 'low_sugar' | 'veggies';
export type Idea = 'add_protein' | 'add_fiber' | 'add_veggies' | 'swap_low_gi';

export interface BalanceScore {
  score: number;
  highlights: Highlight[];
  /** At most one gentle idea, only when there is something to suggest. */
  idea: Idea | null;
  totals: {
    kcal: number;
    protein_g: number;
    carbs_g: number;
    fiber_g: number;
    added_sugar_g: number;
    veg_g: number;
    protein_pct: number;
    low_gi_carb_pct: number;
  };
}

const n = (x: number | null) => x ?? 0;

export function balanceScore(items: ScoreItem[]): BalanceScore | null {
  if (items.length === 0) return null;
  const kcal = items.reduce((s, i) => s + n(i.kcal), 0);
  const protein = items.reduce((s, i) => s + n(i.protein_g), 0);
  const carbs = items.reduce((s, i) => s + n(i.carbs_g), 0);
  const fiber = items.reduce((s, i) => s + n(i.fiber_g), 0);
  const sugar = items.reduce((s, i) => s + n(i.added_sugar_g), 0);
  const veg = items.reduce((s, i) => s + n(i.veg_g), 0);
  const knownCarbs = items.filter((i) => i.gi_band !== 'unknown').reduce((s, i) => s + n(i.carbs_g), 0);
  const lowCarbs = items.filter((i) => i.gi_band === 'low').reduce((s, i) => s + n(i.carbs_g), 0);

  const proteinPct = kcal > 0 ? (protein * 4 * 100) / kcal : 0;
  const lowGiPct = knownCarbs > 0 ? (lowCarbs * 100) / knownCarbs : 0;

  // Each part scores 0–2; total 0–10.
  const pProtein = proteinPct >= 20 ? 2 : proteinPct >= 15 ? 1 : 0;
  const pFiber = fiber >= 25 ? 2 : fiber >= 12 ? 1 : 0;
  const pLowGi = knownCarbs === 0 ? 1 : lowGiPct >= 50 ? 2 : lowGiPct >= 30 ? 1 : 0;
  const pSugar = sugar <= 10 ? 2 : sugar <= 25 ? 1 : 0;
  const pVeg = veg >= 250 ? 2 : veg >= 120 ? 1 : 0;

  const highlights: Highlight[] = [];
  if (pProtein === 2) highlights.push('protein');
  if (pFiber === 2) highlights.push('fiber');
  if (pLowGi === 2) highlights.push('low_gi');
  if (pSugar === 2 && kcal > 0) highlights.push('low_sugar');
  if (pVeg === 2) highlights.push('veggies');

  const idea: Idea | null =
    pProtein === 0 ? 'add_protein' : pVeg === 0 ? 'add_veggies' : pFiber === 0 ? 'add_fiber' : pLowGi === 0 ? 'swap_low_gi' : null;

  const r1 = (x: number) => Math.round(x * 10) / 10;
  return {
    score: pProtein + pFiber + pLowGi + pSugar + pVeg,
    highlights,
    idea,
    totals: {
      kcal: Math.round(kcal),
      protein_g: r1(protein),
      carbs_g: r1(carbs),
      fiber_g: r1(fiber),
      added_sugar_g: r1(sugar),
      veg_g: Math.round(veg),
      protein_pct: Math.round(proteinPct),
      low_gi_carb_pct: Math.round(lowGiPct),
    },
  };
}
