// Calm, non-blocking support card shown when a message suggests she may be in crisis.
import { useTranslation } from 'react-i18next';

import { Button, Card, Muted } from '@/components/ui';
import s from './chat.module.css';

export function CrisisCard({ onDismiss }: { onDismiss: () => void }) {
  const { t } = useTranslation();
  return (
    <div role="region" aria-label={t('chat.crisisTitle')} className={s.crisis}>
      <Card tone="calm" title={t('chat.crisisTitle')}>
        <Muted>{t('chat.crisisBody')}</Muted>
        <div className={s.crisisActions}>
          <a className={s.callLink} href="tel:14416" aria-label={t('a11y.callHelpline')}>
            <span aria-hidden="true">📞</span> {t('chat.crisisCall')}
          </a>
          <Button kind="ghost" small onClick={onDismiss}>
            {t('chat.crisisDismiss')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
