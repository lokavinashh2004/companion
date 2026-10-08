// Message box: Enter sends, Shift+Enter adds a new line (and Enter while composing Tamil text with an IME doesn't send).
import { useLayoutEffect, type Ref, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/ui';
import s from './chat.module.css';

export const MAX_MESSAGE = 2000;

export function Composer({
  value,
  onChange,
  onSend,
  onCamera,
  inputRef,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onCamera: () => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  disabled?: boolean;
}) {
  const { t } = useTranslation();

  // Grow with the text up to a few lines (CSS caps the height).
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    if (el.scrollHeight) el.style.height = `${el.scrollHeight}px`;
  }, [value, inputRef]);

  const canSend = !!value.trim() && !disabled;

  return (
    <form
      className={s.composer}
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) onSend();
      }}
    >
      <IconButton label={t('a11y.openCamera')} className={s.camera} onClick={onCamera}>
        <Icon name="camera" />
      </IconButton>
      <textarea
        ref={inputRef as Ref<HTMLTextAreaElement>}
        className={s.input}
        rows={1}
        value={value}
        maxLength={MAX_MESSAGE}
        placeholder={t('chat.placeholder')}
        aria-label={t('chat.placeholder')}
        enterKeyHint="send"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (canSend) onSend();
          }
        }}
      />
      <button type="submit" className={s.send} aria-label={t('a11y.sendMessage')} title={t('chat.send')} disabled={!canSend}>
        <Icon name="send" />
      </button>
    </form>
  );
}
