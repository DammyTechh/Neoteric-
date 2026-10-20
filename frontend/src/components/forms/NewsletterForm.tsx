'use client';

import { useState, type FormEvent } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ApiError, apiPost } from '@/lib/api';
import { cn } from '@/lib/cn';

type Status = 'idle' | 'sending' | 'done' | 'error';

/**
 * Newsletter sign-up.
 *
 * Double opt-in on the backend, so success here means "check your inbox",
 * not "you are subscribed" — saying the latter would be a lie the reader
 * discovers when no email ever arrives.
 */
export function NewsletterForm({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  /** Honeypot. Hidden from people, irresistible to naive bots. */
  const [website, setWebsite] = useState('');

  const dark = variant === 'dark';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (status === 'sending') return;

    setStatus('sending');

    try {
      const result = await apiPost('/newsletter/subscribe', { email, website });
      setStatus('done');
      setMessage(result.message ?? 'Please check your inbox to confirm.');
      setEmail('');
    } catch (error) {
      setStatus('error');
      setMessage(
        error instanceof ApiError
          ? error.message
          : 'We could not sign you up just now. Please try again.',
      );
    }
  }

  if (status === 'done') {
    return (
      <div
        className={cn(
          'flex items-start gap-3 rounded-card p-4',
          dark ? 'bg-white/10 text-primary-100' : 'bg-primary-50 text-primary-800',
        )}
        role="status"
      >
        <Icon name="mark_email_read" className={dark ? 'text-secondary' : 'text-primary'} />
        <p className="text-small text-pretty">{message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="flex flex-col sm:flex-row gap-3">
        <label htmlFor={`newsletter-email-${variant}`} className="sr-only">
          Email address
        </label>
        <input
          id={`newsletter-email-${variant}`}
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          className={cn(
            'field flex-1',
            dark &&
              'bg-white/10 border-white/20 text-white placeholder:text-primary-300 focus:border-secondary focus:ring-secondary/20',
          )}
        />

        <button
          type="submit"
          disabled={status === 'sending'}
          className={cn(dark ? 'btn-secondary' : 'btn-primary', 'shrink-0')}
        >
          {status === 'sending' ? (
            <>
              <Icon name="progress_activity" size="sm" className="animate-spin" />
              Signing up
            </>
          ) : (
            <>
              Subscribe
              <Icon name="arrow_forward" size="sm" />
            </>
          )}
        </button>
      </div>

      {/* Hidden from people and from screen readers; bots fill it anyway. */}
      <div className="absolute left-[-9999px]" aria-hidden="true">
        <label htmlFor={`website-${variant}`}>Leave this empty</label>
        <input
          id={`website-${variant}`}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </div>

      {status === 'error' && (
        <p
          className={cn('mt-3 text-small', dark ? 'text-secondary-200' : 'text-secondary-700')}
          role="alert"
        >
          {message}
        </p>
      )}
    </form>
  );
}
