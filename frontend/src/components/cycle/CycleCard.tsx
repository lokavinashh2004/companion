// Where you are in your cycle + the predicted next-period RANGE (never a single date). Used on Today and Cycle.
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Card, Chip, Muted, Row } from '@/components/ui';
import type { CycleStatus, Prediction } from '@/lib/api';
import { shortDate } from '@/lib/format';
import s from './cycle.module.css';

export function CycleCard({ status, prediction, title, children }: { status: CycleStatus; prediction: Prediction; title?: string; children?: ReactNode }) {
  const { t } = useTranslation();

  let headline: string;
  if (status.kind === 'period' && status.period_day) headline = t('cycle.periodDay', { day: status.period_day });
  else if (status.kind === 'late' && status.days_late) headline = t('cycle.late', { count: status.days_late });
  else if (status.kind === 'cycle' && status.cycle_day) headline = t('cycle.dayOf', { day: status.cycle_day });
  else headline = t('cycle.unknown');

  const phase = status.phase === 'follicular' || status.phase === 'luteal' ? t(`cycle.phase.${status.phase}`) : null;

  return (
    <Card title={title}>
      <p className={s.headline}>{headline}</p>
      {phase ? (
        <Row>
          <Chip label={phase} tone="calm" />
        </Row>
      ) : null}
      {prediction ? (
        <div className={s.prediction}>
          <span className={s.predLabel}>{t('cycle.prediction')}</span>
          <span className={s.predRange}>{t('cycle.window', { earliest: shortDate(prediction.earliest), latest: shortDate(prediction.latest) })}</span>
          <Row>
            <Chip label={t(`cycle.confidence.${prediction.confidence}`)} />
            {prediction.cycles_used > 0 ? <Muted small>{t('cyclePage.cyclesUsed', { count: prediction.cycles_used })}</Muted> : null}
          </Row>
          <Muted small>{t('cycle.rangeNote')}</Muted>
        </div>
      ) : null}
      {children}
    </Card>
  );
}
