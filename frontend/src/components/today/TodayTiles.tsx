// Today hub tiles: one tile per area (food, water, medicines, mood, walk, cycle, insights, weight when due), each
// with a one-line summary of today and an optional progress bar. Tapping a tile opens that area's own screen.
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { cx } from '@/components/ui';
import ui from '@/components/ui.module.css';
import type { Today } from '@/lib/api';
import { todayReminders, WATER_GOAL_ML } from '@/lib/reminders';
import { useWalk } from '@/lib/walk';
import { MOOD_EMOJI } from './constants';
import s from './tiles.module.css';

type Tint = 'violet' | 'blue' | 'pink' | 'peach' | 'green' | 'amber';

interface TileProps {
  to: string;
  icon: string;
  tint: Tint;
  title: string;
  summary: string;
  /** 0..1 */
  progress?: number;
  badge?: { label: string; live?: boolean };
}

function Tile({ to, icon, tint, title, summary, progress, badge }: TileProps) {
  return (
    <li>
      <Link to={to} className={s.tile} aria-label={`${title}: ${summary}`}>
        <span className={s.top}>
          <span className={cx(ui.cardIcon, ui[`tint_${tint}`])} aria-hidden="true">
            {icon}
          </span>
          {badge ? null : (
            <span className={s.chevron} aria-hidden="true">
              ›
            </span>
          )}
        </span>
        {badge ? <span className={cx(s.badge, badge.live && s.live)}>{badge.label}</span> : null}
        <h2 className={s.title}>{title}</h2>
        <p className={s.summary}>{summary}</p>
        {progress != null ? (
          <span className={s.bar} aria-hidden="true">
            <span className={cx(s.barFill, progress >= 1 && s.barDone)} style={{ width: `${Math.round(Math.min(1, progress) * 100)}%` }} />
          </span>
        ) : null}
      </Link>
    </li>
  );
}

export function TodayTiles({ today }: { today: Today }) {
  const { t } = useTranslation();
  const walk = useWalk();

  // Food
  const meals = new Set(today.foods.map((f) => f.meal)).size;
  const food = today.foods.length
    ? [today.score ? t('todayHub.balance', { score: today.score.score }) : null, t('todayHub.meals', { count: meals })].filter(Boolean).join(' · ')
    : t('todayHub.foodEmpty');

  // Water
  const ml = today.lifestyle?.water_ml ?? 0;
  const glassGoal = WATER_GOAL_ML / 250;

  // Medicines
  const doses = today.meds.flatMap((m) => m.doses);
  const taken = doses.filter((d) => d.taken).length;
  const missed = todayReminders(today).some((r) => r.kind === 'dose_missed');

  // Mood & symptoms
  const mood = [...today.moods].reverse().find((m) => m.mood != null)?.mood ?? null;
  const symptoms = new Set(today.symptoms.map((x) => x.symptom)).size;
  const moodText = [
    mood ? `${MOOD_EMOJI[mood - 1]} ${t('todayPage.moodNow', { value: mood })}` : null,
    symptoms ? t('todayHub.symptoms', { count: symptoms }) : null,
  ].filter(Boolean);

  // Walk (live while a walk is running)
  const steps = today.lifestyle?.steps ?? 0;
  const walking = walk.status === 'walking';

  // Cycle
  const st = today.status;
  const cycle =
    st.kind === 'period' && st.period_day
      ? t('todayHub.periodDay', { day: st.period_day })
      : st.kind === 'late' && st.days_late
        ? t('todayHub.late', { count: st.days_late })
        : st.kind === 'cycle' && st.cycle_day
          ? t('todayHub.cycleDay', { day: st.cycle_day })
          : t('todayHub.cycleEmpty');

  // Sleep & stress
  const sleep = today.lifestyle?.sleep_hours ?? null;
  const stress = [...today.moods].reverse().find((m) => m.stress != null)?.stress ?? null;
  const stressKey = stress == null ? null : stress <= 2 ? 'low' : stress === 3 ? 'medium' : 'high';
  const rest = [sleep != null ? t('today.sleepHours', { count: sleep }) : null, stressKey ? t('todayHub.stress', { level: t(`todayPage.stressLevel.${stressKey}`) }) : null].filter(Boolean);

  return (
    <div className={s.wrap}>
      <ul className={s.grid} aria-label={t('todayHub.label')}>
        <Tile to="/today/food" icon="🍽️" tint="peach" title={t('todayHub.food')} summary={food} progress={today.score ? today.score.score / 10 : undefined} />
        <Tile to="/today/water" icon="💧" tint="blue" title={t('today.water')} summary={t('todayHub.glasses', { count: Math.floor(ml / 250), total: glassGoal })} progress={ml / WATER_GOAL_ML} />
        <Tile
          to="/today/meds"
          icon="💊"
          tint="pink"
          title={t('today.meds')}
          summary={doses.length ? t('todayHub.dosesTaken', { taken, total: doses.length }) : t('todayHub.medsEmpty')}
          progress={doses.length ? taken / doses.length : undefined}
          badge={missed ? { label: t('todayHub.missed') } : undefined}
        />
        <Tile to="/today/mood" icon="😊" tint="violet" title={t('todayHub.mood')} summary={moodText.length ? moodText.join(' · ') : t('todayHub.moodEmpty')} />
        <Tile
          to="/today/walk"
          icon="🚶‍♀️"
          tint="green"
          title={t('walk.title')}
          summary={walking ? t('todayHub.walkingNow', { n: walk.steps.toLocaleString() }) : steps ? t('todayHub.steps', { n: steps.toLocaleString() }) : t('todayHub.walkEmpty')}
          badge={walking ? { label: t('todayHub.live'), live: true } : undefined}
        />
        <Tile to="/cycle" icon="🌸" tint="pink" title={t('todayPage.periodTracker')} summary={cycle} badge={st.kind === 'late' ? { label: t('todayHub.lateBadge') } : undefined} />
        <Tile to="/insights" icon="🌙" tint="amber" title={t('todayHub.rest')} summary={rest.length ? rest.join(' · ') : t('todayHub.restEmpty')} />
        {today.weight_due ? <Tile to="/today/weight" icon="⚖️" tint="green" title={t('todayHub.weight')} summary={t('todayHub.weightDue')} /> : null}
      </ul>
    </div>
  );
}
