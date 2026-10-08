// Lab results from her reports. We only say "within / outside the range on your report" — never interpret.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { LineChart } from '@/components/Charts';
import { ConfirmSheet, FormError } from '@/components/me/common';
import s from '@/components/me/me.module.css';
import { Button, Card, Chip, cx, EmptyState, ErrorState, Field, IconButton, Loading, Muted, Page, Row } from '@/components/ui';
import type { Lab, LabInput } from '@/lib/api';
import { shortDate, todayIn } from '@/lib/format';
import { useAddLab, useDeleteLab, useLabs, useMe } from '@/lib/queries';

type TestName = Lab['test_name'];
const TESTS: TestName[] = ['testosterone', 'AMH', 'LH', 'FSH', 'fasting_insulin', 'HbA1c', 'TSH', 'vitamin_D', 'other'];

export function Labs() {
  const { t } = useTranslation();
  const me = useMe();
  const labs = useLabs();
  const del = useDeleteLab();
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState<Lab | null>(null);
  const today = todayIn(me.data?.profile.timezone);

  const label = (l: Pick<Lab, 'test_name' | 'test_label'>) => (l.test_name === 'other' && l.test_label ? l.test_label : t(`labs.names.${l.test_name}`));

  const groups = new Map<string, Lab[]>();
  for (const l of labs.data?.labs ?? []) {
    const key = l.test_name === 'other' ? `other:${(l.test_label ?? '').toLowerCase()}` : l.test_name;
    groups.set(key, [...(groups.get(key) ?? []), l]);
  }

  return (
    <Page title={t('labs.title')}>
      {labs.isLoading ? <Loading /> : null}
      {labs.isError ? <ErrorState onRetry={() => void labs.refetch()} /> : null}

      {adding ? (
        <AddLab today={today} onDone={() => setAdding(false)} />
      ) : labs.data ? (
        <Row>
          <Button onClick={() => setAdding(true)}>{t('labs.add')}</Button>
        </Row>
      ) : null}

      {labs.data && groups.size === 0 && !adding ? <EmptyState body={t('labs.empty')} /> : null}

      {[...groups.entries()].map(([key, items]) => {
        const asc = [...items].sort((a, b) => a.test_date.localeCompare(b.test_date));
        const name = label(asc[0]!);
        return (
          <Card key={key} title={name}>
            {asc.length >= 2 ? <LineChart title={t('mePage.labs.trend', { name })} data={asc.map((l) => ({ label: shortDate(l.test_date), value: l.value }))} /> : null}
            <div>
              {[...asc].reverse().map((l) => (
                <div key={l.id} className={s.resultRow}>
                  <div className={s.resultMain}>
                    <span>
                      {shortDate(l.test_date)} · <span className={s.value}>{l.value}</span>
                      {l.unit ? ` ${l.unit}` : ''}
                    </span>
                    {l.reference_range ? <Muted small>{l.reference_range}</Muted> : null}
                  </div>
                  {l.within_range === true ? <span className={cx(s.badge, s.badgeWithin)}>{t('labs.within')}</span> : null}
                  {l.within_range === false ? <span className={cx(s.badge, s.badgeOutside)}>{t('labs.outside')}</span> : null}
                  <IconButton label={`${t('common.delete')} · ${name} · ${shortDate(l.test_date)}`} onClick={() => setConfirm(l)}>
                    🗑
                  </IconButton>
                </div>
              ))}
            </div>
          </Card>
        );
      })}

      {labs.data && groups.size ? (
        <Link to="/insights">{t('mePage.labs.insightsLink')}</Link>
      ) : null}
      <Muted small>{t('common.disclaimer')}</Muted>

      <ConfirmSheet
        open={!!confirm}
        title={t('mePage.labs.deleteConfirm')}
        body={confirm ? `${label(confirm)} · ${shortDate(confirm.test_date)} · ${confirm.value}${confirm.unit ? ` ${confirm.unit}` : ''}` : undefined}
        confirmLabel={t('common.delete')}
        busy={del.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) del.mutate(confirm.id, { onSuccess: () => setConfirm(null) });
        }}
      />
    </Page>
  );
}

function AddLab({ today, onDone }: { today: string; onDone: () => void }) {
  const { t } = useTranslation();
  const add = useAddLab();
  const [test, setTest] = useState<TestName>('testosterone');
  const [custom, setCustom] = useState('');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('');
  const [range, setRange] = useState('');
  const [date, setDate] = useState(today);
  const [errors, setErrors] = useState<{ custom?: string; value?: string; date?: string }>({});

  const submit = () => {
    const num = Number(value.trim().replace(',', '.'));
    const errs: typeof errors = {};
    if (test === 'other' && !custom.trim()) errs.custom = t('mePage.labs.customRequired');
    if (!value.trim() || !Number.isFinite(num)) errs.value = t('mePage.labs.valueInvalid');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) errs.date = t('mePage.labs.dateInvalid');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const body: LabInput = {
      test_name: test,
      test_label: test === 'other' ? custom.trim().slice(0, 60) : null,
      value: num,
      unit: unit.trim() ? unit.trim().slice(0, 20) : null,
      reference_range: range.trim() ? range.trim().slice(0, 40) : null,
      test_date: date,
    };
    add.mutate(body, { onSuccess: onDone });
  };

  return (
    <Card title={t('labs.add')}>
      <div className={s.stack} role="group" aria-label={t('labs.test')}>
        <span>{t('labs.test')}</span>
        <Row>
          {TESTS.map((n) => (
            <Chip key={n} label={t(`labs.names.${n}`)} selected={test === n} onClick={() => setTest(n)} />
          ))}
        </Row>
      </div>
      {test === 'other' ? <Field label={t('labs.customName')} value={custom} maxLength={60} error={errors.custom} onChange={(e) => setCustom(e.target.value)} /> : null}
      <div className={s.timeGrid}>
        <Field label={t('labs.value')} value={value} inputMode="decimal" error={errors.value} onChange={(e) => setValue(e.target.value)} />
        <Field label={t('labs.unit')} value={unit} maxLength={20} hint={t('common.optional')} onChange={(e) => setUnit(e.target.value)} />
      </div>
      <Field label={t('labs.range')} value={range} maxLength={40} hint={t('labs.rangeHint')} onChange={(e) => setRange(e.target.value)} />
      <Field label={t('labs.date')} type="date" value={date} max={today} error={errors.date} onChange={(e) => setDate(e.target.value)} />
      {add.isError ? <FormError>{t('common.error')}</FormError> : null}
      <Row>
        <Button busy={add.isPending} onClick={submit}>
          {t('common.save')}
        </Button>
        <Button kind="ghost" onClick={onDone}>
          {t('common.cancel')}
        </Button>
      </Row>
    </Card>
  );
}
