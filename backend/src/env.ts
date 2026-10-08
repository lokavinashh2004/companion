// Environment variables, validated once at startup. Names only live in .env.example / render.yaml;
// values are set in the Render dashboard (never committed).
import { z } from 'zod';

const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(8787),
  /** Comma-separated list of frontend origins allowed by CORS, e.g. https://companion.vercel.app */
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),

  FIREBASE_PROJECT_ID: optional,
  /** Service-account JSON (raw or base64). Needed to delete Firebase users; token checks work without it. */
  FIREBASE_SERVICE_ACCOUNT: optional,

  /** MongoDB connection string, e.g. mongodb+srv://user:pass@cluster.mongodb.net */
  MONGODB_URI: optional,
  MONGODB_DB: z.string().default('companion'),
  /** Public URL of this backend (Render sets RENDER_EXTERNAL_URL automatically); used inside push notifications. */
  PUBLIC_API_URL: optional,
  RENDER_EXTERNAL_URL: optional,

  OPENROUTER_API_KEY: optional,
  USDA_API_KEY: optional,
  LLM_DAILY_BUDGET: z.coerce.number().int().positive().default(50),
  LLM_SUMMARY_RESERVE: z.coerce.number().int().min(0).default(2),

  /** Shared secret the external scheduler (e.g. cron-job.org) sends to /jobs/* */
  CRON_SECRET: optional,

  VAPID_PUBLIC_KEY: optional,
  VAPID_PRIVATE_KEY: optional,
  VAPID_SUBJECT: optional,
  /** Signs the short-lived tokens inside medicine notifications (Taken / Snooze). */
  MED_ACTION_SECRET: optional,

  /** Where the gte-small embedding model is cached (filled at build time). */
  MODEL_DIR: z.string().default('./models'),
});

export type Env = z.output<typeof EnvSchema>;

const REQUIRED =['FIREBASE_PROJECT_ID', 'MONGODB_URI'] as const;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const r = EnvSchema.safeParse(source);
  if (!r.success) {
    const names = r.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Invalid or missing environment variables: ${names}. See backend/.env.example.`);
  }
  const env = r.data;
  const missing = REQUIRED.filter((k) => !env[k]);
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(', ')}. See backend/.env.example.`);
  return env;
}

export function allowedOrigins(env: Pick<Env, 'ALLOWED_ORIGINS'>): string[] {
  return env.ALLOWED_ORIGINS.split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
}
