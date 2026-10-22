'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Logo } from '@/components/ui/Logo';
import { cn } from '@/lib/cn';

/**
 * The frame shared by every page you can reach without being signed in.
 *
 * Same dark teal glass as the sign-in card, so changing a password does not
 * feel like landing on a different website.
 */
export function AuthShell({
  title,
  description,
  children,
  footer,
  backHref = '/admin/login',
  backLabel = 'Back to sign in',
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  backHref?: string | null;
  backLabel?: string;
}) {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-primary-950 px-6 py-12">
      <div className="absolute inset-0 bg-grid" aria-hidden="true" />
      <div
        className="pointer-events-none absolute -left-32 top-0 h-[32rem] w-[32rem] rounded-full opacity-25 blur-3xl"
        style={{ background: 'radial-gradient(circle, #3a9291, transparent 70%)' }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-24 bottom-0 h-96 w-96 rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, #c19766, transparent 70%)' }}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <Logo variant="light" priority className="mx-auto h-12 w-auto" />
          </Link>
          <p className="eyebrow mt-6">Administration</p>
        </div>

        <div className="rounded-panel border border-white/10 bg-white/[0.06] p-8 shadow-deep backdrop-blur-xl">
          <h1 className="text-h4 text-white">{title}</h1>
          {description && <p className="mt-2 text-small text-primary-200">{description}</p>}
          <div className="mt-8">{children}</div>
        </div>

        {footer && <div className="mt-6 text-center">{footer}</div>}

        {backHref && (
          <div className="mt-4 text-center">
            <Link
              href={backHref}
              className="inline-flex items-center gap-1 text-small text-primary-300 transition-colors hover:text-white"
            >
              <Icon name="arrow_back" size="sm" />
              {backLabel}
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

/** A dark-glass text field matching the sign-in form. */
export function AuthField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-small font-medium text-primary-100">{label}</label>
      {children}
      {error && <p className="mt-2 text-small text-secondary-200">{error}</p>}
    </div>
  );
}

export function AuthInput({
  invalid,
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...rest}
      aria-invalid={invalid}
      className={cn(
        'field border-white/20 bg-white/10 text-white placeholder:text-primary-300',
        'focus:border-secondary focus:ring-secondary/20',
        invalid && 'border-secondary-400',
        className,
      )}
    />
  );
}

/** A password field with a reveal toggle. */
export function AuthPassword({
  label,
  value,
  onChange,
  error,
  autoComplete = 'new-password',
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  error?: string;
  autoComplete?: string;
  autoFocus?: boolean;
}) {
  const [shown, setShown] = useState(false);

  return (
    <AuthField label={label} error={error}>
      <div className="relative">
        <AuthInput
          type={shown ? 'text' : 'password'}
          required
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          value={value}
          invalid={Boolean(error)}
          onChange={(event) => onChange(event.target.value)}
          placeholder="••••••••••••"
          className="pr-12"
        />
        <button
          type="button"
          onClick={() => setShown((current) => !current)}
          className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded text-primary-300 transition-colors hover:text-white"
          aria-label={shown ? 'Hide password' : 'Show password'}
        >
          <Icon name={shown ? 'visibility_off' : 'visibility'} size="sm" />
        </button>
      </div>
    </AuthField>
  );
}

export function AuthSubmit({
  busy,
  children,
  busyLabel,
  disabled,
}: {
  busy: boolean;
  children: ReactNode;
  busyLabel: string;
  disabled?: boolean;
}) {
  return (
    <button type="submit" disabled={busy || disabled} className="btn-secondary w-full">
      {busy ? (
        <>
          <Icon name="progress_activity" size="sm" className="animate-spin" />
          {busyLabel}
        </>
      ) : (
        <>
          {children}
          <Icon name="arrow_forward" size="sm" />
        </>
      )}
    </button>
  );
}

export function AuthAlert({
  tone,
  children,
}: {
  tone: 'error' | 'success';
  children: ReactNode;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-card p-4',
        tone === 'error' ? 'bg-secondary-500/15' : 'bg-emerald-500/15',
      )}
    >
      <Icon
        name={tone === 'error' ? 'error' : 'check_circle'}
        size="sm"
        className={cn(
          'mt-0.5 shrink-0',
          tone === 'error' ? 'text-secondary-300' : 'text-emerald-300',
        )}
      />
      <p
        className={cn(
          'text-small',
          tone === 'error' ? 'text-secondary-100' : 'text-emerald-50',
        )}
      >
        {children}
      </p>
    </div>
  );
}

/**
 * A live read on whether the password will be accepted.
 *
 * The rules are the backend's, restated here so the editor finds out before
 * submitting rather than after. The server still enforces them; this only
 * saves a round trip.
 */
export function PasswordRules({ password }: { password: string }) {
  const rules = [
    { label: 'At least 12 characters', met: password.length >= 12 },
    { label: 'Not a single repeated character', met: !/^(.)\1+$/.test(password) },
    {
      label: 'Mixes letters with numbers or symbols',
      met: /[a-zA-Z]/.test(password) && /[^a-zA-Z]/.test(password),
    },
  ];

  return (
    <ul className="space-y-2">
      {rules.map((rule) => (
        <li key={rule.label} className="flex items-center gap-2 text-small">
          <Icon
            name={rule.met ? 'check_circle' : 'radio_button_unchecked'}
            size="sm"
            className={rule.met ? 'text-emerald-300' : 'text-primary-400'}
          />
          <span className={rule.met ? 'text-primary-100' : 'text-primary-300'}>
            {rule.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
