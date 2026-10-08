// Food balance: a gentle score, what went well, one idea, and today's meals. No shaming, kcal only if opted in.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { Button, Card, Chip, EmptyState, IconButton, Muted, Row, Sheet } from '@/components/ui';
import type { FoodLog, Meal, Today } from '@/lib/api';
import { useDeleteFood } from '@/lib/queries';
import s from './today.module.css';

const MEALS: Meal[] = ['breakfast', 'lunch', 'snack', 'dinner', 'other'];

export function BalanceCard({ today }: { today: Today }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const del = useDeleteFood();
  const [removing, setRemoving] = useState<FoodLog | null>(null);
  const showKcal = today.calorie_display === 'show';
  const { score, foods } = today;

  if (!foods.length) {
    return <EmptyState title={t('today.balanceTitle')} body={t('today.balanceEmpty')} action={{ label: t('todayPage.tellChat'), onClick: () => void navigate('/') }} />;
  }

  return (
    <Card title={t('today.balanceTitle')}>
      {score ? (
        <>
          <p className={s.score}>{t('today.balanceScore', { score: score.score })}</p>
          {score.highlights.length ? (
            <Row>
              {score.highlights.map((h) => (
                <Chip key={h} tone="calm" label={`✓ ${t(`today.highlights.${h}`)}`} />
              ))}
            </Row>
          ) : null}
          {score.idea ? <p className={s.idea}>{t(`today.ideas.${score.idea}`)}</p> : null}
          {showKcal && score.kcal != null ? <Muted small>{t('todayPage.kcalTotal', { count: Math.round(score.kcal) })}</Muted> : null}
        </>
      ) : null}

      {MEALS.map((meal) => {
        const items = foods.filter((f) => f.meal === meal);
        if (!items.length) return null;
        return (
          <div key={meal} className={s.meal}>
            <h3 className={s.mealTitle}>{t(`meals.${meal}`)}</h3>
            <ul className={s.items}>
              {items.map((f) => (
                <li key={f.id} className={s.item}>
                  <span className={s.itemText}>
                    <span>{f.item_name}</span>
                    {f.quantity != null ? <span className={s.qty}>× {[f.quantity, f.unit].filter((x) => x != null && x !== '').join(' ')}</span> : null}
                    {f.is_estimate ? <span className={s.tag}>{t('today.estimate')}</span> : null}
                  </span>
                  {showKcal && f.kcal != null ? <span className={s.kcal}>{t('today.kcal', { count: Math.round(f.kcal) })}</span> : null}
                  <IconButton label={t('a11y.removeItem', { name: f.item_name })} onClick={() => setRemoving(f)}>
                    ✕
                  </IconButton>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      <Sheet open={!!removing} onClose={() => setRemoving(null)} title={removing ? t('today.deleteFood', { name: removing.item_name }) : ''}>
        <Row>
          <Button
            kind="danger"
            busy={del.isPending}
            onClick={() => {
              if (removing) del.mutate(removing.id, { onSuccess: () => setRemoving(null) });
            }}
          >
            {t('common.remove')}
          </Button>
          <Button kind="ghost" onClick={() => setRemoving(null)}>
            {t('common.cancel')}
          </Button>
        </Row>
      </Sheet>
    </Card>
  );
}
