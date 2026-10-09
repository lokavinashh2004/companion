// Helpers shared by route modules: provisioning, today's date in her timezone, and document → API mappers
// (which drop internal fields such as user_id and embeddings).
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { z } from '@hono/zod-openapi';

import type { FirebaseAuth } from '../auth/firebase.ts';
import type { ChatMessageSchema, CycleStatusSchema, FoodLogSchema, InsightSchema, MedicationSchema, PredictionSchema } from '../contract.ts';
import type { CycleStatus, Prediction } from '../core/cycle.ts';
import { todayIn } from '../core/dates.ts';
import type { Services } from '../services/context.ts';
import type { UserScope } from '../store/index.ts';
import type { FoodLogDoc, InsightDoc, MedicationDoc, MessageDoc, ProfileDoc } from '../store/types.ts';

export type AppEnv = { Variables: { uid: string; email: string | null } };
export type App = OpenAPIHono<AppEnv>;

export interface AppDeps {
  auth: Pick<FirebaseAuth, 'verifyToken' | 'deleteUser'>;
  services: Services;
  allowedOrigins: string[];
  /** Public URL of this API (put into push notifications so the service worker can call /med-action). */
  apiUrl: string;
}

export const DEFAULT_PROFILE: Omit<ProfileDoc, 'id' | 'created_at' | 'user_id'> = {
  companion_name: 'Companion',
  display_name: null,
  display_language: 'auto',
  ui_language: 'en',
  persona_tone: 'bestie',
  tamil_address_form: 'casual',
  calorie_display: 'hide',
  goals: [],
  diet_type: null,
  allergies: [],
  typical_cycle_length: null,
  onboarding_done: false,
  timezone: 'Asia/Kolkata',
  morning_checkin: '08:30',
  evening_checkin: '21:00',
  quiet_start: '22:30',
  quiet_end: '07:30',
  water_nudges: false,
  weight_tracking: false,
  last_opened_at: null,
  soft_nudge_sent_at: null,
};

// Users already provisioned, per store (so a fresh store or a deleted user is re-checked).
const ensured = new WeakMap<Services['store'], Set<string>>();

/** Creates the user + default profile on first sign-in (idempotent, cached per process and store). */
export async function ensureUser(s: Services, uid: string, email: string | null): Promise<void> {
  let seen = ensured.get(s.store);
  if (!seen) ensured.set(s.store, (seen = new Set()));
  if (seen.has(uid)) return;
  await s.store.shared.users.updateOne({ id: uid }, { email }, { upsert: true });
  await s.store.user(uid).profiles.updateOne({}, {}, { upsert: true, setOnInsert: DEFAULT_PROFILE });
  if (seen.size > 1000) seen.clear();
  seen.add(uid);
}

/** Call after deleting a user's data so the next sign-in re-provisions. */
export function forgetUser(s: Services, uid: string): void {
  ensured.get(s.store)?.delete(uid);
}

export async function profileOf(u: UserScope): Promise<ProfileDoc> {
  const p = await u.profiles.findOne();
  if (!p) throw new Error('profile missing');
  return p;
}

export function todayFor(s: Services, p: ProfileDoc): string {
  return todayIn(p.timezone, s.now());
}

export function toProfile(p: ProfileDoc) {
  return {
    companion_name: p.companion_name,
    display_name: p.display_name || null,
    display_language: p.display_language,
    ui_language: p.ui_language,
    persona_tone: p.persona_tone,
    tamil_address_form: p.tamil_address_form,
    calorie_display: p.calorie_display,
    goals: p.goals,
    diet_type: p.diet_type,
    allergies: p.allergies,
    typical_cycle_length: p.typical_cycle_length,
    onboarding_done: p.onboarding_done,
    timezone: p.timezone,
    morning_checkin: p.morning_checkin,
    evening_checkin: p.evening_checkin,
    quiet_start: p.quiet_start,
    quiet_end: p.quiet_end,
    water_nudges: p.water_nudges,
    weight_tracking: p.weight_tracking,
  };
}

export function toMessage(m: MessageDoc): z.infer<typeof ChatMessageSchema> {
  const meta = { ...m.meta, logs: m.meta.logs?.map(({ table, id, label }) => ({ table, id, label })) };
  return { id: m.id, created_at: m.created_at, role: m.role, content: m.content, status: m.status, meta };
}

/** Calories are never sent to the browser when she has hidden them. */
export function toFoodLog(f: FoodLogDoc, hideKcal: boolean): z.infer<typeof FoodLogSchema> {
  return {
    id: f.id, day: f.day, meal: f.meal, item_name: f.item_name, quantity: f.quantity, unit: f.unit, grams: f.grams,
    kcal: hideKcal ? null : f.kcal, protein_g: f.protein_g, carbs_g: f.carbs_g, fiber_g: f.fiber_g,
    added_sugar_g: f.added_sugar_g, veg_g: f.veg_g, gi_band: f.gi_band, is_estimate: f.is_estimate, source: f.source,
  };
}

export function toStatus(s: CycleStatus): z.infer<typeof CycleStatusSchema> {
  switch (s.kind) {
    case 'none':
      return { kind: 'none', cycle_day: null, period_day: null, days_late: null, phase: null };
    case 'period':
      return { kind: 'period', cycle_day: s.cycleDay, period_day: s.periodDay, days_late: null, phase: 'menstrual' };
    case 'late':
      return { kind: 'late', cycle_day: s.cycleDay, period_day: null, days_late: s.daysLate, phase: 'late' };
    case 'cycle':
      return { kind: 'cycle', cycle_day: s.cycleDay, period_day: null, days_late: null, phase: s.phase };
  }
}

export function toPrediction(p: Prediction | null): z.infer<typeof PredictionSchema> | null {
  return p ? { earliest: p.earliest, likely: p.likely, latest: p.latest, confidence: p.confidence, cycles_used: p.cyclesUsed } : null;
}

export function toInsight(i: InsightDoc): z.infer<typeof InsightSchema> {
  return { id: i.id, day: i.day, type: i.type, payload: i.payload, dismissed: i.dismissed };
}

export function toMedication(m: MedicationDoc): z.infer<typeof MedicationSchema> {
  return { id: m.id, name: m.name, dose: m.dose, schedule_times: m.schedule_times, active: m.active, start_date: m.start_date, end_date: m.end_date };
}

export const jsonBody = <T>(schema: T) => ({ required: true, content: { 'application/json': { schema } } });
export const jsonRes = <T>(schema: T, description: string) => ({ description, content: { 'application/json': { schema } } });
