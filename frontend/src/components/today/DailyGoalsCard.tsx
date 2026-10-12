// Today's goals at the top of the Today hub: one progress bar for the day (3 meals, 8 glasses of water, the step
// goal) and a pill per goal that opens its screen. Worked out on the server; it starts again each day.
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { cx } from '@/components/ui';
import type { DayProgress } from '@/lib/api';
import s from './goals.module.css';

const GLASS_ML = 250;

export function DailyGoalsCard({ progress }: { progress: DayProgress }) {
  const { t } = useTranslation();
  const { percent, complete, food, water, steps } = progress;
  const goals = [
    { key: 'food', to: '/today/food', icon: '🍽️', value: `${Math.min(food.done, food.goal)}/${food.goal}`, label: t('goals.meals'), part: food.done / food.goal },
    {
      key: 'water',
      to: '/today/water',
      icon: '💧',
      value: `${Math.floor(water.done / GLASS_ML)}/${water.goal / GLASS_ML}`,
      label: t('goals.glasses'),
      part: water.done / water.goal,
    },
    {
      key: 'steps',
      to: '/today/walk',
      icon: '🚶‍♀️',
      value: steps.done >= 1000 ? `${(steps.done / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(steps.done),
      label: t('goals.ofSteps', { goal: `${steps.goal / 1000}k` }),
      part: steps.done / steps.goal,
    },
  ];
  const met = goals.filter((g) => g.part >= 1).length;

  return (
    <section className={s.card} aria-labelledby="daily-goals-title">
      <div className={s.head}>
        <h2 id="daily-goals-title" className={s.title}>
          {t('goals.title')}
        </h2>
        <span className={s.percent}>{percent}%</span>
      </div>
      <div className={s.track} role="progressbar" aria-labelledby="daily-goals-title" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <span className={cx(s.fill, complete && s.fillDone)} style={{ width: `${percent}%` }} />
      </div>
      <p className={s.status}>{complete ? <strong>{t('goals.allDone')}</strong> : t('goals.met', { met, total: goals.length })}</p>
      <ul className={s.goals}>
        {goals.map((g) => {
          const done = g.part >= 1;
          return (
            <li key={g.key}>
              <Link to={g.to} className={cx(s.goal, done && s.goalDone)} aria-label={`${t(`goals.name.${g.key}`)}: ${g.value} ${g.label}${done ? `, ${t('goals.done')}` : ''}`}>
                {done ? (
                  <span className={s.tick} aria-hidden="true">
                    ✓
                  </span>
                ) : null}
                <span className={s.goalIcon} aria-hidden="true">
                  {g.icon}
                </span>
                <span className={s.goalValue}>{g.value}</span>
                <span className={s.goalLabel}>{g.label}</span>
                <span className={s.goalBar} aria-hidden="true">
                  <span style={{ width: `${Math.round(Math.min(1, g.part) * 100)}%` }} />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <Link className={s.link} to="/today/goals">
        📅 {t('goals.calendarLink')} ›
      </Link>
    </section>
  );
}
