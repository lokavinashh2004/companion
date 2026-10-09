import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation } from 'react-router';
import { create } from 'zustand';

import { ChatPanel } from '@/components/chat/ChatPanel';
import { Icon, type IconName } from '@/components/Icon';
import { TopBar } from '@/components/shell/TopBar';
import { Notice, Sheet } from '@/components/ui';
import { useApiStatus } from '@/lib/api';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { useOnline } from '@/lib/useOnline';
import s from './Layout.module.css';
import { RequireAuth } from './RequireAuth';

const TABS: { to: string; key: string; icon: IconName; wideOnly?: boolean }[] = [
  { to: '/', key: 'tabs.chat', icon: 'chat' },
  { to: '/today', key: 'tabs.today', icon: 'today' },
  { to: '/cycle', key: 'tabs.cycle', icon: 'cycle' },
  { to: '/insights', key: 'me.insights', icon: 'insights', wideOnly: true },
  { to: '/me', key: 'tabs.me', icon: 'me' },
];

/** Whether the desktop chat panel is open beside the other pages (memory only). */
const useChatDock = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({ open: true, setOpen: (open) => set({ open }) }));

/** Signed-in shell: bottom tabs on phones, a side menu on desktop, and the chat beside every other page. */
export function Layout() {
  const { t } = useTranslation();
  const waking = useApiStatus((st) => st.waking);
  const online = useOnline();
  const { pathname } = useLocation();
  const wide = useMediaQuery('(min-width: 1200px)');
  const dockOpen = useChatDock((st) => st.open);
  const setDockOpen = useChatDock((st) => st.setOpen);
  const [sheetOpen, setSheetOpen] = useState(false);

  const onChat = pathname === '/';
  const showPanel = wide && !onChat && dockOpen;
  const showLauncher = !onChat && !showPanel;

  return (
    <RequireAuth>
      <div className={s.shell}>
        <a className="skip-link" href="#main">
          {t('common.skipToContent')}
        </a>
        <nav className={s.nav} aria-label={t('common.appName')}>
          <span className={s.brand}>
            <span className={s.brandMark} aria-hidden="true">
              <Icon name="sparkle" size={20} />
            </span>
            {t('common.appName')}
          </span>
          {TABS.map((tab) => (
            <NavLink key={tab.to} to={tab.to} end={tab.to === '/'} className={tab.wideOnly ? `${s.link} ${s.desktopOnly}` : s.link}>
              <span className={s.icon}>
                <Icon name={tab.icon} />
              </span>
              {t(tab.key)}
            </NavLink>
          ))}
          <p className={s.privacy}>{t('chatPage.privacyNote')}</p>
        </nav>
        <div className={s.content}>
          {!online ? <Notice tone="warn">{t('common.offline')}</Notice> : null}
          {waking ? <Notice>{t('common.wakingUp')}</Notice> : null}
          <TopBar className={onChat ? s.topbarChat : undefined} />
          <Outlet />
        </div>
        {showPanel ? (
          <aside className={s.panel}>
            <ChatPanel variant="panel" onClose={() => setDockOpen(false)} />
          </aside>
        ) : null}
        {showLauncher ? (
          <button
            type="button"
            className={s.launcher}
            onClick={() => (wide ? setDockOpen(true) : setSheetOpen(true))}
          >
            <Icon name="chat" />
            <span className={s.launcherText}>{t('chatPage.openPanel')}</span>
          </button>
        ) : null}
        {!wide && !onChat ? (
          <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={t('chatPage.quickChat')}>
            <div className={s.sheetChat}>
              <ChatPanel variant="sheet" />
            </div>
          </Sheet>
        ) : null}
      </div>
    </RequireAuth>
  );
}
