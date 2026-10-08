// Insights: trends computed in code from her logs, plus patterns ("you might notice…", only with 3+
// completed cycles) and active delay / red-flag / weekly cards.
import { createRoute } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';

import { IdParam, InsightsSchema, OkSchema } from '../contract.ts';
import { cycleLengths } from '../core/cycle.ts';
import { addDays, localMidnight } from '../core/dates.ts';
import { findPatterns } from '../core/patterns.ts';
import { balanceScore, type ScoreItem } from '../core/score.ts';
import { jsonRes, profileOf, todayFor, toInsight, type App, type AppDeps } from './shared.ts';

const sec = [{ firebase: [] }];

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

/** Trailing moving average, for a calm weight trend rather than day-to-day noise. */
export function smooth(values: number[], window = 3): number[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    return Math.round((slice.reduce((a, b) => a + b, 0) / slice.length) * 10) / 10;
  });
}

export function registerInsights(app: App, { services: s }: AppDeps) {
  app.openapi(
    createRoute({ method: 'get', path: '/insights', tags: ['insights'], security: sec, responses: { 200: jsonRes(InsightsSchema, 'Trends and insight cards') } }),
    async (c) => {
      const u = s.store.user(c.get('uid'));
      const p = await profileOf(u);
      const today = todayFor(s, p);
      const from200 = addDays(today, -200);
      const week = addDays(today, -6);
      const [periods, foods, moods, symptoms, weights, life, intake, cards] = await Promise.all([
        u.periods.find({}, { sort: { start_date: 1 } }),
        u.food_logs.find({ day: { $gte: from200 } }),
        u.mood_logs.find({ day: { $gte: from200 } }, { sort: { day: 1 } }),
        u.symptom_logs.find({ day: { $gte: from200 } }),
        p.weight_tracking ? u.weight_logs.find({}, { sort: { day: 1 }, limit: 52 }) : Promise.resolve([]),
        u.lifestyle_logs.find({ day: { $gte: week } }),
        u.med_intake.find({ taken: true, scheduled_for: { $gte: localMidnight(week, p.timezone) } }),
        u.insights.find({ dismissed: false }, { sort: { created_at: -1 }, limit: 20 }),
      ]);

      const byDay = new Map<string, ScoreItem[]>();
      for (const f of foods) byDay.set(f.day, [...(byDay.get(f.day) ?? []), f as ScoreItem]);
      const scores = [...byDay].sort(([a], [b]) => a.localeCompare(b)).map(([day, items]) => ({ day, value: balanceScore(items)!.score }));

      const moodByDay = new Map<string, number[]>();
      for (const m of moods) if (m.mood !== null) moodByDay.set(m.day, [...(moodByDay.get(m.day) ?? []), m.mood]);
      const moodTrend = [...moodByDay].map(([day, v]) => ({ day, value: avg(v)! }));

      const sugarByDay = new Map<string, number>();
      for (const f of foods) sugarByDay.set(f.day, (sugarByDay.get(f.day) ?? 0) + Number(f.added_sugar_g ?? 0));
      const patterns = findPatterns({
        periods,
        moods,
        symptoms,
        sugarByDay: [...sugarByDay].map(([day, added_sugar_g]) => ({ day, added_sugar_g })),
      });
      const patternCards = patterns.map((pt) => ({ id: `pattern:${pt.kind}`, day: today, type: 'pattern' as const, payload: pt as unknown as Record<string, unknown>, dismissed: false }));

      return c.json(
        {
          insights: [...cards.map(toInsight), ...patternCards],
          cycle_lengths: cycleLengths(periods.map((x) => x.start_date)).slice(-8),
          balance_trend: scores.filter((x) => x.day >= addDays(today, -13)),
          mood_trend: moodTrend.filter((x) => x.day >= addDays(today, -29)),
          weight_trend: p.weight_tracking ? smooth(weights.map((w) => w.weight_kg)).map((value, i) => ({ day: weights[i]!.day, value })) : null,
          week: {
            days_with_food_logged: scores.filter((x) => x.day >= week).length,
            avg_balance_score: avg(scores.filter((x) => x.day >= week).map((x) => x.value)),
            avg_mood: avg(moodTrend.filter((x) => x.day >= week).map((x) => x.value)),
            avg_sleep_hours: avg(life.map((l) => l.sleep_hours).filter((x): x is number => x !== null)),
            exercise_minutes_total: life.reduce((n, l) => n + (l.exercise_minutes ?? 0), 0),
            medication_doses_taken: intake.length,
          },
        },
        200,
      );
    },
  );

  app.openapi(
    createRoute({ method: 'post', path: '/insights/{id}/dismiss', tags: ['insights'], security: sec, request: { params: IdParam }, responses: { 200: jsonRes(OkSchema, 'Dismissed') } }),
    async (c) => {
      if (!(await s.store.user(c.get('uid')).insights.updateOne({ id: c.req.valid('param').id }, { dismissed: true }))) throw new HTTPException(404, { message: 'not_found' });
      return c.json({ ok: true as const }, 200);
    },
  );
}
