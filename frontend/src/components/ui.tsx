// Shared UI kit. Every visible string comes from i18n (callers pass translated text).
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';

import s from './ui.module.css';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Page({ children, title, actions, wide }: { children: ReactNode; title?: string; actions?: ReactNode; wide?: boolean }) {
  return (
    <main id="main" className={cx(s.page, wide && s.pageWide)}>
      {title || actions ? (
        <div className={s.pageHeader}>
          {title ? <h1>{title}</h1> : <span />}
          {actions}
        </div>
      ) : null}
      {children}
    </main>
  );
}

export function Card({ children, tone = 'surface', title, className }: { children: ReactNode; tone?: 'surface' | 'alt' | 'calm' | 'warn'; title?: ReactNode; className?: string }) {
  return (
    <section className={cx(s.card, tone === 'alt' && s.cardAlt, tone === 'calm' && s.cardCalm, tone === 'warn' && s.cardWarn, className)}>
      {title ? <h2 className={s.cardTitle}>{title}</h2> : null}
      {children}
    </section>
  );
}

export function Row({ children, between, nowrap }: { children: ReactNode; between?: boolean; nowrap?: boolean }) {
  return <div className={cx(s.row, between && s.between, nowrap && s.nowrap)}>{children}</div>;
}

type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({ kind = 'primary', small, busy, className, children, disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: ButtonKind; small?: boolean; busy?: boolean }) {
  return (
    <button type="button" className={cx(s.button, s[kind], small && s.small, className)} disabled={disabled || busy} aria-busy={busy || undefined} {...props}>
      {busy ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function IconButton({ label, children, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label} className={cx(s.iconButton, className)} {...props}>
      <span aria-hidden="true">{children}</span>
    </button>
  );
}

export function Field({ label, hint, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string | null }) {
  const id = useId();
  return (
    <div className={s.field}>
      <label className={s.label} htmlFor={id}>
        {label}
      </label>
      <input id={id} className={s.input} aria-invalid={!!error || undefined} aria-describedby={hint || error ? `${id}-h` : undefined} {...props} />
      {hint || error ? (
        <p id={`${id}-h`} className={cx(s.small, error ? s.error : s.muted)}>
          {error ?? hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextArea({ label, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  const id = useId();
  return (
    <div className={s.field}>
      <label className={s.label} htmlFor={id}>
        {label}
      </label>
      <textarea id={id} className={cx(s.input, s.textarea)} {...props} />
    </div>
  );
}

export function Select({ label, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const id = useId();
  return (
    <div className={s.field}>
      <label className={s.label} htmlFor={id}>
        {label}
      </label>
      <select id={id} className={s.input} {...props}>
        {children}
      </select>
    </div>
  );
}

export function Chip({ label, selected, onClick, ariaLabel, tone }: { label: string; selected?: boolean; onClick?: () => void; ariaLabel?: string; tone?: 'calm' }) {
  if (!onClick) return <span className={cx(s.chip, s.chipStatic, tone === 'calm' && s.chipCalm)}>{label}</span>;
  return (
    <button type="button" className={cx(s.chip, selected && s.chipSelected)} aria-pressed={!!selected} aria-label={ariaLabel} onClick={onClick}>
      {label}
    </button>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div role="group" aria-label={label} className={s.row}>
      {options.map((o) => (
        <Chip key={o.value} label={o.label} selected={o.value === value} onClick={() => onChange(o.value)} />
      ))}
    </div>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const id = useId();
  return (
    <div className={s.toggleRow}>
      <label htmlFor={id} className={s.toggleLabel}>
        <span>{label}</span>
        {hint ? <span className={cx(s.small, s.muted)}>{hint}</span> : null}
      </label>
      <input id={id} type="checkbox" role="switch" className={s.switch} checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </div>
  );
}

export function Stepper({ label, value, onChange, min = 0, max = 99, step = 1, format }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; format?: (v: number) => string }) {
  const round = (v: number) => Math.round(v * 10) / 10;
  return (
    <div className={s.stepper} role="group" aria-label={label}>
      <span className={s.stepperLabel}>{label}</span>
      <IconButton label={`${label} −`} onClick={() => onChange(Math.max(min, round(value - step)))}>
        −
      </IconButton>
      <output className={s.stepperValue} aria-live="polite">
        {format ? format(value) : value}
      </output>
      <IconButton label={`${label} +`} onClick={() => onChange(Math.min(max, round(value + step)))}>
        +
      </IconButton>
    </div>
  );
}

export function ListItem({ title, subtitle, onClick, right }: { title: ReactNode; subtitle?: ReactNode; onClick?: () => void; right?: ReactNode }) {
  const body = (
    <>
      <span className={s.listText}>
        <span>{title}</span>
        {subtitle ? <span className={cx(s.small, s.muted)}>{subtitle}</span> : null}
      </span>
      {right ?? (onClick ? <span aria-hidden="true">›</span> : null)}
    </>
  );
  return onClick ? (
    <button type="button" className={cx(s.listItem, s.listButton)} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={s.listItem}>{body}</div>
  );
}

export function Muted({ children, small }: { children: ReactNode; small?: boolean }) {
  return <p className={cx(s.muted, small && s.small)}>{children}</p>;
}

export function Notice({ children, tone }: { children: ReactNode; tone?: 'warn' }) {
  return (
    <div className={cx(s.notice, tone === 'warn' && s.noticeWarn)} role="status" aria-live="polite">
      {children}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return <span className={s.spinner} role={label ? 'status' : undefined} aria-label={label} />;
}

export function Loading() {
  const { t } = useTranslation();
  return (
    <div className={s.loading}>
      <Spinner label={t('common.loading')} />
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <Card tone="alt">
      <Muted>{t('common.error')}</Muted>
      {onRetry ? (
        <Button kind="secondary" small onClick={onRetry}>
          {t('common.retry')}
        </Button>
      ) : null}
    </Card>
  );
}

export function EmptyState({ title, body, action }: { title?: string; body: string; action?: { label: string; onClick: () => void } }) {
  return (
    <Card tone="alt">
      {title ? <h2 className={s.cardTitle}>{title}</h2> : null}
      <Muted>{body}</Muted>
      {action ? (
        <div>
          <Button kind="secondary" small onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

/** Accessible bottom sheet / dialog (native <dialog>: focus trap, Esc to close). */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    }
    if (!open && d.open) {
      if (typeof d.close === 'function') d.close();
      else d.removeAttribute('open');
    }
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={s.sheet}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // click on the backdrop
      }}
    >
      {open ? (
        <div className={s.sheetBody}>
          <div className={s.sheetHeader}>
            <h2 id={titleId}>{title}</h2>
            <Button kind="ghost" small onClick={onClose}>
              {t('common.close')}
            </Button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
