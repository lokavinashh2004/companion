// Long-term memory: profile facts (deduped by text and by embedding similarity > 0.9, capped at 60) and
// similarity search over daily summaries. Vectors are compared in code (a user has at most a few hundred
// summaries), so this works on any MongoDB tier without a vector index.
import { scrubPII } from '../core/safety.ts';
import type { UserScope } from '../store/index.ts';
import type { FactDoc } from '../store/types.ts';
import type { Services } from './context.ts';

export const MAX_ACTIVE_FACTS = 60;
export const DUPLICATE_SIMILARITY = 0.9;

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length && i < b.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

export function normalizeFact(f: string): string {
  return f.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
}

export function guessCategory(fact: string): FactDoc['category'] {
  const f = fact.toLowerCase();
  if (/\b(likes?|loves?|prefers?|hates?|dislikes?|favou?rite|enjoys?)\b/.test(f)) return 'preference';
  if (/\b(mother|mom|amma|father|dad|appa|sister|brother|friend|husband|partner|boyfriend|cousin|aunt|uncle|grand\w*|colleague|boss|roommate)\b/.test(f)) return 'person';
  if (/\b(exam|interview|trip|wedding|birthday|appointment|test|visit|function|meeting|deadline|travel|on (monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/.test(f)) return 'event';
  if (/\b(doctor|diagnos\w*|thyroid|diabet\w*|allerg\w*|pain|medic\w*|insulin|pcos|pcod|sleep)\b/.test(f)) return 'health';
  return 'other';
}

export async function addFacts(s: Services, u: UserScope, facts: string[], sourceMessageId: string | null): Promise<number> {
  if (facts.length === 0) return 0;
  const active = await u.facts.find({ active: true }, { sort: { updated_at: 1 } });
  const seen = new Set(active.map((f) => normalizeFact(f.fact)));
  let added = 0;

  for (const raw of facts.slice(0, 5)) {
    const fact = scrubPII(raw).trim();
    const norm = normalizeFact(fact);
    if (norm.length < 3 || seen.has(norm)) continue;

    const embedding = await s.embed(fact).catch(() => null);
    if (embedding) {
      const twin = active.find((f) => f.embedding && cosine(f.embedding, embedding) > DUPLICATE_SIMILARITY);
      if (twin) {
        // Same fact, newer wording: refresh instead of duplicating.
        await u.facts.updateOne({ id: twin.id }, { fact, embedding, source_message_id: sourceMessageId, updated_at: s.now().toISOString() });
        seen.add(norm);
        continue;
      }
    }
    if (active.length >= MAX_ACTIVE_FACTS) {
      const oldest = active.shift();
      if (oldest) await u.facts.updateOne({ id: oldest.id }, { active: false, updated_at: s.now().toISOString() });
    }
    const inserted = await u.facts.insertOne({
      fact,
      category: guessCategory(fact),
      source_message_id: sourceMessageId,
      active: true,
      embedding,
      updated_at: s.now().toISOString(),
    });
    active.push(inserted);
    seen.add(norm);
    added++;
  }
  return added;
}

/** Top related daily summaries for a query text (cosine on gte-small vectors), above a relevance floor. */
export async function relatedSummaries(
  s: Services,
  u: UserScope,
  text: string,
  exclude: Set<string>,
  limit = 3,
): Promise<{ day: string; summary: string }[]> {
  const q = await s.embed(scrubPII(text)).catch(() => null);
  if (!q) return [];
  const rows = await u.daily_summaries.find({ embedding: { $exists: true } }, { sort: { day: -1 }, limit: 400 });
  return rows
    .filter((r) => r.embedding && !exclude.has(r.day))
    .map((r) => ({ day: r.day, summary: r.summary, sim: cosine(r.embedding!, q) }))
    .filter((r) => r.sim > 0.75)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, limit)
    .map(({ day, summary }) => ({ day, summary }));
}
