// Add / edit a medicine: name, optional dose, and up to 8 reminder times (HH:MM).
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Chip, Field, Muted, Row } from '@/components/ui';
import type { MedInput } from '@/lib/api';
import { hhmm, isValidTime } from '@/lib/format';
import { FormError } from './common';
import s from './me.module.css';

export const MAX_TIMES = 8;

export function MedEditor({
  initial,
  submitLabel,
  busy,
  failed,
  onSave,
  onCancel,
}: {
  initial?: MedInput;
  submitLabel: string;
  busy?: boolean;
  failed?: boolean;
  onSave: (m: MedInput) => void;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const timesLabelId = useId();
  const [name, setName] = useState(initial?.name ?? '');
  const [dose, setDose] = useState(initial?.dose ?? '');
  const [times, setTimes] = useState<string[]>(() => (initial?.schedule_times ?? []).map(hhmm).sort());
  const [newTime, setNewTime] = useState('');
  const [timeError, setTimeError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const addTime = () => {
    const v = newTime.trim();
    if (!isValidTime(v)) return setTimeError(t('settings.invalidTime'));
    if (times.includes(v)) return setTimeError(t('mePage.meds.duplicateTime'));
    if (times.length >= MAX_TIMES) return setTimeError(t('mePage.meds.maxTimes'));
    setTimes([...times, v].sort());
    setNewTime('');
    setTimeError(null);
  };

  const submit = () => {
    const n = name.trim();
    if (!n) return setNameError(t('mePage.meds.nameRequired'));
    setNameError(null);
    // A valid time typed but not yet added still counts.
    const pending = newTime.trim();
    const all = isValidTime(pending) && !times.includes(pending) && times.length < MAX_TIMES ? [...times, pending].sort() : times;
    onSave({ name: n.slice(0, 60), dose: dose.trim() ? dose.trim().slice(0, 40) : null, schedule_times: all });
  };

  return (
    <div className={s.stack}>
      <Field label={t('meds.name')} placeholder={t('meds.namePlaceholder')} value={name} maxLength={60} error={nameError} onChange={(e) => setName(e.target.value)} />
      <Field label={t('meds.dose')} placeholder={t('meds.dosePlaceholder')} value={dose} maxLength={40} hint={t('common.optional')} onChange={(e) => setDose(e.target.value)} />

      <div className={s.stack} role="group" aria-labelledby={timesLabelId}>
        <span id={timesLabelId}>{t('meds.times')}</span>
        {times.length ? (
          <Row>
            {times.map((tm) => (
              <Chip key={tm} label={`${tm} ✕`} ariaLabel={t('mePage.meds.removeTime', { time: tm })} onClick={() => setTimes(times.filter((x) => x !== tm))} />
            ))}
          </Row>
        ) : (
          <Muted small>{t('mePage.meds.noTimes')}</Muted>
        )}
        {times.length < MAX_TIMES ? (
          <Row nowrap>
            <Field
              label={t('mePage.meds.newTime')}
              value={newTime}
              placeholder="08:00"
              inputMode="numeric"
              maxLength={5}
              error={timeError}
              hint={t('settings.timeFormatHint')}
              onChange={(e) => setNewTime(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTime();
                }
              }}
            />
            <Button kind="secondary" small onClick={addTime}>
              {t('meds.addTime')}
            </Button>
          </Row>
        ) : (
          <Muted small>{t('mePage.meds.maxTimes')}</Muted>
        )}
      </div>

      {failed ? <FormError>{t('common.error')}</FormError> : null}
      <Row>
        <Button busy={busy} onClick={submit}>
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button kind="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
        ) : null}
      </Row>
    </div>
  );
}
