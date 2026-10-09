// Entry point on Render: `npm run build && npm start`. Render provides PORT and RENDER_EXTERNAL_URL.
import { existsSync } from 'node:fs';
import { serve } from '@hono/node-server';

import { createApp, VERSION } from './app.ts';
import { claim, tick } from './jobs/tick.ts';
import { createFirebaseAuth } from './auth/firebase.ts';
import { allowedOrigins, loadEnv } from './env.ts';
import type { Services } from './services/context.ts';
import { configureModelDir, embed } from './services/embed.ts';
import { createLlmClient, usageDay } from './services/llm.ts';
import { fetchCatalog } from './services/models.ts';
import { createPushSender, webPushTransport } from './services/push.ts';
import { createMongoStore } from './store/index.ts';
import { seedFoods, syncModels } from './store/seed.ts';

// Local runs read backend/.env; on Render the dashboard provides the environment.
if (process.env.NODE_ENV !== 'production' && existsSync('.env')) process.loadEnvFile('.env');

const env = loadEnv();
// loadEnv() has already checked that FIREBASE_PROJECT_ID and MONGODB_URI are set.
const auth = createFirebaseAuth(env);
const store = await createMongoStore(env.MONGODB_URI!, env.MONGODB_DB);

console.log(`startup: database connected (${env.MONGODB_DB})`);
const seeded = await seedFoods(store);
console.log(`seed: ${seeded.foods} foods, ${seeded.synonyms} synonyms, ${seeded.units} units added`);

// LLM models: resolve the seed list against OpenRouter's public catalog (no key needed), then sync.
const catalog = await fetchCatalog().catch((e) => {
  console.warn(`llm: OpenRouter model list unreachable (${e instanceof Error ? e.message : e}); keeping the models already in the database`);
  return null;
});
const models = await syncModels(store, catalog);
for (const m of models.synced) console.log(`llm: model ${m.priority}. ${m.model_id} [${m.caps.join(',')}]${m.enabled ? '' : ' (disabled in seed)'}`);
if (models.unresolved.length) console.warn(`llm: not found as a free model on OpenRouter: ${models.unresolved.join('; ')}`);
if (models.retired.length) console.log(`llm: retired old models: ${models.retired.join(', ')}`);

configureModelDir(env.MODEL_DIR, env.NODE_ENV !== 'production');
let embedOk = true;
const services: Services = {
  store,
  env,
  llm: createLlmClient(store, env.OPENROUTER_API_KEY, env.LLM_DAILY_BUDGET, (input, init) => fetch(input, init)),
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

const yesNo = (v: unknown) => (v ? 'set' : 'MISSING');
serve({ fetch: app.fetch, port: env.PORT, hostname: '0.0.0.0' }, (info) => {
  const enabled = models.synced.filter((m) => m.enabled).length;
  console.log(
    [
      '==================================================',
      `companion-backend ${VERSION} is running on :${info.port} (${env.NODE_ENV})`,
      `  public url   ${apiUrl}`,
      `  database     mongo / ${env.MONGODB_DB}`,
      `  firebase     project ${env.FIREBASE_PROJECT_ID}, service account ${yesNo(env.FIREBASE_SERVICE_ACCOUNT)}`,
      `  cors         ${origins.join(', ') || '(none)'}`,
      `  llm          OpenRouter key ${yesNo(env.OPENROUTER_API_KEY)}, ${enabled} models enabled, ${env.LLM_DAILY_BUDGET} requests/day budget`,
      `  push         ${env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY ? 'on' : 'off (VAPID keys missing)'}, cron secret ${yesNo(env.CRON_SECRET)}, USDA key ${yesNo(env.USDA_API_KEY)}`,
      '==================================================',
    ].join('\n'),
  );
  void startupLlmCheck();
});

// After start (never blocking requests): always check the key; probe every model at most once per UTC day,
// because each probe uses one request of the free daily quota and Render restarts the app often.
async function startupLlmCheck() {
  try {
    const probe = !!env.OPENROUTER_API_KEY && (await claim(services, 'llm-probe', usageDay()));
    if (!probe && env.OPENROUTER_API_KEY) console.log('llm: models were already probed today; POST /jobs/llm-check to test them again');
    await services.llm.check?.({ probe });
  } catch (e) {
    console.warn('llm: startup check failed', e instanceof Error ? e.message : e);
  }
}

// Local development has no external scheduler: run the same tick in-process every 5 minutes
// (reminders, retrying queued chat messages, daily jobs). On Render, cron-job.org calls /jobs/tick.
if (env.NODE_ENV === 'development') {
  const run = () =>
    tick(services, apiUrl)
      .then((r) => console.log('dev tick', JSON.stringify(r).slice(0, 200)))
      .catch((e) => console.warn('dev tick failed', e instanceof Error ? e.message : e));
  setInterval(run, 5 * 60_000).unref();
}
