// Walk session card: Start → live steps and time → Stop → summary with steps, duration, calories and a cheer.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Card, Muted, Notice } from '@/components/ui';
import type { Today } from '@/lib/api';
import { clock, DEFAULT_WEIGHT_KG, useWalk, walkCheerKey, walkKcal } from '@/lib/walk';
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

export function WalkCard({ today }: { today: Today }) {
  const { t } = useTranslation();
  const { status, startedAt, steps, summary, start, stop, reset } = useWalk();
  const walking = status === 'walking';
  const now = useNow(walking);
  const showKcal = today.calorie_display === 'show';

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
          <Button kind="secondary" onClick={stop}>
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
                <dd>{t('walk.kcal', { value: walkKcal(summary.steps) })}</dd>
              </div>
            ) : null}
          </dl>
          {showKcal ? <Muted small>{t('walk.kcalNote', { kg: DEFAULT_WEIGHT_KG })}</Muted> : null}
          <Button onClick={() => void start()}>▶ {t('walk.again')}</Button>
          <Button kind="ghost" small onClick={reset}>
            {t('common.close')}
          </Button>
        </>
      ) : (
        <>
          {status === 'denied' ? <Notice tone="warn">{t('walk.denied')}</Notice> : null}
          {status === 'unsupported' ? <Notice tone="warn">{t('walk.unsupported')}</Notice> : null}
          <Muted small>{t('walk.intro')}</Muted>
          <Button busy={status === 'starting'} onClick={() => void start()}>
            ▶ {t('walk.start')}
          </Button>
        </>
      )}
    </Card>
  );
}
