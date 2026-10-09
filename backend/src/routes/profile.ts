import { createRoute } from '@hono/zod-openapi';

import { MeSchema, OnboardingSchema, ProfilePatchSchema, ProfileSchema } from '../contract.ts';
import { addDays, diffDays } from '../core/dates.ts';
import { logPeriod } from '../services/cycle.ts';
import { jsonBody, jsonRes, profileOf, todayFor, toProfile, type App, type AppDeps } from './shared.ts';

const sec = [{ firebase: [] }];

export function registerProfile(app: App, { services: s }: AppDeps) {
  app.openapi(
    createRoute({ method: 'get', path: '/me', tags: ['profile'], security: sec, responses: { 200: jsonRes(MeSchema, 'The signed-in user and her profile') } }),
    async (c) => {
      const u = s.store.user(c.get('uid'));
      // Opening the app counts as "seen" (used for the one-time soft nudge after 3 quiet days).
      const p = (await u.profiles.updateOne({}, { last_opened_at: s.now().toISOString() })) ?? (await profileOf(u));
      return c.json({ uid: c.get('uid'), email: c.get('email'), profile: toProfile(p) }, 200);
    },
  );

  app.openapi(
    createRoute({ method: 'patch', path: '/me', tags: ['profile'], security: sec, request: { body: jsonBody(ProfilePatchSchema) }, responses: { 200: jsonRes(ProfileSchema, 'Updated profile') } }),
    async (c) => {
      const p = await s.store.user(c.get('uid')).profiles.updateOne({}, blankToNull(c.req.valid('json')));
      return c.json(toProfile(p!), 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/me/onboarding',
      tags: ['profile'],
      security: sec,
      request: { body: jsonBody(OnboardingSchema) },
      responses: { 200: jsonRes(ProfileSchema, 'Onboarding saved') },
    }),
    async (c) => {
      const body = c.req.valid('json');
      const u = s.store.user(c.get('uid'));
      const p = (await u.profiles.updateOne({}, { ...blankToNull(body.profile), onboarding_done: true }))!;
      const today = todayFor(s, p);
      if (body.medications.length) {
        await u.medications.insertMany(body.medications.map((m) => ({ ...m, active: true, start_date: today, end_date: null })));
      }
      if (body.last_period_start && body.last_period_start <= today) {
        const period = await logPeriod(u, 'period_start', body.last_period_start);
        // A start 10+ days ago is over: assume a 5-day period (editable in Cycle).
        if (period && diffDays(body.last_period_start, today) >= 10) {
          await u.periods.updateOne({ id: period.id }, { end_date: addDays(body.last_period_start, 4) });
        }
      }
      return c.json(toProfile(p), 200);
    },
  );
}

/** An emptied display name means "don't use a name". */
function blankToNull<T extends { display_name?: string | null }>(patch: T): T {
  return patch.display_name === '' ? { ...patch, display_name: null } : patch;
}
