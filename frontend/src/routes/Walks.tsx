// Walking: start/stop a walk (with today's steps towards the goal and the streak), daily steps for 7 or 30 days,
// totals for the period, and recent walks (each can be removed). Opened from the Walk tile on Today.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BarChart } from '@/components/Charts';
import { ConfirmSheet } from '@/components/me/common';
import m from '@/components/me/me.module.css';
import { WalkCard } from '@/components/today/WalkCard';
import s from '@/components/walks/walks.module.css';
import { Button, Card, ErrorState, Loading, Muted, Page, Segmented } from '@/components/ui';
import type { Walk } from '@/lib/api';
import { shortDate } from '@/lib/format';
import { useDeleteWalk, useMe, useWalks } from '@/lib/queries';
import { BackToToday } from './TodaySection';
import { clock, DEFAULT_WEIGHT_KG, walkKcal } from '@/lib/walk';

type Range = '7' | '30';

export function Walks() {
  const { t, i18n } = useTranslation();
  const [range, setRange] = useState<Range>('7');
  const q = useWalks(Number(range));
  const me = useMe();
  const del = useDeleteWalk();
  const [removing, setRemoving] = useState<Walk | null>(null);
  const d = q.data;
  const showKcal = me.data?.profile.calorie_display === 'show';

  const avg = d ? Math.round(d.totals.steps / d.days.length) : 0;
  const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(i18n.language, { hour: 'numeric', minute: '2-digit' });

  return (
    <Page title={t('walks.title')} subtitle={t('walks.subtitle')} eyebrow={<BackToToday />} wide>
      {q.isLoading ? <Loading /> : null}
      {q.isError ? <ErrorState onRetry={() => void q.refetch()} /> : null}
      {d ? (
        <div className={m.insightGrid}>
          <WalkCard showKcal={showKcal} />

          <Card title={t('walks.period')} icon="📊" tint="violet">
            <Segmented<Range>
              label={t('walks.range')}
              value={range}
              onChange={setRange}
              options={[
                { value: '7', label: t('walks.last7') },
                { value: '30', label: t('walks.last30') },
              ]}
            />
            <dl className={s.stats}>
              <div>
                <dt>{t('walks.totalSteps')}</dt>
                <dd>{d.totals.steps.toLocaleString()}</dd>
              </div>
              <div>
                <dt>{t('walks.dailyAverage')}</dt>
                <dd>{avg.toLocaleString()}</dd>
              </div>
              <div>
                <dt>{t('walks.goalDays')}</dt>
                <dd>{t('walks.daysOf', { n: d.totals.goal_days, total: d.days.length })}</dd>
              </div>
              <div>
                <dt>{t('walks.activeTime')}</dt>
                <dd>{clock(d.totals.duration_s * 1000)}</dd>
              </div>
              <div>
                <dt>{t('walks.walksCount')}</dt>
                <dd>{d.totals.sessions}</dd>
              </div>
              {d.best ? (
                <div>
                  <dt>{t('walks.bestDay')}</dt>
                  <dd>{d.best.steps.toLocaleString()}</dd>
                </div>
              ) : null}
              {showKcal ? (
                <div>
                  <dt>{t('walk.calories')}</dt>
                  <dd>{t('walk.kcal', { value: Math.round(walkKcal(d.totals.steps, d.weight_kg ?? DEFAULT_WEIGHT_KG)) })}</dd>
                </div>
              ) : null}
            </dl>
            {d.best ? <Muted small>{t('walks.bestOn', { date: shortDate(d.best.day) })}</Muted> : null}
          </Card>

          <div className={m.span2}>
            <Card title={t('walks.dailySteps')}>
              {d.totals.sessions > 0 ? (
                <>
                  <BarChart
                    title={t('walks.dailySteps')}
                    goal={d.goal}
                    color="var(--primary)"
                    data={d.days.map((x) => ({ label: shortDate(x.day), value: x.steps }))}
                  />
                  <Muted small>{t('walks.goalLine', { goal: d.goal.toLocaleString() })}</Muted>
                </>
              ) : (
                <Muted>{t('walks.empty')}</Muted>
              )}
            </Card>
          </div>

          <div className={m.span2}>
            <Card title={t('walks.recent')}>
              {d.recent.length ? (
                <ul className={s.recent}>
                  {d.recent.map((w) => (
                    <li key={w.id} className={s.recentRow}>
                      <span className={s.recentMain}>
                        <span className={s.recentSteps}>{t('walks.stepsCount', { n: w.steps.toLocaleString() })}</span>
                        <Muted small>{t('walks.walkMeta', { date: shortDate(w.day), time: timeOf(w.started_at), duration: clock(w.duration_s * 1000) })}</Muted>
                      </span>
                      <Button kind="ghost" small aria-label={t('walks.removeLabel', { date: shortDate(w.day), time: timeOf(w.started_at) })} onClick={() => setRemoving(w)}>
                        {t('common.remove')}
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <Muted>{t('walks.noWalks')}</Muted>
              )}
            </Card>
          </div>
        </div>
      ) : null}
      <ConfirmSheet
        open={!!removing}
        title={t('walks.removeTitle')}
        body={t('walks.removeBody')}
        confirmLabel={t('common.remove')}
        busy={del.isPending}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) del.mutate(removing.id, { onSuccess: () => setRemoving(null) });
        }}
      />
      <Muted small>{t('common.disclaimer')}</Muted>
    </Page>
  );
}
