// Five-second check-in: mood, energy, stress, symptoms, optional sleep.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Chip, Muted, Notice, Row, Sheet, Stepper } from '@/components/ui';
import type { QuickLog } from '@/lib/api';
import { useQuickLog } from '@/lib/queries';
import { MOOD_EMOJI, QUICK_SYMPTOMS, type Symptom } from './constants';
import s from './today.module.css';

const LEVELS = [1, 2, 3, 4, 5];

export function QuickLogSheet({ open, day, onClose, onLogged }: { open: boolean; day: string; onClose: () => void; onLogged: () => void }) {
  const { t } = useTranslation();
  return (
    <Sheet open={open} onClose={onClose} title={t('quickLog.title')}>
      {open ? <QuickLogForm day={day} onLogged={onLogged} /> : null}
    </Sheet>
  );
}

function QuickLogForm({ day, onLogged }: { day: string; onLogged: () => void }) {
  const { t } = useTranslation();
  const log = useQuickLog();
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [stress, setStress] = useState<number | null>(null);
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [sleep, setSleep] = useState<number | null>(null);
  const [empty, setEmpty] = useState(false);

  const toggle = (x: Symptom) => setSymptoms((cur) => (cur.includes(x) ? cur.filter((y) => y !== x) : [...cur, x]));

  const save = () => {
    const body: QuickLog = { day };
    if (mood != null) body.mood = mood;
    if (energy != null) body.energy = energy;
    if (stress != null) body.stress = stress;
    if (symptoms.length) body.symptoms = symptoms;
    if (sleep != null) body.sleep_hours = sleep;
    if (Object.keys(body).length === 1) {
      setEmpty(true);
      return;
    }
    setEmpty(false);
    log.mutate(body, { onSuccess: onLogged });
  };

  const level = (label: string, value: number | null, set: (v: number | null) => void) => (
    <div className={s.section}>
      <h3 className={s.label}>{label}</h3>
      <Row>
        {LEVELS.map((v) => (
          <Chip key={v} label={String(v)} ariaLabel={t('a11y.levelValue', { label, value: v })} selected={value === v} onClick={() => set(value === v ? null : v)} />
        ))}
      </Row>
    </div>
  );

  return (
    <>
      <div className={s.section}>
        <h3 className={s.label}>{t('quickLog.mood')}</h3>
        <Row>
          {MOOD_EMOJI.map((e, i) => (
            <Chip key={e} label={e} ariaLabel={t('a11y.moodValue', { value: i + 1 })} selected={mood === i + 1} onClick={() => setMood(mood === i + 1 ? null : i + 1)} />
          ))}
        </Row>
      </div>
      {level(t('quickLog.energy'), energy, setEnergy)}
      {level(t('quickLog.stress'), stress, setStress)}
      <div className={s.section}>
        <h3 className={s.label}>{t('quickLog.symptoms')}</h3>
        <Row>
          {QUICK_SYMPTOMS.map((x) => (
            <Chip key={x} label={t(`symptoms.${x}`)} selected={symptoms.includes(x)} onClick={() => toggle(x)} />
          ))}
        </Row>
      </div>
      <div className={s.section}>
        {sleep == null ? (
          <div>
            <Button kind="secondary" small onClick={() => setSleep(7)}>
              {t('todayPage.addSleep')}
            </Button>
          </div>
        ) : (
          <>
            <Stepper label={t('quickLog.sleep')} value={sleep} onChange={setSleep} min={0} max={16} step={0.5} format={(v) => t('today.sleepHours', { count: v })} />
            <div>
              <Button kind="ghost" small onClick={() => setSleep(null)}>
                {t('todayPage.skipSleep')}
              </Button>
            </div>
          </>
        )}
      </div>
      {empty ? <Muted small>{t('todayPage.pickOne')}</Muted> : null}
      {log.isError ? <Notice tone="warn">{t('common.error')}</Notice> : null}
      <Button busy={log.isPending} onClick={save}>
        {t('quickLog.save')}
      </Button>
    </>
  );
}
