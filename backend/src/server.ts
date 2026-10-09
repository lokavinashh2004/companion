// Entry point on Render: `npm run build && npm start`. Render provides PORT and RENDER_EXTERNAL_URL.
import { existsSync } from 'node:fs';
import { serve } from '@hono/node-server';

import { createApp } from './app.ts';
import { tick } from './jobs/tick.ts';
import { createFirebaseAuth } from './auth/firebase.ts';
import { allowedOrigins, loadEnv } from './env.ts';
import type { Services } from './services/context.ts';
import { configureModelDir, embed } from './services/embed.ts';
import { createLlmClient } from './services/llm.ts';
import { createPushSender, webPushTransport } from './services/push.ts';
import { createMongoStore } from './store/index.ts';
import { seedFoods, syncModels } from './store/seed.ts';

// Local runs read backend/.env; on Render the dashboard provides the environment.
if (process.env.NODE_ENV !== 'production' && existsSync('.env')) process.loadEnvFile('.env');

const env = loadEnv();
// loadEnv() has already checked that FIREBASE_PROJECT_ID and MONGODB_URI are set.
const auth = createFirebaseAuth(env);
const store = await createMongoStore(env.MONGODB_URI!, env.MONGODB_DB);

const seeded = await seedFoods(store);
const models = await syncModels(store);
console.log(`seed: ${seeded.foods} foods, ${seeded.synonyms} synonyms, ${seeded.units} units added; ${models} models synced`);

configureModelDir(env.MODEL_DIR, env.NODE_ENV !== 'production');
let embedOk = true;
const services: Services = {
  store,
  env,
  llm: createLlmClient(store, env.OPENROUTER_API_KEY, env.LLM_DAILY_BUDGET),
  embed: async (text) => {
    if (!embedOk) return null;
    try {
      return await embed(text);
    } catch (e) {
      embedOk = false; // model unavailable: memory search is skipped rather than failing requests
      console.warn('embeddings disabled:', e instanceof Error ? e.message : e);
      return null;
    }
  },
  push: createPushSender(
    store,
    env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY
      ? webPushTransport({ publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT ?? 'mailto:admin@example.com' })
      : null,
  ),
  fetch: (input, init) => fetch(input, init),
  now: () => new Date(),
};

const apiUrl = (env.PUBLIC_API_URL ?? env.RENDER_EXTERNAL_URL ?? `http://localhost:${env.PORT}`).replace(/\/$/, '');
const origins = allowedOrigins(env);
console.log(`CORS allowed origins: ${origins.join(', ') || '(none)'}`);
const app = createApp({ auth, services, allowedOrigins: origins, apiUrl });

serve({ fetch: app.fetch, port: env.PORT, hostname: '0.0.0.0' }, (info) => {
  console.log(`companion-backend listening on :${info.port} (${env.NODE_ENV})`);
});

// Local development has no external scheduler: run the same tick in-process every 5 minutes
// (reminders, retrying queued chat messages, daily jobs). On Render, cron-job.org calls /jobs/tick.
if (env.NODE_ENV === 'development') {
  const run = () =>
    tick(services, apiUrl)
      .then((r) => console.log('dev tick', JSON.stringify(r).slice(0, 200)))
      .catch((e) => console.warn('dev tick failed', e instanceof Error ? e.message : e));
  setInterval(run, 5 * 60_000).unref();
}
