'use client';

import { Suspense, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ApiError, apiPost } from '@/lib/api';
import {
  AuthAlert,
  AuthPassword,
  AuthShell,
  AuthSubmit,
  PasswordRules,
} from '@/components/admin/AuthShell';

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  const mismatch = confirmation.length > 0 && confirmation !== password;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting || mismatch) return;

    setSubmitting(true);
    setError('');
    setFieldErrors({});

    try {
      await apiPost('/auth/reset-password', { token, password });
      setDone(true);
      // A moment to read the confirmation, then on to the sign-in form.
      setTimeout(() => router.replace('/admin/login'), 2500);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setFieldErrors(caught.fieldErrors);
        setError(caught.message);
      } else {
        setError('Could not reach the server. Please try again.');
      }
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <AuthShell title="This link is incomplete">
        <div className="space-y-6">
          <AuthAlert tone="error">
            The reset link is missing its token. Links can be broken by an email client
            that wraps long lines — try copying the whole address from the email, or
            request a fresh one.
          </AuthAlert>

          <Link href="/admin/forgot-password" className="btn-secondary w-full">
            Request a new link
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell title="Password changed">
        <div className="space-y-6">
          <AuthAlert tone="success">
            Your new password is saved, and every other session has been signed out.
            Taking you to the sign-in page.
          </AuthAlert>

          <Link href="/admin/login" className="btn-secondary w-full">
            Sign in now
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" description="Make it one you do not use elsewhere.">
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <AuthPassword
          label="New password"
          value={password}
          onChange={setPassword}
          error={fieldErrors.password}
          autoFocus
        />

        <AuthPassword
          label="Type it again"
          value={confirmation}
          onChange={setConfirmation}
          error={mismatch ? 'These two do not match.' : undefined}
        />

        <div className="rounded-card bg-white/5 p-4">
          <PasswordRules password={password} />
        </div>

        {error && !Object.keys(fieldErrors).length && (
          <AuthAlert tone="error">{error}</AuthAlert>
        )}

        <AuthSubmit
          busy={submitting}
          busyLabel="Saving"
          disabled={password.length < 12 || mismatch}
        >
          Save the password
        </AuthSubmit>
      </form>
    </AuthShell>
  );
}

/**
 * `useSearchParams` makes this page client-rendered, which Next wants wrapped
 * in a Suspense boundary so the shell can be served while the token is read.
 */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthShell title="Reset your password"><div /></AuthShell>}>
      <ResetForm />
    </Suspense>
  );
}
