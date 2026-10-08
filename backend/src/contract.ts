// API request/response schemas (Zod + OpenAPI). The frontend's types are generated from the OpenAPI
// document built from these (npm run openapi → openapi.json → frontend npm run api:types).
import { z } from '@hono/zod-openapi';

import { MEALS, SYMPTOMS } from './core/schemas.ts';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'HH:MM');
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM');
const flow = z.enum(['spotting', 'light', 'medium', 'heavy']);
const meal = z.enum(MEALS);
const giBand = z.enum(['low', 'medium', 'high', 'unknown']);

export const ErrorSchema = z.object({ error: z.string() }).openapi('Error');
export const OkSchema = z.object({ ok: z.literal(true) }).openapi('Ok');
export const HealthSchema = z.object({ ok: z.literal(true), version: z.string(), store: z.enum(['memory', 'mongo']) }).openapi('Health');
export const IdParam = z.object({ id: z.string().min(1).max(64) });
export const DayQuery = z.object({ day: date.optional() });

// ---------------------------------------------------------------- profile

export const ProfileSchema = z
  .object({
    companion_name: z.string(),
    display_language: z.enum(['auto', 'en', 'ta', 'tanglish']),
    ui_language: z.enum(['en', 'ta']),
    persona_tone: z.enum(['bestie', 'calm', 'coach']),
    tamil_address_form: z.enum(['casual', 'respectful']),
    calorie_display: z.enum(['show', 'hide']),
    goals: z.array(z.string()),
    diet_type: z.string().nullable(),
    allergies: z.array(z.string()),
    typical_cycle_length: z.number().int().nullable(),
    onboarding_done: z.boolean(),
    timezone: z.string(),
    morning_checkin: z.string(),
    evening_checkin: z.string(),
    quiet_start: z.string(),
    quiet_end: z.string(),
    water_nudges: z.boolean(),
    weight_tracking: z.boolean(),
  })
  .openapi('Profile');

export const MeSchema = z.object({ uid: z.string(), email: z.string().nullable(), profile: ProfileSchema }).openapi('Me');

const profileFields = {
  companion_name: z.string().trim().min(1).max(30),
  display_language: z.enum(['auto', 'en', 'ta', 'tanglish']),
  ui_language: z.enum(['en', 'ta']),
  persona_tone: z.enum(['bestie', 'calm', 'coach']),
  tamil_address_form: z.enum(['casual', 'respectful']),
  calorie_display: z.enum(['show', 'hide']),
  goals: z.array(z.string().max(60)).max(10),
  diet_type: z.string().max(40).nullable(),
  allergies: z.array(z.string().max(40)).max(20),
  typical_cycle_length: z.number().int().min(15).max(120).nullable(),
  timezone: z.string().min(1).max(64),
  morning_checkin: time,
  evening_checkin: time,
  quiet_start: time,
  quiet_end: time,
  water_nudges: z.boolean(),
  weight_tracking: z.boolean(),
};

/** Fields the user may change. Everything optional; unknown keys rejected. */
export const ProfilePatchSchema = z.strictObject(profileFields).partial().openapi('ProfilePatch');

export const MedInputSchema = z
  .strictObject({ name: z.string().trim().min(1).max(60), dose: z.string().trim().max(40).nullable(), schedule_times: z.array(hhmm).max(8) })
  .openapi('MedInput');

export const OnboardingSchema = z
  .strictObject({
    profile: z.strictObject(profileFields).partial(),
    medications: z.array(MedInputSchema).max(15),
    last_period_start: date.nullable(),
  })
  .openapi('Onboarding');

// ---------------------------------------------------------------- chat

const UndoLogSchema = z.object({
  table: z.enum(['food_logs', 'symptom_logs', 'mood_logs', 'med_intake', 'lifestyle_logs']),
  id: z.string(),
  label: z.string(),
});
const PendingPeriodSchema = z.object({ kind: z.enum(['period_start', 'period_end']), date, flow: flow.nullable(), pain: z.number().nullable() });

export const MessageMetaSchema = z
  .object({
    reply_to: z.string().optional(),
    logs: z.array(UndoLogSchema).optional(),
    pending: z.array(PendingPeriodSchema).optional(),
    flags: z.object({ crisis: z.boolean(), red_flag: z.boolean() }).optional(),
    fallback: z.boolean().optional(),
    kind: z.string().optional(),
    undone: z.record(z.string(), z.boolean()).optional(),
    confirmed: z.record(z.string(), z.string()).optional(),
  })
  .openapi('MessageMeta');

export const ChatMessageSchema = z
  .object({
    id: z.string(),
    created_at: z.string(),
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    status: z.enum(['pending', 'done', 'queued', 'failed']),
    meta: MessageMetaSchema,
  })
  .openapi('ChatMessage');

export const ChatListSchema = z.object({ messages: z.array(ChatMessageSchema), has_more: z.boolean() }).openapi('ChatList');
export const ChatListQuery = z.object({ before: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).optional() });

export const SendMessageSchema = z.object({ text: z.string().trim().min(1).max(2000), client_id: z.string().uuid() }).openapi('SendMessage');
export const SendResultSchema = z
  .object({
    status: z.enum(['done', 'queued']),
    message: ChatMessageSchema,
    reply: ChatMessageSchema.nullable(),
    notice: ChatMessageSchema.nullable(),
    crisis: z.boolean(),
  })
  .openapi('SendResult');

export const UndoLogRequest = z.object({ message_id: z.string(), log_id: z.string() }).openapi('UndoLogRequest');
export const PeriodChipRequest = z.object({ message_id: z.string(), index: z.number().int().min(0).max(5) }).openapi('PeriodChipRequest');
export const MessageUpdatedSchema = z.object({ message: ChatMessageSchema }).openapi('MessageUpdated');

// ---------------------------------------------------------------- food

export const FoodLogSchema = z
  .object({
    id: z.string(),
    day: date,
    meal,
    item_name: z.string(),
    quantity: z.number().nullable(),
    unit: z.string().nullable(),
    grams: z.number().nullable(),
    kcal: z.number().nullable(),
    protein_g: z.number().nullable(),
    carbs_g: z.number().nullable(),
    fiber_g: z.number().nullable(),
    added_sugar_g: z.number().nullable(),
    veg_g: z.number().nullable(),
    gi_band: giBand,
    is_estimate: z.boolean(),
    source: z.enum(['text', 'photo', 'manual']),
  })
  .openapi('FoodLog');

export const PhotoRequestSchema = z
  .object({ image_base64: z.string().min(100).max(3_000_000), meal: meal.nullable().default(null) })
  .openapi('PhotoRequest');
export const PhotoResultSchema = z
  .object({
    status: z.enum(['ok', 'unavailable']),
    is_food: z.boolean(),
    items: z.array(z.object({ name: z.string(), quantity: z.number().nullable(), unit: z.string().nullable(), estimated_grams: z.number().nullable() })),
  })
  .openapi('PhotoResult');

export const LogFoodsSchema = z
  .object({
    items: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(80),
          quantity: z.number().min(0).max(50).nullable(),
          unit: z.string().max(20).nullable(),
          grams: z.number().min(1).max(2000).nullable().default(null),
        }),
      )
      .min(1)
      .max(12),
    meal,
    day: date,
    source: z.enum(['photo', 'manual']),
  })
  .openapi('LogFoods');
export const FoodLogsSchema = z.object({ logs: z.array(FoodLogSchema) }).openapi('FoodLogs');

// ---------------------------------------------------------------- cycle

export const PredictionSchema = z
  .object({
    earliest: date,
    likely: date,
    latest: date,
    confidence: z.enum(['low', 'medium', 'high']),
    cycles_used: z.number().int(),
  })
  .openapi('Prediction');

export const CycleStatusSchema = z
  .object({
    kind: z.enum(['none', 'period', 'cycle', 'late']),
    cycle_day: z.number().int().nullable(),
    period_day: z.number().int().nullable(),
    days_late: z.number().int().nullable(),
    phase: z.enum(['menstrual', 'follicular', 'luteal', 'late', 'unknown']).nullable(),
  })
  .openapi('CycleStatus');

export const PeriodSchema = z
  .object({
    id: z.string(),
    start_date: date,
    end_date: date.nullable(),
    flow: flow.nullable(),
    pain: z.number().nullable(),
    auto_closed: z.boolean(),
    length_days: z.number().int(),
    cycle_length: z.number().int().nullable(),
  })
  .openapi('Period');

export const InsightSchema = z
  .object({
    id: z.string(),
    day: date,
    type: z.enum(['delay', 'weekly', 'red_flag', 'pattern']),
    payload: z.record(z.string(), z.unknown()),
    dismissed: z.boolean(),
  })
  .openapi('Insight');

export const CycleSchema = z
  .object({
    today: date,
    status: CycleStatusSchema,
    prediction: PredictionSchema.nullable(),
    periods: z.array(PeriodSchema),
    insights: z.array(InsightSchema),
  })
  .openapi('Cycle');

export const LogPeriodSchema = z
  .object({ kind: z.enum(['start', 'end']), date, flow: flow.nullable().optional(), pain: z.number().int().min(0).max(10).nullable().optional() })
  .openapi('LogPeriod');
export const PeriodPatchSchema = z
  .strictObject({ end_date: date.nullable(), flow: flow.nullable(), pain: z.number().int().min(0).max(10).nullable(), auto_closed: z.literal(false) })
  .partial()
  .openapi('PeriodPatch');

// ---------------------------------------------------------------- today

export const ScoreSchema = z
  .object({
    score: z.number().int(),
    highlights: z.array(z.enum(['protein', 'fiber', 'low_gi', 'low_sugar', 'veggies'])),
    idea: z.enum(['add_protein', 'add_fiber', 'add_veggies', 'swap_low_gi']).nullable(),
    kcal: z.number().nullable(),
  })
  .openapi('Score');

export const DoseSchema = z.object({ time: hhmm, taken: z.boolean() }).openapi('Dose');
export const MedicationSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    dose: z.string().nullable(),
    schedule_times: z.array(z.string()),
    active: z.boolean(),
    start_date: date.nullable(),
    end_date: date.nullable(),
  })
  .openapi('Medication');

export const TodaySchema = z
  .object({
    day: date,
    calorie_display: z.enum(['show', 'hide']),
    status: CycleStatusSchema,
    prediction: PredictionSchema.nullable(),
    foods: z.array(FoodLogSchema),
    score: ScoreSchema.nullable(),
    moods: z.array(z.object({ id: z.string(), mood: z.number().nullable(), energy: z.number().nullable(), stress: z.number().nullable() })),
    symptoms: z.array(z.object({ id: z.string(), symptom: z.string(), severity: z.number() })),
    lifestyle: z
      .object({ water_ml: z.number().nullable(), sleep_hours: z.number().nullable(), exercise_minutes: z.number().nullable(), steps: z.number().nullable() })
      .nullable(),
    meds: z.array(z.object({ medication: MedicationSchema, doses: z.array(DoseSchema) })),
    weight_due: z.boolean(),
  })
  .openapi('Today');

export const WaterSchema = z.object({ day: date, ml: z.number().int().min(-2000).max(2000) }).openapi('Water');
export const QuickLogSchema = z
  .object({
    day: date,
    mood: z.number().int().min(1).max(5).nullable().optional(),
    energy: z.number().int().min(1).max(5).nullable().optional(),
    stress: z.number().int().min(1).max(5).nullable().optional(),
    symptoms: z.array(z.enum(SYMPTOMS)).max(12).optional(),
    sleep_hours: z.number().min(0).max(24).nullable().optional(),
  })
  .openapi('QuickLog');
export const WeightSchema = z.object({ day: date, weight_kg: z.number().min(20).max(300) }).openapi('Weight');

// ---------------------------------------------------------------- medicines, labs, facts

export const MedicationsSchema = z.object({ medications: z.array(MedicationSchema) }).openapi('Medications');
export const MedPatchSchema = MedInputSchema.partial().extend({ active: z.boolean().optional() }).openapi('MedPatch');
export const DoseTakenSchema = z.object({ day: date, time: hhmm, taken: z.boolean() }).openapi('DoseTaken');

export const LabSchema = z
  .object({
    id: z.string(),
    test_date: date,
    test_name: z.enum(['testosterone', 'AMH', 'LH', 'FSH', 'fasting_insulin', 'HbA1c', 'TSH', 'vitamin_D', 'other']),
    test_label: z.string().nullable(),
    value: z.number(),
    unit: z.string().nullable(),
    reference_range: z.string().nullable(),
    within_range: z.boolean().nullable(),
  })
  .openapi('Lab');
export const LabInputSchema = z
  .strictObject({
    test_date: date,
    test_name: z.enum(['testosterone', 'AMH', 'LH', 'FSH', 'fasting_insulin', 'HbA1c', 'TSH', 'vitamin_D', 'other']),
    test_label: z.string().trim().max(60).nullable(),
    value: z.number(),
    unit: z.string().trim().max(20).nullable(),
    reference_range: z.string().trim().max(40).nullable(),
  })
  .openapi('LabInput');
export const LabsSchema = z.object({ labs: z.array(LabSchema) }).openapi('Labs');

export const FactSchema = z
  .object({ id: z.string(), fact: z.string(), category: z.enum(['preference', 'person', 'event', 'health', 'other']), updated_at: z.string() })
  .openapi('Fact');
export const FactsSchema = z.object({ facts: z.array(FactSchema) }).openapi('Facts');
export const FactPatchSchema = z.object({ fact: z.string().trim().min(3).max(300) }).openapi('FactPatch');

// ---------------------------------------------------------------- insights

const point = z.object({ day: date, value: z.number() });
export const InsightsSchema = z
  .object({
    insights: z.array(InsightSchema),
    cycle_lengths: z.array(z.number().int()),
    balance_trend: z.array(point),
    mood_trend: z.array(point),
    weight_trend: z.array(point).nullable(),
    week: z.object({
      days_with_food_logged: z.number().int(),
      avg_balance_score: z.number().nullable(),
      avg_mood: z.number().nullable(),
      avg_sleep_hours: z.number().nullable(),
      exercise_minutes_total: z.number(),
      medication_doses_taken: z.number().int(),
    }),
  })
  .openapi('Insights');

// ---------------------------------------------------------------- push

export const PushSubscriptionSchema = z
  .object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) })
  .openapi('PushSubscription');
export const PushEndpointSchema = z.object({ endpoint: z.string().url().max(1000) }).openapi('PushEndpoint');
export const PushTestResultSchema = z.object({ result: z.string() }).openapi('PushTestResult');
export const MedActionSchema = z.object({ token: z.string().min(10).max(1000), action: z.enum(['taken', 'snooze']) }).openapi('MedAction');

export type Profile = z.infer<typeof ProfileSchema>;
export type ProfilePatch = z.infer<typeof ProfilePatchSchema>;
