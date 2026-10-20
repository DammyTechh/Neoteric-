'use client';

import { useState, type FormEvent } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ApiError, apiPost } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { PracticeArea } from '@/lib/types';

type Status = 'idle' | 'sending' | 'done' | 'error';

interface SubmitResult {
  reference: string;
}

/**
 * The contact form.
 *
 * v1 had no form at all — just an email address on the page. This files a
 * tracked enquiry, returns the reference the firm will quote back, and sends
 * both an acknowledgement and an internal notification.
 */
export function ContactForm({ practiceAreas }: { practiceAreas: PracticeArea[] }) {
  const [status, setStatus] = useState<Status>('idle');
  const [reference, setReference] = useState('');
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'sending') return;

    const form = new FormData(event.currentTarget);
    setStatus('sending');
    setFieldErrors({});

    try {
      const result = await apiPost<SubmitResult>('/contact', {
        fullName: form.get('fullName'),
        email: form.get('email'),
        phone: form.get('phone') || null,
        company: form.get('company') || null,
        subject: form.get('subject') || null,
        message: form.get('message'),
        practiceAreaId: form.get('practiceAreaId') || null,
        website: form.get('website'),
      });

      setReference(result.data.reference);
      setMessage(result.message ?? 'Thank you. We will respond shortly.');
      setStatus('done');
    } catch (error) {
      if (error instanceof ApiError) {
        setFieldErrors(error.fieldErrors);
        setMessage(error.message);
      } else {
        setMessage('We could not send your message just now. Please try again.');
      }
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <div className="card p-8 text-center" role="status">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary-50 text-primary">
          <Icon name="check_circle" size="xl" />
        </span>

        <h3 className="mt-6 text-h5">Message received</h3>
        <p className="mt-3 text-ink-muted text-pretty">{message}</p>

        <div className="mt-6 rounded-card bg-surface-sunken p-4">
          <p className="eyebrow mb-2">Your reference</p>
          <p className="mono text-h5 text-primary">{reference}</p>
        </div>

        <p className="mt-4 text-small text-ink-soft">
          A copy has been sent to your inbox.
        </p>
      </div>
    );
  }

  const errorFor = (field: string) => fieldErrors[field];

  return (
    <form onSubmit={handleSubmit} noValidate className="card p-6 md:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" name="fullName" required error={errorFor('fullName')} autoComplete="name" />
        <Field label="Email" name="email" type="email" required error={errorFor('email')} autoComplete="email" />
        <Field label="Phone" name="phone" type="tel" error={errorFor('phone')} autoComplete="tel" />
        <Field label="Company" name="company" error={errorFor('company')} autoComplete="organization" />
      </div>

      {practiceAreas.length > 0 && (
        <div className="mt-5">
          <label htmlFor="practiceAreaId" className="mb-2 block text-small font-medium text-ink">
            What is this about?
          </label>
          <select id="practiceAreaId" name="practiceAreaId" className="field" defaultValue="">
            <option value="">Select a practice area (optional)</option>
            {practiceAreas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-5">
        <Field label="Subject" name="subject" error={errorFor('subject')} />
      </div>

      <div className="mt-5">
        <label htmlFor="message" className="mb-2 block text-small font-medium text-ink">
          Message <span className="text-secondary">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          required
          className={cn('field resize-y', errorFor('message') && 'border-secondary-500')}
          placeholder="Tell us a little about your matter."
        />
        {errorFor('message') && (
          <p className="mt-2 text-small text-secondary-700">{errorFor('message')}</p>
        )}
      </div>

      {/* Honeypot */}
      <div className="absolute left-[-9999px]" aria-hidden="true">
        <label htmlFor="website">Leave this empty</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {status === 'error' && !Object.keys(fieldErrors).length && (
        <p className="mt-5 rounded-card bg-secondary-50 p-4 text-small text-secondary-800" role="alert">
          {message}
        </p>
      )}

      <button type="submit" disabled={status === 'sending'} className="btn-primary mt-6 w-full sm:w-auto">
        {status === 'sending' ? (
          <>
            <Icon name="progress_activity" size="sm" className="animate-spin" />
            Sending
          </>
        ) : (
          <>
            Send message
            <Icon name="send" size="sm" />
          </>
        )}
      </button>

      <p className="mt-4 text-caption text-ink-soft text-pretty">
        Sending this message does not create a solicitor–client relationship, and nothing
        in our reply constitutes legal advice until we are formally engaged.
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  type = 'text',
  required = false,
  error,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  error?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-2 block text-small font-medium text-ink">
        {label} {required && <span className="text-secondary">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        className={cn('field', error && 'border-secondary-500')}
      />
      {error && <p className="mt-2 text-small text-secondary-700">{error}</p>}
    </div>
  );
}
