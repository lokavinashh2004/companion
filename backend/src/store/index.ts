// The data store. MongoDB in production (MONGODB_URI); in-memory for local development without a database
// and for tests. Request handlers only ever see `store.user(uid)`: collections that add `user_id` to every
// filter and insert, so a query can't accidentally touch another user's data. Scheduled jobs (which work
// across users) use `store.unscoped`, which is deliberately named to stand out in review.
import type { Db } from 'mongodb';

import type { Collection, Filter, FindOptions, NewDoc } from './collection.ts';
import { MemoryCollection } from './memory.ts';
import { connectMongo, ensureIndexes, MongoCollection } from './mongo.ts';
import {
  SHARED_COLLECTIONS,
  USER_COLLECTION_NAMES,
  USER_COLLECTIONS,
  type SharedCollectionName,
  type SharedDocs,
  type UserCollectionName,
  type UserDocs,
} from './schema.ts';

type UserColls = { [K in UserCollectionName]: Collection<UserDocs[K]> };
type SharedColls = { [K in SharedCollectionName]: Collection<SharedDocs[K]> };

/** User collections without user_id in their write types: the scope adds it. */
export type Scoped<T extends { user_id: string }> = {
  find(filter?: Filter, opts?: FindOptions): Promise<T[]>;
  findOne(filter?: Filter, opts?: { sort?: Record<string, 1 | -1> }): Promise<T | null>;
  insertOne(doc: Omit<NewDoc<T>, 'user_id'>): Promise<T>;
  insertMany(docs: Omit<NewDoc<T>, 'user_id'>[]): Promise<T[]>;
  updateOne(filter: Filter, set: Partial<Omit<T, 'user_id'>>, opts?: { upsert?: boolean; setOnInsert?: Partial<Omit<T, 'user_id'>> }): Promise<T | null>;
  updateMany(filter: Filter, set: Partial<Omit<T, 'user_id'>>): Promise<number>;
  inc(filter: Filter, field: keyof T & string, by: number, opts?: { upsert?: boolean }): Promise<number>;
  deleteOne(filter: Filter): Promise<T | null>;
  deleteMany(filter?: Filter): Promise<number>;
  count(filter?: Filter): Promise<number>;
};
export type UserScope = { [K in UserCollectionName]: Scoped<UserDocs[K]> };

function scope<T extends { id: string; user_id: string }>(c: Collection<T>, uid: string): Scoped<T> {
  const f = (filter: Filter = {}) => ({ ...filter, user_id: uid });
  const d = <D extends object>(doc: D) => ({ ...doc, user_id: uid });
  return {
    find: (filter, opts) => c.find(f(filter), opts),
    findOne: (filter, opts) => c.findOne(f(filter), opts),
    insertOne: (doc) => c.insertOne(d(doc) as NewDoc<T>),
    insertMany: (docs) => c.insertMany(docs.map(d) as NewDoc<T>[]),
    updateOne: (filter, set, opts) => {
      const { user_id: _drop, ...safe } = set as Record<string, unknown>;
      return c.updateOne(f(filter), safe as Partial<T>, opts as { upsert?: boolean; setOnInsert?: Partial<T> });
    },
    updateMany: (filter, set) => {
      const { user_id: _drop, ...safe } = set as Record<string, unknown>;
      return c.updateMany(f(filter), safe as Partial<T>);
    },
    inc: (filter, field, by, opts) => c.inc(f(filter), field, by, opts),
    deleteOne: (filter) => c.deleteOne(f(filter)),
    deleteMany: (filter) => c.deleteMany(f(filter)),
    count: (filter) => c.count(f(filter)),
  };
}

export interface Store {
  kind: 'memory' | 'mongo';
  user(uid: string): UserScope;
  shared: SharedColls;
  /** Cross-user access for scheduled jobs only. */
  unscoped: UserColls;
  /** Deletes every document belonging to a user ("Delete everything"). */
  deleteUserData(uid: string): Promise<number>;
  close(): Promise<void>;
}

function build(kind: Store['kind'], make: (name: string, spec: (typeof USER_COLLECTIONS)[UserCollectionName]) => Collection<never>, close: () => Promise<void>): Store {
  const unscoped = Object.fromEntries(
    Object.entries(USER_COLLECTIONS).map(([name, spec]) => [name, make(name, spec)]),
  ) as unknown as UserColls;
  const shared = Object.fromEntries(
    Object.entries(SHARED_COLLECTIONS).map(([name, spec]) => [name, make(name, spec)]),
  ) as unknown as SharedColls;
  const scopes = new Map<string, UserScope>();
  return {
    kind,
    unscoped,
    shared,
    user(uid) {
      if (!uid) throw new Error('store.user() needs a user id');
      let s = scopes.get(uid);
      if (!s) {
        s = Object.fromEntries(USER_COLLECTION_NAMES.map((n) => [n, scope(unscoped[n] as never, uid)])) as unknown as UserScope;
        if (scopes.size > 500) scopes.clear();
        scopes.set(uid, s);
      }
      return s;
    },
    async deleteUserData(uid) {
      let n = 0;
      for (const name of USER_COLLECTION_NAMES) n += await unscoped[name].deleteMany({ user_id: uid });
      n += await shared.users.deleteMany({ id: uid });
      return n;
    },
    close,
  };
}

export function createMemoryStore(): Store {
  return build('memory', (_name, spec) => new MemoryCollection(spec) as never, async () => undefined);
}

export async function createMongoStore(uri: string, dbName: string): Promise<Store> {
  const { client, db } = await connectMongo(uri, dbName);
  await ensureIndexes(db, { ...USER_COLLECTIONS, ...SHARED_COLLECTIONS });
  return build('mongo', (name) => new MongoCollection((db as Db).collection(name)) as never, () => client.close());
}
