import type { Period } from '@/lib/api';
import { addDays } from '@/lib/format';

export type Flow = 'spotting' | 'light' | 'medium' | 'heavy';
export const FLOWS: Flow[] = ['spotting', 'light', 'medium', 'heavy'];

/** Every day covered by a logged period (open periods run until today). */
export function periodDays(periods: Period[], today: string): Set<string> {
  const out = new Set<string>();
  for (const p of periods) {
    const end = p.end_date ?? today;
    for (let d = p.start_date; d <= end; d = addDays(d, 1)) out.add(d);
  }
  return out;
}
