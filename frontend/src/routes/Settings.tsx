// Settings: language, companion personality, privacy-friendly toggles, check-in times, theme and notifications.
// Every change saves straight away (PATCH /me) except the name and the times, which have their own Save.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import s from '@/components/me/me.module.css';
import { PushSettings } from '@/components/me/PushSettings';
import { Button, Card, ErrorState, Field, Loading, Muted, Notice, Page, Row, Segmented, Toggle } from '@/components/ui';
import { setUiLanguage, type UiLanguage } from '@/i18n';
import type { Profile, ProfilePatch } from '@/lib/api';
import { hhmm, isValidTime } from '@/lib/format';
import { useMe, useUpdateProfile } from '@/lib/queries';
import { useTheme, type ThemePref } from '@/lib/theme';

type TimeKey = 'morning_checkin' | 'evening_checkin' | 'quiet_start' | 'quiet_end';
const TIME_KEYS: TimeKey[] = ['morning_checkin', 'evening_checkin', 'quiet_start', 'quiet_end'];

export function Settings() {
  const { t } = useTranslation();
  const me = useMe();
  return (
    <Page title={t('settings.title')}>
      {me.isLoading ? <Loading /> : null}
      {me.isError ? <ErrorState onRetry={() => void me.refetch()} /> : null}
      {me.data ? <SettingsForm profile={me.data.profile} /> : null}
    </Page>
  );
}

function SettingsForm({ profile }: { profile: Profile }) {
  const { t, i18n } = useTranslation();
  const update = useUpdateProfile();
  const theme = useTheme();
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState(profile.companion_name);
  const [nameError, setNameError] = useState<string | null>(null);

  const [times, setTimes] = useState<Record<TimeKey, string>>(() => ({
    morning_checkin: hhmm(profile.morning_checkin),
    evening_checkin: hhmm(profile.evening_checkin),
    quiet_start: hhmm(profile.quiet_start),
    quiet_end: hhmm(profile.quiet_end),
  }));
  const [timeErrors, setTimeErrors] = useState<Partial<Record<TimeKey, boolean>>>({});

  const save = (patch: ProfilePatch) => {
    setSaved(false);
    update.mutate(patch, { onSuccess: () => setSaved(true) });
  };

  const changeLanguage = (v: UiLanguage) => {
    void setUiLanguage(v);
    save({ ui_language: v });
  };

  const saveName = () => {
    const v = name.trim();
    if (v === profile.companion_name) return;
    if (v.length < 1 || v.length > 30) {
      setNameError(t('mePage.nameInvalid'));
      return;
    }
    setNameError(null);
    save({ companion_name: v });
  };

  const saveTimes = () => {
    const errs: Partial<Record<TimeKey, boolean>> = {};
    for (const k of TIME_KEYS) if (!isValidTime(times[k].trim())) errs[k] = true;
    setTimeErrors(errs);
    if (Object.keys(errs).length) return;
    save(Object.fromEntries(TIME_KEYS.map((k) => [k, times[k].trim()])) as ProfilePatch);
  };

  const timeField = (k: TimeKey, label: string) => (
    <Field
      label={label}
      value={times[k]}
      inputMode="numeric"
      placeholder="08:30"
      maxLength={5}
      autoComplete="off"
      error={timeErrors[k] ? t('settings.invalidTime') : null}
      onChange={(e) => setTimes((o) => ({ ...o, [k]: e.target.value }))}
    />
  );

  return (
    <>
      {saved ? <Notice>{t('settings.saved')}</Notice> : null}
      {update.isError ? <Notice tone="warn">{t('common.error')}</Notice> : null}

      <Card title={t('settings.appLanguage')}>
        <Segmented<UiLanguage>
          label={t('settings.appLanguage')}
          value={i18n.language === 'ta' ? 'ta' : 'en'}
          onChange={changeLanguage}
          options={[
            { value: 'en', label: t('settings.english') },
            { value: 'ta', label: t('settings.tamil') },
          ]}
        />
      </Card>

      <Card title={t('settings.companionName')}>
        <Field
          label={t('settings.companionName')}
          value={name}
          maxLength={30}
          error={nameError}
          placeholder={t('onboarding.companionNamePlaceholder')}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveName();
          }}
        />
        <Row>
          <Button kind="secondary" small onClick={saveName}>
            {t('mePage.saveName')}
          </Button>
        </Row>

        <div className={s.section}>
          <h3 className={s.sectionTitle}>{t('settings.replyLanguage')}</h3>
          <Segmented<Profile['display_language']>
            label={t('settings.replyLanguage')}
            value={profile.display_language}
            onChange={(v) => save({ display_language: v })}
            options={[
              { value: 'auto', label: t('onboarding.replyAuto') },
              { value: 'en', label: t('onboarding.replyEn') },
              { value: 'ta', label: t('onboarding.replyTa') },
              { value: 'tanglish', label: t('onboarding.replyTanglish') },
            ]}
          />
        </div>

        <div className={s.section}>
          <h3 className={s.sectionTitle}>{t('settings.persona')}</h3>
          <Segmented<Profile['persona_tone']>
            label={t('settings.persona')}
            value={profile.persona_tone}
            onChange={(v) => save({ persona_tone: v })}
            options={[
              { value: 'bestie', label: t('persona.bestie') },
              { value: 'calm', label: t('persona.calm') },
              { value: 'coach', label: t('persona.coach') },
            ]}
          />
          <Muted small>{t(`persona.${profile.persona_tone}Desc`)}</Muted>
        </div>

        <div className={s.section}>
          <h3 className={s.sectionTitle}>{t('settings.addressForm')}</h3>
          <Segmented<Profile['tamil_address_form']>
            label={t('settings.addressForm')}
            value={profile.tamil_address_form}
            onChange={(v) => save({ tamil_address_form: v })}
            options={[
              { value: 'casual', label: t('onboarding.addressCasual') },
              { value: 'respectful', label: t('onboarding.addressRespectful') },
            ]}
          />
        </div>
      </Card>

      <Card>
        <Toggle label={t('settings.calories')} hint={t('onboarding.caloriesHint')} checked={profile.calorie_display === 'show'} onChange={(v) => save({ calorie_display: v ? 'show' : 'hide' })} />
        <Toggle label={t('settings.waterNudges')} checked={profile.water_nudges} onChange={(v) => save({ water_nudges: v })} />
        <Toggle label={t('settings.weightTracking')} hint={t('settings.weightHint')} checked={profile.weight_tracking} onChange={(v) => save({ weight_tracking: v })} />
      </Card>

      <Card title={t('settings.checkins')}>
        <div className={s.timeGrid}>
          {timeField('morning_checkin', t('settings.morning'))}
          {timeField('evening_checkin', t('settings.evening'))}
        </div>
        <h3 className={s.sectionTitle}>{t('settings.quietHours')}</h3>
        <div className={s.timeGrid}>
          {timeField('quiet_start', t('settings.quietStart'))}
          {timeField('quiet_end', t('settings.quietEnd'))}
        </div>
        <Muted small>{t('settings.timeFormatHint')}</Muted>
        <Row>
          <Button busy={update.isPending && update.variables?.morning_checkin !== undefined} onClick={saveTimes}>
            {t('mePage.saveTimes')}
          </Button>
        </Row>
      </Card>

      <PushSettings />

      <Card title={t('settings.theme')}>
        <Segmented<ThemePref>
          label={t('settings.theme')}
          value={theme.pref}
          onChange={theme.set}
          options={[
            { value: 'system', label: t('settings.themeSystem') },
            { value: 'light', label: t('settings.themeLight') },
            { value: 'dark', label: t('settings.themeDark') },
          ]}
        />
      </Card>
    </>
  );
}
