// Today hub: a greeting, the one most useful nudge, then a tile per area (food, water, medicines, mood, walk,
// cycle, sleep & stress, weight when due). Each tile opens its own screen; built phone-first.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { Icon } from '@/components/Icon';
import { NudgeCard } from '@/components/today/NudgeCard';
import { QuickLogSheet } from '@/components/today/QuickLogSheet';
import { TodayTiles } from '@/components/today/TodayTiles';
import { Button, ErrorState, Loading, Notice, Page } from '@/components/ui';
import { weekdayDate } from '@/lib/format';
import { useMe, useToday } from '@/lib/queries';
import s from './Today.module.css';

function greetingKey(hour = new Date().getHours()) {
  if (hour >= 4 && hour < 12) return 'todayPage.greetMorning';
  if (hour >= 12 && hour < 17) return 'todayPage.greetAfternoon';
  return 'todayPage.greetEvening';
}

export function Today() {
  const { t } = useTranslation();
  const today = useToday();
  const me = useMe();
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
  const eyebrow = today.data ? (
    <>
      <span aria-hidden="true">📅</span> {weekdayDate(today.data.day)}
    </>
  ) : undefined;
  const subtitle = (
    <>
      {t('todayPage.tagline')} <span className={s.cheer}>{t('todayPage.cheer')}</span>
    </>
  );
  const companion = me.data?.profile.companion_name || t('common.appName');
  const yourName = me.data?.profile.display_name?.trim();
  const greeting = yourName ? t('todayPage.greetWithName', { greeting: t(greetingKey()), name: yourName }) : t(greetingKey());

  return (
    <Page title={`${greeting} ☀️`} eyebrow={eyebrow} subtitle={subtitle} actions={actions} wide hero>
      {logged ? <Notice>{t('quickLog.saved')}</Notice> : null}
      {today.isLoading ? <Loading /> : null}
      {today.isError ? <ErrorState onRetry={() => void today.refetch()} /> : null}
      {today.data ? (
        <div className={s.hub}>
          <NudgeCard today={today.data} />
          <TodayTiles today={today.data} />
          <Link className={s.ask} to="/">
            <span className={s.askMark} aria-hidden="true">
              <Icon name="sparkle" size={22} />
            </span>
            <span className={s.askText}>
              <span className={s.askTitle}>{t('todayPage.askTitle', { name: companion })}</span>
              <span className={s.askBody}>{t('todayPage.askBody')}</span>
            </span>
            <span className={s.askArrow} aria-hidden="true">
              <Icon name="send" size={18} />
            </span>
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
        </div>
      ) : null}
    </Page>
  );
}
