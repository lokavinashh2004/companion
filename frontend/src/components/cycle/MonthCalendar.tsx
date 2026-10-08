// Accessible month grid: logged period days filled, predicted range shaded, today outlined, future days disabled.
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cx, IconButton } from '@/components/ui';
import type { Period, Prediction } from '@/lib/api';
import { addDays, longDate, monthTitle, weekdayInitials } from '@/lib/format';
import s from './cycle.module.css';
import { periodDays } from './periods';

function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

export function MonthCalendar({ today, periods, prediction, onPick }: { today: string; periods: Period[]; prediction: Prediction; onPick: (day: string) => void }) {
  const { t } = useTranslation();
  const [month, setMonth] = useState(today.slice(0, 7));
  const filled = useMemo(() => periodDays(periods, today), [periods, today]);

  const first = `${month}-01`;
  const lead = new Date(`${first}T00:00:00Z`).getUTCDay();
  const days: string[] = [];
  for (let d = first; d.startsWith(month); d = addDays(d, 1)) days.push(d);
  const initials = weekdayInitials(); // follows the UI language
  const title = monthTitle(month);
  // Allow paging forward far enough to see the predicted range.
  const lastMonth = prediction && prediction.latest > today ? prediction.latest.slice(0, 7) : today.slice(0, 7);
  const canNext = month < lastMonth;

  return (
    <div>
      <div className={s.calHeader}>
        <IconButton label={t('cycle.monthPrev')} onClick={() => setMonth(shiftMonth(month, -1))}>
          ‹
        </IconButton>
        <h2 className={s.calTitle} aria-live="polite">
          {title}
        </h2>
        <IconButton label={t('cycle.monthNext')} onClick={() => setMonth(shiftMonth(month, 1))} disabled={!canNext}>
          ›
        </IconButton>
      </div>
      <div className={s.grid} role="group" aria-label={`${t('cyclePage.calendar')}, ${title}`}>
        {initials.map((w, i) => (
          <span key={i} className={s.weekday} aria-hidden="true">
            {w}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`b${i}`} aria-hidden="true" />
        ))}
        {days.map((d) => {
          const isPeriod = filled.has(d);
          const isPredicted = !isPeriod && !!prediction && d >= prediction.earliest && d <= prediction.latest;
          const date = longDate(d);
          const label = isPeriod ? t('a11y.periodDay', { date }) : isPredicted ? t('a11y.predictedDay', { date }) : t('a11y.calendarDay', { date });
          return (
            <button
              key={d}
              type="button"
              className={cx(s.day, isPeriod && s.period, isPredicted && s.predicted, d === today && s.today)}
              aria-label={label}
              aria-current={d === today ? 'date' : undefined}
              disabled={d > today}
              onClick={() => onPick(d)}
            >
              {Number(d.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
