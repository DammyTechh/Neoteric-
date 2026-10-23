'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AdminShell } from '@/components/admin/Shell';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  Modal,
  Pagination,
  Panel,
  Pill,
  SearchInput,
  Select,
  Spinner,
  StatusPill,
  Textarea,
  useToast,
} from '@/components/admin/ui';
import { Icon } from '@/components/ui/Icon';
import { useApi } from '@/lib/auth';
import { formatDateTime, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { ContactInquiry, InquiryStatus, InquiryStatusCounts } from '@/lib/types';

const STATUSES: InquiryStatus[] = ['new', 'in_review', 'responded', 'closed', 'spam'];

export default function InquiriesPage() {
  const api = useApi();
  const params = useSearchParams();
  const { notify } = useToast();

  const [items, setItems] = useState<ContactInquiry[]>([]);
  const [counts, setCounts] = useState<Partial<InquiryStatusCounts>>({});
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(params.get('status') ?? '');

  const [open, setOpen] = useState<ContactInquiry | null>(null);
  const [reply, setReply] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState<ContactInquiry | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [result, countResult] = await Promise.all([
        api.list<ContactInquiry>('/admin/inquiries', {
          page,
          limit: 20,
          search: search || undefined,
          status: status || undefined,
        }),
        api
          .get<InquiryStatusCounts>('/admin/inquiries/counts')
          .catch(() => ({}) as InquiryStatusCounts),
      ]);

      setItems(result.items);
      setCounts(countResult);
      setMeta({
        page: result.meta.page,
        totalPages: result.meta.totalPages,
        total: result.meta.total,
      });
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api, page, search, status]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  // Deep link from the dashboard: `?open=<id>` opens that enquiry directly.
  useEffect(() => {
    const id = params.get('open');
    if (!id || items.length === 0) return;

    const match = items.find((item) => item.id === id);
    if (match) openInquiry(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, items]);

  function openInquiry(inquiry: ContactInquiry) {
    setOpen(inquiry);
    setReply('');
    setNote(inquiry.internalNote ?? '');

    // Opening a new enquiry is the moment it stops being new.
    if (inquiry.status === 'new') void setStatusOf(inquiry, 'in_review', true);
  }

  async function setStatusOf(
    inquiry: ContactInquiry,
    next: InquiryStatus,
    quiet = false,
  ) {
    try {
      const updated = await api.patch<ContactInquiry>(`/admin/inquiries/${inquiry.id}`, {
        status: next,
      });

      setItems((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setOpen((current) => (current?.id === updated.id ? updated : current));
      if (!quiet) notify(`Marked ${next.replace('_', ' ')}`);
    } catch (caught) {
      notify((caught as Error).message, 'error');
    }
  }

  async function saveNote() {
    if (!open) return;

    try {
      const updated = await api.patch<ContactInquiry>(`/admin/inquiries/${open.id}`, {
        internalNote: note || null,
      });
      setItems((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      notify('Note saved');
    } catch (caught) {
      notify((caught as Error).message, 'error');
    }
  }

  /** Emails the reply through Resend and marks the enquiry answered. */
  async function sendReply() {
    if (!open || reply.trim().length < 10) return;
    setSending(true);

    try {
      await api.post(`/admin/inquiries/${open.id}/respond`, {
        message: reply,
        markResponded: true,
      });

      notify(`Reply sent to ${open.email}`);
      setOpen(null);
      void load();
    } catch (caught) {
      notify((caught as Error).message, 'error');
    } finally {
      setSending(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);

    try {
      await api.remove(`/admin/inquiries/${deleting.id}`);
      notify('Deleted');
      setDeleting(null);
      void load();
    } catch (caught) {
      notify((caught as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell
      title="Enquiries"
      description="Everything sent through the contact form."
    >
      {/* ── Status filters ──────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setStatus('');
            setPage(1);
          }}
          className={cn(
            'rounded-full px-4 py-2 text-small font-medium transition-colors duration-200',
            status === ''
              ? 'bg-primary text-white'
              : 'border border-surface-line bg-surface text-ink-muted hover:text-primary',
          )}
        >
          Everything
        </button>

        {STATUSES.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setStatus(value);
              setPage(1);
            }}
            className={cn(
              'flex items-center gap-2 rounded-full px-4 py-2 text-small font-medium transition-colors duration-200',
              status === value
                ? 'bg-primary text-white'
                : 'border border-surface-line bg-surface text-ink-muted hover:text-primary',
            )}
          >
            {value.replace('_', ' ')}
            {counts[value] ? (
              <span
                className={cn(
                  'font-mono text-caption tabular-nums',
                  status === value ? 'text-primary-100' : 'text-ink-soft',
                )}
              >
                {counts[value]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <Panel padded={false}>
        <div className="flex flex-wrap items-end gap-4 border-b border-surface-line px-6 py-4">
          <SearchInput
            value={search}
            onChange={(next) => {
              setSearch(next);
              setPage(1);
            }}
            placeholder="Search names, emails, messages…"
          />
          <Field label="Status" className="w-44 sm:hidden">
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Any status</option>
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value.replace('_', ' ')}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {loading ? (
          <Spinner />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon="mark_email_read"
            title={search || status ? 'Nothing matches' : 'No enquiries yet'}
            description="Messages sent through the contact form on the website arrive here."
          />
        ) : (
          <>
            <ul className="divide-y divide-surface-line">
              {items.map((inquiry) => (
                <li key={inquiry.id}>
                  <button
                    type="button"
                    onClick={() => openInquiry(inquiry)}
                    className="flex w-full items-start gap-4 px-6 py-5 text-left transition-colors hover:bg-surface-sunken/60"
                  >
                    <span
                      className={cn(
                        'mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full text-small font-medium',
                        inquiry.status === 'new'
                          ? 'bg-primary text-white'
                          : 'bg-surface-sunken text-ink-muted',
                      )}
                    >
                      {inquiry.fullName.slice(0, 1).toUpperCase()}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-ink">{inquiry.fullName}</span>
                        <StatusPill status={inquiry.status} />
                        {inquiry.internalNote && (
                          <Pill tone="neutral" icon="sticky_note_2">
                            Note
                          </Pill>
                        )}
                      </span>

                      {inquiry.subject && (
                        <span className="mt-1 block text-base font-medium text-ink">
                          {inquiry.subject}
                        </span>
                      )}

                      <span className="mt-1 block line-clamp-2 text-base text-ink-muted">
                        {inquiry.message}
                      </span>

                      <span className="mt-2 flex flex-wrap items-center gap-3 font-mono text-caption text-ink-soft">
                        <span>{inquiry.reference}</span>
                        <span>{inquiry.email}</span>
                        {inquiry.phone && <span>{inquiry.phone}</span>}
                      </span>
                    </span>

                    <span className="shrink-0 whitespace-nowrap text-small text-ink-muted">
                      {formatRelative(inquiry.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              total={meta.total}
              onChange={setPage}
            />
          </>
        )}
      </Panel>

      {/* ── One enquiry ─────────────────────────────────────────────────── */}
      <Modal
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        title={open?.fullName ?? ''}
        description={open ? `${open.reference} · ${formatDateTime(open.createdAt)}` : undefined}
        width="lg"
        footer={
          open && (
            <>
              <Button variant="danger" icon="delete" onClick={() => setDeleting(open)}>
                Delete
              </Button>
              <div className="flex-1" />
              <Button
                variant="ghost"
                icon="block"
                onClick={() => void setStatusOf(open, 'spam')}
              >
                Spam
              </Button>
              <Button
                variant="ghost"
                icon="check"
                onClick={() => void setStatusOf(open, 'closed')}
              >
                Close
              </Button>
              <Button
                variant="secondary"
                icon="send"
                busy={sending}
                disabled={reply.trim().length < 10}
                onClick={() => void sendReply()}
              >
                Send reply
              </Button>
            </>
          )
        }
      >
        {open && (
          <div className="space-y-6">
            <dl className="grid gap-4 rounded-card bg-surface-sunken p-4 sm:grid-cols-2">
              {[
                ['Email', open.email, 'mail'],
                ['Phone', open.phone ?? '—', 'call'],
                ['Company', open.company ?? '—', 'business'],
                ['Status', open.status.replace('_', ' '), 'label'],
              ].map(([label, value, icon]) => (
                <div key={label} className="flex items-start gap-3">
                  <Icon name={icon} size="sm" className="mt-0.5 shrink-0 text-ink-soft" />
                  <div className="min-w-0">
                    <dt className="text-caption uppercase tracking-[0.1em] text-ink-soft">
                      {label}
                    </dt>
                    <dd className="mt-0.5 break-words text-small text-ink">{value}</dd>
                  </div>
                </div>
              ))}
            </dl>

            <div>
              <p className="mb-2 text-base font-medium text-ink">
                {open.subject || 'Their message'}
              </p>
              <div className="whitespace-pre-wrap rounded-card border border-surface-line p-4 text-base text-ink">
                {open.message}
              </div>
            </div>

            <Field
              label="Your reply"
              hint={`Sent to ${open.email} from the firm's address, and the enquiry is marked answered.`}
            >
              <Textarea
                rows={7}
                value={reply}
                maxLength={10000}
                onChange={(event) => setReply(event.target.value)}
                placeholder={`Dear ${open.fullName.split(' ')[0]},\n\nThank you for getting in touch with M. A Mustapha & Co.`}
              />
            </Field>

            <Field label="Internal note" hint="Only visible here. Never sent to the client.">
              <Textarea
                rows={3}
                value={note}
                maxLength={4000}
                onChange={(event) => setNote(event.target.value)}
                onBlur={() => void saveNote()}
                placeholder="Who is handling this, what was agreed…"
              />
            </Field>

            {open.respondedAt && (
              <p className="flex items-center gap-2 text-small text-emerald-700">
                <Icon name="check_circle" size="sm" />
                Answered on {formatDateTime(open.respondedAt)}
              </p>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        busy={busy}
        title="Delete this enquiry?"
        message={`The message from ${deleting?.fullName} will be removed permanently. If you only want it out of the way, close it instead.`}
      />
    </AdminShell>
  );
}
