// Food screen calories: today against her daily guide (with what's left, per meal), and this week or this month
// as a daily chart with the guide as a dashed line. When calories are off, offers to turn them on instead.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BarChart } from '@/components/Charts';
import { Button, Card, cx, Field, Muted, Row, Segmented, Sheet } from '@/components/ui';
import type { Calories } from '@/lib/api';
import { shortDate } from '@/lib/format';
import { useCalories, useUpdateProfile } from '@/lib/queries';
import s from './food.module.css';

type Range = 'week' | 'month';

export function CaloriesCard() {
  const { t } = useTranslation();
  const q = useCalories();
  const update = useUpdateProfile();
  const c = q.data;
  if (!c) return null;

  if (c.hidden) {
    return (
      <Card title={t('food.calories')} icon="🔥" tint="amber">
        <Muted>{t('food.caloriesOff')}</Muted>
        <div>
          <Button kind="secondary" small busy={update.isPending} onClick={() => update.mutate({ calorie_display: 'show' })}>
            {t('food.showCalories')}
          </Button>
        </div>
      </Card>
    );
  }
  return (
    <>
      <TodayCalories c={c} />
      <CalorieTrend c={c} />
    </>
  );
}

function TodayCalories({ c }: { c: Calories }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const today = c.today!;
  const left = c.target - today.kcal;
  const over = left < 0;
  return (
    <Card title={t('food.today')} icon="🔥" tint="amber">
      <div className={s.today}>
        <p className={s.amount}>
          <strong>{today.kcal.toLocaleString()}</strong> {t('food.ofGuide', { target: c.target.toLocaleString() })}
        </p>
        <div className={s.track} role="progressbar" aria-label={t('food.todayLabel')} aria-valuemin={0} aria-valuemax={c.target} aria-valuenow={Math.min(today.kcal, c.target)}>
          <span className={cx(s.fill, over && s.over)} style={{ width: `${Math.min(100, Math.round((today.kcal / c.target) * 100))}%` }} />
        </div>
        <p className={s.left}>{over ? t('food.over', { n: (-left).toLocaleString() }) : t('food.left', { n: left.toLocaleString() })}</p>
        {today.by_meal.length ? (
          <ul className={s.meals} aria-label={t('food.byMeal')}>
            {today.by_meal.map((m) => (
              <li key={m.meal}>
                {t(`meals.${m.meal}`)} <strong>{m.kcal.toLocaleString()}</strong>
              </li>
            ))}
          </ul>
        ) : null}
        {today.unknown_items ? <Muted small>{t('food.unknownItems', { count: today.unknown_items })}</Muted> : null}
        <div className={s.guide}>
          <Muted small>{c.target_is_default ? t('food.guideDefault', { n: c.target.toLocaleString() }) : t('food.guideOwn', { n: c.target.toLocaleString() })}</Muted>
          <Button kind="ghost" small onClick={() => setEditing(true)}>
            {t('food.editGuide')}
          </Button>
        </div>
      </div>
      {editing ? <GuideSheet open current={c.target_is_default ? null : c.target} onClose={() => setEditing(false)} /> : null}
    </Card>
  );
}

function GuideSheet({ open, current, onClose }: { open: boolean; current: number | null; onClose: () => void }) {
  const { t } = useTranslation();
  const update = useUpdateProfile();
  const [value, setValue] = useState(current ? String(current) : '');
  const [error, setError] = useState<string | null>(null);
  const save = (target: number | null) => update.mutate({ calorie_target: target }, { onSuccess: onClose });
  return (
    <Sheet open={open} onClose={onClose} title={t('food.guideTitle')}>
      <Field
        label={t('food.guideLabel')}
        hint={t('food.guideHint')}
        error={error}
        type="number"
        inputMode="numeric"
        min={1000}
        max={4000}
        step={50}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <Row>
        <Button
          busy={update.isPending}
          onClick={() => {
            const n = Math.round(Number(value));
            if (!value || !Number.isFinite(n) || n < 1000 || n > 4000) return setError(t('food.guideInvalid'));
            setError(null);
            save(n);
          }}
        >
          {t('common.save')}
        </Button>
        <Button kind="ghost" disabled={update.isPending} onClick={() => save(null)}>
          {t('food.useDefault')}
        </Button>
      </Row>
    </Sheet>
  );
}

function CalorieTrend({ c }: { c: Calories }) {
  const { t, i18n } = useTranslation();
  const [range, setRange] = useState<Range>('week');
  const period = range === 'week' ? c.week! : c.month!;
  const weekday = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(i18n.language, { weekday: 'short', timeZone: 'UTC' });
  const data = period.days.map((d) => ({ label: range === 'week' ? weekday(d.day) : String(Number(d.day.slice(8))), value: d.kcal }));
  const overDays = period.days.filter((d) => d.kcal > c.target).length;
  const title = range === 'week' ? t('food.thisWeek') : t('food.thisMonth');
  return (
    <Card title={t('food.trend')} icon="📊" tint="violet">
      <Segmented<Range>
        label={t('food.range')}
        value={range}
        onChange={setRange}
        options={[
          { value: 'week', label: t('food.thisWeek') },
          { value: 'month', label: t('food.thisMonth') },
        ]}
      />
      {period.total > 0 ? (
        <BarChart title={`${title}: ${t('food.calories')}`} data={data} goal={c.target} color="var(--primary)" />
      ) : (
        <Muted>{t('food.noFoodPeriod')}</Muted>
      )}
      <dl className={s.stats}>
        <div>
          <dt>{t('food.total')}</dt>
          <dd>{period.total.toLocaleString()}</dd>
        </div>
        <div>
          <dt>{t('food.average')}</dt>
          <dd>{period.average != null ? period.average.toLocaleString() : '–'}</dd>
        </div>
        <div>
          <dt>{t('food.overDays')}</dt>
          <dd>{overDays}</dd>
        </div>
      </dl>
      <Muted small>{t('food.trendNote', { from: shortDate(period.from), n: c.target.toLocaleString() })}</Muted>
    </Card>
  );
}
