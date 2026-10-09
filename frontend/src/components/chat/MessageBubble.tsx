// One chat bubble, plus the action cards under companion replies (undo a log, confirm a period).
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/Icon';
import { cx } from '@/components/ui';
import type { ChatMessage } from '@/lib/api';
import { shortDate } from '@/lib/format';
import s from './chat.module.css';

type Log = NonNullable<ChatMessage['meta']['logs']>[number];

export type BubbleActions = {
  onUndoLog: (message: ChatMessage, log: Log) => void;
  onConfirmPeriod: (message: ChatMessage, index: number) => void;
  onUndoPeriod: (message: ChatMessage, index: number) => void;
  busy: boolean;
};

export function MessageBubble({ message, actions, statusOverride }: { message: ChatMessage; actions?: BubbleActions; statusOverride?: string }) {
  const { t } = useTranslation();
  const mine = message.role === 'user';
  const meta = message.meta;

  let status: string | null = statusOverride ?? null;
  if (!status && mine) {
    if (message.status === 'pending') status = t('chat.sending');
    else if (message.status === 'queued') status = t('chat.queued');
    else if (message.status === 'failed') status = t('chat.notSent');
  }

  const logLabel = (log: Log) => t(`chat.logNames.${log.table}`, { label: log.label });

  return (
    <li className={cx(s.item, mine ? s.itemMine : s.itemBot)}>
      <div className={cx(s.bubble, mine ? s.bubbleMine : s.bubbleBot, meta.fallback && s.bubbleSoft)}>{message.content}</div>
      {status ? <span className={s.status}>{status}</span> : null}

      {!mine && actions && (meta.logs?.length || meta.pending?.length) ? (
        <div className={s.cards}>
          {meta.logs?.map((log) => {
            const label = logLabel(log);
            if (meta.undone?.[log.id]) {
              return (
                <div key={log.id} className={cx(s.card, s.cardDone)}>
                  {t('chatPage.removed', { label })}
                </div>
              );
            }
            return (
              <div key={log.id} className={s.card}>
                <span className={s.cardIcon}>
                  <Icon name="check" size={18} strokeWidth={2.4} />
                </span>
                <span className={s.cardText}>{t('chat.logged', { label })}</span>
                <button type="button" className={s.cardAction} disabled={actions.busy} aria-label={t('chatPage.undoAria', { label })} onClick={() => actions.onUndoLog(message, log)}>
                  {t('common.undo')}
                </button>
              </div>
            );
          })}
          {meta.pending?.map((p, index) => {
            const date = shortDate(p.date);
            if (meta.confirmed?.[String(index)]) {
              const label = t('chat.periodLogged', { date });
              return (
                <div key={`p${index}`} className={s.card}>
                  <span className={cx(s.cardIcon, s.cardIconPeriod)}>
                    <Icon name="cycle" size={18} />
                  </span>
                  <span className={s.cardText}>{label}</span>
                  <button type="button" className={s.cardAction} disabled={actions.busy} aria-label={t('chatPage.undoAria', { label })} onClick={() => actions.onUndoPeriod(message, index)}>
                    {t('common.undo')}
                  </button>
                </div>
              );
            }
            return (
              <div key={`p${index}`} className={cx(s.card, s.cardAsk)}>
                <span className={s.cardHint}>{t('chatPage.periodHint')}</span>
                <button type="button" className={s.cardConfirm} disabled={actions.busy} onClick={() => actions.onConfirmPeriod(message, index)}>
                  {t(p.kind === 'period_start' ? 'chat.confirmPeriodStart' : 'chat.confirmPeriodEnd', { date })}
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </li>
  );
}

/** Three bouncing dots on the companion's side while a reply is on its way (the header announces "typing…"). */
export function TypingBubble() {
  return (
    <li className={cx(s.item, s.itemBot)} aria-hidden="true" data-testid="typing">
      <div className={cx(s.bubble, s.bubbleBot, s.typing)}>
        <span className={s.dot} />
        <span className={s.dot} />
        <span className={s.dot} />
      </div>
    </li>
  );
}
