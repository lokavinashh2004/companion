// Medicines: Companion only reminds. Add, edit times, or stop (stopping records the stop date; history stays).
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ConfirmSheet } from '@/components/me/common';
import s from '@/components/me/me.module.css';
import { MedEditor } from '@/components/me/MedEditor';
import { Button, Card, EmptyState, ErrorState, Loading, Muted, Page, Row } from '@/components/ui';
import type { Medication } from '@/lib/api';
import { hhmm, shortDate } from '@/lib/format';
import { useAddMed, useMeds, useUpdateMed } from '@/lib/queries';

const describe = (m: Medication) => (m.dose ? `${m.name} · ${m.dose}` : m.name);

export function Medications() {
  const { t } = useTranslation();
  const meds = useMeds();
  const add = useAddMed();
  const update = useUpdateMed();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [stopping, setStopping] = useState<Medication | null>(null);

  const list = meds.data?.medications ?? [];
  const active = list.filter((m) => m.active);
  const stopped = list.filter((m) => !m.active);

  return (
    <Page title={t('meds.title')}>
      <Card tone="calm">
        <Muted>{t('meds.note')}</Muted>
      </Card>

      {meds.isLoading ? <Loading /> : null}
      {meds.isError ? <ErrorState onRetry={() => void meds.refetch()} /> : null}
      {meds.data && active.length === 0 && !adding ? <EmptyState body={t('meds.empty')} /> : null}

      {active.length ? (
        <Card title={t('meds.active')}>
          <div>
            {active.map((m) =>
              editing === m.id ? (
                <div key={m.id} className={s.medRow}>
                  <h3 className={s.sectionTitle}>{t('mePage.meds.edit')}</h3>
                  <MedEditor
                    initial={{ name: m.name, dose: m.dose, schedule_times: m.schedule_times }}
                    submitLabel={t('common.save')}
                    busy={update.isPending}
                    failed={update.isError}
                    onCancel={() => setEditing(null)}
                    onSave={(v) => update.mutate({ id: m.id, ...v }, { onSuccess: () => setEditing(null) })}
                  />
                </div>
              ) : (
                <div key={m.id} className={s.medRow}>
                  <p className={s.medName}>{describe(m)}</p>
                  <Muted small>{m.schedule_times.length ? m.schedule_times.map(hhmm).join(', ') : t('mePage.meds.noTimes')}</Muted>
                  <Row>
                    <Button
                      small
                      kind="secondary"
                      onClick={() => {
                        update.reset();
                        setEditing(m.id);
                      }}
                    >
                      {t('common.edit')}
                    </Button>
                    <Button small kind="ghost" onClick={() => setStopping(m)}>
                      {t('meds.stop')}
                    </Button>
                  </Row>
                </div>
              ),
            )}
          </div>
        </Card>
      ) : null}

      {adding ? (
        <Card title={t('meds.add')}>
          <MedEditor
            submitLabel={t('common.add')}
            busy={add.isPending}
            failed={add.isError}
            onCancel={() => setAdding(false)}
            onSave={(v) => add.mutate(v, { onSuccess: () => setAdding(false) })}
          />
        </Card>
      ) : meds.data ? (
        <Row>
          <Button
            onClick={() => {
              add.reset();
              setAdding(true);
            }}
          >
            {t('meds.add')}
          </Button>
        </Row>
      ) : null}

      {stopped.length ? (
        <Card tone="alt">
          <details className={s.details}>
            <summary>{t('mePage.meds.stopped', { count: stopped.length })}</summary>
            <div>
              {stopped.map((m) => (
                <div key={m.id} className={s.medRow}>
                  <p className={s.medName}>{describe(m)}</p>
                  {m.end_date ? <Muted small>{t('mePage.meds.stoppedOn', { date: shortDate(m.end_date) })}</Muted> : null}
                </div>
              ))}
            </div>
          </details>
        </Card>
      ) : null}

      <ConfirmSheet
        open={!!stopping}
        title={t('mePage.meds.stopTitle', { name: stopping?.name ?? '' })}
        body={t('mePage.meds.stopBody')}
        confirmLabel={t('meds.stop')}
        busy={update.isPending}
        onClose={() => setStopping(null)}
        onConfirm={() => {
          if (stopping) update.mutate({ id: stopping.id, active: false }, { onSuccess: () => setStopping(null) });
        }}
      />
    </Page>
  );
}
