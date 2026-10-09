// First-run setup in small, skippable steps. Everything stays in memory until she taps "Let's start".
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { MonthPicker } from '@/components/chat/MonthPicker';
import { Button, Card, cx, Field, IconButton, Muted, Notice, Page, Segmented, Stepper } from '@/components/ui';
import { setUiLanguage, type UiLanguage } from '@/i18n';
import type { Onboarding as OnboardingBody } from '@/lib/api';
import { isValidTime, longDate, todayIn, uuid } from '@/lib/format';
import { enablePush, isIos, type PushState } from '@/lib/push';
import { useOnboarding } from '@/lib/queries';
import s from './Onboarding.module.css';

type Profile = OnboardingBody['profile'];
type ReplyLanguage = NonNullable<Profile['display_language']>;
type Persona = NonNullable<Profile['persona_tone']>;
type AddressForm = NonNullable<Profile['tamil_address_form']>;
type Calories = NonNullable<Profile['calorie_display']>;
type MedDraft = { key: string; name: string; dose: string; times: string[] };

const TOTAL = 8;
const PERSONAS: Persona[] = ['bestie', 'calm', 'coach'];

export function Onboarding() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const onboarding = useOnboarding();

  const [step, setStep] = useState(1);
  const [replyLanguage, setReplyLanguage] = useState<ReplyLanguage>('auto');
  const [companionName, setCompanionName] = useState('');
  const [yourName, setYourName] = useState('');
  const [persona, setPersona] = useState<Persona>('bestie');
  const [addressForm, setAddressForm] = useState<AddressForm>('casual');
  const [calories, setCalories] = useState<Calories>('hide');
  const [lastPeriod, setLastPeriod] = useState<string | null>(null);
  const [cycleLength, setCycleLength] = useState<number | null>(30);
  const [meds, setMeds] = useState<MedDraft[]>([]);
  const [morning, setMorning] = useState('08:30');
  const [evening, setEvening] = useState('21:00');
  const [push, setPush] = useState<PushState | 'working' | null>(null);

  const uiLanguage: UiLanguage = i18n.language === 'ta' ? 'ta' : 'en';
  const today = todayIn();
  const timesOk = isValidTime(morning) && isValidTime(evening);
  const medsOk = meds.every((m) => m.times.every(isValidTime));
  const canNext = (step !== 6 || timesOk) && (step !== 5 || medsOk);

  const updateMed = (key: string, patch: Partial<MedDraft>) => setMeds((list) => list.map((m) => (m.key === key ? { ...m, ...patch } : m)));

  const allowNotifications = async () => {
    setPush('working');
    try {
      setPush(await enablePush());
    } catch {
      setPush('unsupported');
    }
  };

  const finish = () => {
    onboarding.mutate(
      {
        profile: {
          display_language: replyLanguage,
          ui_language: uiLanguage,
          companion_name: companionName.trim() || t('onboarding.companionNamePlaceholder'),
          display_name: yourName.trim() || null,
          persona_tone: persona,
          tamil_address_form: addressForm,
          calorie_display: calories,
          typical_cycle_length: cycleLength,
          morning_checkin: morning,
          evening_checkin: evening,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
        },
        medications: meds
          .filter((m) => m.name.trim())
          .map((m) => ({ name: m.name.trim(), dose: m.dose.trim() || null, schedule_times: [...new Set(m.times)].sort() })),
        last_period_start: lastPeriod,
      },
      { onSuccess: () => void navigate('/', { replace: true }) },
    );
  };

  let content: ReactNode;
  switch (step) {
    case 1:
      content = (
        <Card title={t('onboarding.languageTitle')}>
          <Muted small>{t('onboarding.languageHint')}</Muted>
          <h3 className={s.label}>{t('onboarding.uiLanguage')}</h3>
          <Segmented<UiLanguage>
            label={t('onboarding.uiLanguage')}
            value={uiLanguage}
            onChange={(v) => void setUiLanguage(v)}
            options={[
              { value: 'en', label: t('settings.english') },
              { value: 'ta', label: t('settings.tamil') },
            ]}
          />
          <h3 className={s.label}>{t('onboarding.replyLanguage')}</h3>
          <Segmented<ReplyLanguage>
            label={t('onboarding.replyLanguage')}
            value={replyLanguage}
            onChange={setReplyLanguage}
            options={[
              { value: 'auto', label: t('onboarding.replyAuto') },
              { value: 'en', label: t('onboarding.replyEn') },
              { value: 'ta', label: t('onboarding.replyTa') },
              { value: 'tanglish', label: t('onboarding.replyTanglish') },
            ]}
          />
        </Card>
      );
      break;
    case 2:
      content = (
        <Card title={t('onboarding.companionTitle')}>
          <Field
            label={t('profileName.label')}
            hint={t('profileName.hint')}
            value={yourName}
            maxLength={30}
            autoComplete="given-name"
            onChange={(e) => setYourName(e.target.value)}
          />
          <Field
            label={t('onboarding.companionName')}
            placeholder={t('onboarding.companionNamePlaceholder')}
            value={companionName}
            maxLength={30}
            autoComplete="off"
            onChange={(e) => setCompanionName(e.target.value)}
          />
          <h3 className={s.label}>{t('onboarding.persona')}</h3>
          <div className={s.options} role="group" aria-label={t('onboarding.persona')}>
            {PERSONAS.map((p) => (
              <button key={p} type="button" className={cx(s.option, persona === p && s.optionSelected)} aria-pressed={persona === p} onClick={() => setPersona(p)}>
                <span className={s.optionTitle}>{t(`persona.${p}`)}</span>
                <span className={s.optionDesc}>{t(`persona.${p}Desc`)}</span>
              </button>
            ))}
          </div>
          <h3 className={s.label}>{t('onboarding.addressForm')}</h3>
          <Segmented<AddressForm>
            label={t('onboarding.addressForm')}
            value={addressForm}
            onChange={setAddressForm}
            options={[
              { value: 'casual', label: t('onboarding.addressCasual') },
              { value: 'respectful', label: t('onboarding.addressRespectful') },
            ]}
          />
        </Card>
      );
      break;
    case 3:
      content = (
        <Card title={t('onboarding.caloriesTitle')}>
          <h3 className={s.label}>{t('onboarding.caloriesQuestion')}</h3>
          <Segmented<Calories>
            label={t('onboarding.caloriesQuestion')}
            value={calories}
            onChange={setCalories}
            options={[
              { value: 'hide', label: t('onboarding.caloriesHide') },
              { value: 'show', label: t('onboarding.caloriesShow') },
            ]}
          />
          <Muted small>{t('onboarding.caloriesHint')}</Muted>
        </Card>
      );
      break;
    case 4:
      content = (
        <Card title={t('onboarding.cycleTitle')}>
          <h3 className={s.label}>{t('onboarding.lastPeriod')}</h3>
          <Muted small>{t('onboarding.lastPeriodHint')}</Muted>
          <MonthPicker label={t('onboarding.lastPeriod')} value={lastPeriod} onChange={setLastPeriod} max={today} />
          <div className={s.inline}>
            <span aria-live="polite">{lastPeriod ? t('onboardingPage.selectedDate', { date: longDate(lastPeriod) }) : t('onboardingPage.noDate')}</span>
            {lastPeriod ? (
              <Button kind="ghost" small onClick={() => setLastPeriod(null)}>
                {t('onboardingPage.notSureSkip')}
              </Button>
            ) : null}
          </div>
          <h3 className={s.label}>{t('onboarding.cycleLength')}</h3>
          {cycleLength === null ? (
            <div className={s.inline}>
              <span>{t('common.notSure')}</span>
              <Button kind="secondary" small onClick={() => setCycleLength(30)}>
                {t('onboardingPage.setLength')}
              </Button>
            </div>
          ) : (
            <>
              <Stepper
                label={t('onboarding.cycleLength')}
                value={cycleLength}
                onChange={setCycleLength}
                min={15}
                max={120}
                format={(v) => t('onboarding.cycleLengthDays', { count: v })}
              />
              <div>
                <Button kind="ghost" small onClick={() => setCycleLength(null)}>
                  {t('common.notSure')}
                </Button>
              </div>
            </>
          )}
        </Card>
      );
      break;
    case 5:
      content = (
        <Card title={t('onboarding.medsTitle')}>
          <Muted small>{t('onboarding.medsHint')}</Muted>
          {meds.map((m, n) => (
            <fieldset key={m.key} className={s.med}>
              <legend className={s.medLegend}>{m.name.trim() || t('onboardingPage.medNumber', { n: n + 1 })}</legend>
              <Field label={t('meds.name')} placeholder={t('meds.namePlaceholder')} value={m.name} maxLength={60} onChange={(e) => updateMed(m.key, { name: e.target.value })} />
              <Field label={t('meds.dose')} placeholder={t('meds.dosePlaceholder')} value={m.dose} maxLength={40} onChange={(e) => updateMed(m.key, { dose: e.target.value })} />
              <span className={s.label}>{t('meds.times')}</span>
              {m.times.map((time, i) => (
                <div key={i} className={s.timeRow}>
                  <Field
                    label={t('onboardingPage.timeNumber', { n: i + 1 })}
                    type="time"
                    value={time}
                    error={isValidTime(time) ? null : t('settings.invalidTime')}
                    onChange={(e) => updateMed(m.key, { times: m.times.map((x, j) => (j === i ? e.target.value : x)) })}
                  />
                  <IconButton label={t('a11y.removeItem', { name: time || String(i + 1) })} onClick={() => updateMed(m.key, { times: m.times.filter((_, j) => j !== i) })}>
                    ✕
                  </IconButton>
                </div>
              ))}
              <div className={s.inline}>
                <Button kind="secondary" small onClick={() => updateMed(m.key, { times: [...m.times, '08:00'] })}>
                  + {t('meds.addTime')}
                </Button>
                <Button kind="ghost" small onClick={() => setMeds((list) => list.filter((x) => x.key !== m.key))}>
                  {t('common.remove')}
                </Button>
              </div>
            </fieldset>
          ))}
          <div>
            <Button kind="secondary" onClick={() => setMeds((list) => [...list, { key: uuid(), name: '', dose: '', times: [] }])}>
              + {t('meds.add')}
            </Button>
          </div>
          <Muted small>{t('meds.note')}</Muted>
        </Card>
      );
      break;
    case 6:
      content = (
        <Card title={t('onboarding.checkinTitle')}>
          <Field
            label={t('onboarding.morning')}
            type="time"
            value={morning}
            hint={t('settings.timeFormatHint')}
            error={isValidTime(morning) ? null : t('settings.invalidTime')}
            onChange={(e) => setMorning(e.target.value)}
          />
          <Field
            label={t('onboarding.evening')}
            type="time"
            value={evening}
            hint={t('settings.timeFormatHint')}
            error={isValidTime(evening) ? null : t('settings.invalidTime')}
            onChange={(e) => setEvening(e.target.value)}
          />
          <Muted small>{t('onboarding.notificationsHint')}</Muted>
          <div>
            <Button kind="secondary" busy={push === 'working'} disabled={push === 'on'} onClick={() => void allowNotifications()}>
              🔔 {t('onboarding.notificationsAllow')}
            </Button>
          </div>
          {push && push !== 'working' ? (
            <Notice tone={push === 'denied' ? 'warn' : undefined}>
              {push === 'on' ? t('onboardingPage.pushOn') : null}
              {push === 'denied' ? t('onboardingPage.pushDenied') : null}
              {push === 'off' ? t('onboardingPage.pushOff') : null}
              {push === 'unsupported' ? t('onboardingPage.pushUnsupported') : null}
              {push === 'not-configured' ? t('onboardingPage.pushNotConfigured') : null}
              {push === 'needs-install' ? (
                <>
                  {t('onboardingPage.pushNeedsInstall')}
                  <ol className={s.steps}>
                    <li>{t('onboardingPage.iosStep1')}</li>
                    <li>{t('onboardingPage.iosStep2')}</li>
                    <li>{t('onboardingPage.iosStep3')}</li>
                  </ol>
                </>
              ) : null}
            </Notice>
          ) : null}
        </Card>
      );
      break;
    case 7:
      content = (
        <Card title={t('onboardingPage.installTitle')}>
          <Muted>{t('onboardingPage.installBody')}</Muted>
          <div className={cx(s.platforms, isIos() && s.iosFirst)}>
            <div className={s.platform}>
              <h3 className={s.label}>{t('onboardingPage.androidTitle')}</h3>
              <ol className={s.steps}>
                <li>{t('onboardingPage.androidStep1')}</li>
                <li>{t('onboardingPage.androidStep2')}</li>
              </ol>
            </div>
            <div className={cx(s.platform, s.ios)}>
              <h3 className={s.label}>{t('onboardingPage.iosTitle')}</h3>
              <ol className={s.steps}>
                <li>{t('onboardingPage.iosStep1')}</li>
                <li>{t('onboardingPage.iosStep2')}</li>
                <li>{t('onboardingPage.iosStep3')}</li>
              </ol>
            </div>
          </div>
        </Card>
      );
      break;
    default:
      content = (
        <Card title={t('onboarding.privacyTitle')}>
          <Muted>{t('onboarding.privacyBody')}</Muted>
          <Muted small>{t('common.disclaimer')}</Muted>
        </Card>
      );
  }

  return (
    <Page>
      <div className={s.top}>
        <span className={s.brand}>🌸 {t('common.appName')}</span>
        <span className={s.stepText}>{t('onboarding.step', { current: step, total: TOTAL })}</span>
      </div>
      <div className={s.progress} aria-hidden="true">
        <span style={{ width: `${(step / TOTAL) * 100}%` }} />
      </div>

      {content}

      {onboarding.isError ? <Notice tone="warn">{t('common.error')}</Notice> : null}

      <div className={s.nav}>
        {step > 1 ? (
          <Button kind="ghost" onClick={() => setStep((n) => n - 1)}>
            {t('common.back')}
          </Button>
        ) : (
          <span />
        )}
        {step < TOTAL ? (
          <Button disabled={!canNext} onClick={() => setStep((n) => n + 1)}>
            {t('common.next')}
          </Button>
        ) : (
          <Button busy={onboarding.isPending} onClick={finish}>
            {t('onboarding.finish')}
          </Button>
        )}
      </div>
    </Page>
  );
}
