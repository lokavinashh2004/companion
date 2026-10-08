// Web Push controls for this browser: explains the current state and offers the one sensible next step.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Card, Muted, Notice, Row } from '@/components/ui';
import { disablePush, enablePush, pushState, sendTestPush, type PushState } from '@/lib/push';
import s from './me.module.css';

type PushAction = typeof enablePush; // same shape as disablePush

const RESULTS = new Set(['sent', 'no_subscription', 'quiet_hours', 'cap', 'error', 'disabled']);

export function PushSettings() {
  const { t } = useTranslation();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState<'on' | 'off' | 'test' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    pushState()
      .then((st) => alive && setState(st))
      .catch(() => alive && setState('unsupported'));
    return () => {
      alive = false;
    };
  }, []);

  const run = async (kind: 'on' | 'off', fn: PushAction) => {
    setBusy(kind);
    setMessage(null);
    try {
      setState(await fn());
    } catch {
      setMessage(t('mePage.notifications.failed'));
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy('test');
    setMessage(null);
    try {
      const r = await sendTestPush();
      setMessage(t(`mePage.notifications.results.${RESULTS.has(r) ? r : 'error'}`));
    } catch {
      setMessage(t('mePage.notifications.results.error'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card title={t('mePage.notifications.title')}>
      {state === null ? <Muted small>{t('mePage.notifications.checking')}</Muted> : null}

      {state === 'off' ? (
        <>
          <Muted>{t('mePage.notifications.offBody')}</Muted>
          <Row>
            <Button busy={busy === 'on'} onClick={() => void run('on', enablePush)}>
              {t('mePage.notifications.turnOn')}
            </Button>
          </Row>
        </>
      ) : null}

      {state === 'on' ? (
        <>
          <Muted>{t('mePage.notifications.onBody')}</Muted>
          <Row>
            <Button kind="secondary" busy={busy === 'test'} disabled={!!busy} onClick={() => void test()}>
              {t('mePage.notifications.test')}
            </Button>
            <Button kind="ghost" busy={busy === 'off'} disabled={!!busy} onClick={() => void run('off', disablePush)}>
              {t('mePage.notifications.turnOff')}
            </Button>
          </Row>
        </>
      ) : null}

      {state === 'denied' ? <Muted>{t('mePage.notifications.deniedBody')}</Muted> : null}

      {state === 'needs-install' ? (
        <>
          <Muted>{t('mePage.notifications.installBody')}</Muted>
          <ol className={s.steps}>
            <li>{t('mePage.notifications.installStep1')}</li>
            <li>{t('mePage.notifications.installStep2')}</li>
            <li>{t('mePage.notifications.installStep3')}</li>
          </ol>
        </>
      ) : null}

      {state === 'unsupported' ? <Muted>{t('mePage.notifications.unsupportedBody')}</Muted> : null}
      {state === 'not-configured' ? <Muted>{t('mePage.notifications.notConfiguredBody')}</Muted> : null}

      {message ? <Notice>{message}</Notice> : null}
    </Card>
  );
}
