// Food balance: a gentle score ring, what went well and one idea; Meals: today's foods by meal. No shaming, kcal only if opted in.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { Button, Card, Chip, EmptyState, IconButton, Muted, Row, Sheet } from '@/components/ui';
import type { FoodLog, Meal, Today } from '@/lib/api';
import { useDeleteFood } from '@/lib/queries';
import { mealArt } from './dish';
import s from './today.module.css';

const MEALS: Meal[] = ['breakfast', 'lunch', 'snack', 'dinner', 'other'];
const RING_R = 52;
const RING_C = 2 * Math.PI * RING_R;

export function BalanceCard({ today }: { today: Today }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const showKcal = today.calorie_display === 'show';
  const { score, foods } = today;

  if (!foods.length) {
    return <EmptyState title={t('today.balanceTitle')} body={t('today.balanceEmpty')} action={{ label: t('todayPage.tellChat'), onClick: () => void navigate('/') }} />;
  }

  const filled = score ? Math.max(0, Math.min(10, score.score)) / 10 : 0;

  return (
    <Card className={s.balance}>
      <div className={s.balanceBody}>
        <div className={s.ring}>
          <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
            <defs>
              <linearGradient id="balance-ring" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%" stopColor="#2563eb" />
                <stop offset="60%" stopColor="#7c3aed" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>
            </defs>
            <circle cx="60" cy="60" r={RING_R} className={s.ringTrack} />
            <circle cx="60" cy="60" r={RING_R} className={s.ringFill} stroke="url(#balance-ring)" strokeDasharray={`${RING_C * filled} ${RING_C}`} />
          </svg>
          <span className={s.ringText}>
            {score ? <span className={s.score}>{t('today.balanceScore', { score: score.score })}</span> : null}
            <span className={s.ringLabel}>{t('todayPage.balanceLabel')}</span>
          </span>
        </div>
        <div className={s.balanceText}>
          <div className={s.balanceHead}>
            <span className={s.balanceIcon} aria-hidden="true">
              🪷
            </span>
            <h2 className={s.balanceTitle}>{t('today.balanceTitle')}</h2>
          </div>
          {score?.idea ? <p className={s.idea}>{t(`today.ideas.${score.idea}`)}</p> : null}
          {score?.highlights.length ? (
            <Row>
              {score.highlights.map((h) => (
                <Chip key={h} tone="calm" label={`✓ ${t(`today.highlights.${h}`)}`} />
              ))}
            </Row>
          ) : null}
          {showKcal && score?.kcal != null ? <Muted small>{t('todayPage.kcalTotal', { count: Math.round(score.kcal) })}</Muted> : null}
        </div>
      </div>
    </Card>
  );
}

export function MealsCard({ today }: { today: Today }) {
  const { t } = useTranslation();
  const del = useDeleteFood();
  const [removing, setRemoving] = useState<FoodLog | null>(null);
  const showKcal = today.calorie_display === 'show';
  if (!today.foods.length) return null;

  return (
    <Card title={t('todayPage.meals')} icon="🍽️" tint="peach">
      {MEALS.map((meal) => {
        const items = today.foods.filter((f) => f.meal === meal);
        if (!items.length) return null;
        return (
          <div key={meal} className={s.mealRow}>
            <span className={s.plate} aria-hidden="true">
              {mealArt(meal, items.map((f) => f.item_name))}
            </span>
            <div className={s.meal}>
            <h3 className={s.mealTitle}>{t(`meals.${meal}`)}</h3>
            <ul className={s.items}>
              {items.map((f) => (
                <li key={f.id} className={s.item}>
                  <span className={s.itemText}>
                    <span className={s.itemName}>{f.item_name}</span>
                    {f.quantity != null ? <span className={s.qty}>× {[f.quantity, f.unit].filter((x) => x != null && x !== '').join(' ')}</span> : null}
                    {f.is_estimate ? <span className={s.tag}>{t('today.estimate')}</span> : null}
                  </span>
                  {showKcal && f.kcal != null ? <span className={s.kcal}>{t('today.kcal', { count: Math.round(f.kcal) })}</span> : null}
                  <IconButton label={t('a11y.removeItem', { name: f.item_name })} className={s.remove} onClick={() => setRemoving(f)}>
                    ✕
                  </IconButton>
                </li>
              ))}
            </ul>
            </div>
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
