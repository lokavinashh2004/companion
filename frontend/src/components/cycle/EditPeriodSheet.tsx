// Edit a logged period: set its end date (quick 3–7 day chips or a date field, never after today) or delete it.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Chip, Field, Muted, Notice, Row, Sheet } from '@/components/ui';
import type { Period } from '@/lib/api';
import { addDays, shortDate } from '@/lib/format';
import { useDeletePeriod, useUpdatePeriod } from '@/lib/queries';

const QUICK = [3, 4, 5, 6, 7];

export function EditPeriodSheet({ period, today, onClose, onSaved }: { period: Period | null; today: string; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  return (
    <Sheet open={!!period} onClose={onClose} title={t('cyclePage.editTitle')}>
      {period ? <EditBody key={period.id} period={period} today={today} onSaved={onSaved} /> : null}
    </Sheet>
  );
}

function EditBody({ period, today, onSaved }: { period: Period; today: string; onSaved: () => void }) {
  const { t } = useTranslation();
  const update = useUpdatePeriod();
  const del = useDeletePeriod();
  const [end, setEnd] = useState(period.end_date ?? '');
  const [confirming, setConfirming] = useState(false);
  const valid = !!end && end >= period.start_date && end <= today;

  return (
    <>
      <Muted>{t('cyclePage.range', { start: shortDate(period.start_date), end: period.end_date ? shortDate(period.end_date) : t('cycle.ongoing') })}</Muted>
      <Muted small>{t('cyclePage.lastedDays')}</Muted>
      <Row>
        {QUICK.map((n) => {
          const d = addDays(period.start_date, n - 1);
          if (d > today) return null;
          return <Chip key={n} label={t('common.days', { count: n })} selected={end === d} onClick={() => setEnd(d)} />;
        })}
      </Row>
      <Field label={t('cyclePage.endDate')} type="date" value={end} min={period.start_date} max={today} onChange={(e) => setEnd(e.target.value)} />
      <Button disabled={!valid || end === period.end_date} busy={update.isPending} onClick={() => update.mutate({ id: period.id, end_date: end }, { onSuccess: onSaved })}>
        {t('cyclePage.saveEnd')}
      </Button>
      {confirming ? (
        <>
          <Muted>{t('cycle.deletePeriod')}</Muted>
          <Row>
            <Button kind="danger" busy={del.isPending} onClick={() => del.mutate(period.id, { onSuccess: onSaved })}>
              {t('cyclePage.confirmDelete')}
            </Button>
            <Button kind="ghost" onClick={() => setConfirming(false)}>
              {t('common.cancel')}
            </Button>
          </Row>
        </>
      ) : (
        <Button kind="ghost" onClick={() => setConfirming(true)}>
          {t('common.delete')}
        </Button>
      )}
      {update.isError || del.isError ? <Notice tone="warn">{t('cyclePage.saveError')}</Notice> : null}
    </>
  );
}
