import { createRoute } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';

import { CycleSchema, IdParam, LogPeriodSchema, OkSchema, PeriodPatchSchema, PeriodSchema } from '../contract.ts';
import { diffDays } from '../core/dates.ts';
import { loadCycle, logPeriod } from '../services/cycle.ts';
import type { PeriodDoc } from '../store/types.ts';
import { jsonBody, jsonRes, profileOf, todayFor, toInsight, toPrediction, toStatus, type App, type AppDeps } from './shared.ts';

const sec = [{ firebase: [] }];

function toPeriod(p: PeriodDoc, today: string, next: PeriodDoc | undefined) {
  return {
    id: p.id,
    start_date: p.start_date,
    end_date: p.end_date,
    flow: p.flow,
    pain: p.pain,
    auto_closed: p.auto_closed,
    length_days: diffDays(p.start_date, p.end_date ?? today) + 1,
    cycle_length: next ? diffDays(p.start_date, next.start_date) : null,
  };
}

export function registerCycle(app: App, { services: s }: AppDeps) {
  app.openapi(
    createRoute({ method: 'get', path: '/cycle', tags: ['cycle'], security: sec, responses: { 200: jsonRes(CycleSchema, 'Periods, the predicted range and active cycle insights') } }),
    async (c) => {
      const u = s.store.user(c.get('uid'));
      const p = await profileOf(u);
      const today = todayFor(s, p);
      const cycle = await loadCycle(u, p.typical_cycle_length, today);
      const insights = await u.insights.find({ dismissed: false, type: { $in: ['delay', 'red_flag'] } }, { sort: { created_at: -1 }, limit: 10 });
      return c.json(
        {
          today,
          status: toStatus(cycle.status),
          prediction: toPrediction(cycle.prediction),
          periods: cycle.periods.map((x, i) => toPeriod(x, today, cycle.periods[i + 1])).reverse(),
          insights: insights.map(toInsight),
        },
        200,
      );
    },
  );

  app.openapi(
    createRoute({ method: 'post', path: '/cycle/periods', tags: ['cycle'], security: sec, request: { body: jsonBody(LogPeriodSchema) }, responses: { 200: jsonRes(PeriodSchema, 'Period start or end logged') } }),
    async (c) => {
      const b = c.req.valid('json');
      const u = s.store.user(c.get('uid'));
      const today = todayFor(s, await profileOf(u));
      if (b.date > today) throw new HTTPException(400, { message: 'future_date' });
      const period = await logPeriod(u, b.kind === 'start' ? 'period_start' : 'period_end', b.date, { flow: b.flow ?? null, pain: b.pain ?? null });
      if (!period) throw new HTTPException(409, { message: 'no_period_to_end' });
      return c.json(toPeriod(period, today, undefined), 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'patch',
      path: '/cycle/periods/{id}',
      tags: ['cycle'],
      security: sec,
      request: { params: IdParam, body: jsonBody(PeriodPatchSchema) },
      responses: { 200: jsonRes(PeriodSchema, 'Updated') },
    }),
    async (c) => {
      const u = s.store.user(c.get('uid'));
      const today = todayFor(s, await profileOf(u));
      const patch = c.req.valid('json');
      const current = await u.periods.findOne({ id: c.req.valid('param').id });
      if (!current) throw new HTTPException(404, { message: 'not_found' });
      if (patch.end_date && (patch.end_date < current.start_date || patch.end_date > today)) throw new HTTPException(400, { message: 'invalid_end_date' });
      const updated = (await u.periods.updateOne({ id: current.id }, { ...patch, ...(patch.end_date ? { auto_closed: false } : {}) }))!;
      return c.json(toPeriod(updated, today, undefined), 200);
    },
  );

  app.openapi(
    createRoute({ method: 'delete', path: '/cycle/periods/{id}', tags: ['cycle'], security: sec, request: { params: IdParam }, responses: { 200: jsonRes(OkSchema, 'Deleted') } }),
    async (c) => {
      const gone = await s.store.user(c.get('uid')).periods.deleteOne({ id: c.req.valid('param').id });
      if (!gone) throw new HTTPException(404, { message: 'not_found' });
      return c.json({ ok: true as const }, 200);
    },
  );
}
