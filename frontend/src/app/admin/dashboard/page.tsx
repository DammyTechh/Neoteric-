'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminShell } from '@/components/admin/Shell';
import {
  Button,
  EmptyState,
  ErrorState,
  Panel,
  Pill,
  Spinner,
  StatusPill,
  Table,
  Td,
  Th,
} from '@/components/admin/ui';
import { Icon } from '@/components/ui/Icon';
import { useApi, useAuth } from '@/lib/auth';
import { formatNumber, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { ContactInquiry, DashboardStats, Publication } from '@/lib/types';

/**
 * A single headline number.
 *
 * The figure is monospace — it is a number, and numerals line up in columns
 * when they share a width. Everything else on the tile is Archivo.
 */
function StatTile({
  label,
  value,
  icon,
  href,
  detail,
  accent = false,
}: {
  label: string;
  value: number;
  icon: string;
  href: string;
  detail?: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group relative overflow-hidden rounded-panel border p-6',
        'transition-all duration-500 ease-physical hover:-translate-y-1',
        accent
          ? 'border-transparent bg-primary text-white shadow-lift hover:shadow-deep'
          : 'border-surface-line bg-surface shadow-float hover:shadow-lift',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <span
          className={cn(
            'grid h-11 w-11 place-items-center rounded-card',
            accent ? 'bg-white/15 text-white' : 'bg-primary-50 text-primary',
          )}
        >
          <Icon name={icon} />
        </span>
        <Icon
          name="arrow_outward"
          size="sm"
          className={cn(
            'transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5',
            accent ? 'text-white/50' : 'text-ink-soft',
          )}
        />
      </div>

      <p
        className={cn(
          'mt-6 font-mono text-h2 font-semibold tabular-nums',
          accent ? 'text-white' : 'text-ink',
        )}
      >
        {formatNumber(value)}
      </p>
      <p className={cn('mt-1 text-small', accent ? 'text-primary-100' : 'text-ink-muted')}>
        {label}
      </p>
      {detail && (
        <p className={cn('mt-3 text-caption', accent ? 'text-primary-200' : 'text-ink-soft')}>
          {detail}
        </p>
      )}
    </Link>
  );
}

export default function DashboardPage() {
  const api = useApi();
  const { user } = useAuth();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recent, setRecent] = useState<Publication[]>([]);
  const [inquiries, setInquiries] = useState<ContactInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isAdmin = user ? user.role !== 'editor' : false;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      /*
       * Three independent reads, so they go out together rather than in
       * sequence — the dashboard is the first thing an editor sees after
       * signing in and should not take three round trips to appear.
       *
       * Enquiries are admin-only, so an editor's request would 403. Rather
       * than let one forbidden panel fail the whole page, that read is
       * skipped by role and the panel simply is not rendered.
       */
      const [statsResult, publicationsResult, inquiriesResult] = await Promise.all([
        api.get<DashboardStats>('/admin/dashboard/stats'),
        api.list<Publication>('/admin/publications', { limit: 6, sortBy: 'updated_at' }),
        isAdmin
          ? api.list<ContactInquiry>('/admin/inquiries', { limit: 5, status: 'new' })
          : Promise.resolve({ items: [] as ContactInquiry[] }),
      ]);

      setStats(statsResult);
      setRecent(publicationsResult.items);
      setInquiries(inquiriesResult.items);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api, isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const greeting = user?.fullName.split(' ')[0] ?? 'there';

  return (
    <AdminShell
      title={`Good to see you, ${greeting}`}
      description="Everything on the website, in one place."
      actions={
        <Button
          variant="secondary"
          icon="add"
          onClick={() => {
            window.location.href = '/admin/publications/new';
          }}
        >
          <span className="hidden sm:inline">New publication</span>
        </Button>
      }
    >
      {loading ? (
        <Panel padded={false}>
          <Spinner label="Gathering your numbers…" />
        </Panel>
      ) : error ? (
        <Panel padded={false}>
          <ErrorState message={error} onRetry={() => void load()} />
        </Panel>
      ) : (
        stats && (
          <div className="space-y-8">
            {/* ── Headline numbers ─────────────────────────────────────── */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile
                label="Published articles"
                value={stats.publicationsPublished}
                icon="article"
                href="/admin/publications?status=published"
                detail={`${stats.publicationsDraft} in draft · ${stats.publicationsScheduled} scheduled`}
                accent
              />
              <StatTile
                label="Article reads"
                value={stats.publicationsViews}
                icon="visibility"
                href="/admin/publications"
                detail="Since the site went live"
              />
              {isAdmin ? (
                <StatTile
                  label="New enquiries"
                  value={stats.inquiriesNew}
                  icon="inbox"
                  href="/admin/inquiries?status=new"
                  detail={`${stats.inquiriesTotal} received in total`}
                />
              ) : (
                <StatTile
                  label="Media files"
                  value={stats.mediaTotal}
                  icon="perm_media"
                  href="/admin/media"
                  detail="Images and documents"
                />
              )}
              <StatTile
                label="Newsletter subscribers"
                value={stats.subscribersActive}
                icon="mail"
                href={isAdmin ? '/admin/newsletter' : '/admin/dashboard'}
                detail="Confirmed and active"
              />
            </div>

            {/* ── Content counts ───────────────────────────────────────── */}
            <Panel
              title="On the website"
              description="What visitors can see right now."
            >
              <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: 'Practice areas', value: stats.practiceAreasActive, href: '/admin/content/practice-areas', icon: 'gavel' },
                  { label: 'Industries', value: stats.industriesActive, href: '/admin/content/industries', icon: 'apartment' },
                  { label: 'Team members', value: stats.teamActive, href: '/admin/content/team', icon: 'groups' },
                  { label: 'Testimonials', value: stats.testimonialsPublished, href: '/admin/content/testimonials', icon: 'format_quote' },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-4 rounded-card border border-surface-line p-4 transition-colors duration-200 hover:border-primary-200 hover:bg-primary-50/40"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-card bg-surface-sunken text-ink-muted">
                      <Icon name={item.icon} size="sm" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-mono text-h5 font-semibold tabular-nums text-ink">
                        {item.value}
                      </p>
                      <p className="truncate text-small text-ink-muted">{item.label}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </Panel>

            <div className="grid gap-6 xl:grid-cols-5">
              {/* ── Recently edited ───────────────────────────────────── */}
              <Panel
                className="xl:col-span-3"
                padded={false}
                title="Recently edited"
                description="Your six most recently touched articles."
                actions={
                  <Link
                    href="/admin/publications"
                    className="text-small font-medium text-primary underline-offset-4 hover:underline"
                  >
                    View all
                  </Link>
                }
              >
                {recent.length === 0 ? (
                  <EmptyState
                    icon="article"
                    title="No publications yet"
                    description="Write the first piece, or import one from a document."
                    action={
                      <Link href="/admin/publications/new">
                        <Button variant="secondary" icon="add">
                          New publication
                        </Button>
                      </Link>
                    }
                  />
                ) : (
                  <Table>
                    <thead>
                      <tr>
                        <Th>Title</Th>
                        <Th className="w-32">Status</Th>
                        <Th className="w-32">Updated</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((publication) => (
                        <tr key={publication.id} className="group">
                          <Td>
                            <Link
                              href={`/admin/publications/${publication.id}`}
                              prefetch={false}
                              className="font-medium text-ink transition-colors group-hover:text-primary"
                            >
                              {publication.title}
                            </Link>
                            <p className="mt-1 flex items-center gap-2 text-caption text-ink-soft">
                              {publication.body ? (
                                <>
                                  <Icon name="check_circle" size="sm" className="text-[0.95rem] text-emerald-600" />
                                  Readable on the site
                                </>
                              ) : (
                                <>
                                  <Icon name="pending" size="sm" className="text-[0.95rem] text-amber-600" />
                                  No content yet
                                </>
                              )}
                            </p>
                          </Td>
                          <Td>
                            <StatusPill status={publication.status} />
                          </Td>
                          <Td className="whitespace-nowrap text-ink-muted">
                            {formatRelative(publication.updatedAt)}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </Panel>

              {/* ── Enquiries needing a reply ─────────────────────────── */}
              {isAdmin && (
                <Panel
                  className="xl:col-span-2"
                  padded={false}
                  title="Waiting on you"
                  description="Enquiries nobody has answered."
                  actions={
                    <Link
                      href="/admin/inquiries"
                      className="text-small font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Inbox
                    </Link>
                  }
                >
                  {inquiries.length === 0 ? (
                    <EmptyState
                      icon="mark_email_read"
                      title="Inbox clear"
                      description="Every enquiry has been picked up."
                    />
                  ) : (
                    <ul className="divide-y divide-surface-line">
                      {inquiries.map((inquiry) => (
                        <li key={inquiry.id}>
                          <Link
                            href={`/admin/inquiries?open=${inquiry.id}`}
                            // A one-off deep link into a dynamic page; there
                            // is nothing worth prefetching, and the attempt
                            // only puts a failed request in the console.
                            prefetch={false}
                            className="block px-6 py-4 transition-colors hover:bg-surface-sunken"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="truncate text-small font-medium text-ink">
                                {inquiry.fullName}
                              </p>
                              <Pill tone="teal">{formatRelative(inquiry.createdAt)}</Pill>
                            </div>
                            <p className="mt-1 truncate text-small text-ink-muted">
                              {inquiry.subject || inquiry.message}
                            </p>
                            <p className="mt-2 font-mono text-caption text-ink-soft">
                              {inquiry.reference}
                            </p>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              )}
            </div>
          </div>
        )
      )}
    </AdminShell>
  );
}
