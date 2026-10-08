// Food photo → detected items she can edit → saved to today only when she taps Save. The photo itself is never stored.
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Field, IconButton, Muted, Notice, Segmented, Sheet, Spinner } from '@/components/ui';
import type { Meal } from '@/lib/api';
import { mealForHour, todayIn, uuid } from '@/lib/format';
import { useLogFoods, usePhotoDetect } from '@/lib/queries';
import { fileToJpegBase64 } from './image';
import s from './chat.module.css';

type MealChoice = Exclude<Meal, 'other'>;
type Draft = { key: string; name: string; quantity: string; unit: string; grams: number | null };
type Phase = 'pick' | 'analyzing' | 'review' | 'saved';
type Problem = 'unavailable' | 'notFood' | 'error' | null;

const MEALS: MealChoice[] = ['breakfast', 'lunch', 'snack', 'dinner'];

export function PhotoLogSheet({ open, onClose, timezone }: { open: boolean; onClose: () => void; timezone?: string }) {
  const { t } = useTranslation();
  const detect = usePhotoDetect();
  const logFoods = useLogFoods();
  const [phase, setPhase] = useState<Phase>('pick');
  const [problem, setProblem] = useState<Problem>(null);
  const [items, setItems] = useState<Draft[]>([]);
  const [meal, setMeal] = useState<MealChoice>(() => mealForHour());
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setPhase('pick');
    setProblem(null);
    setItems([]);
    setMeal(mealForHour());
    detect.reset();
    logFoods.reset();
  };
  const close = () => {
    reset();
    onClose();
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setProblem(null);
    setPhase('analyzing');
    let image_base64: string;
    try {
      image_base64 = await fileToJpegBase64(file);
    } catch {
      setProblem('error');
      setPhase('pick');
      return;
    }
    detect.mutate(
      { image_base64, meal },
      {
        onSuccess: (r) => {
          if (r.status === 'unavailable') {
            setProblem('unavailable');
            setPhase('pick');
          } else if (!r.is_food || r.items.length === 0) {
            setProblem('notFood');
            setPhase('pick');
          } else {
            setItems(r.items.map((i) => ({ key: uuid(), name: i.name, quantity: i.quantity == null ? '' : String(i.quantity), unit: i.unit ?? '', grams: i.estimated_grams })));
            setPhase('review');
          }
        },
        onError: () => {
          setProblem('error');
          setPhase('pick');
        },
      },
    );
    // Let her pick the same file again later.
    if (cameraRef.current) cameraRef.current.value = '';
    if (libraryRef.current) libraryRef.current.value = '';
  };

  const update = (key: string, patch: Partial<Draft>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const save = () => {
    const clean = items
      .filter((i) => i.name.trim())
      .map((i) => {
        const q = Number.parseFloat(i.quantity.replace(',', '.'));
        return { name: i.name.trim(), quantity: Number.isFinite(q) && q > 0 ? q : null, unit: i.unit.trim() || null, grams: i.grams };
      });
    if (!clean.length) return;
    logFoods.mutate({ items: clean, meal, day: todayIn(timezone), source: 'photo' }, { onSuccess: () => setPhase('saved') });
  };

  return (
    <Sheet open={open} onClose={close} title={t('photo.title')}>
      <Muted small>{t('photo.privacy')}</Muted>

      {problem === 'unavailable' ? <Notice tone="warn">{t('photo.unavailable')}</Notice> : null}
      {problem === 'notFood' ? <Notice>{t('photo.notFood')}</Notice> : null}
      {problem === 'error' ? <Notice tone="warn">{t('common.error')}</Notice> : null}

      {phase === 'pick' ? (
        <div className={s.pickRow}>
          <label className={s.fileButton}>
            <input ref={cameraRef} className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={(e) => void onFile(e.target.files?.[0])} />
            <span aria-hidden="true">📷</span> {t('photo.pickCamera')}
          </label>
          <label className={`${s.fileButton} ${s.fileButtonAlt}`}>
            <input ref={libraryRef} className="visually-hidden" type="file" accept="image/*" onChange={(e) => void onFile(e.target.files?.[0])} />
            <span aria-hidden="true">🖼️</span> {t('photo.pickLibrary')}
          </label>
        </div>
      ) : null}

      {phase === 'analyzing' ? (
        <div className={s.analyzing} role="status">
          <Spinner />
          <span>{t('photo.analyzing')}</span>
        </div>
      ) : null}

      {phase === 'review' ? (
        <>
          <Muted small>{t('photo.hint')}</Muted>
          <ul className={s.foodList}>
            {items.map((i, n) => (
              <li key={i.key} className={s.foodItem}>
                <div className={s.foodName}>
                  <Field label={t('photo.itemName')} value={i.name} maxLength={80} onChange={(e) => update(i.key, { name: e.target.value })} />
                </div>
                <div className={s.foodQty}>
                  <Field label={t('photo.quantity')} inputMode="decimal" value={i.quantity} maxLength={8} onChange={(e) => update(i.key, { quantity: e.target.value })} />
                </div>
                <div className={s.foodUnit}>
                  <Field label={t('photo.unit')} value={i.unit} maxLength={20} onChange={(e) => update(i.key, { unit: e.target.value })} />
                </div>
                <IconButton
                  label={t('a11y.removeItem', { name: i.name.trim() || String(n + 1) })}
                  className={s.foodRemove}
                  onClick={() => setItems((list) => list.filter((x) => x.key !== i.key))}
                >
                  ✕
                </IconButton>
              </li>
            ))}
          </ul>
          <div>
            <Button kind="secondary" small onClick={() => setItems((list) => [...list, { key: uuid(), name: '', quantity: '', unit: '', grams: null }])}>
              + {t('photo.addItem')}
            </Button>
          </div>
          <Segmented<MealChoice> label={t('photo.meal')} value={meal} onChange={setMeal} options={MEALS.map((m) => ({ value: m, label: t(`meals.${m}`) }))} />
          {logFoods.isError ? <Notice tone="warn">{t('common.error')}</Notice> : null}
          <Button onClick={save} busy={logFoods.isPending} disabled={!items.some((i) => i.name.trim())}>
            {t('photo.save')}
          </Button>
        </>
      ) : null}

      {phase === 'saved' ? (
        <>
          <Notice>{t('photo.saved')}</Notice>
          <Button onClick={close}>{t('common.done')}</Button>
        </>
      ) : null}
    </Sheet>
  );
}
