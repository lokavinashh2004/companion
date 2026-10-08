// Insights: this week's numbers, gentle patterns, and simple trend charts. Two columns on desktop.
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { BarChart, LineChart, type Point } from '@/components/Charts';
import s from '@/components/me/me.module.css';
import { PatternCard } from '@/components/me/PatternCard';
import { Button, Card, ErrorState, Loading, Muted, Page } from '@/components/ui';
import type { Insights as InsightsData } from '@/lib/api';
import { shortDate } from '@/lib/format';
import { useDismissInsight, useInsights } from '@/lib/queries';

type WeekKey = keyof InsightsData['week'];
const WEEK_KEYS: WeekKey[] = ['days_with_food_logged', 'avg_balance_score', 'avg_mood', 'avg_sleep_hours', 'exercise_minutes_total', 'medication_doses_taken'];

const toPoints = (xs: { day: string; value: number }[]): Point[] => xs.map((x) => ({ label: shortDate(x.day), value: x.value }));

export function Insights() {
  const { t } = useTranslation();
  const q = useInsights();
  const dismiss = useDismissInsight();
  const d = q.data;

  const weekly = (d?.insights ?? []).filter((i) => i.type === 'weekly' && !i.dismissed);
  const patterns = (d?.insights ?? []).filter((i) => i.type === 'pattern');

  const chart = (title: string, enough: boolean, el: ReactNode) => (
    <Card title={title}>{enough ? el : <Muted>{t('insights.notEnough')}</Muted>}</Card>
  );

  return (
    <Page title={t('insights.title')} wide>
      {q.isLoading ? <Loading /> : null}
      {q.isError ? <ErrorState onRetry={() => void q.refetch()} /> : null}
      {d ? (
        <div className={s.insightGrid}>
          <Card title={t('insights.weekly')}>
            <div>
              {WEEK_KEYS.filter((k) => d.week[k] !== null).map((k) => (
                <div key={k} className={s.stat}>
                  <span>{t(`insights.stats.${k}`)}</span>
                  <span className={s.statValue}>{d.week[k]}</span>
                </div>
              ))}
            </div>
          </Card>

          {weekly.map((w) => {
            const message = typeof w.payload.message === 'string' ? w.payload.message : null;
            if (!message) return null;
            return (
              <Card key={w.id} tone="alt" title={t('insightsPage.recap')}>
                <p className={s.factText}>{message}</p>
                <div>
                  <Button kind="ghost" small busy={dismiss.isPending && dismiss.variables === w.id} onClick={() => dismiss.mutate(w.id)}>
                    {t('insightCards.dismiss')}
                  </Button>
                </div>
              </Card>
            );
          })}
          {weekly.length === 0 ? (
            <Card tone="alt">
              <Muted>{t('insights.weeklyEmpty')}</Muted>
            </Card>
          ) : null}

          {patterns.length ? (
            <div className={s.span2}>
              <PatternCard insights={patterns} />
            </div>
          ) : null}

          {chart(
            t('insights.cycleLengths'),
            d.cycle_lengths.length >= 2,
            <>
              <BarChart title={t('insights.cycleLengths')} data={d.cycle_lengths.map((v, i) => ({ label: t('insightsPage.cycleLabel', { n: i + 1 }), value: v }))} />
              <Muted small>{t('cycle.rangeNote')}</Muted>
            </>,
          )}
          {chart(t('insights.balanceTrend'), d.balance_trend.length >= 2, <LineChart title={t('insights.balanceTrend')} data={toPoints(d.balance_trend.slice(-14))} min={0} max={10} />)}
          {chart(t('insights.moodTrend'), d.mood_trend.length >= 2, <LineChart title={t('insights.moodTrend')} data={toPoints(d.mood_trend)} min={1} max={5} />)}
          {d.weight_trend
            ? chart(t('insights.weightTrend'), d.weight_trend.length >= 2, <LineChart title={t('insights.weightTrend')} data={toPoints(d.weight_trend)} />)
            : null}

          <Card title={t('insights.labs')}>
            <Muted>{t('insightsPage.labsHint')}</Muted>
            <Link to="/me/labs">{t('insightsPage.openLabs')}</Link>
          </Card>
        </div>
      ) : null}
      <Muted small>{t('common.disclaimer')}</Muted>
    </Page>
  );
}
