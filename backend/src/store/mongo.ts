// MongoDB store (Atlas free M0 works). Documents use our own string `id`; Mongo's `_id` is never exposed.
import { randomUUID } from 'node:crypto';
import { MongoClient, MongoServerError, type Collection as MongoColl, type Db, type Document } from 'mongodb';

import { DuplicateKeyError, equalities, stamp, type Collection, type Filter, type FindOptions, type NewDoc } from './collection.ts';
import type { CollectionSpec } from './schema.ts';

const NO_ID = { _id: 0 } as const;

function rethrow(e: unknown): never {
  if (e instanceof MongoServerError && e.code === 11000) throw new DuplicateKeyError(Object.keys(e.keyPattern ?? {}).join(','));
  throw e;
}

export class MongoCollection<T extends { id: string; created_at: string }> implements Collection<T> {
  constructor(private readonly c: MongoColl<Document>) {}

  async find(filter: Filter = {}, opts: FindOptions = {}): Promise<T[]> {
    let cur = this.c.find(filter, { projection: NO_ID });
    if (opts.sort) cur = cur.sort(opts.sort);
    if (opts.skip) cur = cur.skip(opts.skip);
    if (opts.limit !== undefined) cur = cur.limit(opts.limit);
    return (await cur.toArray()) as unknown as T[];
  }

  async findOne(filter: Filter, opts: { sort?: Record<string, 1 | -1> } = {}): Promise<T | null> {
    return (await this.c.findOne(filter, { projection: NO_ID, sort: opts.sort })) as unknown as T | null;
  }

  async insertOne(doc: NewDoc<T>): Promise<T> {
    const full = { ...doc, id: doc.id ?? randomUUID(), created_at: doc.created_at ?? stamp() };
    try {
      await this.c.insertOne({ ...full });
    } catch (e) {
      rethrow(e);
    }
    return full as unknown as T;
  }

  async insertMany(docs: NewDoc<T>[]): Promise<T[]> {
    if (docs.length === 0) return [];
    const full = docs.map((d) => ({ ...d, id: d.id ?? randomUUID(), created_at: d.created_at ?? stamp() }));
    try {
      await this.c.insertMany(full.map((d) => ({ ...d })), { ordered: true });
    } catch (e) {
      rethrow(e);
    }
    return full as unknown as T[];
  }

  async updateOne(filter: Filter, set: Partial<T>, opts: { upsert?: boolean; setOnInsert?: Partial<T> } = {}): Promise<T | null> {
    const setKeys = new Set(Object.keys(set));
    const onInsert: Record<string, unknown> = { id: randomUUID(), created_at: new Date().toISOString(), ...opts.setOnInsert };
    for (const k of Object.keys(onInsert)) if (setKeys.has(k)) delete onInsert[k];
    try {
      const doc = await this.c.findOneAndUpdate(
        filter,
        { ...(Object.keys(set).length ? { $set: set } : {}), ...(opts.upsert ? { $setOnInsert: onInsert } : {}) },
        { upsert: !!opts.upsert, returnDocument: 'after', projection: NO_ID },
      );
      return doc as unknown as T | null;
    } catch (e) {
      rethrow(e);
    }
  }

  async updateMany(filter: Filter, set: Partial<T>): Promise<number> {
    return (await this.c.updateMany(filter, { $set: set })).modifiedCount;
  }

  async inc(filter: Filter, field: keyof T & string, by: number, opts: { upsert?: boolean } = {}): Promise<number> {
    const doc = await this.c.findOneAndUpdate(
      filter,
      { $inc: { [field]: by }, ...(opts.upsert ? { $setOnInsert: { id: randomUUID(), created_at: new Date().toISOString(), ...equalities(filter) } } : {}) },
      { upsert: !!opts.upsert, returnDocument: 'after', projection: NO_ID },
    );
    return Number((doc as Record<string, unknown> | null)?.[field] ?? 0);
  }

  async deleteOne(filter: Filter): Promise<T | null> {
    return (await this.c.findOneAndDelete(filter, { projection: NO_ID })) as unknown as T | null;
  }

  async deleteMany(filter: Filter): Promise<number> {
    return (await this.c.deleteMany(filter)).deletedCount;
  }

  async count(filter: Filter = {}): Promise<number> {
    return this.c.countDocuments(filter);
  }
}

export async function connectMongo(uri: string, dbName: string): Promise<{ client: MongoClient; db: Db }> {
  const client = new MongoClient(uri, { maxPoolSize: 10, serverSelectionTimeoutMS: 10_000 });
  await client.connect();
  return { client, db: client.db(dbName) };
}

export async function ensureIndexes(db: Db, specs: Record<string, CollectionSpec>): Promise<void> {
  for (const [name, spec] of Object.entries(specs)) {
    const c = db.collection(name);
    await c.createIndex({ id: 1 }, { unique: true });
    // Partial unique indexes: documents where a key part is null/missing are not constrained
    // (e.g. assistant messages have no client_id; generic units have no food).
    for (const keys of spec.unique) {
      await c.createIndex(Object.fromEntries(keys.map((k) => [k, 1])), {
        unique: true,
        partialFilterExpression: Object.fromEntries(keys.map((k) => [k, { $type: 'string' }])),
      });
    }
    for (const keys of spec.indexes ?? []) await c.createIndex(Object.fromEntries(keys.map((k) => [k, 1])));
  }
}
