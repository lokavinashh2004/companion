// A small MongoDB-shaped collection API shared by the real MongoDB store and the in-memory store.
// Filters support equality and $eq/$ne/$gt/$gte/$lt/$lte/$in/$nin/$exists, like MongoDB.

export type Cond = { $eq?: unknown; $ne?: unknown; $gt?: unknown; $gte?: unknown; $lt?: unknown; $lte?: unknown; $in?: unknown[]; $nin?: unknown[]; $exists?: boolean };
export type Filter = Record<string, unknown>;
export type Sort = Record<string, 1 | -1>;

export interface FindOptions {
  sort?: Sort;
  limit?: number;
  skip?: number;
}

export class DuplicateKeyError extends Error {
  constructor(public readonly key: string) {
    super(`duplicate key: ${key}`);
  }
}

let lastStamp = 0;
/** Strictly increasing ISO timestamps, so documents created in the same millisecond keep their order. */
export function stamp(): string {
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  return new Date(lastStamp).toISOString();
}

/** New documents get `id` and `created_at` from the store; callers may pass them to override. */
export type NewDoc<T> = Omit<T, 'id' | 'created_at'> & { id?: string; created_at?: string };

export interface Collection<T extends { id: string }> {
  find(filter?: Filter, opts?: FindOptions): Promise<T[]>;
  findOne(filter: Filter, opts?: { sort?: Sort }): Promise<T | null>;
  insertOne(doc: NewDoc<T>): Promise<T>;
  insertMany(docs: NewDoc<T>[]): Promise<T[]>;
  /** Updates the first match and returns it (after update), or null. With upsert, inserts `{...filterEquals, ...set, ...setOnInsert}`. */
  updateOne(filter: Filter, set: Partial<T>, opts?: { upsert?: boolean; setOnInsert?: Partial<T> }): Promise<T | null>;
  updateMany(filter: Filter, set: Partial<T>): Promise<number>;
  /** Atomically adds `by` to a numeric field (upserting when asked) and returns the new value. */
  inc(filter: Filter, field: keyof T & string, by: number, opts?: { upsert?: boolean }): Promise<number>;
  deleteOne(filter: Filter): Promise<T | null>;
  deleteMany(filter: Filter): Promise<number>;
  count(filter?: Filter): Promise<number>;
}

// ---------------------------------------------------------------- helpers used by the in-memory store

function cmp(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  return (a as number | string) < (b as number | string) ? -1 : 1;
}

/** Reads 'a.b.c' style paths, like MongoDB dot notation. */
function getPath(doc: Record<string, unknown>, key: string): unknown {
  if (!key.includes('.')) return doc[key];
  return key.split('.').reduce<unknown>((v, k) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined), doc);
}

export function matches(doc: Record<string, unknown>, filter: Filter): boolean {
  return Object.entries(filter).every(([key, want]) => {
    const have = getPath(doc, key);
    if (want !== null && typeof want === 'object' && !Array.isArray(want) && Object.keys(want).some((k) => k.startsWith('$'))) {
      const c = want as Cond;
      if ('$eq' in c && have !== c.$eq) return false;
      if ('$ne' in c && have === c.$ne) return false;
      if ('$gt' in c && !(have != null && cmp(have, c.$gt) > 0)) return false;
      if ('$gte' in c && !(have != null && cmp(have, c.$gte) >= 0)) return false;
      if ('$lt' in c && !(have != null && cmp(have, c.$lt) < 0)) return false;
      if ('$lte' in c && !(have != null && cmp(have, c.$lte) <= 0)) return false;
      if (c.$in && !c.$in.includes(have)) return false;
      if (c.$nin && c.$nin.includes(have)) return false;
      if (c.$exists !== undefined && (have !== undefined && have !== null) !== c.$exists) return false;
      return true;
    }
    if (want === null) return have === null || have === undefined;
    return have === want;
  });
}

export function sortDocs<T>(docs: T[], sort?: Sort): T[] {
  if (!sort) return docs;
  const keys = Object.entries(sort);
  return [...docs].sort((a, b) => {
    for (const [k, dir] of keys) {
      const c = cmp((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]);
      if (c !== 0) return c * dir;
    }
    return 0;
  });
}

/** Equality parts of a filter (used to build upserted documents). */
export function equalities(filter: Filter): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(filter).filter(([, v]) => v === null || typeof v !== 'object' || Array.isArray(v) || !Object.keys(v as object).some((k) => k.startsWith('$'))),
  );
}
