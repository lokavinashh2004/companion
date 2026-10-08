// Collections and their unique indexes. Used by both the MongoDB store (creates indexes) and the
// in-memory store (enforces the same uniqueness), so behaviour matches in dev, tests and production.
import type * as T from './types.ts';

export interface CollectionSpec {
  /** Unique key sets, e.g. [['user_id', 'day']] */
  unique: string[][];
  /** Extra (non-unique) indexes for MongoDB query speed */
  indexes?: string[][];
}

export const USER_COLLECTIONS = {
  profiles: { unique: [['user_id']] },
  messages: { unique: [['user_id', 'client_id']], indexes: [['user_id', 'created_at'], ['status', 'created_at']] },
  facts: { unique: [], indexes: [['user_id', 'active']] },
  food_logs: { unique: [], indexes: [['user_id', 'day']] },
  periods: { unique: [['user_id', 'start_date']], indexes: [['user_id']] },
  symptom_logs: { unique: [], indexes: [['user_id', 'day']] },
  mood_logs: { unique: [], indexes: [['user_id', 'day']] },
  lifestyle_logs: { unique: [['user_id', 'day']] },
  weight_logs: { unique: [['user_id', 'day']] },
  medications: { unique: [], indexes: [['user_id']] },
  med_intake: { unique: [['medication_id', 'scheduled_for']], indexes: [['user_id', 'scheduled_for']] },
  lab_results: { unique: [], indexes: [['user_id', 'test_date']] },
  daily_summaries: { unique: [['user_id', 'day']] },
  insights: { unique: [['user_id', 'type', 'key']] },
  push_subscriptions: { unique: [['endpoint']], indexes: [['user_id']] },
  reminder_log: { unique: [['user_id', 'kind', 'ref']] },
  push_log: { unique: [], indexes: [['user_id', 'created_at']] },
  snoozes: { unique: [], indexes: [['sent', 'due_at']] },
} satisfies Record<string, CollectionSpec>;

export const SHARED_COLLECTIONS = {
  users: { unique: [] },
  foods: { unique: [['canonical_name']] },
  food_synonyms: { unique: [['alias']] },
  household_units: { unique: [['unit_name', 'applies_to']] },
  llm_models: { unique: [['model_id']] },
  llm_usage: { unique: [['day']] },
  job_runs: { unique: [['job', 'period']] },
} satisfies Record<string, CollectionSpec>;

export type UserCollectionName = keyof typeof USER_COLLECTIONS;
export type SharedCollectionName = keyof typeof SHARED_COLLECTIONS;

export interface UserDocs {
  profiles: T.ProfileDoc;
  messages: T.MessageDoc;
  facts: T.FactDoc;
  food_logs: T.FoodLogDoc;
  periods: T.PeriodDoc;
  symptom_logs: T.SymptomDoc;
  mood_logs: T.MoodDoc;
  lifestyle_logs: T.LifestyleDoc;
  weight_logs: T.WeightDoc;
  medications: T.MedicationDoc;
  med_intake: T.MedIntakeDoc;
  lab_results: T.LabDoc;
  daily_summaries: T.SummaryDoc;
  insights: T.InsightDoc;
  push_subscriptions: T.PushSubscriptionDoc;
  reminder_log: T.ReminderLogDoc;
  push_log: T.PushLogDoc;
  snoozes: T.SnoozeDoc;
}

export interface SharedDocs {
  users: T.UserDoc;
  foods: T.FoodDoc;
  food_synonyms: T.FoodSynonymDoc;
  household_units: T.UnitDoc;
  llm_models: T.LlmModelDoc;
  llm_usage: T.LlmUsageDoc;
  job_runs: T.JobRunDoc;
}

export const USER_COLLECTION_NAMES = Object.keys(USER_COLLECTIONS) as UserCollectionName[];
