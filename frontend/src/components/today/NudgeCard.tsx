// The highlighted card at the top of Today: the most useful reminder right now (a missed dose, a water nudge,
// the period window), else the latest companion insight. One clear action each.
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { reminderText } from '@/components/shell/reminderText';
import { Button } from '@/components/ui';
import type { Insight, Today } from '@/lib/api';
import { useAddWater, useDismissInsight, useInsights, useSetDose } from '@/lib/queries';
import { todayReminders, type Reminder } from '@/lib/reminders';
import s from './nudge.module.css';

function pickInsight(insights: Insight[] | undefined): Insight | null {
  return insights?.find((i) => !i.dismissed && (i.type === 'delay' || i.type === 'red_flag')) ?? null;
}

export function NudgeCard({ today }: { today: Today }) {
  const { t } = useTranslation();
  const insights = useInsights();
  const setDose = useSetDose();
  const water = useAddWater();
  const dismiss = useDismissInsight();

  const reminder: Reminder | undefined = todayReminders(today).find((r) => r.kind !== 'dose_due');
  const insight = reminder ? null : pickInsight(insights.data?.insights);

  let icon: string;
  let title: string;
  let body: string;
  let action = null;

  if (reminder) {
    ({ icon, title, body } = reminderText(t, reminder));
    if (reminder.kind === 'dose_missed') {
      action = (
        <Button small className={s.action} busy={setDose.isPending} onClick={() => setDose.mutate({ id: reminder.medId, day: today.day, time: reminder.time, taken: true })}>
          {t('todayPage.markTaken')}
        </Button>
      );
    } else if (reminder.kind === 'water_behind') {
      action = (
        <Button small className={s.action} busy={water.isPending} onClick={() => water.mutate({ day: today.day, ml: 250 })}>
          {t('reminders.addGlass')}
        </Button>
      );
    } else if (reminder.kind === 'period_late' || reminder.kind === 'period_soon') {
      action = (
        <Link className={s.link} to="/cycle">
          {t('todayPage.openCycle')} ›
        </Link>
      );
    }
  } else if (insight) {
    icon = insight.type === 'delay' ? '🌸' : '🩺';
    title = insight.type === 'delay' ? t('insightCards.delayTitle') : t('insightCards.redFlagTitle');
    body =
      insight.type === 'delay'
        ? t('insightCards.delayBody', { count: Number(insight.payload.days_late ?? 0) })
        : typeof insight.payload.rule === 'string'
          ? t(`insightCards.redFlags.${insight.payload.rule}`)
          : t('insightCards.redFlagBody');
    action = (
      <Button small className={s.action} busy={dismiss.isPending} onClick={() => dismiss.mutate(insight.id)}>
        {t('insightCards.dismiss')}
      </Button>
    );
  } else {
    icon = '✨';
    title = t('reminders.allClear');
    body = t('reminders.allClearBody');
  }

  return (
    <section className={s.nudge} aria-live="polite">
      <div className={s.top}>
        <span className={s.icon} aria-hidden="true">
          {icon}
        </span>
        <h2 className={s.title}>{title}</h2>
      </div>
      <p className={s.body}>{body}</p>
      {action ? <div>{action}</div> : null}
    </section>
  );
}
