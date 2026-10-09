import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation } from 'react-router';

import { Icon } from '@/components/Icon';
import { Button, Card, Field, Muted, Page, Row } from '@/components/ui';
import { setUiLanguage } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { firebaseConfigured, resetPassword, signInEmail, signInGoogle, signUpEmail } from '@/lib/firebase';
import s from './SignIn.module.css';

export function SignIn() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (user) return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/'} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim()) || password.length < 8) {
      setMessage(t('auth.invalid'));
      return;
    }
    setBusy(true);
    try {
      if (mode === 'in') await signInEmail(email.trim(), password);
      else await signUpEmail(email.trim(), password);
    } catch {
      setMessage(t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setMessage(null);
    try {
      await signInGoogle();
    } catch (e) {
      setMessage((e as { code?: string }).code === 'auth/popup-blocked' ? t('auth.popupBlocked') : t('common.error'));
    }
  };

  const forgot = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setMessage(t('auth.invalid'));
      return;
    }
    await resetPassword(email.trim()).catch(() => undefined);
    setMessage(t('auth.resetSent')); // same message either way: don't reveal whether the account exists
  };

  return (
    <Page>
      <Row>
        <span style={{ flex: 1 }} />
        <Button kind="ghost" onClick={() => setUiLanguage(i18n.language === 'ta' ? 'en' : 'ta')}>
          {i18n.language === 'ta' ? t('settings.english') : t('settings.tamil')}
        </Button>
      </Row>
      <span className={s.mark} aria-hidden="true">
        <Icon name="sparkle" size={30} />
      </span>
      <h1>{t('auth.title')}</h1>
      <Muted>{t('auth.subtitle')}</Muted>
      <Card>
        {!firebaseConfigured ?<Muted>{t('auth.notConfigured')}</Muted> : null}
        <Button kind="secondary" onClick={google} disabled={!firebaseConfigured}>
          {t('auth.google')}
        </Button>
        <Muted small>{t('auth.or')}</Muted>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label={t('auth.email')} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Field
            label={t('auth.password')}
            type="password"
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {message ? (
            <p role="status" aria-live="polite">
              {message}
            </p>
          ) : null}
          <Button type="submit" disabled={busy || !firebaseConfigured}>
            {mode === 'in' ? t('auth.signIn') : t('auth.signUp')}
          </Button>
        </form>
        <Row>
          <Button kind="ghost" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
            {mode === 'in' ? t('auth.switchToSignUp') : t('auth.switchToSignIn')}
          </Button>
          {mode === 'in' ? (
            <Button kind="ghost" onClick={forgot}>
              {t('auth.forgot')}
            </Button>
          ) : null}
        </Row>
      </Card>
      <Muted small>{t('common.disclaimer')}</Muted>
    </Page>
  );
}
