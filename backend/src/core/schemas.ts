// Zod schemas for every LLM output and API input. Models are sloppy, so the companion schema
// coerces where safe (e.g. "2" -> 2) and drops bad array items rather than failing the whole reply.
import { z } from 'zod';

export const SYMPTOMS = [
  'acne', 'hair_fall', 'hirsutism', 'bloating', 'cramps', 'cravings', 'fatigue', 'headache',
  'pelvic_pain', 'breast_tenderness', 'spotting', 'fainting', 'other',
] as const;
export const MEALS = ['breakfast', 'lunch', 'snack', 'dinner', 'other'] as const;
export const FLOWS = ['spotting', 'light', 'medium', 'heavy'] as const;

const nullableNum = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === '' || v === undefined ? null : typeof v === 'string' ? Number(v) : v),
    z.number().min(min).max(max).nullable(),
  ).catch(null);

const nullableBool = z.preprocess((v) => (v === undefined ? null : v), z.boolean().nullable()).catch(null);

/** Keep valid items of an array, drop invalid ones. */
function lenientArray<T extends z.ZodType>(item: T) {
  return z
    .array(z.unknown())
    .catch([])
    .default([])
    .transform((xs) => xs.flatMap((x) => {
      const r = item.safeParse(x);
      return r.success ? [r.data as z.output<T>] : [];
    }));
}

export const ExtractedFood = z.object({
  name: z.string().trim().min(1).max(80),
  quantity: nullableNum(0, 50).default(null),
  unit: z.string().trim().max(20).nullable().catch(null).default(null),
  meal: z.enum(MEALS).nullable().catch(null).default(null),
});

export const PeriodEvent = z.object({
  type: z.enum(['started', 'ended', 'none']).catch('none'),
  relative_day: z.preprocess((v) => (typeof v === 'string' ? Number(v) : v), z.number().int().min(-30).max(0)).catch(0).default(0),
  flow: z.enum(FLOWS).nullable().catch(null).default(null),
  pain: nullableNum(0, 10).default(null),
});

export const CompanionResponse = z.object({
  reply: z.string().trim().min(1),
  language_detected: z.enum(['en', 'ta', 'tanglish', 'mixed']).catch('en'),
  extracted: z
    .object({
      foods: lenientArray(ExtractedFood),
      period_event: PeriodEvent.nullable().catch(null).default(null),
      symptoms: lenientArray(
        z.object({
          symptom: z.enum(SYMPTOMS),
          severity: z.preprocess((v) => (typeof v === 'string' ? Number(v) : v), z.number().int().min(0).max(3)).catch(1),
        }),
      ),
      mood: z
        .object({ mood: nullableNum(1, 5).default(null), energy: nullableNum(1, 5).default(null), stress: nullableNum(1, 5).default(null) })
        .nullable()
        .catch(null)
        .default(null),
      lifestyle: z
        .object({
          sleep_hours: nullableNum(0, 24).default(null),
          water_ml: nullableNum(0, 10000).default(null),
          exercise_minutes: nullableNum(0, 600).default(null),
          exercise_type: z.string().max(40).nullable().catch(null).default(null),
          illness: nullableBool.default(null),
          travel: nullableBool.default(null),
        })
        .nullable()
        .catch(null)
        .default(null),
      med_taken: lenientArray(z.object({ name: z.string().trim().min(1).max(60), taken: z.boolean().catch(true) })),
      new_facts: lenientArray(z.string().trim().min(3).max(200)),
    })
    .catch({ foods: [], period_event: null, symptoms: [], mood: null, lifestyle: null, med_taken: [], new_facts: [] })
    .default({ foods: [], period_event: null, symptoms: [], mood: null, lifestyle: null, med_taken: [], new_facts: [] }),
  flags: z
    .object({ crisis: z.boolean().catch(false).default(false), red_flag_symptom: z.boolean().catch(false).default(false) })
    .catch({ crisis: false, red_flag_symptom: false })
    .default({ crisis: false, red_flag_symptom: false }),
});
export type CompanionResponse = z.output<typeof CompanionResponse>;

export const PhotoResponse = z.object({
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        quantity: nullableNum(0, 50).default(1),
        unit: z.string().trim().max(20).nullable().catch(null).default(null),
        estimated_grams: nullableNum(1, 2000).default(null),
      }),
    )
    .max(12),
  is_food: z.boolean().catch(true).default(true),
});
export type PhotoResponse = z.output<typeof PhotoResponse>;

export const IngredientBreakdown = z.object({
  dish: z.string().min(1),
  serving_grams: nullableNum(1, 2000).default(null),
  ingredients: z.array(z.object({ name: z.string().min(1).max(60), grams: z.number().min(0).max(2000) })).min(1).max(15),
});
export type IngredientBreakdown = z.output<typeof IngredientBreakdown>;

export const SummaryResponse = z.object({
  summary: z.string().trim().min(10).max(1200),
  facts_to_retire: z.array(z.string()).catch([]).default([]),
});

export const RecapResponse = z.object({ message: z.string().trim().min(10).max(1500) });

// ---------------------------------------------------------------- API inputs

export const ChatRequest = z.object({
  text: z.string().trim().min(1).max(2000),
  client_id: z.string().uuid(),
});

export const PhotoRequest = z.object({
  image_base64: z.string().min(100).max(3_000_000),
  meal: z.enum(MEALS).nullable().default(null),
});

export const ResolveFoodsRequest = z.object({
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
  meal: z.enum(MEALS),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.enum(['photo', 'manual']),
});

/** Strip ``` fences and any text around the outermost JSON object. */
export function extractJson(raw: string): unknown {
  let s = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('no_json_object');
  s = s.slice(start, end + 1);
  return JSON.parse(s);
}
