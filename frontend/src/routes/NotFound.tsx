import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { Page } from '@/components/ui';

export function NotFound() {
  const { t } = useTranslation();
  return (
    <Page title={t('common.notFoundTitle')}>
      <Link to="/">{t('common.goHome')}</Link>
    </Page>
  );
}
