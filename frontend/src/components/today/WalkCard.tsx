// Walk session card (top of the Walking page): pick a walk length → Start → live steps and a countdown (a bell rings
// when the time is up; the walk carries on until Stop) → saved summary with steps, duration, calories and a cheer.
// Before a walk it shows today's steps towards the goal and the goal streak.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Card, Chip, Field, Muted, Notice, Row } from '@/components/ui';
import { StepProgress } from '@/components/walks/StepProgress';
import w from '@/components/walks/walks.module.css';
import { useSaveWalk, useWalks } from '@/lib/queries';
import { clock, DEFAULT_WEIGHT_KG, MAX_WALK_MINUTES, useWalk, WALK_MINUTES, walkCheerKey, walkKcal, type WalkSummary } from '@/lib/walk';
import s from './today.module.css';

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

export function WalkCard({ showKcal }: { showKcal: boolean }) {
  const { t } = useTranslation();
  const { status, startedAt, steps, summary, start, stop, reset, goalMinutes, bellRang, preferredMinutes } = useWalk();
  const walks = useWalks(7);
  const save = useSaveWalk();
  const walking = status === 'walking';
  const now = useNow(walking);
  const weightKg = walks.data?.weight_kg ?? DEFAULT_WEIGHT_KG;
  const todaySteps = walks.data?.days.find((d) => d.day === walks.data?.today)?.steps;

  const persist = (w: WalkSummary) =>
    save.mutate({ client_id: w.clientId, started_at: new Date(w.startedAt).toISOString(), duration_s: Math.round(w.durationMs / 1000), steps: w.steps });
  const onStop = () => {
    const w = stop();
    if (w) persist(w);
  };
  const onStart = () => {
    save.reset();
    void start(preferredMinutes);
  };
  const goalMs = goalMinutes != null && startedAt != null ? goalMinutes * 60_000 : null;
  const elapsed = now - (startedAt ?? now);
  const streak = walks.data?.streak ?? 0;

  return (
    <Card title={t('walk.title')} icon="🚶‍♀️" tint="peach">
      {walking ? (
        <>
          <div className={s.walkStats} aria-live="polite">
            <p className={s.glassCount}>
              <span className={s.big}>{steps.toLocaleString()}</span> {t('walk.stepsUnit')}
            </p>
            <p className={s.glassCount}>
              <span className={s.big}>{goalMs != null && !bellRang ? clock(goalMs - elapsed) : clock(elapsed)}</span>
              {goalMs != null && !bellRang ? t('walk.left') : null}
            </p>
          </div>
          {goalMs != null && !bellRang ? (
            <div className={w.track} role="progressbar" aria-label={t('walk.timeProgress', { count: goalMinutes! })} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round((elapsed / goalMs) * 100))}>
              <div className={w.fill} style={{ width: `${Math.min(100, (elapsed / goalMs) * 100)}%` }} />
            </div>
          ) : null}
          {bellRang ? <Notice>🔔 {t('walk.bellNotice', { count: goalMinutes! })}</Notice> : null}
          <Muted small>{t('walk.keepOpen')}</Muted>
          <Button kind="secondary" onClick={onStop}>
            ⏹ {t('walk.stop')}
          </Button>
        </>
      ) : status === 'done' && summary ? (
        <>
          <Notice>{t(walkCheerKey(summary.steps))}</Notice>
          <dl className={s.walkSummary}>
            <div>
              <dt>{t('walk.totalSteps')}</dt>
              <dd>{summary.steps.toLocaleString()}</dd>
            </div>
            <div>
              <dt>{t('walk.duration')}</dt>
              <dd>{clock(summary.durationMs)}</dd>
            </div>
            {summary.goalMinutes != null ? (
              <div>
                <dt>{t('walk.goal')}</dt>
                <dd>
                  {summary.durationMs >= summary.goalMinutes * 60_000
                    ? t('walk.goalMet', { count: summary.goalMinutes })
                    : t('walk.goalPart', { done: Math.floor(summary.durationMs / 60_000), count: summary.goalMinutes })}
                </dd>
              </div>
            ) : null}
            {showKcal ? (
              <div>
                <dt>{t('walk.calories')}</dt>
                <dd>{t('walk.kcal', { value: walkKcal(summary.steps, weightKg) })}</dd>
              </div>
            ) : null}
          </dl>
          {showKcal ? <Muted small>{t('walk.kcalNote', { kg: weightKg })}</Muted> : null}
          {save.isPending ? <Muted small>{t('walk.saving')}</Muted> : null}
          {save.isSuccess ? <Muted small>{t('walk.saved')}</Muted> : null}
          {save.isError ? (
            <Notice tone="warn">
              {t('walk.saveFailed')}{' '}
              <Button kind="ghost" small onClick={() => persist(summary)}>
                {t('common.retry')}
              </Button>
            </Notice>
          ) : null}
          <Button onClick={onStart} disabled={save.isPending}>
            ▶ {t('walk.again')}
          </Button>
          <Button kind="ghost" small onClick={reset} disabled={save.isPending}>
            {t('common.close')}
          </Button>
        </>
      ) : (
        <>
          {status === 'denied' ? <Notice tone="warn">{t('walk.denied')}</Notice> : null}
          {status === 'unsupported' ? <Notice tone="warn">{t('walk.unsupported')}</Notice> : null}
          {walks.data && todaySteps != null ? (
            <StepProgress steps={todaySteps} goal={walks.data.goal} aside={streak > 0 ? <span className={w.streak}>🔥 {t('walks.streak', { count: streak })}</span> : null} />
          ) : (
            <Muted small>{t('walk.intro')}</Muted>
          )}
          <WalkLength />
          <Button busy={status === 'starting'} onClick={onStart}>
            ▶ {preferredMinutes ? t('walk.startFor', { count: preferredMinutes }) : t('walk.start')}
          </Button>
        </>
      )}
    </Card>
  );
}

/** How long she plans to walk: no timer, a quick pick, or her own number of minutes. Remembered for next time. */
function WalkLength() {
  const { t } = useTranslation();
  const minutes = useWalk((st) => st.preferredMinutes);
  const setMinutes = useWalk((st) => st.setPreferredMinutes);
  const custom = minutes != null && !(WALK_MINUTES as readonly number[]).includes(minutes);
  const [other, setOther] = useState(custom);
  const [text, setText] = useState(custom ? String(minutes) : '');
  const [error, setError] = useState<string | null>(null);
  const pick = (m: number | null) => {
    setOther(false);
    setMinutes(m);
  };
  return (
    <div className={w.length}>
      <Muted small>{t('walk.howLong')}</Muted>
      <Row>
        <Chip label={t('walk.noTimer')} selected={minutes == null && !other} onClick={() => pick(null)} />
        {WALK_MINUTES.map((m) => (
          <Chip key={m} label={t('walk.minutes', { count: m })} selected={minutes === m && !other} onClick={() => pick(m)} />
        ))}
        <Chip label={t('walk.other')} selected={other} onClick={() => setOther(true)} />
      </Row>
      {other ? (
        <div className={w.otherRow}>
          <Field
            label={t('walk.otherLabel', { max: MAX_WALK_MINUTES })}
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_WALK_MINUTES}
            error={error}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              const n = Number(e.target.value);
              if (Number.isInteger(n) && n >= 1 && n <= MAX_WALK_MINUTES) {
                setError(null);
                setMinutes(n);
              } else {
                setError(t('walk.otherInvalid', { max: MAX_WALK_MINUTES }));
              }
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
