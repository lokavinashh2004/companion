// Daily goals calendar (/today/goals): each day of the month is a ring filled to that day's progress, solid when
// all three goals were met. Shows this month's complete days and the streak; tap a day to see its breakdown.
import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

import s from '@/components/today/goals.module.css';
import tiles from '@/components/today/tiles.module.css';
import { Card, cx, ErrorState, IconButton, Loading, Muted, Page } from '@/components/ui';
import type { ProgressDay, ProgressMonth } from '@/lib/api';
import { addDays, longDate, monthTitle, todayIn, weekdayDate, weekdayInitials } from '@/lib/format';
import { useProgress } from '@/lib/queries';
import { BackToToday } from './TodaySection';

function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

export function Goals() {
  const { t } = useTranslation();
  const [month, setMonth] = useState(() => todayIn().slice(0, 7));
  const [picked, setPicked] = useState<string | null>(null);
  const q = useProgress(month);
  const d = q.data;

  return (
    <Page title={t('goals.calendarTitle')} eyebrow={<BackToToday />} subtitle={t('goals.calendarSubtitle')}>
      {q.isError ? <ErrorState onRetry={() => void q.refetch()} /> : null}
      <div className={`${tiles.stack} ${tiles.enter}`}>
        <Card>
          <div className={s.calHeader}>
            <IconButton label={t('cycle.monthPrev')} onClick={() => setMonth(shiftMonth(month, -1))}>
              ‹
            </IconButton>
            <h2 className={s.calTitle} aria-live="polite">
              {monthTitle(month)}
            </h2>
            <IconButton label={t('cycle.monthNext')} onClick={() => setMonth(shiftMonth(month, 1))} disabled={!d || month >= d.today.slice(0, 7)}>
              ›
            </IconButton>
          </div>
          {q.isLoading ? <Loading /> : null}
          {d ? <MonthGrid data={d} month={month} picked={picked ?? d.today} onPick={setPicked} /> : null}
          <div className={s.legend} role="group" aria-label={t('goals.legend')}>
            <span className={s.legendItem}>
              <span className={cx(s.swatch, s.swatchDone)} aria-hidden="true" />
              {t('goals.legendDone')}
            </span>
            <span className={s.legendItem}>
              <span className={cx(s.swatch, s.swatchPart)} aria-hidden="true" />
              {t('goals.legendPart')}
            </span>
          </div>
        </Card>

        {d ? (
          <>
            <Card>
              <dl className={s.stats}>
                <div>
                  <dt>{t('goals.completeDays')}</dt>
                  <dd>{t('goals.daysOf', { n: d.complete_days, total: d.days.length })}</dd>
                </div>
                <div>
                  <dt>{t('goals.streak')}</dt>
                  <dd>
                    {d.streak > 0 ? '🔥 ' : ''}
                    {t('goals.streakDays', { count: d.streak })}
                  </dd>
                </div>
              </dl>
              <Muted small>{t('goals.rules', { meals: d.goals.meals, glasses: d.goals.water_ml / 250, steps: d.goals.steps.toLocaleString() })}</Muted>
            </Card>
            <DayDetail data={d} day={d.days.find((x) => x.day === (picked ?? d.today)) ?? null} />
          </>
        ) : null}
      </div>
    </Page>
  );
}

function MonthGrid({ data, month, picked, onPick }: { data: ProgressMonth; month: string; picked: string; onPick: (day: string) => void }) {
  const { t } = useTranslation();
  const byDay = new Map(data.days.map((x) => [x.day, x]));
  const first = `${month}-01`;
  const lead = new Date(`${first}T00:00:00Z`).getUTCDay();
  const days: string[] = [];
  for (let x = first; x.startsWith(month); x = addDays(x, 1)) days.push(x);

  return (
    <div className={s.grid} role="group" aria-label={`${t('goals.calendarTitle')}, ${monthTitle(month)}`}>
      {weekdayInitials().map((w, i) => (
        <span key={i} className={s.weekday} aria-hidden="true">
          {w}
        </span>
      ))}
      {Array.from({ length: lead }, (_, i) => (
        <span key={`b${i}`} aria-hidden="true" />
      ))}
      {days.map((day) => {
        const p = byDay.get(day);
        const future = day > data.today;
        const label = future
          ? longDate(day)
          : p?.complete
            ? t('goals.dayComplete', { date: longDate(day) })
            : t('goals.dayPercent', { date: longDate(day), percent: p?.percent ?? 0 });
        return (
          <button
            key={day}
            type="button"
            className={cx(s.day, p?.complete && s.complete, day === data.today && s.today, day === picked && s.selected)}
            style={{ '--p': `${p?.percent ?? 0}%` } as CSSProperties}
            aria-label={label}
            aria-pressed={day === picked}
            aria-current={day === data.today ? 'date' : undefined}
            disabled={future}
            onClick={() => onPick(day)}
          >
            <span>{Number(day.slice(8))}</span>
          </button>
        );
      })}
    </div>
  );
}

function DayDetail({ data, day }: { data: ProgressMonth; day: ProgressDay | null }) {
  const { t } = useTranslation();
  if (!day) return null;
  const rows = [
    { key: 'food', icon: '🍽️', value: t('goals.mealsOf', { done: Math.min(day.meals, data.goals.meals), goal: data.goals.meals }), done: day.meals >= data.goals.meals },
    { key: 'water', icon: '💧', value: t('goals.glassesOf', { done: Math.floor(day.water_ml / 250), goal: data.goals.water_ml / 250 }), done: day.water_ml >= data.goals.water_ml },
    { key: 'steps', icon: '🚶‍♀️', value: t('goals.stepsOf', { done: day.steps.toLocaleString(), goal: data.goals.steps.toLocaleString() }), done: day.steps >= data.goals.steps },
  ];
  return (
    <Card title={weekdayDate(day.day)} aside={<strong>{day.percent}%</strong>}>
      <ul className={s.detailRows}>
        {rows.map((r) => (
          <li key={r.key} className={s.detailRow}>
            <span>
              <span aria-hidden="true">{r.icon}</span> {t(`goals.name.${r.key}`)}
            </span>
            <span className={s.detailValue}>
              {r.value} {r.done ? '✓' : ''}
            </span>
          </li>
        ))}
      </ul>
      {day.complete ? <Muted small>{t('goals.allDonePast')}</Muted> : null}
    </Card>
  );
}
