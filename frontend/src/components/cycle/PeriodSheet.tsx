// Sheet for a tapped calendar day: log a period start (flow + pain) or end the ongoing period.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Muted, Notice, Segmented, Sheet, Stepper } from '@/components/ui';
import type { Period } from '@/lib/api';
import { longDate, shortDate } from '@/lib/format';
import { useLogPeriod } from '@/lib/queries';
import { FLOWS, type Flow } from './periods';

export function PeriodSheet({ day, today, periods, onClose, onSaved }: { day: string | null; today: string; periods: Period[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const log = useLogPeriod();
  const [flow, setFlow] = useState<Flow>('medium');
  const [pain, setPain] = useState(0);

  const open = periods.find((p) => !p.end_date);
  const inside = day ? periods.find((p) => p.end_date && day >= p.start_date && day <= p.end_date) : undefined;
  const canEnd = !!day && !!open && day >= open.start_date;

  const submit = (kind: 'start' | 'end') => {
    if (!day) return;
    log.mutate(kind === 'start' ? { kind, date: day, flow, pain } : { kind, date: day }, {
      onSuccess: () => {
        setFlow('medium');
        setPain(0);
        onSaved();
      },
    });
  };

  return (
    <Sheet
      open={!!day}
      onClose={() => {
        log.reset();
        onClose();
      }}
      title={day ? longDate(day) : ''}
    >
      {day && day > today ? null : canEnd && open ? (
        <>
          <Muted>{t('cyclePage.endHint', { date: shortDate(open.start_date) })}</Muted>
          <Button busy={log.isPending} onClick={() => submit('end')}>
            {t('cycle.logEnd')}
          </Button>
        </>
      ) : inside ? (
        <Muted>{t('cycle.notDuringPeriod')}</Muted>
      ) : (
        <>
          <Muted small>{t('cyclePage.startHint')}</Muted>
          <Muted small>{t('cycle.flow')}</Muted>
          <Segmented<Flow> label={t('cycle.flow')} value={flow} onChange={setFlow} options={FLOWS.map((f) => ({ value: f, label: t(`cycle.flows.${f}`) }))} />
          <Stepper label={t('cycle.pain')} value={pain} onChange={setPain} min={0} max={10} />
          <Button busy={log.isPending} onClick={() => submit('start')}>
            {t('cycle.logStart')}
          </Button>
        </>
      )}
      {log.isError ? <Notice tone="warn">{t('cyclePage.saveError')}</Notice> : null}
    </Sheet>
  );
}
