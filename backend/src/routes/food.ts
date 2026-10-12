import { createRoute } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';

import {
  CaloriesSchema,
  FoodEstimateRequest,
  FoodEstimateSchema,
  FoodLogsSchema,
  FoodSearchQuery,
  FoodSearchSchema,
  IdParam,
  LogFoodsSchema,
  OkSchema,
  PhotoRequestSchema,
  PhotoResultSchema,
} from '../contract.ts';
import { DEFAULT_CALORIE_TARGET, monthStart, periodTotals, todayByMeal, weekStart } from '../core/calories.ts';
import { foldTanglish, measure, normalizeFoodName, nutrientsFor } from '../core/food.ts';
import { resolveFood } from '../core/food-resolver.ts';
import { photoPrompt } from '../core/prompts/companion.ts';
import { PhotoResponse } from '../core/schemas.ts';
import { loadUnits, logFoods, resolverDeps } from '../services/foods.ts';
import { jsonBody, jsonRes, profileOf, todayFor, toFoodLog, type App, type AppDeps } from './shared.ts';

const SEARCH_LIMIT = 8;

const sec = [{ firebase: [] }];

export function registerFood(app: App, { services: s }: AppDeps) {
  // Photo → vision model → detected items for her to confirm. Nothing is saved and the image is not stored.
  app.openapi(
    createRoute({
      method: 'post',
      path: '/food/photo',
      tags: ['food'],
      security: sec,
      request: { body: jsonBody(PhotoRequestSchema) },
      responses: { 200: jsonRes(PhotoResultSchema, 'Detected items (not saved)') },
    }),
    async (c) => {
      const { image_base64 } = c.req.valid('json');
      const r = await s.llm.call({
        caps: ['vision', 'json'],
        temperature: 0.2,
        schema: PhotoResponse,
        maxModels: 4,
        maxTokens: 500,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: photoPrompt() },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image_base64}` } },
            ],
          },
        ],
      });
      if (!r.ok) return c.json({ status: 'unavailable' as const, is_food: false, items: [] }, 200);
      return c.json(
        {
          status: 'ok' as const,
          is_food: r.data.is_food,
          items: r.data.items.map((i) => ({ name: i.name, quantity: i.quantity ?? null, unit: i.unit ?? null, estimated_grams: i.estimated_grams ?? null })),
        },
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/food/logs',
      tags: ['food'],
      security: sec,
      request: { body: jsonBody(LogFoodsSchema) },
      responses: { 200: jsonRes(FoodLogsSchema, 'Saved through the same food pipeline as chat') },
    }),
    async (c) => {
      const { items, meal, day, source } = c.req.valid('json');
      const u = s.store.user(c.get('uid'));
      const p = await profileOf(u);
      const rows = await logFoods(s, u, day, items.map((i) => ({ ...i, meal })), source, null);
      return c.json({ logs: rows.map((r) => toFoodLog(r, p.calorie_display === 'hide')) }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'get',
      path: '/food/calories',
      tags: ['food'],
      security: sec,
      responses: { 200: jsonRes(CaloriesSchema, 'Calories today (by meal), this week (from Monday) and this month, against her daily guide. No numbers when calories are off.') },
    }),
    async (c) => {
      const u = s.store.user(c.get('uid'));
      const p = await profileOf(u);
      const target = p.calorie_target ?? DEFAULT_CALORIE_TARGET;
      const base = { target, target_is_default: p.calorie_target == null };
      if (p.calorie_display === 'hide') return c.json({ ...base, hidden: true, today: null, week: null, month: null }, 200);
      const today = todayFor(s, p);
      const week = weekStart(today);
      const month = monthStart(today);
      const from = week < month ? week : month;
      const rows = await u.food_logs.find({ day: { $gte: from, $lte: today } });
      return c.json({ ...base, hidden: false, today: todayByMeal(rows, today), week: periodTotals(rows, week, today), month: periodTotals(rows, month, today) }, 200);
    },
  );

  // Suggestions for the manual food form, from the built-in food list (no external lookups).
  app.openapi(
    createRoute({ method: 'get', path: '/food/search', tags: ['food'], security: sec, request: { query: FoodSearchQuery }, responses: { 200: jsonRes(FoodSearchSchema, 'Known foods matching the text') } }),
    async (c) => {
      const q = normalizeFoodName(c.req.valid('query').q);
      const fq = foldTanglish(q);
      const deps = resolverDeps(s);
      const units = await loadUnits(s.store);
      const syns = await deps.synonyms();
      const rank = (alias: string) => (alias.startsWith(q) || foldTanglish(alias).startsWith(fq) ? 0 : alias.includes(q) || foldTanglish(alias).includes(fq) ? 1 : 2);
      const hits = syns
        .map((x) => ({ ...x, r: rank(x.alias) }))
        .filter((x) => x.r < 2)
        .sort((a, b) => a.r - b.r || a.alias.length - b.alias.length);
      const seen = new Set<string>();
      const results = [];
      for (const h of hits) {
        if (seen.has(h.food_id)) continue;
        seen.add(h.food_id);
        const food = await deps.foodById(h.food_id);
        if (!food) continue;
        const piece = units.find((x) => x.unit_name === 'piece' && x.applies_to === food.id);
        results.push({ name: h.alias, kcal_per_100g: food.kcal, serving_g: food.typical_serving_g, piece_g: piece?.grams_or_ml ?? null });
        if (results.length >= SEARCH_LIMIT) break;
      }
      return c.json({ results }, 200);
    },
  );

  // Live preview for the manual food form: same maths as saving, but local foods only (no USDA/AI calls).
  app.openapi(
    createRoute({
      method: 'post',
      path: '/food/estimate',
      tags: ['food'],
      security: sec,
      request: { body: jsonBody(FoodEstimateRequest) },
      responses: { 200: jsonRes(FoodEstimateSchema, 'Grams and kcal for a quantity (not saved). found=false means it will be looked up when saved.') },
    }),
    async (c) => {
      const { name, quantity, unit } = c.req.valid('json');
      const deps = { ...resolverDeps(s), usda: async () => null, off: async () => null, breakdown: async () => null };
      const r = await resolveFood(name, deps, false);
      if (!r.food) return c.json({ found: false, name: null, grams: null, kcal: null, is_estimate: true }, 200);
      const m = measure(quantity ?? r.quantityFromName, unit, r.food, await loadUnits(s.store));
      const grams = m.grams * (r.sizeFromName ?? 1);
      return c.json({ found: true, name: r.food.canonical_name.replace(/^~/, ''), grams: Math.round(grams), kcal: nutrientsFor(r.food, grams).kcal, is_estimate: r.isEstimate || !m.known }, 200);
    },
  );

  app.openapi(
    createRoute({ method: 'delete', path: '/food/logs/{id}', tags: ['food'], security: sec, request: { params: IdParam }, responses: { 200: jsonRes(OkSchema, 'Deleted') } }),
    async (c) => {
      const gone = await s.store.user(c.get('uid')).food_logs.deleteOne({ id: c.req.valid('param').id });
      if (!gone) throw new HTTPException(404, { message: 'not_found' });
      return c.json({ ok: true as const }, 200);
    },
  );
}
