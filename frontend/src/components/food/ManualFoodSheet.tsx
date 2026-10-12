// Log a food by hand: meal, food name (with suggestions from the food list), quantity, unit and portion size.
// A live preview shows the grams and calories the server will save (the same maths as saving).
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Chip, Field, Muted, Notice, Segmented, Select, Sheet } from '@/components/ui';
import type { Meal } from '@/lib/api';
import { mealForHour } from '@/lib/format';
import { useFoodEstimate, useFoodSearch, useLogFoods } from '@/lib/queries';
import { useDebounced } from '@/lib/useDebounced';
import s from './food.module.css';

const MEALS: Meal[] = ['breakfast', 'lunch', 'snack', 'dinner', 'other'];
const UNITS = ['piece', 'bowl', 'cup', 'plate', 'karandi', 'tumbler', 'glass', 'slice', 'tablespoon', 'teaspoon', 'handful', 'g', 'ml'] as const;
type Size = 'small' | 'regular' | 'large';
/** Exact weights and volumes don't take a portion size. */
const EXACT = new Set(['g', 'ml']);

export function ManualFoodSheet({ open, day, showKcal, onClose, onSaved }: { open: boolean; day: string; showKcal: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  return (
    <Sheet open={open} onClose={onClose} title={t('food.logTitle')}>
      {open ? <ManualFoodForm day={day} showKcal={showKcal} onSaved={onSaved} /> : null}
    </Sheet>
  );
}

function ManualFoodForm({ day, showKcal, onSaved }: { day: string; showKcal: boolean; onSaved: () => void }) {
  const { t } = useTranslation();
  const log = useLogFoods();
  const [meal, setMeal] = useState<Meal>(() => mealForHour());
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState<(typeof UNITS)[number]>('piece');
  const [size, setSize] = useState<Size>('regular');
  const [error, setError] = useState<string | null>(null);

  const qty = Number(quantity.replace(',', '.'));
  const validQty = quantity !== '' && Number.isFinite(qty) && qty > 0 && qty <= 50;
  // "large bowl", "small piece": the server scales the portion by the size word.
  const unitText = EXACT.has(unit) || size === 'regular' ? unit : `${size} ${unit}`;

  const search = useFoodSearch(useDebounced(name));
  // Debounce a string, not an object (a new object each render would never settle).
  const previewKey = useDebounced(JSON.stringify({ name, quantity: validQty ? qty : null, unit: unitText }), 400);
  const preview = useFoodEstimate(JSON.parse(previewKey) as { name: string; quantity: number | null; unit: string });
  const suggestions = (search.data?.results ?? []).filter((r) => r.name.toLowerCase() !== name.trim().toLowerCase()).slice(0, 5);

  const save = () => {
    if (!name.trim()) return setError(t('food.nameMissing'));
    if (!validQty) return setError(t('food.qtyInvalid'));
    setError(null);
    log.mutate({ items: [{ name: name.trim(), quantity: qty, unit: unitText }], meal, day, source: 'manual' }, { onSuccess: onSaved });
  };

  const est = preview.data;
  return (
    <div className={s.form}>
      <Select label={t('food.meal')} value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
        {MEALS.map((m) => (
          <option key={m} value={m}>
            {t(`meals.${m}`)}
          </option>
        ))}
      </Select>
      <Field label={t('food.name')} placeholder={t('food.namePlaceholder')} autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
      {suggestions.length ? (
        <ul className={s.suggestions} aria-label={t('food.suggestions')}>
          {suggestions.map((r) => (
            <li key={r.name}>
              <Chip label={r.name} onClick={() => setName(r.name)} />
            </li>
          ))}
        </ul>
      ) : null}
      <div className={s.pair}>
        <Field label={t('food.quantity')} type="number" inputMode="decimal" min={0.25} max={50} step={0.25} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        <Select label={t('food.unit')} value={unit} onChange={(e) => setUnit(e.target.value as (typeof UNITS)[number])}>
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {t(`food.units.${u}`)}
            </option>
          ))}
        </Select>
      </div>
      {EXACT.has(unit) ? null : (
        <Segmented<Size>
          label={t('food.size')}
          value={size}
          onChange={setSize}
          options={[
            { value: 'small', label: t('food.sizes.small') },
            { value: 'regular', label: t('food.sizes.regular') },
            { value: 'large', label: t('food.sizes.large') },
          ]}
        />
      )}
      {name.trim().length >= 2 && validQty ? (
        <p className={s.preview} aria-live="polite">
          {est?.found ? (
            <>
              {showKcal && est.kcal != null ? (
                <>
                  ≈ <strong>{t('food.kcal', { n: est.kcal.toLocaleString() })}</strong> ·{' '}
                </>
              ) : null}
              {t('food.grams', { n: est.grams })}
              {est.is_estimate ? ` · ${t('today.estimate')}` : ''}
            </>
          ) : est ? (
            t('food.notInList')
          ) : (
            t('common.loading')
          )}
        </p>
      ) : null}
      {error ? <Notice tone="warn">{error}</Notice> : null}
      {log.isError ? <Notice tone="warn">{t('common.error')}</Notice> : null}
      <Button busy={log.isPending} onClick={save}>
        {t('food.save')}
      </Button>
      <Muted small>{t('food.manualHint')}</Muted>
    </div>
  );
}
