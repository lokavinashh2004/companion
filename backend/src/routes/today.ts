import { createRoute } from '@hono/zod-openapi';

import { DayQuery, OkSchema, ProgressMonthSchema, ProgressQuery, QuickLogSchema, TodaySchema, WaterSchema, WeightSchema } from '../contract.ts';
import { addDays, localDateTime, localMidnight } from '../core/dates.ts';
import { completeStreak, DAILY_GOALS, dailyProgress, dayProgress } from '../core/progress.ts';
import { balanceScore, type ScoreItem } from '../core/score.ts';
import { loadCycle } from '../services/cycle.ts';
import { jsonBody, jsonRes, profileOf, todayFor, toFoodLog, toMedication, toPrediction, toStatus, type App, type AppDeps } from './shared.ts';

const sec = [{ firebase: [] }];
const STREAK_LOOKBACK_DAYS = 120;

export function registerToday(app: App, { services: s }: AppDeps) {
  app.openapi(
    createRoute({
      method: 'get',
      path: '/today',
      tags: ['today'],
      security: sec,
      request: { query: DayQuery },
      responses: { 200: jsonRes(TodaySchema, "One day's logs with the server-computed balance score and cycle status") },
    }),
    async (c) => {
      const u = s.store.user(c.get('uid'));
      const p = await profileOf(u);
      const today = todayFor(s, p);
      const day = c.req.valid('query').day ?? today;
      const hideKcal = p.calorie_display === 'hide';
      const [cycle, foods, moods, symptoms, lifestyle, meds, intake, lastWeight] = await Promise.all([
        loadCycle(u, p.typical_cycle_length, day),
        u.food_logs.find({ day }, { sort: { created_at: 1 } }),
        u.mood_logs.find({ day }, { sort: { created_at: 1 } }),
        u.symptom_logs.find({ day }),
        u.lifestyle_logs.findOne({ day }),
        u.medications.find({ active: true }, { sort: { created_at: 1 } }),
        u.med_intake.find({ scheduled_for: { $gte: localMidnight(day, p.timezone), $lt: localMidnight(addDays(day, 1), p.timezone) } }),
        u.weight_logs.findOne({}, { sort: { day: -1 } }),
      ]);
      const score = balanceScore(foods as ScoreItem[]);
      const goals = dayProgress({ day, meals: new Set(foods.map((f) => f.meal)).size, water_ml: lifestyle?.water_ml ?? 0, steps: lifestyle?.steps ?? 0 });
      return c.json(
        {
          day,
          calorie_display: p.calorie_display,
          status: toStatus(cycle.status),
          prediction: toPrediction(cycle.prediction),
          foods: foods.map((f) => toFoodLog(f, hideKcal)),
          score: score ? { score: score.score, highlights: score.highlights, idea: score.idea, kcal: hideKcal ? null : score.totals.kcal } : null,
          moods: moods.map((m) => ({ id: m.id, mood: m.mood, energy: m.energy, stress: m.stress })),
          symptoms: symptoms.map((x) => ({ id: x.id, symptom: x.symptom, severity: x.severity })),
          lifestyle: lifestyle ? { water_ml: lifestyle.water_ml, sleep_hours: lifestyle.sleep_hours, exercise_minutes: lifestyle.exercise_minutes, steps: lifestyle.steps } : null,
          meds: meds.map((m) => ({
            medication: toMedication(m),
            doses: m.schedule_times.map((time) => ({
              time,
              taken: intake.some((i) => i.medication_id === m.id && i.taken && Date.parse(i.scheduled_for) === Date.parse(localDateTime(day, time, p.timezone))),
            })),
          })),
          weight_due: p.weight_tracking && (!lastWeight || lastWeight.day <= addDays(today, -7)),
          progress: {
            percent: goals.percent,
            complete: goals.complete,
            food: { done: goals.meals, goal: DAILY_GOALS.meals },
            water: { done: goals.water_ml, goal: DAILY_GOALS.water_ml },
            steps: { done: goals.steps, goal: DAILY_GOALS.steps },
          },
        },
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: 'get',
      path: '/progress',
      tags: ['today'],
      security: sec,
      request: { query: ProgressQuery },
      responses: { 200: jsonRes(ProgressMonthSchema, 'Daily goal progress for each day of a month (default: this month) and the complete-day streak') },
    }),
    async (c) => {
      const u = s.store.user(c.get('uid'));
      const today = todayFor(s, await profileOf(u));
      const month = c.req.valid('query').month ?? today.slice(0, 7);
      const first = `${month}-01`;
      const last = addDays(`${addDays(first, 31).slice(0, 7)}-01`, -1);
      const to = last < today ? last : today;
      // The streak can reach back before this month.
      const from = first < addDays(today, -STREAK_LOOKBACK_DAYS) ? first : addDays(today, -STREAK_LOOKBACK_DAYS);
      const [foods, lifestyle] = await Promise.all([
        u.food_logs.find({ day: { $gte: from, $lte: today } }),
        u.lifestyle_logs.find({ day: { $gte: from, $lte: today } }),
      ]);
      const all = dailyProgress(foods, lifestyle, from, today);
      const days = first > today ? [] : all.filter((d) => d.day >= first && d.day <= to);
      return c.json(
        {
          month,
          today,
          goals: { ...DAILY_GOALS },
          days: days.map(({ day, percent, complete, meals, water_ml, steps }) => ({ day, percent, complete, meals, water_ml, steps })),
          complete_days: days.filter((d) => d.complete).length,
          streak: completeStreak(all, today),
        },
        200,
      );
    },
  );

  app.openapi(
    createRoute({ method: 'post', path: '/today/water', tags: ['today'], security: sec, request: { body: jsonBody(WaterSchema) }, responses: { 200: jsonRes(OkSchema, 'Water updated') } }),
    async (c) => {
      const { day, ml } = c.req.valid('json');
      const u = s.store.user(c.get('uid'));
      const row = await u.lifestyle_logs.findOne({ day });
      await u.lifestyle_logs.updateOne(
        { day },
        { water_ml: Math.max(0, (row?.water_ml ?? 0) + ml) },
        { upsert: true, setOnInsert: { sleep_hours: null, steps: null, exercise_minutes: null, exercise_type: null, illness: null, travel: null } },
      );
      return c.json({ ok: true as const }, 200);
    },
  );

  app.openapi(
    createRoute({ method: 'post', path: '/today/quick-log', tags: ['today'], security: sec, request: { body: jsonBody(QuickLogSchema) }, responses: { 200: jsonRes(OkSchema, 'Logged') } }),
    async (c) => {
      const q = c.req.valid('json');
      const u = s.store.user(c.get('uid'));
      if ((q.mood ?? q.energy ?? q.stress) != null) {
        await u.mood_logs.insertOne({ day: q.day, mood: q.mood ?? null, energy: q.energy ?? null, stress: q.stress ?? null, note: null, source_message_id: null });
      }
      if (q.symptoms?.length) {
        await u.symptom_logs.insertMany(q.symptoms.map((symptom) => ({ day: q.day, symptom, severity: 1, note: null, source_message_id: null })));
      }
      if (q.sleep_hours != null) {
        await u.lifestyle_logs.updateOne(
          { day: q.day },
          { sleep_hours: q.sleep_hours },
          { upsert: true, setOnInsert: { water_ml: null, steps: null, exercise_minutes: null, exercise_type: null, illness: null, travel: null } },
        );
      }
      return c.json({ ok: true as const }, 200);
    },
  );

  app.openapi(
    createRoute({ method: 'post', path: '/today/weight', tags: ['today'], security: sec, request: { body: jsonBody(WeightSchema) }, responses: { 200: jsonRes(OkSchema, 'Weight saved') } }),
    async (c) => {
      const { day, weight_kg } = c.req.valid('json');
      await s.store.user(c.get('uid')).weight_logs.updateOne({ day }, { weight_kg }, { upsert: true });
      return c.json({ ok: true as const }, 200);
    },
  );
}
