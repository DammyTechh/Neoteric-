'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { LogoMark } from '@/components/ui/Logo';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import type { AdminRole } from '@/lib/types';

interface NavItem {
  label: string;
  href: string;
  icon: string;
  /** Minimum role. Omitted means any signed-in operator. */
  role?: AdminRole;
}

const NAV_GROUPS: { heading: string; items: NavItem[] }[] = [
  {
    heading: 'Content',
    items: [
      { label: 'Dashboard', href: '/admin/dashboard', icon: 'dashboard' },
      { label: 'Publications', href: '/admin/publications', icon: 'article' },
      { label: 'Categories', href: '/admin/content/categories', icon: 'sell' },
      { label: 'Media library', href: '/admin/media', icon: 'perm_media' },
    ],
  },
  {
    heading: 'The firm',
    items: [
      { label: 'Practice areas', href: '/admin/content/practice-areas', icon: 'gavel' },
      { label: 'Industries', href: '/admin/content/industries', icon: 'apartment' },
      { label: 'Team', href: '/admin/content/team', icon: 'groups' },
      { label: 'Testimonials', href: '/admin/content/testimonials', icon: 'format_quote' },
      { label: 'Achievements', href: '/admin/content/achievements', icon: 'trending_up' },
    ],
  },
  {
    heading: 'Engagement',
    items: [
      { label: 'Enquiries', href: '/admin/inquiries', icon: 'inbox', role: 'admin' },
      { label: 'Newsletter', href: '/admin/newsletter', icon: 'mail', role: 'admin' },
    ],
  },
  {
    heading: 'Administration',
    items: [
      { label: 'Site settings', href: '/admin/settings', icon: 'settings', role: 'admin' },
      { label: 'Operators', href: '/admin/users', icon: 'manage_accounts', role: 'super_admin' },
      { label: 'Audit log', href: '/admin/audit', icon: 'history', role: 'super_admin' },
    ],
  },
];

const ROLE_RANK: Record<AdminRole, number> = { editor: 1, admin: 2, super_admin: 3 };

/**
 * The dashboard chrome: guard, sidebar, top bar.
 *
 * The guard runs client-side because the access token lives in memory — there
 * is no cookie a server component could read to make this decision, which is
 * the trade for not putting a token anywhere injected script can reach.
 * `/admin` is `noindex` and every API call is authorised server-side
 * regardless, so this is a navigation convenience rather than the security
 * boundary.
 */
export function AdminShell({
  children,
  title,
  description,
  actions,
}: {
  children: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/admin/login');
  }, [loading, user, router]);

  // An operator who must change their password gets no further.
  useEffect(() => {
    if (user?.mustChangePassword && pathname !== '/admin/change-password') {
      router.replace('/admin/change-password');
    }
  }, [user, pathname, router]);

  useEffect(() => setSidebarOpen(false), [pathname]);

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-surface-sunken">
        <div className="flex items-center gap-3 text-ink-muted">
          <Icon name="progress_activity" className="animate-spin" />
          <span className="text-base">Loading…</span>
        </div>
      </div>
    );
  }

  const canSee = (item: NavItem) =>
    !item.role || ROLE_RANK[user.role] >= ROLE_RANK[item.role];

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
        <LogoMark className="h-9 w-9" />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold leading-tight text-white">
            Neoteric LP
          </p>
          <p className="truncate text-caption uppercase tracking-[0.14em] text-primary-300">
            Dashboard
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter(canSee);
          if (items.length === 0) return null;

          return (
            <div key={group.heading} className="mb-6">
              <p className="px-3 pb-3 text-caption font-medium uppercase tracking-[0.16em] text-primary-400/90">
                {group.heading}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        /*
                          Every page under /admin is force-dynamic, so there
                          is no RSC payload to prefetch — Next tries anyway on
                          hover and logs a failed request for each link in
                          this rail. Nothing is lost by turning it off: these
                          pages fetch their own data after navigating.
                        */
                        prefetch={false}
                        className={cn(
                          'group flex items-center gap-3 rounded-card px-3 py-2.5',
                          'text-base transition-colors duration-200',
                          active
                            ? 'bg-white/[0.12] font-medium text-white'
                            : 'text-primary-200 hover:bg-white/[0.07] hover:text-white',
                        )}
                      >
                        {/* The icon sits in a fixed box so every label starts
                            on the same vertical line, whatever the glyph. */}
                        <span
                          className={cn(
                            'grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors duration-200',
                            active
                              ? 'bg-secondary/20 text-secondary'
                              : 'text-primary-300 group-hover:text-white',
                          )}
                        >
                          <Icon name={item.icon} />
                        </span>
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <Link
          href="/"
          target="_blank"
          className="group flex items-center gap-3 rounded-card px-3 py-2.5 text-base text-primary-200 transition-colors hover:bg-white/[0.07] hover:text-white"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-primary-300 transition-colors group-hover:text-white">
            <Icon name="open_in_new" />
          </span>
          View the website
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface-sunken">
      {/* ── Sidebar, desktop ─────────────────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 bg-primary-950 lg:block">
        {sidebar}
      </aside>

      {/* ── Sidebar, mobile ──────────────────────────────────────────────── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-primary-950/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          />
          <aside className="absolute inset-y-0 left-0 w-72 bg-primary-950 shadow-deep">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-72">
        {/* ── Top bar ────────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-30 border-b border-surface-line bg-surface/90 backdrop-blur-xl">
          <div className="flex items-center gap-4 px-4 py-4 md:px-8">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-card text-ink transition-colors hover:bg-surface-sunken lg:hidden"
              aria-label="Open menu"
            >
              <Icon name="menu" />
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-h4 font-semibold tracking-[-0.01em] text-ink">
                {title}
              </h1>
              {description && (
                <p className="mt-1 truncate text-base text-ink-muted">{description}</p>
              )}
            </div>

            {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}

            <div className="relative shrink-0">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-surface-line px-2 py-1.5 transition-colors hover:bg-surface-sunken">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-small font-medium text-white">
                    {user.fullName
                      .split(' ')
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join('')}
                  </span>
                  <Icon name="expand_more" size="sm" className="text-ink-muted" />
                </summary>

                <div className="absolute right-0 top-full z-40 mt-2 w-60 overflow-hidden rounded-card border border-surface-line bg-surface shadow-lift">
                  <div className="border-b border-surface-line px-4 py-3">
                    <p className="truncate text-base font-medium text-ink">{user.fullName}</p>
                    <p className="truncate text-small text-ink-muted">{user.email}</p>
                    <p className="mt-1.5 text-caption font-medium uppercase tracking-[0.12em] text-secondary">
                      {user.role.replace('_', ' ')}
                    </p>
                  </div>
                  <Link
                    href="/admin/change-password"
                    className="flex items-center gap-3 px-4 py-3 text-base text-ink transition-colors hover:bg-surface-sunken"
                  >
                    <Icon name="lock" size="sm" className="text-ink-muted" />
                    Change password
                  </Link>
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-base text-secondary-700 transition-colors hover:bg-secondary-50"
                  >
                    <Icon name="logout" size="sm" />
                    Sign out
                  </button>
                </div>
              </details>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
