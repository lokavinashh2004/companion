// Walk session card (top of the Walking page): Start → live steps and time → Stop → saved summary with steps,
// duration, calories and a cheer. Before a walk it shows today's steps towards the goal and the goal streak.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Card, Muted, Notice } from '@/components/ui';
import { StepProgress } from '@/components/walks/StepProgress';
import w from '@/components/walks/walks.module.css';
import { useSaveWalk, useWalks } from '@/lib/queries';
import { clock, DEFAULT_WEIGHT_KG, useWalk, walkCheerKey, walkKcal, type WalkSummary } from '@/lib/walk';
import s from './today.module.css';

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

export function WalkCard({ showKcal }: { showKcal: boolean }) {
  const { t } = useTranslation();
  const { status, startedAt, steps, summary, start, stop, reset } = useWalk();
  const walks = useWalks(7);
  const save = useSaveWalk();
  const walking = status === 'walking';
  const now = useNow(walking);
  const weightKg = walks.data?.weight_kg ?? DEFAULT_WEIGHT_KG;
  const todaySteps = walks.data?.days.find((d) => d.day === walks.data?.today)?.steps;

  const persist = (w: WalkSummary) =>
    save.mutate({ client_id: w.clientId, started_at: new Date(w.startedAt).toISOString(), duration_s: Math.round(w.durationMs / 1000), steps: w.steps });
  const onStop = () => {
    const w = stop();
    if (w) persist(w);
  };
  const onStart = () => {
    save.reset();
    void start();
  };
  const streak = walks.data?.streak ?? 0;

  return (
    <Card title={t('walk.title')} icon="🚶‍♀️" tint="peach">
      {walking ? (
        <>
          <div className={s.walkStats} aria-live="polite">
            <p className={s.glassCount}>
              <span className={s.big}>{steps.toLocaleString()}</span> {t('walk.stepsUnit')}
            </p>
            <p className={s.glassCount}>
              <span className={s.big}>{clock(now - (startedAt ?? now))}</span>
            </p>
          </div>
          <Muted small>{t('walk.keepOpen')}</Muted>
          <Button kind="secondary" onClick={onStop}>
            ⏹ {t('walk.stop')}
          </Button>
        </>
      ) : status === 'done' && summary ? (
        <>
          <Notice>{t(walkCheerKey(summary.steps))}</Notice>
          <dl className={s.walkSummary}>
            <div>
              <dt>{t('walk.totalSteps')}</dt>
              <dd>{summary.steps.toLocaleString()}</dd>
            </div>
            <div>
              <dt>{t('walk.duration')}</dt>
              <dd>{clock(summary.durationMs)}</dd>
            </div>
            {showKcal ? (
              <div>
                <dt>{t('walk.calories')}</dt>
                <dd>{t('walk.kcal', { value: walkKcal(summary.steps, weightKg) })}</dd>
              </div>
            ) : null}
          </dl>
          {showKcal ? <Muted small>{t('walk.kcalNote', { kg: weightKg })}</Muted> : null}
          {save.isPending ? <Muted small>{t('walk.saving')}</Muted> : null}
          {save.isSuccess ? <Muted small>{t('walk.saved')}</Muted> : null}
          {save.isError ? (
            <Notice tone="warn">
              {t('walk.saveFailed')}{' '}
              <Button kind="ghost" small onClick={() => persist(summary)}>
                {t('common.retry')}
              </Button>
            </Notice>
          ) : null}
          <Button onClick={onStart} disabled={save.isPending}>
            ▶ {t('walk.again')}
          </Button>
          <Button kind="ghost" small onClick={reset} disabled={save.isPending}>
            {t('common.close')}
          </Button>
        </>
      ) : (
        <>
          {status === 'denied' ? <Notice tone="warn">{t('walk.denied')}</Notice> : null}
          {status === 'unsupported' ? <Notice tone="warn">{t('walk.unsupported')}</Notice> : null}
          {walks.data && todaySteps != null ? (
            <StepProgress steps={todaySteps} goal={walks.data.goal} aside={streak > 0 ? <span className={w.streak}>🔥 {t('walks.streak', { count: streak })}</span> : null} />
          ) : (
            <Muted small>{t('walk.intro')}</Muted>
          )}
          <Button busy={status === 'starting'} onClick={onStart}>
            ▶ {t('walk.start')}
          </Button>
        </>
      )}
    </Card>
  );
}
