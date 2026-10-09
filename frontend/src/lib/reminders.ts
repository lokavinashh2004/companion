// Today's reminders, worked out on the device from /today (the same things push notifications nudge about):
// missed or upcoming medicine doses, a water nudge when she's behind pace, and the period window.
import type { Today } from './api';
import { diffDays, hhmm } from './format';

export const WATER_GOAL_ML = 2000;

export type Reminder =
  | { kind: 'dose_missed'; key: string; medId: string; name: string; time: string }
  | { kind: 'dose_due'; key: string; medId: string; name: string; time: string }
  | { kind: 'water_behind'; key: string; ml: number; goal: number }
  | { kind: 'water_goal'; key: string; ml: number }
  | { kind: 'period_late'; key: string; days: number }
  | { kind: 'period_soon'; key: string; earliest: string; latest: string; inDays: number };

const ORDER: Reminder['kind'][] = ['dose_missed', 'period_late', 'water_behind', 'period_soon', 'dose_due', 'water_goal'];

/** Minutes since midnight for 'HH:MM', or for a Date in local time. */
const minutes = (v: string | Date) => (typeof v === 'string' ? Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5)) : v.getHours() * 60 + v.getMinutes());

export function todayReminders(today: Today, now: Date = new Date()): Reminder[] {
  const out: Reminder[] = [];
  const nowMin = minutes(now);

  for (const { medication: m, doses } of today.meds) {
    const name = [m.name, m.dose].filter(Boolean).join(' ');
    for (const d of doses) {
      if (d.taken) continue;
      const time = hhmm(d.time);
      const base = { key: `dose:${m.id}:${time}`, medId: m.id, name, time };
      out.push(minutes(time) <= nowMin ? { kind: 'dose_missed', ...base } : { kind: 'dose_due', ...base });
    }
  }

  // Water: an even pace from 8:00 to 20:00; nudge only when a glass or more behind, and not before 10:00.
  const ml = today.lifestyle?.water_ml ?? 0;
  if (ml >= WATER_GOAL_ML) out.push({ kind: 'water_goal', key: 'water:goal', ml });
  else if (nowMin >= 10 * 60) {
    const pace = (WATER_GOAL_ML * Math.min(1, Math.max(0, (nowMin - 8 * 60) / (12 * 60)))) | 0;
    if (ml + 250 <= pace) out.push({ kind: 'water_behind', key: 'water:behind', ml, goal: WATER_GOAL_ML });
  }

  const { status, prediction } = today;
  if (status.kind === 'late' && status.days_late) out.push({ kind: 'period_late', key: 'period:late', days: status.days_late });
  else if (status.kind !== 'period' && prediction) {
    const inDays = diffDays(today.day, prediction.earliest);
    if (inDays >= 0 && inDays <= 3) out.push({ kind: 'period_soon', key: 'period:soon', earliest: prediction.earliest, latest: prediction.latest, inDays });
  }

  return out.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
}

/** The ones worth a badge on the bell (not upcoming doses or good news). */
export const needsAttention = (r: Reminder) => r.kind === 'dose_missed' || r.kind === 'water_behind' || r.kind === 'period_late' || r.kind === 'period_soon';
