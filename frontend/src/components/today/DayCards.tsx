// Small Today cards: water glasses, mood & symptoms, medicines checklist, cycle strip, quick insights, weekly weight.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import { Button, Card, Chip, cx, Field, Muted, Notice, Row } from '@/components/ui';
import type { CycleStatus, Prediction, Today } from '@/lib/api';
import { addDays, diffDays, hhmm } from '@/lib/format';
import { useAddWater, useQuickLog, useSaveWeight, useSetDose } from '@/lib/queries';
import { MOOD_EMOJI } from './constants';
import s from './today.module.css';

const GLASS_ML = 250;
const GLASS_GOAL = 8;

export function WaterCard({ today }: { today: Today }) {
  const { t } = useTranslation();
  const water = useAddWater();
  const ml = today.lifestyle?.water_ml ?? 0;
  const glasses = Math.floor(ml / GLASS_ML);
  const total = Math.max(GLASS_GOAL, glasses);
  return (
    <Card title={t('today.water')} icon="💧" tint="blue">
      <p className={s.glassCount}>
        <span className={s.big}>{glasses}</span> {t('todayPage.glassesOf', { total })}
      </p>
      <Muted small>{t('today.waterAmount', { ml })}</Muted>
      <div className={s.glasses} aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={cx(s.glass, i < glasses && s.glassFull)} />
        ))}
      </div>
      <div className={s.waterActions}>
        <Button className={s.grow} busy={water.isPending && water.variables?.ml === GLASS_ML} onClick={() => water.mutate({ day: today.day, ml: GLASS_ML })}>
          {t('today.addWater')}
        </Button>
        <Button
          kind="ghost"
          small
          aria-label={t('todayPage.waterUndoLabel')}
          disabled={ml <= 0 || water.isPending}
          onClick={() => water.mutate({ day: today.day, ml: -Math.min(GLASS_ML, ml) })}
        >
          {t('todayPage.waterUndo')}
        </Button>
      </div>
    </Card>
  );
}

export function MoodCard({ today }: { today: Today }) {
  const { t } = useTranslation();
  const log = useQuickLog();
  const latest = [...today.moods].reverse().find((m) => m.mood != null)?.mood ?? null;
  const mood = log.isPending && log.variables?.mood != null ? log.variables.mood : latest;
  const symptoms = [...new Set(today.symptoms.map((x) => x.symptom))];
  return (
    <Card title={t('todayPage.feeling')} icon="😊" tint="violet">
      <div className={s.moods} role="group" aria-label={t('today.mood')}>
        {MOOD_EMOJI.map((emoji, i) => {
          const value = i + 1;
          return (
            <button
              key={value}
              type="button"
              className={cx(s.moodTile, mood === value && s.moodOn)}
              aria-pressed={mood === value}
              aria-label={t('todayPage.logMood', { value })}
              disabled={log.isPending}
              onClick={() => log.mutate({ day: today.day, mood: value })}
            >
              <span aria-hidden="true">{emoji}</span>
            </button>
          );
        })}
      </div>
      {mood ? <Muted small>{t('todayPage.moodNow', { value: mood })}</Muted> : <Muted small>{t('today.moodEmpty')}</Muted>}
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
    </Card>
  );
}

export function MedsCard({ today }: { today: Today }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setDose = useSetDose();
  if (!today.meds.length) {
    return (
      <Card title={t('today.meds')} icon="💊" tint="pink">
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
    <Card title={t('today.meds')} icon="💊" tint="pink">
      <ul className={s.items}>
        {today.meds.flatMap(({ medication: m, doses }) =>
          doses.map((d) => {
            const name = [m.name, m.dose].filter(Boolean).join(' ');
            return (
              <li key={`${m.id}-${d.time}`} className={s.dose}>
                <span className={s.doseText}>
                  <span className={s.itemName}>{name}</span>
                  <span className={s.qty}>{hhmm(d.time)}</span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={d.taken}
                  aria-label={t('todayPage.doseLabel', { name, time: hhmm(d.time) })}
                  className={cx(s.doseButton, d.taken && s.doseTaken)}
                  onClick={() => setDose.mutate({ id: m.id, day: today.day, time: d.time, taken: !d.taken })}
                >
                  {d.taken ? `✓ ${t('today.taken')}` : t('todayPage.markTaken')}
                </button>
              </li>
            );
          }),
        )}
      </ul>
    </Card>
  );
}

/** One dot per day of the current cycle: days gone, today, and the predicted period window. */
export function CycleStrip({ day, status, prediction }: { day: string; status: CycleStatus; prediction: Prediction }) {
  const { t } = useTranslation();
  const cycleDay = status.cycle_day;
  if (status.kind !== 'cycle' || !cycleDay || !prediction) return null;
  const start = addDays(day, -(cycleDay - 1));
  const length = Math.min(45, Math.max(cycleDay, diffDays(start, prediction.latest) + 1));
  const from = diffDays(start, prediction.earliest);
  const to = diffDays(start, prediction.latest);
  const likely = Math.max(21, diffDays(start, prediction.likely));
  return (
    <div className={s.strip} role="img" aria-label={t('todayPage.cycleSummary', { day: cycleDay, length: likely })}>
      {Array.from({ length }, (_, i) => (
        <span key={i} className={cx(s.dot, i < cycleDay - 1 && s.dotPast, i === cycleDay - 1 && s.dotToday, i >= from && i <= to && s.dotPredicted)} />
      ))}
    </div>
  );
}

export function InsightsCard({ today }: { today: Today }) {
  const { t } = useTranslation();
  const sleep = today.lifestyle?.sleep_hours ?? null;
  const steps = today.lifestyle?.steps ?? null;
  const stress = [...today.moods].reverse().find((m) => m.stress != null)?.stress ?? null;
  const stressKey = stress == null ? null : stress <= 2 ? 'low' : stress === 3 ? 'medium' : 'high';
  const stats = [
    { icon: '🌙', label: t('today.sleep'), value: sleep != null ? t('today.sleepHours', { count: sleep }) : '–' },
    { icon: '👟', label: t('todayPage.steps'), value: steps != null ? steps.toLocaleString() : '–' },
    { icon: '🍃', label: t('todayPage.stress'), value: stressKey ? t(`todayPage.stressLevel.${stressKey}`) : '–' },
  ];
  return (
    <Card title={t('todayPage.insightsTitle')} icon="💡" tint="amber">
      <dl className={s.stats}>
        {stats.map((x) => (
          <div key={x.label} className={s.stat}>
            <span className={s.statIcon} aria-hidden="true">
              {x.icon}
            </span>
            <span className={s.statText}>
              <dt>{x.label}</dt>
              <dd>{x.value}</dd>
            </span>
          </div>
        ))}
      </dl>
      <Link className={s.cardLink} to="/insights">
        📈 {t('todayPage.seeInsights')} ›
      </Link>
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
    <Card title={t('today.weightPrompt')} icon="⚖️" tint="green">
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
