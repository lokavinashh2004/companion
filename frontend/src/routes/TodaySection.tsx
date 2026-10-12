// One area of Today on its own screen (/today/food, /today/water, /today/meds, /today/mood, /today/weight),
// opened from a hub tile. Each reuses the Today cards; the back link returns to the hub.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';

import { CaloriesCard } from '@/components/food/CaloriesCard';
import { MoodGames } from '@/components/mood/MoodGames';
import { ManualFoodSheet } from '@/components/food/ManualFoodSheet';
import { BalanceCard, MealsCard } from '@/components/today/BalanceCard';
import { MedsCard, MoodCard, WaterCard, WeightCard } from '@/components/today/DayCards';
import { QuickLogSheet } from '@/components/today/QuickLogSheet';
import s from '@/components/today/tiles.module.css';
import { Button, ErrorState, Loading, Muted, Notice, Page } from '@/components/ui';
import type { Today } from '@/lib/api';
import { weekdayDate } from '@/lib/format';
import { useToday } from '@/lib/queries';
import { NotFound } from './NotFound';

const SECTIONS = ['food', 'water', 'meds', 'mood', 'weight'] as const;
type Section = (typeof SECTIONS)[number];
const isSection = (x: string | undefined): x is Section => SECTIONS.includes(x as Section);

const TITLE: Record<Section, string> = {
  food: 'todayHub.food',
  water: 'today.water',
  meds: 'today.meds',
  mood: 'todayHub.mood',
  weight: 'todayHub.weight',
};

export function BackToToday() {
  const { t } = useTranslation();
  return (
    <Link className={s.back} to="/today">
      ‹ {t('todayHub.back')}
    </Link>
  );
}

export function TodaySection() {
  const { section } = useParams();
  if (!isSection(section)) return <NotFound />;
  return <SectionPage section={section} />;
}

function SectionPage({ section }: { section: Section }) {
  const { t } = useTranslation();
  const today = useToday();
  return (
    <Page title={t(TITLE[section])} eyebrow={<BackToToday />} subtitle={today.data ? weekdayDate(today.data.day) : undefined}>
      {today.isLoading ? <Loading /> : null}
      {today.isError ? <ErrorState onRetry={() => void today.refetch()} /> : null}
      {today.data ? (
        <div className={`${s.stack} ${s.enter}`}>
          <SectionBody section={section} today={today.data} />
        </div>
      ) : null}
    </Page>
  );
}

function SectionBody({ section, today }: { section: Section; today: Today }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [quickOpen, setQuickOpen] = useState(false);
  const [foodOpen, setFoodOpen] = useState(false);
  const [logged, setLogged] = useState(false);

  switch (section) {
    case 'food':
      return (
        <>
          {logged ? <Notice>{t('food.saved')}</Notice> : null}
          <Button onClick={() => setFoodOpen(true)}>＋ {t('food.logButton')}</Button>
          <CaloriesCard />
          <BalanceCard today={today} />
          <MealsCard today={today} />
          {today.foods.length ? (
            <Button kind="secondary" onClick={() => void navigate('/')}>
              💬 {t('todayHub.logFood')}
            </Button>
          ) : null}
          <ManualFoodSheet
            open={foodOpen}
            day={today.day}
            showKcal={today.calorie_display === 'show'}
            onClose={() => setFoodOpen(false)}
            onSaved={() => {
              setFoodOpen(false);
              setLogged(true);
            }}
          />
        </>
      );
    case 'water':
      return (
        <>
          <WaterCard today={today} />
          <Muted small>{t('todayHub.waterHint')}</Muted>
        </>
      );
    case 'meds':
      return (
        <>
          <MedsCard today={today} />
          {today.meds.length ? (
            <Link className={s.back} to="/me/medications">
              {t('todayHub.manageMeds')} ›
            </Link>
          ) : null}
        </>
      );
    case 'mood':
      return (
        <>
          {logged ? <Notice>{t('quickLog.saved')}</Notice> : null}
          <MoodCard today={today} />
          <Button kind="secondary" onClick={() => setQuickOpen(true)}>
            ✏️ {t('todayHub.moreCheckIn')}
          </Button>
          <MoodGames day={today.day} />
          <QuickLogSheet
            open={quickOpen}
            day={today.day}
            onClose={() => setQuickOpen(false)}
            onLogged={() => {
              setQuickOpen(false);
              setLogged(true);
            }}
          />
        </>
      );
    case 'weight':
      return today.weight_due ? <WeightCard today={today} /> : <Muted>{t('todayHub.weightNotDue')}</Muted>;
  }
}
