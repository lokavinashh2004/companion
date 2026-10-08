import { createRoute } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';

import { FoodLogsSchema, IdParam, LogFoodsSchema, OkSchema, PhotoRequestSchema, PhotoResultSchema } from '../contract.ts';
import { photoPrompt } from '../core/prompts/companion.ts';
import { PhotoResponse } from '../core/schemas.ts';
import { logFoods } from '../services/foods.ts';
import { jsonBody, jsonRes, profileOf, toFoodLog, type App, type AppDeps } from './shared.ts';

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
    createRoute({ method: 'delete', path: '/food/logs/{id}', tags: ['food'], security: sec, request: { params: IdParam }, responses: { 200: jsonRes(OkSchema, 'Deleted') } }),
    async (c) => {
      const gone = await s.store.user(c.get('uid')).food_logs.deleteOne({ id: c.req.valid('param').id });
      if (!gone) throw new HTTPException(404, { message: 'not_found' });
      return c.json({ ok: true as const }, 200);
    },
  );
}
