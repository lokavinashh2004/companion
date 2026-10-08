// In-memory store: used for local development without MongoDB and in tests.
// Enforces the same unique keys as the MongoDB indexes. Data is lost on restart.
import { randomUUID } from 'node:crypto';

import {
  DuplicateKeyError,
  equalities,
  matches,
  sortDocs,
  stamp,
  type Collection,
  type Filter,
  type FindOptions,
  type NewDoc,
} from './collection.ts';
import type { CollectionSpec } from './schema.ts';

const clone = <T>(x: T): T => structuredClone(x);

export class MemoryCollection<T extends { id: string; created_at: string }> implements Collection<T> {
  private rows: T[] = [];
  constructor(private readonly spec: CollectionSpec) {}

  private checkUnique(doc: T, ignoreId?: string) {
    for (const keys of this.spec.unique) {
      // Like the MongoDB partial indexes: documents with a missing/null key part are not constrained.
      if (keys.some((k) => (doc as Record<string, unknown>)[k] == null)) continue;
      const clash = this.rows.find(
        (r) => r.id !== ignoreId && keys.every((k) => (r as Record<string, unknown>)[k] === (doc as Record<string, unknown>)[k]),
      );
      if (clash) throw new DuplicateKeyError(keys.join(','));
    }
  }

  async find(filter: Filter = {}, opts: FindOptions = {}): Promise<T[]> {
    let out = sortDocs(this.rows.filter((r) => matches(r as Record<string, unknown>, filter)), opts.sort);
    if (opts.skip) out = out.slice(opts.skip);
    if (opts.limit !== undefined) out = out.slice(0, opts.limit);
    return out.map(clone);
  }

  async findOne(filter: Filter, opts: { sort?: Record<string, 1 | -1> } = {}): Promise<T | null> {
    return (await this.find(filter, { sort: opts.sort, limit: 1 }))[0] ?? null;
  }

  async insertOne(doc: NewDoc<T>): Promise<T> {
    const full = { ...clone(doc), id: doc.id ?? randomUUID(), created_at: doc.created_at ?? stamp() } as T;
    this.checkUnique(full);
    this.rows.push(full);
    return clone(full);
  }

  async insertMany(docs: NewDoc<T>[]): Promise<T[]> {
    const out: T[] = [];
    for (const d of docs) out.push(await this.insertOne(d));
    return out;
  }

  async updateOne(filter: Filter, set: Partial<T>, opts: { upsert?: boolean; setOnInsert?: Partial<T> } = {}): Promise<T | null> {
    const i = this.rows.findIndex((r) => matches(r as Record<string, unknown>, filter));
    if (i === -1) {
      if (!opts.upsert) return null;
      return this.insertOne({ ...equalities(filter), ...opts.setOnInsert, ...set } as NewDoc<T>);
    }
    const next = { ...this.rows[i]!, ...clone(set) } as T;
    this.checkUnique(next, next.id);
    this.rows[i] = next;
    return clone(next);
  }

  async updateMany(filter: Filter, set: Partial<T>): Promise<number> {
    let n = 0;
    this.rows = this.rows.map((r) => {
      if (!matches(r as Record<string, unknown>, filter)) return r;
      n++;
      return { ...r, ...clone(set) };
    });
    return n;
  }

  async inc(filter: Filter, field: keyof T & string, by: number, opts: { upsert?: boolean } = {}): Promise<number> {
    const i = this.rows.findIndex((r) => matches(r as Record<string, unknown>, filter));
    if (i === -1) {
      if (!opts.upsert) return 0;
      await this.insertOne({ ...equalities(filter), [field]: by } as NewDoc<T>);
      return by;
    }
    const row = this.rows[i] as Record<string, unknown>;
    row[field] = Number(row[field] ?? 0) + by;
    return row[field] as number;
  }

  async deleteOne(filter: Filter): Promise<T | null> {
    const i = this.rows.findIndex((r) => matches(r as Record<string, unknown>, filter));
    if (i === -1) return null;
    const [gone] = this.rows.splice(i, 1);
    return gone ? clone(gone) : null;
  }

  async deleteMany(filter: Filter): Promise<number> {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !matches(r as Record<string, unknown>, filter));
    return before - this.rows.length;
  }

  async count(filter: Filter = {}): Promise<number> {
    return this.rows.filter((r) => matches(r as Record<string, unknown>, filter)).length;
  }
}
