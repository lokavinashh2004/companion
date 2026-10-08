// Small month calendar for picking a past date (days after `max` are disabled).
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cx, IconButton } from '@/components/ui';
import { longDate, monthTitle, weekdayInitials } from '@/lib/format';
import s from './chat.module.css';

function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

function daysIn(month: string): number {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function MonthPicker({ value, onChange, max, label }: { value: string | null; onChange: (d: string) => void; max: string; label: string }) {
  const { t } = useTranslation();
  const [month, setMonth] = useState(() => (value ?? max).slice(0, 7));
  const firstWeekday = new Date(`${month}-01T00:00:00Z`).getUTCDay();
  const count = daysIn(month);
  const cells: (string | null)[] = [...Array.from({ length: firstWeekday }, () => null), ...Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  const atMax = month >= max.slice(0, 7);

  return (
    <div className={s.calendar} role="group" aria-label={label}>
      <div className={s.calendarHeader}>
        <IconButton label={t('cycle.monthPrev')} onClick={() => setMonth((m) => shiftMonth(m, -1))}>
          ‹
        </IconButton>
        <span className={s.calendarTitle} aria-live="polite">
          {monthTitle(month)}
        </span>
        <IconButton label={t('cycle.monthNext')} disabled={atMax} onClick={() => setMonth((m) => shiftMonth(m, 1))}>
          ›
        </IconButton>
      </div>
      <div className={s.calendarGrid}>
        {weekdayInitials().map((w, i) => (
          <span key={`w${i}`} className={s.weekday} aria-hidden="true">
            {w}
          </span>
        ))}
        {cells.map((d, i) =>
          d ? (
            <button
              key={d}
              type="button"
              className={cx(s.day, d === value && s.daySelected)}
              disabled={d > max}
              aria-pressed={d === value}
              aria-label={t('a11y.calendarDay', { date: longDate(d) })}
              onClick={() => onChange(d)}
            >
              {Number(d.slice(8))}
            </button>
          ) : (
            <span key={`b${i}`} />
          ),
        )}
      </div>
    </div>
  );
}
