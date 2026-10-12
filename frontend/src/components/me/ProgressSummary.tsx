// Overall progress at the top of Me: this week's score as a ring, and whether it's up, down or steady against
// last week. Opens the full progress page.
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { cx } from '@/components/ui';
import type { Overview } from '@/lib/api';
import { useOverview } from '@/lib/queries';
import s from './progress.module.css';

type Trend = Overview['week']['trend'];
const ARROW: Record<Trend, string> = { up: '↑', down: '↓', steady: '→' };

/** Up / down / steady. `compact` shows only the arrow (the words stay for screen readers). */
export function TrendBadge({ trend, change, compact }: { trend: Trend; change?: number; compact?: boolean }) {
  const { t } = useTranslation();
  const text = change != null && trend !== 'steady' ? t(`progress.trendBy.${trend}`, { n: Math.abs(change) }) : t(`progress.trend.${trend}`);
  return (
    <span className={cx(s.trend, s[trend], compact && s.compact)}>
      <span aria-hidden="true">{ARROW[trend]}</span>
      {compact ? <span className="visually-hidden">{text}</span> : text}
    </span>
  );
}

export function ScoreRing({ value, big, label }: { value: number; big?: boolean; label: string }) {
  return (
    <span className={cx(s.ring, big && s.ringBig)} style={{ '--p': `${value}%` } as CSSProperties} role="img" aria-label={label}>
      <span className={s.ringValue} aria-hidden="true">
        {value}
      </span>
    </span>
  );
}

export function ProgressSummary() {
  const { t } = useTranslation();
  const q = useOverview();
  const o = q.data;
  if (!o) return null;
  return (
    <Link to="/me/progress" className={s.summary} aria-label={`${t('progress.title')}: ${t('progress.weekScore', { n: o.week.score })}, ${t(`progress.trend.${o.week.trend}`)}`}>
      <ScoreRing value={o.week.score} label={t('progress.weekScore', { n: o.week.score })} />
      <span className={s.summaryText}>
        <span className={s.summaryTitle}>{t('progress.title')}</span>
        <TrendBadge trend={o.week.trend} change={o.week.change} />
        <span className={s.trendNote}>{t('progress.vsLastWeek', { n: o.week.previous })}</span>
      </span>
      <span className={s.chevron} aria-hidden="true">
        ›
      </span>
    </Link>
  );
}
