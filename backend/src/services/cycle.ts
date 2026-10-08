// Cycle state for one user, computed from her logged periods (never stored, never from the LLM).
import { cycleLengths, cycleStatus, predictNextPeriod, type CycleStatus, type Prediction } from '../core/cycle.ts';
import type { UserScope } from '../store/index.ts';
import type { PeriodDoc } from '../store/types.ts';

export interface CycleState {
  periods: PeriodDoc[];
  prediction: Prediction | null;
  status: CycleStatus;
  lengths: number[];
}

export async function loadCycle(u: UserScope, typicalLength: number | null, today: string): Promise<CycleState> {
  const periods = await u.periods.find({}, { sort: { start_date: 1 } });
  const starts = periods.map((p) => p.start_date);
  const prediction = predictNextPeriod(starts, typicalLength);
  return { periods, prediction, status: cycleStatus(today, periods, prediction), lengths: cycleLengths(starts) };
}

/**
 * Logs a period start (closing an older open period first) or an end. Returns the affected period.
 * Code owns these dates: chat only proposes them through confirm chips.
 */
export async function logPeriod(
  u: UserScope,
  kind: 'period_start' | 'period_end',
  date: string,
  extra: { flow?: PeriodDoc['flow']; pain?: number | null; source_message_id?: string | null } = {},
): Promise<PeriodDoc | null> {
  if (kind === 'period_start') {
    const open = await u.periods.findOne({ end_date: null });
    if (open && open.start_date < date) await u.periods.updateOne({ id: open.id }, { end_date: open.start_date });
    return u.periods.updateOne(
      { start_date: date },
      { flow: extra.flow ?? null, pain: extra.pain ?? null },
      { upsert: true, setOnInsert: { end_date: null, notes: null, auto_closed: false, source_message_id: extra.source_message_id ?? null } },
    );
  }
  const target = await u.periods.findOne({ start_date: { $lte: date } }, { sort: { start_date: -1 } });
  if (!target) return null;
  return u.periods.updateOne({ id: target.id }, { end_date: date, auto_closed: false });
}
