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

/** The deployed frontend. Always allowed, so a mistyped ALLOWED_ORIGINS on Render can't lock the app out. */
export const PRODUCTION_ORIGIN = 'https://companion-psi-eight.vercel.app';

/**
 * ALLOWED_ORIGINS → exact origins (scheme://host[:port]) the browser will send in the Origin header.
 * Tolerates what dashboards tend to add: quotes, spaces, trailing slashes, a path, upper case.
 */
export function allowedOrigins(env: Pick<Env, 'ALLOWED_ORIGINS' | 'NODE_ENV'>): string[] {
  const out = new Set<string>();
  for (const raw of env.ALLOWED_ORIGINS.split(/[,\s]+/)) {
    const v = raw.trim().replace(/^['"]+|['"]+$/g, '');
    if (!v) continue;
    try {
      const origin = new URL(v).origin;
      if (origin !== 'null') out.add(origin);
    } catch {
      console.warn(`ALLOWED_ORIGINS: ignoring "${v}" (not a URL like https://example.com)`);
    }
  }
  if (env.NODE_ENV === 'production') out.add(PRODUCTION_ORIGIN);
  return [...out];
}
