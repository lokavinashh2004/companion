// Stored document shapes (snake_case, like the API). Every document has a string `id` (UUID) and `created_at`.
// User documents also carry `user_id` (the Firebase uid); the store adds it automatically (see store/index.ts).

export type GiBand = 'low' | 'medium' | 'high' | 'unknown';
export type Meal = 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'other';

export interface Base {
  id: string;
  created_at: string;
}
export interface Owned extends Base {
  user_id: string;
}

export interface UserDoc extends Base {
  email: string | null;
}

export interface ProfileDoc extends Owned {
  companion_name: string;
  display_language: 'auto' | 'en' | 'ta' | 'tanglish';
  ui_language: 'en' | 'ta';
  persona_tone: 'bestie' | 'calm' | 'coach';
  tamil_address_form: 'casual' | 'respectful';
  calorie_display: 'show' | 'hide';
  goals: string[];
  diet_type: string | null;
  allergies: string[];
  typical_cycle_length: number | null;
  onboarding_done: boolean;
  timezone: string;
  morning_checkin: string;
  evening_checkin: string;
  quiet_start: string;
  quiet_end: string;
  water_nudges: boolean;
  weight_tracking: boolean;
  last_opened_at: string | null;
  soft_nudge_sent_at: string | null;
}

export interface UndoLog {
  table: 'food_logs' | 'symptom_logs' | 'mood_logs' | 'med_intake' | 'lifestyle_logs';
  id: string;
  label: string;
  /** lifestyle_logs only: field values before this message, restored on undo */
  prev?: Record<string, unknown>;
}

export interface PendingPeriod {
  kind: 'period_start' | 'period_end';
  date: string;
  flow: 'spotting' | 'light' | 'medium' | 'heavy' | null;
  pain: number | null;
}

export interface MessageMeta {
  reply_to?: string;
  logs?: UndoLog[];
  pending?: PendingPeriod[];
  flags?: { crisis: boolean; red_flag: boolean };
  fallback?: boolean;
  kind?: string;
  undone?: Record<string, boolean>;
  confirmed?: Record<string, string>;
}

export interface MessageDoc extends Owned {
  client_id: string | null;
  role: 'user' | 'assistant' | 'system';
  content: string;
  language: 'en' | 'ta' | 'tanglish' | 'mixed' | null;
  status: 'pending' | 'done' | 'queued' | 'failed';
  model_id: string | null;
  retry_count: number;
  error: string | null;
  meta: MessageMeta;
}

export interface FactDoc extends Owned {
  updated_at: string;
  fact: string;
  category: 'preference' | 'person' | 'event' | 'health' | 'other';
  source_message_id: string | null;
  active: boolean;
  embedding: number[] | null;
}

export interface FoodLogDoc extends Owned {
  day: string;
  meal: Meal;
  item_name: string;
  matched_food_id: string | null;
  quantity: number | null;
  unit: string | null;
  grams: number | null;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  added_sugar_g: number | null;
  veg_g: number | null;
  gi_band: GiBand;
  is_estimate: boolean;
  source: 'text' | 'photo' | 'manual';
  source_message_id: string | null;
}

export interface PeriodDoc extends Owned {
  start_date: string;
  end_date: string | null;
  flow: 'spotting' | 'light' | 'medium' | 'heavy' | null;
  pain: number | null;
  notes: string | null;
  auto_closed: boolean;
  source_message_id: string | null;
}

export interface SymptomDoc extends Owned {
  day: string;
  symptom: string;
  severity: number;
  note: string | null;
  source_message_id: string | null;
}

export interface MoodDoc extends Owned {
  day: string;
  mood: number | null;
  energy: number | null;
  stress: number | null;
  note: string | null;
  source_message_id: string | null;
}

export interface LifestyleDoc extends Owned {
  day: string;
  sleep_hours: number | null;
  water_ml: number | null;
  steps: number | null;
  exercise_minutes: number | null;
  exercise_type: string | null;
  illness: boolean | null;
  travel: boolean | null;
}

export interface WeightDoc extends Owned {
  day: string;
  weight_kg: number;
}

export interface MedicationDoc extends Owned {
  name: string;
  dose: string | null;
  schedule_times: string[]; // 'HH:MM'
  active: boolean;
  start_date: string | null;
  end_date: string | null;
}

export interface MedIntakeDoc extends Owned {
  medication_id: string;
  scheduled_for: string; // ISO timestamp with offset
  taken: boolean;
  taken_at: string | null;
}

export interface LabDoc extends Owned {
  test_date: string;
  test_name: 'testosterone' | 'AMH' | 'LH' | 'FSH' | 'fasting_insulin' | 'HbA1c' | 'TSH' | 'vitamin_D' | 'other';
  test_label: string | null;
  value: number;
  unit: string | null;
  reference_range: string | null;
}

export interface SummaryDoc extends Owned {
  day: string;
  summary: string;
  mood_avg: number | null;
  embedding: number[] | null;
}

export interface InsightDoc extends Owned {
  day: string;
  type: 'delay' | 'weekly' | 'red_flag' | 'pattern';
  key: string;
  payload: Record<string, unknown>;
  shown: boolean;
  dismissed: boolean;
}

export interface PushSubscriptionDoc extends Owned {
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
}

export interface ReminderLogDoc extends Owned {
  kind: 'morning' | 'evening' | 'water' | 'med';
  ref: string;
}

export interface PushLogDoc extends Owned {
  kind: string;
  ref: string | null;
}

export interface SnoozeDoc extends Owned {
  medication_id: string;
  time: string; // 'HH:MM' of the original dose
  day: string;
  due_at: string; // ISO
  sent: boolean;
}

// ---------------------------------------------------------------- shared (not per user)

export interface FoodDoc extends Base {
  canonical_name: string;
  source: 'usda' | 'off' | 'ifct' | 'custom';
  external_id: string | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  added_sugar_g: number;
  veg_fraction: number;
  typical_serving_g: number | null;
  gi_band: GiBand;
  is_liquid: boolean;
}

export interface FoodSynonymDoc extends Base {
  food_id: string;
  alias: string;
  language: 'en' | 'ta' | 'tanglish';
}

export interface UnitDoc extends Base {
  unit_name: string;
  language: 'en' | 'ta' | 'tanglish';
  grams_or_ml: number;
  applies_to: string | null; // food id
  note: string | null;
}

export interface LlmModelDoc extends Base {
  model_id: string;
  priority: number;
  caps: string[];
  enabled: boolean;
  supports_response_format: boolean;
  notes: string | null;
  /** set by the model-health job; config sync never clears it */
  health_disabled: boolean;
  unhealthy_until: string | null;
  consecutive_fails: number;
  success_count: number;
  fail_count: number;
  avg_latency_ms: number | null;
  last_error: string | null;
}

export interface LlmUsageDoc extends Base {
  day: string;
  requests: number;
}

export interface JobRunDoc extends Base {
  job: string;
  period: string;
}
