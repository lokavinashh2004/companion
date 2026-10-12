// Walk sessions from the Walk card: save, the walking dashboard, and delete. A walk's steps are also added to
// that day's lifestyle steps, so Today and the daily summary see them.
import { createRoute } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';

import { IdParam, OkSchema, WalkInputSchema, WalkSchema, WalksQuery, WalksSchema } from '../contract.ts';
import { addDays, todayIn } from '../core/dates.ts';
import { dailyTotals, goalStreak, STEP_GOAL } from '../core/walks.ts';
import type { UserScope } from '../store/index.ts';
import { DuplicateKeyError } from '../store/collection.ts';
import type { WalkDoc } from '../store/types.ts';
import { jsonBody, jsonRes, profileOf, todayFor, type App, type AppDeps } from './shared.ts';

const sec = [{ firebase: [] }];
const STREAK_LOOKBACK_DAYS = 365;
const RECENT = 20;

const toWalk = (w: WalkDoc) => ({ id: w.id, day: w.day, started_at: w.started_at, duration_s: w.duration_s, steps: w.steps });

async function addSteps(u: UserScope, day: string, by: number) {
  const row = await u.lifestyle_logs.findOne({ day });
  await u.lifestyle_logs.updateOne(
    { day },
    { steps: Math.max(0, (row?.steps ?? 0) + by) },
    { upsert: true, setOnInsert: { water_ml: null, sleep_hours: null, exercise_minutes: null, exercise_type: null, illness: null, travel: null } },
  );
}

export function registerWalks(app: App, { services: s }: AppDeps) {
  app.openapi(
    createRoute({
      method: 'post',
      path: '/walks',
      tags: ['walks'],
      security: sec,
      request: { body: jsonBody(WalkInputSchema) },
      responses: { 200: jsonRes(WalkSchema, 'Saved (saving the same client_id again returns the first save)') },
    }),
    async (c) => {
      const body = c.req.valid('json');
      const u = s.store.user(c.get('uid'));
      const existing = await u.walks.findOne({ client_id: body.client_id });
      if (existing) return c.json(toWalk(existing), 200);
      const started = new Date(body.started_at);
      if (started.getTime() > s.now().getTime() + 5 * 60_000) throw new HTTPException(400, { message: 'invalid_request' });
      const p = await profileOf(u);
      const day = todayIn(p.timezone, started);
      let walk: WalkDoc;
      try {
        walk = await u.walks.insertOne({ client_id: body.client_id, day, started_at: started.toISOString(), duration_s: body.duration_s, steps: body.steps });
      } catch (e) {
        if (!(e instanceof DuplicateKeyError)) throw e;
        return c.json(toWalk((await u.walks.findOne({ client_id: body.client_id }))!), 200);
      }
      if (walk.steps > 0) await addSteps(u, day, walk.steps);
      return c.json(toWalk(walk), 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'get',
      path: '/walks',
      tags: ['walks'],
      security: sec,
      request: { query: WalksQuery },
      responses: { 200: jsonRes(WalksSchema, 'Daily walking totals for the last `days` days (default 30), the goal streak and recent walks') },
    }),
    async (c) => {
      const u = s.store.user(c.get('uid'));
      const p = await profileOf(u);
      const today = todayFor(s, p);
      const from = addDays(today, -((c.req.valid('query').days ?? 30) - 1));
      const [rows, recent, weight] = await Promise.all([
        u.walks.find({ day: { $gte: addDays(today, -STREAK_LOOKBACK_DAYS) } }),
        u.walks.find({}, { sort: { started_at: -1 }, limit: RECENT }),
        u.weight_logs.findOne({}, { sort: { day: -1 } }),
      ]);
      const days = dailyTotals(rows, from, today);
      const streak = goalStreak(dailyTotals(rows, addDays(today, -STREAK_LOOKBACK_DAYS), today), today);
      const active = days.filter((d) => d.sessions > 0);
      const best = active.reduce<(typeof days)[number] | null>((b, d) => (!b || d.steps > b.steps ? d : b), null);
      return c.json(
        {
          today,
          goal: STEP_GOAL,
          weight_kg: weight?.weight_kg ?? null,
          days,
          streak,
          totals: {
            steps: days.reduce((n, d) => n + d.steps, 0),
            duration_s: days.reduce((n, d) => n + d.duration_s, 0),
            sessions: days.reduce((n, d) => n + d.sessions, 0),
            active_days: active.length,
            goal_days: days.filter((d) => d.steps >= STEP_GOAL).length,
          },
          best,
          recent: recent.map(toWalk),
        },
        200,
      );
    },
  );

  app.openapi(
    createRoute({ method: 'delete', path: '/walks/{id}', tags: ['walks'], security: sec, request: { params: IdParam }, responses: { 200: jsonRes(OkSchema, 'Deleted (its steps are taken off that day)') } }),
    async (c) => {
      const u = s.store.user(c.get('uid'));
      const walk = await u.walks.deleteOne({ id: c.req.valid('param').id });
      if (!walk) throw new HTTPException(404, { message: 'not_found' });
      if (walk.steps > 0) await addSteps(u, walk.day, -walk.steps);
      return c.json({ ok: true as const }, 200);
    },
  );
}
