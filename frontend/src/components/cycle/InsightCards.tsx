// Calm cards for a late period (with possible factors) or a gentle "mention it to your doctor" nudge.
import { useTranslation } from 'react-i18next';

import { Button, Card, Muted } from '@/components/ui';
import type { Insight } from '@/lib/api';
import { useDismissInsight } from '@/lib/queries';
import s from './cycle.module.css';

function DelayCard({ insight }: { insight: Insight }) {
  const { t } = useTranslation();
  const daysLate = Number(insight.payload.days_late ?? 0);
  const factors = Array.isArray(insight.payload.factors) ? (insight.payload.factors as unknown[]).filter((f): f is string => typeof f === 'string') : [];
  return (
    <>
      <Muted>{t('insightCards.delayBody', { count: daysLate })}</Muted>
      {factors.length ? (
        <>
          <Muted small>{t('insightCards.delayFactors')}</Muted>
          <ul className={s.factors}>
            {factors.map((f) => (
              <li key={f}>{t(`insightCards.factors.${f}`)}</li>
            ))}
          </ul>
        </>
      ) : null}
      <Muted small>{t('insightCards.delayPregnancy')}</Muted>
      <Muted small>{t('insightCards.delayDoctor')}</Muted>
    </>
  );
}

export function InsightCards({ insights }: { insights: Insight[] }) {
  const { t } = useTranslation();
  const dismiss = useDismissInsight();
  const shown = insights.filter((i) => !i.dismissed && (i.type === 'delay' || i.type === 'red_flag'));
  if (!shown.length) return null;
  return (
    <>
      {shown.map((i) => (
        <Card key={i.id} tone="calm" title={i.type === 'delay' ? t('insightCards.delayTitle') : t('insightCards.redFlagTitle')}>
          {i.type === 'delay' ? (
            <DelayCard insight={i} />
          ) : (
            <>
              {typeof i.payload.rule === 'string' ? <p>{t(`insightCards.redFlags.${i.payload.rule}`)}</p> : null}
              <Muted small>{t('insightCards.redFlagBody')}</Muted>
            </>
          )}
          <div>
            <Button kind="secondary" small busy={dismiss.isPending && dismiss.variables === i.id} onClick={() => dismiss.mutate(i.id)}>
              {t('insightCards.dismiss')}
            </Button>
          </div>
        </Card>
      ))}
    </>
  );
}
