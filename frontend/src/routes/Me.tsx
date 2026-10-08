// "Me" hub: who you're signed in as, and links to everything personal.
import { useTranslation } from 'react-i18next';

import { LinkRow } from '@/components/me/common';
import s from '@/components/me/me.module.css';
import { Button, Card, ErrorState, Loading, Muted, Page } from '@/components/ui';
import { signOut } from '@/lib/firebase';
import { useMe } from '@/lib/queries';

export function Me() {
  const { t } = useTranslation();
  const me = useMe();
  const name = me.data?.profile.companion_name || t('common.appName');

  return (
    <Page title={t('me.title')}>
      {me.isLoading ? <Loading /> : null}
      {me.isError ? <ErrorState onRetry={() => void me.refetch()} /> : null}
      {me.data ? (
        <Card>
          <h2 className={s.sectionTitle}>{name}</h2>
          <Muted small>{t('me.signedInAs', { email: me.data.email ?? '—' })}</Muted>
          <Muted small>{t('mePage.privacyNote')}</Muted>
        </Card>
      ) : null}

      <Card>
        <nav className={s.linkList} aria-label={t('me.title')}>
          <LinkRow to="/me/remembers" icon="💭" label={t('me.remembers', { name })} />
          <LinkRow to="/insights" icon="📈" label={t('me.insights')} />
          <LinkRow to="/me/medications" icon="💊" label={t('me.medications')} />
          <LinkRow to="/me/labs" icon="🧪" label={t('me.labs')} />
          <LinkRow to="/me/settings" icon="⚙️" label={t('me.settings')} />
        </nav>
      </Card>

      <Button kind="secondary" onClick={() => void signOut()}>
        {t('auth.signOut')}
      </Button>
      <Muted small>{t('common.disclaimer')}</Muted>
    </Page>
  );
}
