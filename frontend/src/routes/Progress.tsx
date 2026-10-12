// Overall progress (/me/progress): a discipline score from everything she logs. This week vs last week with an
// up / down / steady trend and a gentle message, today so far, each habit with its own trend, the last 30 days
// as a chart, and how the score works. Computed on the server from her logs, so it updates every day.
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { LineChart } from '@/components/Charts';
import { ScoreRing, TrendBadge } from '@/components/me/ProgressSummary';
import s from '@/components/me/progress.module.css';
import tiles from '@/components/today/tiles.module.css';
import { Card, ErrorState, Loading, Muted, Page } from '@/components/ui';
import type { Overview } from '@/lib/api';
import { shortDate } from '@/lib/format';
import { useOverview } from '@/lib/queries';

const ICON: Record<Overview['factors'][number]['key'], string> = { meals: '🍽️', water: '💧', steps: '🚶‍♀️', meds: '💊', checkin: '😊', sleep: '🌙' };

export function Progress() {
  const { t } = useTranslation();
  const q = useOverview();
  const o = q.data;
  const back = (
    <Link className={tiles.back} to="/me">
      ‹ {t('tabs.me')}
    </Link>
  );
  return (
    <Page title={t('progress.title')} eyebrow={back} subtitle={t('progress.subtitle')}>
      {q.isLoading ? <Loading /> : null}
      {q.isError ? <ErrorState onRetry={() => void q.refetch()} /> : null}
      {o ? (
        <div className={`${tiles.stack} ${tiles.enter}`}>
          <Card>
            <div className={s.hero}>
              <ScoreRing big value={o.week.score} label={t('progress.weekScore', { n: o.week.score })} />
              <div className={s.heroText}>
                <Muted small>{t('progress.thisWeek')}</Muted>
                <TrendBadge trend={o.week.trend} change={o.week.change} />
                <Muted small>{t('progress.vsLastWeek', { n: o.week.previous })}</Muted>
              </div>
            </div>
            <p className={s.message}>{t(`progress.message.${o.week.trend}`)}</p>
          </Card>

          <Card title={t('progress.today')} aside={<strong>{o.today_score}%</strong>}>
            <div className={s.todayTrack} role="progressbar" aria-label={t('progress.today')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={o.today_score}>
              <span style={{ width: `${o.today_score}%` }} />
            </div>
            <Muted small>{t('progress.todayNote')}</Muted>
          </Card>

          <Card title={t('progress.habits')}>
            <ul className={s.habits}>
              {o.factors.map((f) => (
                <li key={f.key} className={s.habit}>
                  <span className={s.habitIcon} aria-hidden="true">
                    {ICON[f.key]}
                  </span>
                  <span className={s.habitName}>{t(`progress.factor.${f.key}`)}</span>
                  <span className={s.habitValue}>
                    {f.score != null ? `${f.score}%` : '–'} <TrendBadge compact trend={f.trend} />
                  </span>
                  <span className={s.habitBar} aria-hidden="true">
                    <span style={{ width: `${f.score ?? 0}%` }} />
                  </span>
                  {f.previous != null ? <span className={s.habitWas}>{t('progress.was', { n: f.previous })}</span> : null}
                </li>
              ))}
            </ul>
          </Card>

          <Card title={t('progress.last30')}>
            <LineChart title={t('progress.last30')} data={o.days.map((d) => ({ label: shortDate(d.day), value: d.score }))} min={0} max={100} />
            <Muted small>{t('progress.activeDays', { n: o.active_days, total: o.days.length })}</Muted>
          </Card>

          <Card tone="alt" title={t('progress.howTitle')}>
            <Muted small>{t('progress.how')}</Muted>
          </Card>
        </div>
      ) : null}
    </Page>
  );
}
