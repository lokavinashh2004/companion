import { assertEquals } from './assert.ts';
import { test } from 'vitest';
import { plausibleMatch, resolveFood, type NewFood, type ResolverDeps } from '../src/core/food-resolver.ts';
import type { FoodRow } from '../src/core/food.ts';

const row = (id: string, name: string, extra: Partial<FoodRow> = {}): FoodRow => ({
  id, canonical_name: name, kcal: 100, protein_g: 3, carbs_g: 20, fat_g: 1, fiber_g: 1, sugar_g: 0, added_sugar_g: 0,
  veg_fraction: 0, typical_serving_g: 100, gi_band: 'medium', is_liquid: false, ...extra,
});

function deps(over: Partial<ResolverDeps> = {}) {
  const foods = new Map<string, FoodRow>([
    ['f1', row('f1', 'dosai')],
    ['f2', row('f2', 'idli')],
    ['f3', row('f3', 'rice', { gi_band: 'high' })],
    ['f4', row('f4', 'toor dal', { gi_band: 'low', protein_g: 22 })],
  ]);
  const syns = [
    { alias: 'dosai', food_id: 'f1' },
    { alias: 'தோசை', food_id: 'f1' },
    { alias: 'idli', food_id: 'f2' },
    { alias: 'rice', food_id: 'f3' },
    { alias: 'toor dal', food_id: 'f4' },
  ];
  const calls: string[] = [];
  const saved: NewFood[] = [];
  const d: ResolverDeps = {
    synonyms: () => Promise.resolve(syns),
    foodById: (id) => Promise.resolve(foods.get(id) ?? null),
    foodByCanonical: (n) => Promise.resolve([...foods.values()].find((f) => f.canonical_name === n) ?? null),
    usda: (n) => { calls.push(`usda:${n}`); return Promise.resolve(null); },
    off: (n) => { calls.push(`off:${n}`); return Promise.resolve(null); },
    breakdown: (n) => { calls.push(`llm:${n}`); return Promise.resolve(null); },
    saveFood: (f, alias) => {
      saved.push(f);
      const r = row(`new${saved.length}`, f.canonical_name);
      foods.set(r.id, r);
      syns.push({ alias, food_id: r.id });
      return Promise.resolve(r);
    },
    ...over,
  };
  return { d, calls, saved };
}

test('exact synonym, fold variants, Tamil script, quantity words', async () => {
  const { d, calls } = deps();
  assertEquals((await resolveFood('Dosai', d)).via, 'synonym');
  const thosai = await resolveFood('thosai', d);
  assertEquals([thosai.via, thosai.food?.id], ['fold', 'f1']);
  assertEquals((await resolveFood('idly', d)).food?.id, 'f2');
  assertEquals((await resolveFood('தோசை', d)).food?.id, 'f1');
  const two = await resolveFood('rendu dosai', d);
  assertEquals([two.food?.id, two.quantityFromName], ['f1', 2]);
  assertEquals(calls, []);
});

test('unknown -> USDA then OFF then LLM breakdown, results cached', async () => {
  const usdaHit: NewFood = { ...row('x', 'quinoa'), source: 'usda', external_id: '1' };
  const { d, calls } = deps({ usda: (n) => Promise.resolve(n === 'quinoa' ? usdaHit : null) });
  const q = await resolveFood('quinoa', d);
  assertEquals([q.via, q.isEstimate], ['usda', false]);
  // second time it's a cached synonym
  assertEquals((await resolveFood('quinoa', d)).via, 'synonym');
  assertEquals(calls, []);
});

test('LLM breakdown builds an estimated composite from known ingredients', async () => {
  let llmCalls = 0;
  const { d, saved } = deps({
    breakdown: (n) => (llmCalls++, Promise.resolve({ dish: n, serving_grams: 250, ingredients: [{ name: 'rice', grams: 150 }, { name: 'toor dal', grams: 50 }, { name: 'unobtainium', grams: 5 }] })),
  });
  const r = await resolveFood('sambar sadam special', d);
  assertEquals([r.via, r.isEstimate], ['llm', true]);
  assertEquals(saved[0]!.canonical_name, '~sambar sadam special');
  assertEquals(saved[0]!.typical_serving_g, 250);
  assertEquals(llmCalls, 1); // ingredients never trigger another LLM call
});

test('nothing found -> unresolved estimate, Tamil skips external APIs', async () => {
  const { d, calls } = deps();
  const r = await resolveFood('மர்ம உணவு', d);
  assertEquals([r.food, r.via], [null, 'none']);
  assertEquals(calls, ['llm:மர்ம உணவு']);
});

test('plausibleMatch', () => {
  assertEquals(plausibleMatch('brown rice', 'Rice, brown, long-grain, cooked'), true);
  assertEquals(plausibleMatch('kambu koozh', 'Millet, cooked'), false);
});
