// The conversation: history, optimistic send, action cards (undo a log, confirm a period), suggestion chips,
// crisis support and food photos. Shown as the full Chat page, as the desktop side panel beside other pages,
// and inside the phone quick-chat sheet.
// Nothing typed here is written to browser storage (privacy): offline or failed text simply stays in the composer.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/Icon';
import { Button, cx, EmptyState, ErrorState, IconButton, Loading, Notice } from '@/components/ui';
import type { ChatMessage } from '@/lib/api';
import { playChime, useChatSound } from '@/lib/chime';
import { uuid } from '@/lib/format';
import { loadOlderMessages, useConfirmPeriod, useMe, useMessages, useSendMessage, useUndoLog, useUndoPeriod } from '@/lib/queries';
import { useOnline } from '@/lib/useOnline';
import { Composer } from './Composer';
import { CrisisCard } from './CrisisCard';
import { MessageBubble, TypingBubble, type BubbleActions } from './MessageBubble';
import { PhotoLogSheet } from './PhotoLogSheet';
import s from './panel.module.css';

type Problem = 'offline' | 'error' | null;

/** page: the Chat tab (page scrolls). panel: desktop side panel (own scroll, close button). sheet: inside a Sheet (own scroll, no header). */
export type ChatVariant = 'page' | 'panel' | 'sheet';

export function ChatPanel({ variant = 'page', onClose }: { variant?: ChatVariant; onClose?: () => void }) {
  const { t } = useTranslation();
  const me = useMe();
  const history = useMessages();
  const send = useSendMessage();
  const undoLog = useUndoLog();
  const confirmPeriod = useConfirmPeriod();
  const undoPeriod = useUndoPeriod();
  const online = useOnline();
  const muted = useChatSound((st) => st.muted);
  const toggleSound = useChatSound((st) => st.toggle);

  const [text, setText] = useState('');
  const [older, setOlder] = useState<ChatMessage[]>([]);
  const [olderHasMore, setOlderHasMore] = useState<boolean | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sent, setSent] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<{ id: string; text: string } | null>(null);
  const [problem, setProblem] = useState<Problem>(null);
  const [crisisFromSend, setCrisisFromSend] = useState<string | null>(null);
  const [dismissedCrisis, setDismissedCrisis] = useState<string | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Older pages + replies from this session + the live first page (freshest copy wins), oldest first.
  const messages = useMemo(() => {
    const byId = new Map<string, ChatMessage>();
    for (const m of [...older, ...sent, ...(history.data?.messages ?? [])]) byId.set(m.id, m);
    return [...byId.values()].filter((m) => m.role !== 'system').sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
  }, [older, sent, history.data]);

  const hasMore = olderHasMore ?? history.data?.has_more ?? false;
  const lastKey = pending ? `p:${pending.id}` : (messages.at(-1)?.id ?? '');

  // Scroll to the newest message (not when earlier messages are prepended). Panels scroll themselves, not the page.
  useEffect(() => {
    if (!lastKey) return;
    if (variant === 'page') endRef.current?.scrollIntoView?.({ block: 'end' });
    else if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [lastKey, variant]);

  // Crisis support: from the send result or any companion message in view.
  const crisisMsg = [...messages].reverse().find((m) => m.role === 'assistant' && m.meta.flags?.crisis);
  const crisisKey = [crisisFromSend, crisisMsg?.id].filter(Boolean).join('|');
  const showCrisis = !!crisisKey && crisisKey !== dismissedCrisis;

  const sendText = (raw: string, fromComposer: boolean) => {
    const body = raw.trim().slice(0, 2000);
    if (!body || send.isPending) return;
    if (!online) {
      setProblem('offline');
      if (!fromComposer) setText((cur) => (cur.trim() ? cur : body));
      return;
    }
    setProblem(null);
    const client_id = uuid();
    setPending({ id: client_id, text: body });
    if (fromComposer) setText('');
    send.mutate(
      { text: body, client_id },
      {
        onSuccess: (r) => {
          setSent((prev) => [...prev, r.message, ...(r.reply ? [r.reply] : []), ...(r.notice ? [r.notice] : [])]);
          if (r.crisis) setCrisisFromSend(r.message.id);
          if (r.reply) playChime();
          setPending(null);
        },
        onError: () => {
          setPending(null);
          setProblem('error');
          setText((cur) => (cur.trim() ? cur : body)); // keep it so she can retry
        },
      },
    );
  };

  const loadEarlier = async () => {
    const oldest = messages[0];
    if (!oldest || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const r = await loadOlderMessages(oldest.created_at);
      setOlder((prev) => [...r.messages, ...prev]);
      setOlderHasMore(r.has_more);
    } catch {
      setProblem('error');
    } finally {
      setLoadingOlder(false);
    }
  };

  // Keep local copies (older pages / this session's replies) in sync after a card action.
  const replaceLocal = ({ message }: { message: ChatMessage }) => {
    const swap = (list: ChatMessage[]) => (list.some((m) => m.id === message.id) ? list.map((m) => (m.id === message.id ? message : m)) : list);
    setOlder(swap);
    setSent(swap);
  };
  const onActionError = () => setProblem('error');

  const actions: BubbleActions = {
    busy: undoLog.isPending || confirmPeriod.isPending || undoPeriod.isPending,
    onUndoLog: (m, log) => undoLog.mutate({ message_id: m.id, log_id: log.id }, { onSuccess: replaceLocal, onError: onActionError }),
    onConfirmPeriod: (m, index) => confirmPeriod.mutate({ message_id: m.id, index }, { onSuccess: replaceLocal, onError: onActionError }),
    onUndoPeriod: (m, index) => undoPeriod.mutate({ message_id: m.id, index }, { onSuccess: replaceLocal, onError: onActionError }),
  };

  const prefillFood = () => {
    setText((cur) => (cur.trim() ? cur : t('chat.quickFoodText')));
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  };

  const name = me.data?.profile.companion_name || t('common.appName');

  return (
    <section className={cx(s.chat, variant === 'page' ? s.page : s.contained)} aria-label={variant === 'page' ? undefined : t('chatPage.conversation', { name })}>
      {variant !== 'sheet' ? (
        <header className={s.header}>
          <span className={s.avatar} aria-hidden="true">
            <Icon name="sparkle" size={20} />
          </span>
          <div className={s.headerText}>
            {variant === 'page' ? <h1 className={s.title}>{name}</h1> : <h2 className={s.title}>{name}</h2>}
            <span className={s.headerStatus} aria-live="polite">
              {send.isPending ? t('chat.typing') : t('chatPage.languages')}
            </span>
          </div>
          <IconButton label={muted ? t('chatPage.unmute') : t('chatPage.mute')} className={s.headerButton} aria-pressed={muted} onClick={toggleSound}>
            <Icon name={muted ? 'soundOff' : 'sound'} size={18} />
          </IconButton>
          {onClose ? (
            <IconButton label={t('chatPage.minimise')} className={s.headerButton} onClick={onClose}>
              <Icon name="minimise" size={18} />
            </IconButton>
          ) : null}
        </header>
      ) : null}

      <div className={s.body} ref={bodyRef}>
        {history.isLoading ? <Loading /> : null}
        {history.isError && !history.data ? <ErrorState onRetry={() => void history.refetch()} /> : null}

        {hasMore && messages.length ? (
          <div className={s.loadEarlier}>
            <Button kind="ghost" small busy={loadingOlder} onClick={() => void loadEarlier()}>
              {t('chatPage.loadEarlier')}
            </Button>
          </div>
        ) : null}

        {history.data && !messages.length && !pending ? <EmptyState title={t('chat.emptyTitle')} body={t('chat.emptyBody')} /> : null}

        <ol className={s.list} role="log" aria-live="polite" aria-relevant="additions" aria-label={t('chatPage.conversation', { name })}>
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} actions={actions} />
          ))}
          {pending ? (
            <MessageBubble
              message={{ id: pending.id, created_at: '', role: 'user', content: pending.text, status: 'pending', meta: {} }}
              statusOverride={t('chat.sending')}
            />
          ) : null}
          {pending ? <TypingBubble /> : null}
        </ol>

        {showCrisis ? <CrisisCard onDismiss={() => setDismissedCrisis(crisisKey)} /> : null}
        <div ref={endRef} />
      </div>

      <div className={s.dock}>
        {problem === 'offline' ? <Notice tone="warn">{t('common.offline')}</Notice> : null}
        {problem === 'error' ? <Notice tone="warn">{t('common.error')}</Notice> : null}
        <div className={s.quick} role="group" aria-label={t('chatPage.quickReplies')}>
          <button type="button" className={s.quickChip} onClick={prefillFood}>
            {t('chat.quickFood')}
          </button>
          <button type="button" className={s.quickChip} onClick={() => sendText(t('chat.quickPeriodText'), false)}>
            {t('chat.quickPeriod')}
          </button>
          <button type="button" className={s.quickChip} onClick={() => sendText(t('chat.quickLowText'), false)}>
            {t('chat.quickLow')}
          </button>
        </div>
        <Composer
          value={text}
          onChange={(v) => {
            setText(v);
            if (problem === 'offline' && online) setProblem(null);
          }}
          onSend={() => sendText(text, true)}
          onCamera={() => setPhotoOpen(true)}
          inputRef={inputRef}
          disabled={send.isPending}
        />
        <p className={s.disclaimer}>{t('common.disclaimer')}</p>
      </div>

      <PhotoLogSheet open={photoOpen} onClose={() => setPhotoOpen(false)} timezone={me.data?.profile.timezone} />
    </section>
  );
}
