// The same store behaviour on a real MongoDB and on the in-memory store.
// MongoDB comes from MONGODB_TEST_URI (e.g. your Atlas cluster: a throwaway database is created and dropped),
// otherwise from mongodb-memory-server (downloads a MongoDB binary). If neither is available the MongoDB
// half is skipped with the reason shown, and the in-memory half still runs.
import { randomUUID } from 'node:crypto';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DuplicateKeyError } from '../src/store/collection.ts';
import { createMemoryStore, createMongoStore, type Store } from '../src/store/index.ts';
import { harness, onboard, reply } from './helpers.ts';

let mongod: MongoMemoryServer | null = null;
let mongoError: string | null = null;

const externalUri = process.env.MONGODB_TEST_URI;

beforeAll(async () => {
  if (externalUri) return;
  try {
    mongod = await MongoMemoryServer.create();
  } catch (e) {
    mongoError = (e instanceof Error ? e.message : String(e)).split(/\r?\n/)[0]!;
    console.warn(`MongoDB tests skipped: ${mongoError}. Set MONGODB_TEST_URI to run them against a real cluster.`);
  }
}, 240_000);

afterAll(async () => {
  await mongod?.stop();
});

const factories: [string, () => Promise<Store | null>][] = [
  ['memory', async () => createMemoryStore()],
  [
    'mongo',
    async () => {
      const uri = externalUri ?? mongod?.getUri();
      if (!uri) return null;
      const store = await createMongoStore(uri, `companion_test_${randomUUID().slice(0, 8)}`);
      return store;
    },
  ],
];

describe.each(factories)('%s store', (_name, make) => {
  it('CRUD, sort, limit, operators and dot paths', async (ctx) => {
    const store = await make();
    if (!store) return ctx.skip();
    const u = store.user('u1');
    await u.food_logs.insertMany(
      [3, 1, 2].map((n) => ({
        day: `2026-10-0${n}`, meal: 'lunch' as const, item_name: `item${n}`, matched_food_id: null, quantity: n, unit: null, grams: n * 10,
        kcal: null, protein_g: null, carbs_g: null, fat_g: null, fiber_g: null, sugar_g: null, added_sugar_g: null, veg_g: null,
        gi_band: 'unknown' as const, is_estimate: false, source: 'manual' as const, source_message_id: null,
      })),
    );
    expect((await u.food_logs.find({}, { sort: { day: 1 } })).map((f) => f.day)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
    expect((await u.food_logs.find({ day: { $gte: '2026-10-02' } }, { sort: { day: -1 }, limit: 1 })).map((f) => f.item_name)).toEqual(['item3']);
    expect(await u.food_logs.count({ quantity: { $in: [1, 3] } })).toBe(2);
    const updated = await u.food_logs.updateOne({ item_name: 'item1' }, { grams: 99 });
    expect(updated?.grams).toBe(99);
    expect(Object.keys(updated!)).not.toContain('_id');
    await u.messages.insertOne({ client_id: 'c1', role: 'user', content: 'x', language: null, status: 'done', model_id: null, retry_count: 0, error: null, meta: { reply_to: 'abc' } });
    expect(await u.messages.count({ 'meta.reply_to': 'abc' })).toBe(1);
    expect(await u.food_logs.deleteMany({ quantity: { $lt: 3 } })).toBe(2);
    await store.close();
  });

  it('every user query is scoped; user_id cannot be overwritten', async (ctx) => {
    const store = await make();
    if (!store) return ctx.skip();
    const a = store.user('a');
    const b = store.user('b');
    const lab = await a.lab_results.insertOne({ test_date: '2026-10-01', test_name: 'TSH', test_label: null, value: 1, unit: null, reference_range: null });
    expect(lab.user_id).toBe('a');
    expect(await b.lab_results.find()).toEqual([]);
    expect(await b.lab_results.findOne({ id: lab.id })).toBeNull();
    expect(await b.lab_results.deleteOne({ id: lab.id })).toBeNull();
    expect(await b.lab_results.updateOne({ id: lab.id }, { value: 5 })).toBeNull();
    await a.lab_results.updateOne({ id: lab.id }, { value: 2, user_id: 'b' } as never);
    expect((await a.lab_results.findOne({ id: lab.id }))?.value).toBe(2);
    expect(await b.lab_results.count()).toBe(0);
    await store.close();
  });

  it('unique keys (ignoring nulls), upsert with setOnInsert, atomic inc', async (ctx) => {
    const store = await make();
    if (!store) return ctx.skip();
    const u = store.user('u1');
    const msg = { role: 'assistant' as const, content: 'x', language: null, status: 'done' as const, model_id: null, retry_count: 0, error: null, meta: {} };
    await u.messages.insertOne({ ...msg, client_id: null });
    await u.messages.insertOne({ ...msg, client_id: null }); // nulls don't clash
    await u.messages.insertOne({ ...msg, client_id: 'same' });
    await expect(u.messages.insertOne({ ...msg, client_id: 'same' })).rejects.toBeInstanceOf(DuplicateKeyError);
    await store.user('u2').messages.insertOne({ ...msg, client_id: 'same' }); // other user: fine

    const first = await u.lifestyle_logs.updateOne({ day: '2026-10-08' }, { water_ml: 250 }, { upsert: true, setOnInsert: { sleep_hours: 7 } });
    const second = await u.lifestyle_logs.updateOne({ day: '2026-10-08' }, { water_ml: 500 }, { upsert: true, setOnInsert: { sleep_hours: 1 } });
    expect(second).toMatchObject({ id: first!.id, water_ml: 500, sleep_hours: 7, user_id: 'u1', day: '2026-10-08' });

    expect(await store.shared.llm_usage.inc({ day: '2026-10-08' }, 'requests', 1, { upsert: true })).toBe(1);
    expect(await store.shared.llm_usage.inc({ day: '2026-10-08' }, 'requests', 1, { upsert: true })).toBe(2);
    await store.close();
  });

  it('deleteUserData removes everything for one user only', async (ctx) => {
    const store = await make();
    if (!store) return ctx.skip();
    for (const uid of ['a', 'b']) {
      const u = store.user(uid);
      await store.shared.users.updateOne({ id: uid }, { email: null }, { upsert: true });
      await u.profiles.updateOne({}, { companion_name: 'C' }, { upsert: true });
      await u.weight_logs.insertOne({ day: '2026-10-08', weight_kg: 60 });
    }
    expect(await store.deleteUserData('a')).toBeGreaterThanOrEqual(3);
    expect(await store.user('a').weight_logs.count()).toBe(0);
    expect(await store.user('b').weight_logs.count()).toBe(1);
    await store.close();
  });

  it('end to end: onboarding, chat food logging and the period chip work on this store', async (ctx) => {
    const store = await make();
    if (!store) return ctx.skip();
    const h = await harness({ store });
    await onboard(h, 'token-a', { last_period_start: '2026-09-20' });
    h.llm.queue.push(reply('Nice!', { foods: [{ name: 'idly', quantity: 3, unit: null, meal: 'breakfast' }], period_event: { type: 'started', relative_day: 0, flow: null, pain: null } }));
    const r = await h.json<{ reply: { id: string; meta: { logs: unknown[] } } }>('/chat/messages', { token: 'token-a', body: { text: '3 idly, periods vandhuduchu', client_id: randomUUID() } });
    expect(r.body.reply.meta.logs).toHaveLength(1);
    await h.json('/chat/confirm-period', { token: 'token-a', body: { message_id: r.body.reply.id, index: 0 } });
    const cycle = await h.json<{ periods: { start_date: string }[] }>('/cycle', { token: 'token-a' });
    expect(cycle.body.periods.map((p) => p.start_date)).toEqual(['2026-10-08', '2026-09-20']);
    const today = await h.json<{ foods: { item_name: string; grams: number }[] }>('/today', { token: 'token-a' });
    expect(today.body.foods[0]).toMatchObject({ item_name: 'idly', grams: 120 });
    await store.close();
  });
});
