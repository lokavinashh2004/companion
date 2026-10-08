// Small Today cards: water, mood & symptoms, medicines checklist, weekly weight.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { Button, Card, Chip, Field, Muted, Notice, Row, Toggle } from '@/components/ui';
import type { Today } from '@/lib/api';
import { hhmm } from '@/lib/format';
import { useAddWater, useSaveWeight, useSetDose } from '@/lib/queries';
import { MOOD_EMOJI } from './constants';
import s from './today.module.css';

export function WaterCard({ today }: { today: Today }) {
  const { t } = useTranslation();
  const water = useAddWater();
  const ml = today.lifestyle?.water_ml ?? 0;
  return (
    <Card title={t('today.water')}>
      <p className={s.big}>💧 {t('today.waterAmount', { ml })}</p>
      <Row>
        <Button busy={water.isPending && water.variables?.ml === 250} onClick={() => water.mutate({ day: today.day, ml: 250 })}>
          {t('today.addWater')}
        </Button>
        <Button
          kind="ghost"
          small
          aria-label={t('todayPage.waterUndoLabel')}
          disabled={ml <= 0 || water.isPending}
          onClick={() => water.mutate({ day: today.day, ml: -Math.min(250, ml) })}
        >
          {t('todayPage.waterUndo')}
        </Button>
      </Row>
    </Card>
  );
}

export function MoodCard({ today }: { today: Today }) {
  const { t } = useTranslation();
  const mood = [...today.moods].reverse().find((m) => m.mood != null)?.mood ?? null;
  const symptoms = [...new Set(today.symptoms.map((x) => x.symptom))];
  const sleep = today.lifestyle?.sleep_hours ?? null;
  return (
    <Card title={t('today.mood')}>
      {mood ? (
        <Row>
          <span className={s.emoji} role="img" aria-label={t('a11y.moodValue', { value: mood })}>
            {MOOD_EMOJI[mood - 1]}
          </span>
          <Muted small>{t('todayPage.moodNow', { value: mood })}</Muted>
        </Row>
      ) : (
        <Muted>{t('today.moodEmpty')}</Muted>
      )}
      <div className={s.section}>
        <h3 className={s.label}>{t('today.symptoms')}</h3>
        {symptoms.length ? (
          <Row>
            {symptoms.map((x) => (
              <Chip key={x} label={t(`symptoms.${x}`)} />
            ))}
          </Row>
        ) : (
          <Muted small>{t('today.symptomsEmpty')}</Muted>
        )}
      </div>
      {sleep != null ? (
        <div className={s.section}>
          <h3 className={s.label}>{t('today.sleep')}</h3>
          <p className={s.flat}>😴 {t('today.sleepHours', { count: sleep })}</p>
        </div>
      ) : null}
    </Card>
  );
}

export function MedsCard({ today }: { today: Today }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setDose = useSetDose();
  if (!today.meds.length) {
    return (
      <Card title={t('today.meds')}>
        <Muted>{t('today.medsEmpty')}</Muted>
        <div>
          <Button kind="secondary" small onClick={() => void navigate('/me/medications')}>
            {t('todayPage.addMeds')}
          </Button>
        </div>
      </Card>
    );
  }
  return (
    <Card title={t('today.meds')}>
      {today.meds.flatMap(({ medication: m, doses }) =>
        doses.map((d) => (
          <Toggle
            key={`${m.id}-${d.time}`}
            label={t('todayPage.doseLabel', { name: [m.name, m.dose].filter(Boolean).join(' '), time: hhmm(d.time) })}
            hint={d.taken ? t('today.taken') : t('today.notTaken')}
            checked={d.taken}
            onChange={(taken) => setDose.mutate({ id: m.id, day: today.day, time: d.time, taken })}
          />
        )),
      )}
    </Card>
  );
}

export function WeightCard({ today }: { today: Today }) {
  const { t } = useTranslation();
  const save = useSaveWeight();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (save.isSuccess) return <Notice>{t('todayPage.weightSaved')}</Notice>;
  if (!today.weight_due) return null;
  const submit = () => {
    const kg = Number(value.replace(',', '.'));
    if (!value || !Number.isFinite(kg) || kg < 20 || kg > 300) {
      setError(t('todayPage.weightInvalid'));
      return;
    }
    setError(null);
    save.mutate({ day: today.day, weight_kg: Math.round(kg * 10) / 10 });
  };
  return (
    <Card title={t('today.weightPrompt')}>
      <Field label={t('todayPage.weightLabel')} hint={t('todayPage.weightHint')} error={error} type="number" inputMode="decimal" min={20} max={300} step={0.1} value={value} onChange={(e) => setValue(e.target.value)} />
      <div>
        <Button kind="secondary" busy={save.isPending} onClick={submit}>
          {t('today.weightSave')}
        </Button>
      </div>
      {save.isError ? <Muted small>{t('common.error')}</Muted> : null}
    </Card>
  );
}
