'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';

/**
 * The only way into the dashboard.
 *
 * There is no "create an account" link, because there is no registration
 * endpoint — the first administrator comes from `npm run db:seed:admin` and
 * every later one from an existing super-admin. Saying so on the page saves
 * someone hunting for a sign-up button that will never exist.
 */
export default function LoginPage() {
  const { signIn, user, loading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Already signed in: skip the form.
  useEffect(() => {
    if (!loading && user) router.replace('/admin/dashboard');
  }, [loading, user, router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError('');
    setFieldErrors({});

    try {
      const result = await signIn(email, password);
      router.replace(
        result.mustChangePassword ? '/admin/change-password' : '/admin/dashboard',
      );
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
          <h1 className="text-h4 text-white">Sign in</h1>
          <p className="mt-2 text-small text-primary-200">
            Manage publications, the team page and site content.
          </p>

          <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
            <div>
              <label htmlFor="email" className="mb-2 block text-small font-medium text-primary-100">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={Boolean(fieldErrors.email)}
                className={cn(
                  'field border-white/20 bg-white/10 text-white placeholder:text-primary-300',
                  'focus:border-secondary focus:ring-secondary/20',
                  fieldErrors.email && 'border-secondary-400',
                )}
                placeholder="admin@neotericlp.com.ng"
              />
              {fieldErrors.email && (
                <p className="mt-2 text-small text-secondary-200">{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-small font-medium text-primary-100"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={Boolean(fieldErrors.password)}
                  className={cn(
                    'field border-white/20 bg-white/10 pr-12 text-white placeholder:text-primary-300',
                    'focus:border-secondary focus:ring-secondary/20',
                    fieldErrors.password && 'border-secondary-400',
                  )}
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((shown) => !shown)}
                  className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded text-primary-300 transition-colors hover:text-white"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Icon name={showPassword ? 'visibility_off' : 'visibility'} size="sm" />
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-2 text-small text-secondary-200">{fieldErrors.password}</p>
              )}
            </div>

            {error && !Object.keys(fieldErrors).length && (
              <div
                className="flex items-start gap-3 rounded-card bg-secondary-500/15 p-4"
                role="alert"
              >
                <Icon name="error" size="sm" className="mt-0.5 shrink-0 text-secondary-300" />
                <p className="text-small text-secondary-100">{error}</p>
              </div>
            )}

            <button type="submit" disabled={submitting} className="btn-secondary w-full">
              {submitting ? (
                <>
                  <Icon name="progress_activity" size="sm" className="animate-spin" />
                  Signing in
                </>
              ) : (
                <>
                  Sign in
                  <Icon name="arrow_forward" size="sm" />
                </>
              )}
            </button>

            <div className="text-center">
              <Link
                href="/admin/forgot-password"
                className="text-small text-primary-200 underline-offset-4 transition-colors hover:text-white hover:underline"
              >
                Forgot your password?
              </Link>
            </div>
          </form>
        </div>

        <p className="mt-6 text-center text-caption text-primary-400">
          Accounts are created by an administrator. There is no public sign-up.
        </p>

        <div className="mt-4 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-small text-primary-300 transition-colors hover:text-white"
          >
            <Icon name="arrow_back" size="sm" />
            Back to the website
          </Link>
        </div>
      </div>
    </main>
  );
}
