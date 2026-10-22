'use client';

import { useState, type FormEvent } from 'react';
import { apiPost } from '@/lib/api';
import {
  AuthAlert,
  AuthField,
  AuthInput,
  AuthShell,
  AuthSubmit,
} from '@/components/admin/AuthShell';

/**
 * Requests a reset link.
 *
 * The response is the same whether or not the address belongs to an account,
 * and this page repeats that wording, because telling a stranger which
 * addresses exist is how an attacker builds a target list.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError('');

    try {
      await apiPost('/auth/forgot-password', { email });
      setSent(true);
    } catch {
      // Even a failure here must not reveal whether the account exists; the
      // only honest thing to report is that the request did not go through.
      setError('Could not reach the server. Please try again in a moment.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title={sent ? 'Check your email' : 'Reset your password'}
      description={
        sent
          ? undefined
          : 'We will email you a link to set a new one. The link lasts an hour.'
      }
    >
      {sent ? (
        <div className="space-y-6">
          <AuthAlert tone="success">
            If <span className="font-mono">{email}</span> belongs to an operator account,
            a reset link is on its way. It expires in an hour.
          </AuthAlert>

          <p className="text-small text-primary-200">
            Nothing arrived? Check the spam folder, confirm the address is the one the
            firm uses, or ask a super-administrator to look you up.
          </p>

          <button
            type="button"
            onClick={() => {
              setSent(false);
              setEmail('');
            }}
            className="text-small text-primary-200 underline-offset-4 transition-colors hover:text-white hover:underline"
          >
            Use a different address
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          <AuthField label="Email">
            <AuthInput
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@neotericlp.com.ng"
            />
          </AuthField>

          {error && <AuthAlert tone="error">{error}</AuthAlert>}

          <AuthSubmit busy={submitting} busyLabel="Sending" disabled={!email}>
            Send the link
          </AuthSubmit>
        </form>
      )}
    </AuthShell>
  );
}
