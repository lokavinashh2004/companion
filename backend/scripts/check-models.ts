// Tests the OpenRouter key and every model in src/store/seed/llm-models.json, in fallback order.
//   OPENROUTER_API_KEY=... npm run models:check      (or put the key in backend/.env)
//   add -- --all to also probe models that are disabled in the seed.
// Uses one request of the free daily quota per model probed. Never prints the key.
import { existsSync, readFileSync } from 'node:fs';

import { checkKey, describeKey, fetchCatalog, probeModel, resolveSeedModel, type SeedModel } from '../src/services/models.ts';

async function main() {
  if (!process.env.OPENROUTER_API_KEY && existsSync('.env')) process.loadEnvFile('.env');
  const key = process.env.OPENROUTER_API_KEY;
  const all = process.argv.includes('--all');

  const status = await checkKey(fetch, key);
  console.log(describeKey(status));
  if (status.status !== 'ok' || !key) process.exit(1);

  const seed = JSON.parse(readFileSync('src/store/seed/llm-models.json', 'utf8')) as { models: SeedModel[] };
  const catalog = await fetchCatalog();
  let working = 0;
  for (const m of seed.models.sort((a, b) => a.priority - b.priority)) {
    const label = `${String(m.priority).padStart(2)}. ${m.name ?? m.model_id}`;
    const live = resolveSeedModel(m, catalog);
    if (!live) {
      console.log(`${label}\n    NOT FOUND as a free model on OpenRouter`);
      continue;
    }
    const vision = live.architecture?.input_modalities?.includes('image') ? ' vision' : '';
    const rf = live.supported_parameters?.includes('response_format') ? ' json-mode' : '';
    if (!m.enabled && !all) {
      console.log(`${label}\n    ${live.id}${vision}${rf}: disabled in seed, skipped (use --all)`);
      continue;
    }
    const r = await probeModel(fetch, key, live.id);
    if (r.ok) working++;
    console.log(`${label}\n    ${live.id}${vision}${rf}: ${r.ok ? `OK ${r.latency_ms}ms` : `FAILED ${r.error}`}`);
  }
  console.log(`\n${working} model(s) answered.`);
  process.exit(working ? 0 : 1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
