import type { TFunction } from 'i18next';

import { shortDate } from '@/lib/format';
import type { Reminder } from '@/lib/reminders';

/** Icon + one-line title + short body for a reminder, in the UI language. */
export function reminderText(t: TFunction, r: Reminder): { icon: string; title: string; body: string } {
  switch (r.kind) {
    case 'dose_missed':
      return { icon: '💊', title: t('reminders.doseMissed', { name: r.name }), body: t('reminders.doseMissedBody', { time: r.time }) };
    case 'dose_due':
      return { icon: '⏰', title: t('reminders.doseDue', { name: r.name }), body: t('reminders.doseDueBody', { time: r.time }) };
    case 'water_behind':
      return { icon: '💧', title: t('reminders.waterBehind'), body: t('reminders.waterBehindBody', { litres: (r.ml / 1000).toFixed(1), goal: (r.goal / 1000).toFixed(1) }) };
    case 'water_goal':
      return { icon: '🌿', title: t('reminders.waterGoal', { litres: (r.ml / 1000).toFixed(1) }), body: t('reminders.waterGoalBody') };
    case 'period_late':
      return { icon: '🌸', title: t('reminders.periodLate', { count: r.days }), body: t('reminders.periodLateBody') };
    case 'period_soon':
      return {
        icon: '🌸',
        title: r.inDays === 0 ? t('reminders.periodToday') : t('reminders.periodSoon', { count: r.inDays }),
        body: t('cycle.window', { earliest: shortDate(r.earliest), latest: shortDate(r.latest) }),
      };
  }
}
