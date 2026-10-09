// Top-right of every page: today's reminders behind a bell, and an avatar menu (Me, Settings, theme, sign out).
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { Icon } from '@/components/Icon';
import { cx, Segmented } from '@/components/ui';
import { signOut } from '@/lib/firebase';
import { useMe, useToday } from '@/lib/queries';
import { needsAttention, todayReminders } from '@/lib/reminders';
import { useTheme, type ThemePref } from '@/lib/theme';
import { reminderText } from './reminderText';
import s from './shell.module.css';

/** Open/close state for a popover: closes on Escape (returning focus) or a click outside. */
function usePopover(root: RefObject<HTMLElement | null>, trigger: RefObject<HTMLButtonElement | null>) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, root, trigger]);
  return [open, setOpen] as const;
}

function Popover({ label, button, children, buttonClass }: { label: string; button: ReactNode; children: (close: () => void) => ReactNode; buttonClass?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = usePopover(root, trigger);
  const id = useId();
  return (
    <div className={s.pop} ref={root}>
      <button ref={trigger} type="button" className={cx(s.topButton, buttonClass)} aria-label={label} title={label} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        {button}
      </button>
      {open ? (
        <div id={id} className={s.panel} role="dialog" aria-label={label}>
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

function Bell() {
  const { t } = useTranslation();
  const today = useToday();
  const reminders = today.data ? todayReminders(today.data) : [];
  const count = reminders.filter(needsAttention).length;
  const label = count ? t('reminders.bellCount', { count }) : t('reminders.bell');
  return (
    <Popover
      label={label}
      button={
        <>
          <Icon name="bell" />
          {count ? (
            <span className={s.badge} aria-hidden="true">
              {count}
            </span>
          ) : null}
        </>
      }
    >
      {(close) => (
        <>
          <h2 className={s.panelTitle}>{t('reminders.title')}</h2>
          {reminders.length ? (
            <ul className={s.reminders}>
              {reminders.map((r) => {
                const x = reminderText(t, r);
                return (
                  <li key={r.key} className={cx(s.reminder, needsAttention(r) && s.reminderHot)}>
                    <span className={s.reminderIcon} aria-hidden="true">
                      {x.icon}
                    </span>
                    <span className={s.reminderText}>
                      <span className={s.reminderTitle}>{x.title}</span>
                      <span className={s.reminderBody}>{x.body}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={s.empty}>{today.isError ? t('common.error') : t('reminders.empty')}</p>
          )}
          <Link className={s.panelLink} to="/today" onClick={close}>
            {t('reminders.openToday')} ›
          </Link>
        </>
      )}
    </Popover>
  );
}

function AvatarMenu() {
  const { t } = useTranslation();
  const me = useMe();
  const theme = useTheme();
  const name = me.data?.profile.display_name || null;
  const initial = (name || me.data?.email || '?').trim().charAt(0).toUpperCase();
  return (
    <Popover
      label={t('shell.account')}
      buttonClass={s.avatarButton}
      button={
        <>
          <span className={s.avatar} aria-hidden="true">
            {initial}
          </span>
          <svg className={s.caret} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </>
      }
    >
      {(close) => (
        <>
          <div className={s.who}>
            <span className={cx(s.avatar, s.avatarBig)} aria-hidden="true">
              {initial}
            </span>
            <span className={s.whoText}>
              <span className={s.whoName}>{name ?? t('shell.you')}</span>
              {me.data?.email ? <span className={s.whoEmail}>{me.data.email}</span> : null}
            </span>
          </div>
          <nav className={s.menu} aria-label={t('shell.account')}>
            <Link to="/me" onClick={close}>
              👤 {t('tabs.me')}
            </Link>
            <Link to="/me/settings" onClick={close}>
              ⚙️ {t('settings.title')}
            </Link>
          </nav>
          <div className={s.themeRow}>
            <span className={s.themeLabel}>{t('settings.theme')}</span>
            <Segmented<ThemePref>
              label={t('settings.theme')}
              value={theme.pref}
              onChange={theme.set}
              options={[
                { value: 'light', label: t('settings.themeLight') },
                { value: 'dark', label: t('settings.themeDark') },
                { value: 'system', label: t('settings.themeSystem') },
              ]}
            />
          </div>
          <button
            type="button"
            className={s.signOut}
            onClick={() => {
              close();
              void signOut();
            }}
          >
            ↩ {t('auth.signOut')}
          </button>
        </>
      )}
    </Popover>
  );
}

export function TopBar({ className }: { className?: string }) {
  return (
    <div className={cx(s.topbar, className)}>
      <Bell />
      <AvatarMenu />
    </div>
  );
}
