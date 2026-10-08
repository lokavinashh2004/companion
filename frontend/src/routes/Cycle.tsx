// Cycle: where you are, the predicted RANGE, calm insight cards, a month calendar to log periods, and history.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CycleCard } from '@/components/cycle/CycleCard';
import { EditPeriodSheet } from '@/components/cycle/EditPeriodSheet';
import { InsightCards } from '@/components/cycle/InsightCards';
import { MonthCalendar } from '@/components/cycle/MonthCalendar';
import { PeriodSheet } from '@/components/cycle/PeriodSheet';
import cs from '@/components/cycle/cycle.module.css';
import { Button, Card, cx, ErrorState, ListItem, Loading, Muted, Notice, Page, Row } from '@/components/ui';
import type { Period } from '@/lib/api';
import { shortDate } from '@/lib/format';
import { useCycle, useUpdatePeriod } from '@/lib/queries';
import s from './Cycle.module.css';

export function Cycle() {
  const { t } = useTranslation();
  const cycle = useCycle();
  const confirm = useUpdatePeriod();
  const [picked, setPicked] = useState<string | null>(null);
  const [editing, setEditing] = useState<Period | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const id = setTimeout(() => setSaved(false), 4000);
    return () => clearTimeout(id);
  }, [saved]);

  if (cycle.isLoading) {
    return (
      <Page title={t('cycle.title')}>
        <Loading />
      </Page>
    );
  }
  if (cycle.isError || !cycle.data) {
    return (
      <Page title={t('cycle.title')}>
        <ErrorState onRetry={() => void cycle.refetch()} />
      </Page>
    );
  }

  const { today, status, prediction, periods, insights } = cycle.data;
  const autoClosed = periods.filter((p) => p.auto_closed && p.end_date);

  return (
    <Page title={t('cycle.title')} wide>
      {saved ? <Notice>{t('cyclePage.saved')}</Notice> : null}
      <div className={s.grid}>
        <div className={s.col}>
          <CycleCard status={status} prediction={prediction} />
          <InsightCards insights={insights} />
          {autoClosed.map((p) => (
            <Card key={p.id} tone="alt">
              <p className={s.flat}>{t('cycle.autoClosed', { date: shortDate(p.end_date!) })}</p>
              <Row>
                <Button small busy={confirm.isPending && confirm.variables?.id === p.id} onClick={() => confirm.mutate({ id: p.id, auto_closed: false })}>
                  {t('common.yes')}
                </Button>
                <Button small kind="secondary" onClick={() => setEditing(p)}>
                  {t('cycle.autoClosedFix')}
                </Button>
              </Row>
            </Card>
          ))}
        </div>

        <div className={s.col}>
          <Card>
            <MonthCalendar today={today} periods={periods} prediction={prediction} onPick={setPicked} />
            <div className={cs.legend} aria-label={t('cyclePage.legend')} role="group">
              <span className={cs.legendItem}>
                <span className={cx(cs.swatch, cs.swatchPeriod)} aria-hidden="true" />
                {t('cycle.legendPeriod')}
              </span>
              <span className={cs.legendItem}>
                <span className={cx(cs.swatch, cs.swatchPredicted)} aria-hidden="true" />
                {t('cycle.legendPredicted')}
              </span>
              <span className={cs.legendItem}>
                <span className={cx(cs.swatch, cs.swatchToday)} aria-hidden="true" />
                {t('cyclePage.legendToday')}
              </span>
            </div>
            <Muted small>{t('cycle.tapDay')}</Muted>
          </Card>

          <Card title={t('cycle.history')}>
            {periods.length ? (
              <div className={cs.list}>
                {periods.map((p) => (
                  <ListItem
                    key={p.id}
                    onClick={() => setEditing(p)}
                    title={t('cyclePage.range', { start: shortDate(p.start_date), end: p.end_date ? shortDate(p.end_date) : t('cycle.ongoing') })}
                    subtitle={[
                      t('cycle.length', { count: p.length_days }),
                      p.flow ? t(`cycle.flows.${p.flow}`) : null,
                      p.cycle_length ? t('cycle.cycleLength', { count: p.cycle_length }) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  />
                ))}
              </div>
            ) : (
              <Muted>{t('cycle.historyEmpty')}</Muted>
            )}
          </Card>
        </div>
      </div>

      <Muted small>{t('common.disclaimer')}</Muted>

      <PeriodSheet
        day={picked}
        today={today}
        periods={periods}
        onClose={() => setPicked(null)}
        onSaved={() => {
          setPicked(null);
          setSaved(true);
        }}
      />
      <EditPeriodSheet
        period={editing}
        today={today}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          setSaved(true);
        }}
      />
    </Page>
  );
}
