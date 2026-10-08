// Writes openapi.json from the route definitions. The frontend generates its API types from this file.
//   npm run openapi
import { writeFileSync } from 'node:fs';

import { createApp, VERSION } from '../src/app.ts';
import { createPushSender } from '../src/services/push.ts';
import { createMemoryStore } from '../src/store/index.ts';

const store = createMemoryStore();
const app = createApp({
  allowedOrigins: [],
  apiUrl: '',
  auth: { verifyToken: () => Promise.reject(new Error('unused')), deleteUser: () => Promise.resolve() },
  services: {
    store,
    env: { USDA_API_KEY: undefined, LLM_SUMMARY_RESERVE: 2, MED_ACTION_SECRET: undefined, CRON_SECRET: undefined },
    llm: { call: () => Promise.reject(new Error('unused')), remaining: () => Promise.resolve(0) },
    embed: async () => null,
    push: createPushSender(store, null),
    fetch,
    now: () => new Date(),
  },
});
const doc = app.getOpenAPI31Document({ openapi: '3.1.0', info: { title: 'Companion API', version: VERSION } });

// zod-to-openapi writes `ref.nullable()` as allOf [ref, {type: [object, null]}]; type generators read that as an
// intersection. Rewrite it to the plain form anyOf [ref, {type: null}].
function normalizeNullableRefs(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(normalizeNullableRefs);
  if (!node || typeof node !== 'object') return node;
  const o = node as Record<string, unknown>;
  const all = o.allOf as Record<string, unknown>[] | undefined;
  if (Array.isArray(all) && all.length === 2 && all[0]?.$ref && Array.isArray(all[1]?.type) && (all[1]!.type as string[]).includes('null')) {
    const { allOf: _drop, ...rest } = o;
    return { ...rest, anyOf: [{ $ref: all[0].$ref }, { type: 'null' }] };
  }
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, normalizeNullableRefs(v)]));
}

writeFileSync('openapi.json', `${JSON.stringify(normalizeNullableRefs(doc), null, 2)}\n`);
console.log(`openapi.json: ${Object.keys(doc.paths ?? {}).length} paths`);
