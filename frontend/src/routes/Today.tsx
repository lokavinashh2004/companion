// Today: cycle snapshot, food balance, water, mood & symptoms, medicines, weekly weight, and a quick log.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { CycleCard } from '@/components/cycle/CycleCard';
import { BalanceCard } from '@/components/today/BalanceCard';
import { MedsCard, MoodCard, WaterCard, WeightCard } from '@/components/today/DayCards';
import { QuickLogSheet } from '@/components/today/QuickLogSheet';
import { Button, ErrorState, Loading, Notice, Page } from '@/components/ui';
import { useToday } from '@/lib/queries';
import s from './Today.module.css';

export function Today() {
  const { t } = useTranslation();
  const today = useToday();
  const [quickOpen, setQuickOpen] = useState(false);
  const [logged, setLogged] = useState(false);

  useEffect(() => {
    if (!logged) return;
    const id = setTimeout(() => setLogged(false), 4000);
    return () => clearTimeout(id);
  }, [logged]);

  const actions = (
    <Button onClick={() => setQuickOpen(true)} disabled={!today.data}>
      ✏️ {t('today.quickLog')}
    </Button>
  );

  return (
    <Page title={t('today.title')} actions={actions} wide>
      {logged ? <Notice>{t('quickLog.saved')}</Notice> : null}
      {today.isLoading ? <Loading /> : null}
      {today.isError ? <ErrorState onRetry={() => void today.refetch()} /> : null}
      {today.data ? (
        <>
          <div className={s.grid}>
            <div className={s.col}>
              <CycleCard status={today.data.status} prediction={today.data.prediction} title={t('cycle.title')}>
                <Link className={s.link} to="/cycle">
                  {t('todayPage.openCycle')} ›
                </Link>
              </CycleCard>
              <BalanceCard today={today.data} />
            </div>
            <div className={s.col}>
              <WaterCard today={today.data} />
              <MoodCard today={today.data} />
              <MedsCard today={today.data} />
              <WeightCard today={today.data} />
            </div>
          </div>
          <Link className={s.link} to="/insights">
            📈 {t('todayPage.seeInsights')} ›
          </Link>
          <QuickLogSheet
            open={quickOpen}
            day={today.data.day}
            onClose={() => setQuickOpen(false)}
            onLogged={() => {
              setQuickOpen(false);
              setLogged(true);
            }}
          />
        </>
      ) : null}
    </Page>
  );
}
