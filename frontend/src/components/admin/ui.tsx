'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';

/**
 * The dashboard's shared controls.
 *
 * Deliberately one file: these are small, they are only used by the admin
 * pages, and keeping them together makes the visual vocabulary of the
 * dashboard reviewable at a glance. The public site has its own primitives in
 * `components/ui`, which is where anything a visitor sees belongs.
 *
 * Spacing throughout stays on the 4 / 8 / 12 / 16 / 24 / 32 scale, weights
 * stay at 400 for text and 600 for headings, and the only colours are the
 * brand teal, the bronze accent and neutral greys.
 */

// ── Panel ───────────────────────────────────────────────────────────────────

export function Panel({
  children,
  className,
  title,
  description,
  actions,
  padded = true,
}: {
  children?: ReactNode;
  className?: string;
  title?: string;
  description?: string;
  actions?: ReactNode;
  padded?: boolean;
}) {
  return (
    <section
      className={cn(
        'rounded-panel border border-surface-line bg-surface shadow-float',
        // A grid or flex item defaults to `min-width: auto`, so a panel
        // holding a wide table (`min-w-[40rem]`) would be stretched to the
        // table's width and push the whole page sideways on a phone instead
        // of letting the table scroll inside it.
        'min-w-0',
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-surface-line px-6 py-5">
          <div className="min-w-0">
            {title && (
              <h2 className="text-lead font-semibold tracking-[-0.01em] text-ink">{title}</h2>
            )}
            {description && (
              <p className="mt-1 text-small text-ink-muted">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={padded ? 'p-6' : undefined}>{children}</div>
    </section>
  );
}

// ── Buttons ─────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-600 shadow-float',
  secondary: 'bg-secondary text-white hover:bg-secondary-500 shadow-float',
  ghost: 'border border-surface-line bg-surface text-ink hover:bg-surface-sunken',
  danger: 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
};

export function Button({
  children,
  variant = 'primary',
  icon,
  busy = false,
  className,
  type = 'button',
  ...rest
}: {
  children?: ReactNode;
  variant?: ButtonVariant;
  icon?: string;
  busy?: boolean;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <button
      type={type}
      {...rest}
      disabled={rest.disabled || busy}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5',
        'text-base font-medium transition-all duration-300 ease-physical',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'enabled:hover:-translate-y-px',
        BUTTON_STYLES[variant],
        className,
      )}
    >
      {busy ? (
        <Icon name="progress_activity" size="sm" className="animate-spin" />
      ) : (
        icon && <Icon name={icon} size="sm" />
      )}
      {children}
    </button>
  );
}

/** A square icon-only control, for table row actions. */
export function IconButton({
  icon,
  label,
  tone = 'neutral',
  ...rest
}: {
  icon: string;
  label: string;
  tone?: 'neutral' | 'danger';
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      aria-label={label}
      title={label}
      className={cn(
        'grid h-10 w-10 place-items-center rounded-card transition-colors duration-200',
        'disabled:cursor-not-allowed disabled:opacity-40',
        tone === 'danger'
          ? 'text-ink-muted hover:bg-red-50 hover:text-red-600'
          : 'text-ink-muted hover:bg-surface-sunken hover:text-primary',
      )}
    >
      <Icon name={icon} size="sm" />
    </button>
  );
}

// ── Form fields ─────────────────────────────────────────────────────────────

export function Field({
  label,
  children,
  hint,
  error,
  required,
  className,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-2 block text-base font-medium text-ink">
        {label}
        {required && <span className="ml-1 text-secondary">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-2 text-small text-red-600">{error}</p>
      ) : (
        hint && <p className="mt-2 text-small leading-relaxed text-ink-muted">{hint}</p>
      )}
    </div>
  );
}

const FIELD_BASE =
  'w-full rounded-card border border-surface-line bg-surface px-4 py-2.5 text-base text-ink ' +
  'placeholder:text-ink-soft transition-colors duration-200 ' +
  'focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 ' +
  'disabled:cursor-not-allowed disabled:bg-surface-sunken';

export function Input({
  className,
  mono = false,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }) {
  // Monospace is for codes and numbers only — never for prose.
  return <input {...rest} className={cn(FIELD_BASE, mono && 'font-mono', className)} />;
}

export function Textarea({
  className,
  rows = 4,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={rows} {...rest} className={cn(FIELD_BASE, 'resize-y', className)} />;
}

export function Select({
  className,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cn(FIELD_BASE, 'cursor-pointer pr-10', className)}>
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();

  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-surface-line text-primary focus:ring-2 focus:ring-primary/20"
      />
      <label htmlFor={id} className="cursor-pointer select-none">
        <span className="block text-base font-medium text-ink">{label}</span>
        {description && (
          <span className="mt-1 block text-small leading-relaxed text-ink-muted">{description}</span>
        )}
      </label>
    </div>
  );
}

/**
 * A comma-separated list bound to a string array.
 *
 * Tags and qualifications are both short lists an editor types in one go; a
 * chip editor would be more machinery than the task deserves.
 */
export function ListInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value.join(', '));

  // Re-sync when the parent loads a record after first render.
  useEffect(() => setDraft(value.join(', ')), [value]);

  return (
    <Input
      value={draft}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() =>
        onChange(
          draft
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean),
        )
      }
    />
  );
}

// ── Status pills ────────────────────────────────────────────────────────────

const PILL_TONES = {
  neutral: 'bg-surface-sunken text-ink-muted',
  teal: 'bg-primary-50 text-primary-700',
  bronze: 'bg-secondary-50 text-secondary-700',
  positive: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
} as const;

export type PillTone = keyof typeof PILL_TONES;

export function Pill({
  children,
  tone = 'neutral',
  icon,
}: {
  children: ReactNode;
  tone?: PillTone;
  icon?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1',
        'text-caption font-medium uppercase tracking-[0.06em]',
        PILL_TONES[tone],
      )}
    >
      {icon && <Icon name={icon} size="sm" className="text-[1rem]" />}
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, PillTone> = {
  published: 'positive',
  subscribed: 'positive',
  draft: 'neutral',
  pending: 'warning',
  scheduled: 'bronze',
  archived: 'neutral',
  new: 'teal',
  in_review: 'warning',
  responded: 'positive',
  closed: 'neutral',
  spam: 'danger',
  unsubscribed: 'neutral',
  bounced: 'danger',
  sending: 'warning',
  sent: 'positive',
  failed: 'danger',
};

export function StatusPill({ status }: { status: string }) {
  return (
    <Pill tone={STATUS_TONES[status] ?? 'neutral'}>{status.replace(/_/g, ' ')}</Pill>
  );
}

// ── Table ───────────────────────────────────────────────────────────────────

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-left">{children}</table>
    </div>
  );
}

export function Th({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        'border-b border-surface-line bg-surface-sunken/40 px-6 py-3.5',
        'text-caption font-semibold uppercase tracking-[0.1em] text-ink-muted',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <td className={cn('border-b border-surface-line px-6 py-4 text-base text-ink', className)}>
      {children}
    </td>
  );
}

// ── Empty, loading and error states ─────────────────────────────────────────

export function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-6 py-16 text-center">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-surface-sunken">
        <Icon name={icon} size="xl" className="text-ink-soft" />
      </span>
      <p className="mt-5 text-lead font-semibold text-ink">{title}</p>
      {description && (
        <p className="mx-auto mt-2 max-w-md text-base leading-relaxed text-ink-muted">
          {description}
        </p>
      )}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 px-6 py-16 text-ink-muted">
      <Icon name="progress_activity" className="animate-spin" />
      <span className="text-base">{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="px-6 py-16 text-center" role="alert">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-red-50">
        <Icon name="error" size="xl" className="text-red-500" />
      </span>
      <p className="mt-5 text-lead font-semibold text-ink">Could not load this</p>
      <p className="mx-auto mt-2 max-w-md text-base leading-relaxed text-ink-muted">{message}</p>
      {onRetry && (
        <div className="mt-6 flex justify-center">
          <Button variant="ghost" icon="refresh" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Modal ───────────────────────────────────────────────────────────────────

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'sm' | 'md' | 'lg';
}) {
  // Escape closes, and the page behind must not scroll.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 md:p-8">
      <button
        type="button"
        className="fixed inset-0 bg-primary-950/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative my-auto w-full overflow-hidden rounded-panel bg-surface shadow-deep',
          widths[width],
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-surface-line px-6 py-5">
          <div className="min-w-0">
            <h2 className="text-h5 font-semibold tracking-[-0.01em] text-ink">{title}</h2>
            {description && <p className="mt-1.5 text-base text-ink-muted">{description}</p>}
          </div>
          <IconButton icon="close" label="Close" onClick={onClose} />
        </header>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-6">{children}</div>

        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-surface-line bg-surface-sunken px-6 py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Delete',
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} busy={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-base text-ink-muted">{message}</p>
    </Modal>
  );
}

// ── Toasts ──────────────────────────────────────────────────────────────────

type Toast = { id: number; message: string; tone: 'success' | 'error' };

const ToastContext = createContext<{
  notify: (message: string, tone?: Toast['tone']) => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 5000);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-6 right-6 z-[60] flex w-80 flex-col gap-3"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-card border p-4 shadow-lift',
              'animate-[slide-up_0.3s_cubic-bezier(0.22,1,0.36,1)]',
              toast.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-red-200 bg-red-50',
            )}
          >
            <Icon
              name={toast.tone === 'success' ? 'check_circle' : 'error'}
              size="sm"
              className={cn(
                'mt-0.5 shrink-0',
                toast.tone === 'success' ? 'text-emerald-600' : 'text-red-600',
              )}
            />
            <p
              className={cn(
                'text-base',
                toast.tone === 'success' ? 'text-emerald-900' : 'text-red-900',
              )}
            >
              {toast.message}
            </p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Shows a short confirmation or failure message.
 *
 * Falls back to a no-op outside the provider so a component can be rendered
 * in isolation without blowing up.
 */
export function useToast() {
  return useContext(ToastContext) ?? { notify: () => undefined };
}

// ── Pagination ──────────────────────────────────────────────────────────────

export function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) {
    return (
      <p className="px-6 py-4 text-base text-ink-muted">
        <span className="font-mono">{total}</span> {total === 1 ? 'record' : 'records'}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
      <p className="text-base text-ink-muted">
        Page <span className="font-mono">{page}</span> of{' '}
        <span className="font-mono">{totalPages}</span> ·{' '}
        <span className="font-mono">{total}</span> records
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          icon="chevron_left"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </Button>
        <Button variant="ghost" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          Next
          <Icon name="chevron_right" size="sm" />
        </Button>
      </div>
    </div>
  );
}

// ── Search box ──────────────────────────────────────────────────────────────

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative w-full sm:w-72">
      <Icon
        name="search"
        size="sm"
        className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft"
      />
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="pl-11"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink"
          aria-label="Clear search"
        >
          <Icon name="close" size="sm" />
        </button>
      )}
    </div>
  );
}
