// Steps towards the daily goal: "3,200 / 5,000 steps" with a bar, and what's left (or a well done).
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cx, Muted } from '@/components/ui';
import s from './walks.module.css';

export function StepProgress({ steps, goal, aside }: { steps: number; goal: number; aside?: ReactNode }) {
  const { t } = useTranslation();
  const done = steps >= goal;
  const pct = goal > 0 ? Math.min(100, Math.round((steps / goal) * 100)) : 0;
  return (
    <div className={s.progress}>
      <div className={s.progressHead}>
        <p className={s.progressSteps}>
          <strong>{steps.toLocaleString()}</strong> {t('walks.ofGoal', { goal: goal.toLocaleString() })}
        </p>
        {aside}
      </div>
      <div className={s.track} role="progressbar" aria-label={t('walks.todayProgress')} aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(steps, goal)}>
        <div className={cx(s.fill, done && s.fillDone)} style={{ width: `${pct}%` }} />
      </div>
      <Muted small>{done ? t('walks.goalReached') : t('walks.toGo', { count: goal - steps, n: (goal - steps).toLocaleString() })}</Muted>
    </div>
  );
}
