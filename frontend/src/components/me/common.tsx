// Small building blocks shared by the Me-area pages.
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { Button, Muted, Row, Sheet } from '@/components/ui';
import s from './me.module.css';

/** A full-width navigation row (a real link, so it works with middle-click and screen readers). */
export function LinkRow({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <Link to={to} className={s.linkRow}>
      <span className={s.linkIcon} aria-hidden="true">
        {icon}
      </span>
      <span className={s.linkLabel}>{label}</span>
      <span className={s.chevron} aria-hidden="true">
        ›
      </span>
    </Link>
  );
}

/** Confirm-before-destroying sheet. */
export function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {body ? <Muted>{body}</Muted> : null}
      <Row>
        <Button kind="danger" busy={busy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button kind="secondary" onClick={onClose}>
          {t('common.cancel')}
        </Button>
      </Row>
    </Sheet>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  return (
    <p className={s.error} role="alert">
      {children}
    </p>
  );
}
