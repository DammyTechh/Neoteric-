'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin/Shell';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  Pagination,
  Panel,
  Pill,
  Select,
  Spinner,
  StatusPill,
  Table,
  Td,
  Textarea,
  Th,
  useToast,
} from '@/components/admin/ui';
import { Icon } from '@/components/ui/Icon';
import { API_BASE } from '@/lib/api';
import { useApi } from '@/lib/auth';
import { formatDate, formatNumber } from '@/lib/format';
import { cn } from '@/lib/cn';
import type {
  NewsletterCampaign,
  NewsletterSubscriber,
  Publication,
  SubscriberStatus,
} from '@/lib/types';

type Tab = 'subscribers' | 'campaigns';

export default function NewsletterPage() {
  const api = useApi();
  const { notify } = useToast();

  const [tab, setTab] = useState<Tab>('subscribers');

  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [campaigns, setCampaigns] = useState<NewsletterCampaign[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');

  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState({
    subject: '',
    preheader: '',
    body: '',
    publicationId: '',
  });
  const [saving, setSaving] = useState(false);

  const [sendingCampaign, setSendingCampaign] = useState<NewsletterCampaign | null>(null);
  const [removing, setRemoving] = useState<NewsletterSubscriber | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      if (tab === 'subscribers') {
        const result = await api.list<NewsletterSubscriber>(
          '/admin/newsletter/subscribers',
          { page, limit: 25, status: status || undefined },
        );
        setSubscribers(result.items);
        setMeta({
          page: result.meta.page,
          totalPages: result.meta.totalPages,
          total: result.meta.total,
        });
      } else {
        const result = await api.list<NewsletterCampaign>('/admin/newsletter/campaigns', {
          page,
          limit: 25,
        });
        setCampaigns(result.items);
        setMeta({
          page: result.meta.page,
          totalPages: result.meta.totalPages,
          total: result.meta.total,
        });
      }
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api, tab, page, status]);

  useEffect(() => {
    void load();
  }, [load]);

  // Published pieces, so a campaign can simply point at one.
  useEffect(() => {
    void api
      .list<Publication>('/admin/publications', { limit: 50, status: 'published' })
      .then((result) => setPublications(result.items))
      .catch(() => undefined);
  }, [api]);

  async function createCampaign() {
    if (draft.subject.trim().length < 3) return;
    setSaving(true);

    try {
      await api.post('/admin/newsletter/campaigns', {
        subject: draft.subject,
        preheader: draft.preheader || null,
        body: draft.body || null,
        publicationId: draft.publicationId || null,
      });

      notify('Draft saved — review it, then send');
      setComposing(false);
      setDraft({ subject: '', preheader: '', body: '', publicationId: '' });
      setTab('campaigns');
      void load();
    } catch (caught) {
      notify((caught as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function confirmSend() {
    if (!sendingCampaign) return;
    setBusy(true);

    try {
      await api.post(`/admin/newsletter/campaigns/${sendingCampaign.id}/send`);
      notify('Sending — delivery counts will update as it goes out');
      setSendingCampaign(null);
      void load();
    } catch (caught) {
      notify((caught as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    setBusy(true);

    try {
      await api.remove(`/admin/newsletter/subscribers/${removing.id}`);
      notify('Removed');
      setRemoving(null);
      void load();
    } catch (caught) {
      notify((caught as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const STATUSES: SubscriberStatus[] = [
    'subscribed',
    'pending',
    'unsubscribed',
    'bounced',
  ];

  return (
    <AdminShell
      title="Newsletter"
      description="Who is subscribed, and what has been sent to them."
      actions={
        <Button variant="secondary" icon="edit_note" onClick={() => setComposing(true)}>
          <span className="hidden sm:inline">Compose</span>
        </Button>
      }
    >
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {(['subscribers', 'campaigns'] as Tab[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setTab(value);
              setPage(1);
            }}
            className={cn(
              'rounded-full px-4 py-2 text-small font-medium capitalize transition-colors duration-200',
              tab === value
                ? 'bg-primary text-white'
                : 'border border-surface-line bg-surface text-ink-muted hover:text-primary',
            )}
          >
            {value}
          </button>
        ))}

        <div className="flex-1" />

        {tab === 'subscribers' && (
          <>
            <Select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="w-44"
            >
              <option value="">Any status</option>
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>

            {/*
              The export is a plain authenticated GET returning CSV, so it is
              a link rather than a fetch — the browser's own download handling
              is better than anything reconstructed from a blob.
            */}
            <a
              href={`${API_BASE}/admin/newsletter/subscribers/export`}
              target="_blank"
              rel="noreferrer"
            >
              <Button variant="ghost" icon="download">
                Export
              </Button>
            </a>
          </>
        )}
      </div>

      <Panel padded={false}>
        {loading ? (
          <Spinner />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : tab === 'subscribers' ? (
          subscribers.length === 0 ? (
            <EmptyState
              icon="mail"
              title="No subscribers yet"
              description="The sign-up form in the website footer adds people here."
            />
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>Subscriber</Th>
                    <Th className="w-32">Status</Th>
                    <Th className="w-28">Source</Th>
                    <Th className="w-32">Joined</Th>
                    <Th className="w-20" />
                  </tr>
                </thead>
                <tbody>
                  {subscribers.map((subscriber) => (
                    <tr key={subscriber.id}>
                      <Td>
                        <p className="font-mono text-small text-ink">{subscriber.email}</p>
                        {subscriber.fullName && (
                          <p className="mt-0.5 text-small text-ink-muted">
                            {subscriber.fullName}
                          </p>
                        )}
                      </Td>
                      <Td>
                        <StatusPill status={subscriber.status} />
                      </Td>
                      <Td className="text-ink-muted">{subscriber.source}</Td>
                      <Td className="whitespace-nowrap text-ink-muted">
                        {formatDate(subscriber.createdAt)}
                      </Td>
                      <Td>
                        <button
                          type="button"
                          onClick={() => setRemoving(subscriber)}
                          className="text-small text-ink-muted transition-colors hover:text-red-600"
                        >
                          Remove
                        </button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              <Pagination
                page={meta.page}
                totalPages={meta.totalPages}
                total={meta.total}
                onChange={setPage}
              />
            </>
          )
        ) : campaigns.length === 0 ? (
          <EmptyState
            icon="campaign"
            title="Nothing sent yet"
            description="Write a campaign, point it at a publication, and send it to your subscribers."
            action={
              <Button variant="secondary" icon="edit_note" onClick={() => setComposing(true)}>
                Compose
              </Button>
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-surface-line">
              {campaigns.map((campaign) => (
                <li
                  key={campaign.id}
                  className="flex flex-wrap items-center gap-4 px-6 py-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-ink">{campaign.subject}</p>
                      <StatusPill status={campaign.status} />
                    </div>
                    {campaign.preheader && (
                      <p className="mt-1 truncate text-small text-ink-muted">
                        {campaign.preheader}
                      </p>
                    )}
                    <p className="mt-2 flex flex-wrap items-center gap-3 text-caption text-ink-soft">
                      {campaign.sentAt ? (
                        <span>Sent {formatDate(campaign.sentAt)}</span>
                      ) : (
                        <span>Not sent</span>
                      )}
                      {campaign.recipientCount > 0 && (
                        <span className="font-mono">
                          {formatNumber(campaign.deliveredCount)}/
                          {formatNumber(campaign.recipientCount)} delivered
                        </span>
                      )}
                      {campaign.failedCount > 0 && (
                        <span className="font-mono text-red-600">
                          {campaign.failedCount} failed
                        </span>
                      )}
                    </p>
                  </div>

                  {campaign.status === 'draft' && (
                    <Button
                      variant="secondary"
                      icon="send"
                      onClick={() => setSendingCampaign(campaign)}
                    >
                      Send
                    </Button>
                  )}
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

      {/* ── Compose ─────────────────────────────────────────────────────── */}
      <Modal
        open={composing}
        onClose={() => setComposing(false)}
        title="New campaign"
        description="Saved as a draft first. Nothing is sent until you choose to send it."
        width="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setComposing(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              icon="save"
              busy={saving}
              disabled={draft.subject.trim().length < 3}
              onClick={() => void createCampaign()}
            >
              Save draft
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <Field label="Subject" required>
            <Input
              value={draft.subject}
              maxLength={200}
              onChange={(event) =>
                setDraft((current) => ({ ...current, subject: event.target.value }))
              }
              placeholder="New insight: amendments to the Finance Act"
            />
          </Field>

          <Field
            label="Preview line"
            hint="The grey text mail apps show after the subject."
          >
            <Input
              value={draft.preheader}
              maxLength={200}
              onChange={(event) =>
                setDraft((current) => ({ ...current, preheader: event.target.value }))
              }
            />
          </Field>

          <Field
            label="Link to a publication"
            hint="Chosen, the email uses that piece's thumbnail, summary and link."
          >
            <Select
              value={draft.publicationId}
              onChange={(event) =>
                setDraft((current) => ({ ...current, publicationId: event.target.value }))
              }
            >
              <option value="">No publication</option>
              {publications.map((publication) => (
                <option key={publication.id} value={publication.id}>
                  {publication.title}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Message"
            hint="Appears above the publication card. Plain paragraphs are fine."
          >
            <Textarea
              rows={8}
              value={draft.body}
              onChange={(event) =>
                setDraft((current) => ({ ...current, body: event.target.value }))
              }
              placeholder="Dear subscriber,"
            />
          </Field>

          <div className="flex items-start gap-3 rounded-card bg-surface-sunken p-4">
            <Icon name="verified_user" className="shrink-0 text-ink-muted" />
            <p className="text-small text-ink-muted">
              Every email carries an unsubscribe link automatically, and only confirmed
              subscribers are included.
            </p>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(sendingCampaign)}
        onClose={() => setSendingCampaign(null)}
        onConfirm={() => void confirmSend()}
        busy={busy}
        confirmLabel="Send now"
        title="Send this campaign?"
        message={`“${sendingCampaign?.subject}” will go out to every confirmed subscriber. This cannot be recalled.`}
      />

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={() => void confirmRemove()}
        busy={busy}
        confirmLabel="Remove"
        title="Remove this subscriber?"
        message={`${removing?.email} will be deleted from the list.`}
      />

      {tab === 'campaigns' && campaigns.some((c) => c.status === 'sending') && (
        <div className="mt-6 flex items-center gap-3 rounded-card border border-amber-200 bg-amber-50 p-4">
          <Icon name="progress_activity" className="animate-spin text-amber-600" />
          <p className="text-small text-amber-900">
            A campaign is going out. Reload in a moment to see the delivery counts.
          </p>
          <div className="flex-1" />
          <Pill tone="warning">Sending</Pill>
        </div>
      )}
    </AdminShell>
  );
}
