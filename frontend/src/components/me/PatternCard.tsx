// "You might notice…" cards: gentle patterns computed from her own logs. Never dismissible (they're recomputed).
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { Card, Muted } from '@/components/ui';
import type { Insight } from '@/lib/api';
import s from './me.module.css';

const PHASES = new Set(['menstrual', 'follicular', 'luteal']);

function patternText(t: TFunction, payload: Insight['payload']): string | null {
  switch (payload.kind) {
    case 'mood_by_phase': {
      const lowest = typeof payload.lowest === 'string' && PHASES.has(payload.lowest) ? payload.lowest : null;
      return lowest ? t('insightCards.patterns.mood_by_phase', { phase: t(`cycle.phase.${lowest}`) }) : null;
    }
    case 'cravings_luteal':
      return t('insightCards.patterns.cravings_luteal');
    case 'sugar_acne':
      return t('insightCards.patterns.sugar_acne');
    default:
      return null;
  }
}

export function PatternCard({ insights }: { insights: Insight[] }) {
  const { t } = useTranslation();
  const lines = insights.map((i) => ({ id: i.id, text: patternText(t, i.payload) })).filter((x): x is { id: string; text: string } => !!x.text);
  if (!lines.length) return null;
  return (
    <Card tone="calm" title={t('insightCards.patternTitle')}>
      <ul className={s.steps}>
        {lines.map((l) => (
          <li key={l.id}>{l.text}</li>
        ))}
      </ul>
      <Muted small>{t('insightsPage.patternHint')}</Muted>
    </Card>
  );
}
