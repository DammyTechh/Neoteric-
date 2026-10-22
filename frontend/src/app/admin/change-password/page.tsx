'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Icon } from '@/components/ui/Icon';
import {
  AuthAlert,
  AuthPassword,
  AuthShell,
  AuthSubmit,
  PasswordRules,
} from '@/components/admin/AuthShell';

/**
 * Changes the password of the operator who is signed in.
 *
 * Reached two ways: from the account menu, and automatically after a first
 * sign-in with an emailed password — `mustChangePassword` on the account sends
 * them here and the shell keeps them here until it is done.
 */
export default function ChangePasswordPage() {
  const { user, loading, token, refresh } = useAuth();
  const router = useRouter();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  const forced = Boolean(user?.mustChangePassword);
  const mismatch = confirmation.length > 0 && confirmation !== next;
  const sameAsCurrent = next.length > 0 && next === current;

  useEffect(() => {
    if (!loading && !user) router.replace('/admin/login');
  }, [loading, user, router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting || mismatch || sameAsCurrent) return;

    setSubmitting(true);
    setError('');
    setFieldErrors({});

    try {
      await apiPost(
        '/auth/change-password',
        { currentPassword: current, newPassword: next },
        { token, credentials: 'include' },
      );

      setDone(true);

      /*
       * The backend revokes every refresh token on a password change, so the
       * cookie this tab holds is now dead. Minting a fresh one keeps the
       * editor signed in here rather than bouncing them to the login form
       * seconds after they proved who they are.
       */
      await refresh();
      setTimeout(() => router.replace('/admin/dashboard'), 1800);
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

  if (done) {
    return (
      <AuthShell title="Password changed" backHref={null}>
        <AuthAlert tone="success">
          Saved. Other devices have been signed out. Taking you to the dashboard.
        </AuthAlert>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={forced ? 'Set your password' : 'Change your password'}
      description={
        forced
          ? 'Your account was created with a temporary password. Choose your own to continue.'
          : undefined
      }
      backHref={forced ? null : '/admin/dashboard'}
      backLabel="Back to the dashboard"
      footer={
        forced ? (
          <p className="text-caption text-primary-400">
            This is the last step before you can use the dashboard.
          </p>
        ) : undefined
      }
    >
      {forced && (
        <div className="mb-6 flex items-start gap-3 rounded-card bg-secondary-500/15 p-4">
          <Icon name="key" size="sm" className="mt-0.5 shrink-0 text-secondary-300" />
          <p className="text-small text-secondary-100">
            The password from your invitation email works only for this step.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <AuthPassword
          label={forced ? 'Password from the email' : 'Current password'}
          value={current}
          onChange={setCurrent}
          error={fieldErrors.currentPassword}
          autoComplete="current-password"
          autoFocus
        />

        <AuthPassword
          label="New password"
          value={next}
          onChange={setNext}
          error={
            sameAsCurrent
              ? 'This has to be different from the current one.'
              : fieldErrors.newPassword
          }
        />

        <AuthPassword
          label="Type it again"
          value={confirmation}
          onChange={setConfirmation}
          error={mismatch ? 'These two do not match.' : undefined}
        />

        <div className="rounded-card bg-white/5 p-4">
          <PasswordRules password={next} />
        </div>

        {error && !Object.keys(fieldErrors).length && (
          <AuthAlert tone="error">{error}</AuthAlert>
        )}

        <AuthSubmit
          busy={submitting}
          busyLabel="Saving"
          disabled={!current || next.length < 12 || mismatch || sameAsCurrent}
        >
          Save the password
        </AuthSubmit>
      </form>
    </AuthShell>
  );
}
