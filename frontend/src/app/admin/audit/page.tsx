'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin/Shell';
import {
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
  type PillTone,
} from '@/components/admin/ui';
import { Icon } from '@/components/ui/Icon';
import { useApi } from '@/lib/auth';
import { formatDateTime, humanise } from '@/lib/format';
import type { AuditLog } from '@/lib/types';

const ACTION_TONES: Record<string, PillTone> = {
  create: 'positive',
  update: 'teal',
  bulk_update: 'teal',
  delete: 'danger',
  publish: 'positive',
  unpublish: 'warning',
  login: 'neutral',
  login_failed: 'danger',
  logout: 'neutral',
  password_change: 'bronze',
};

const ACTION_ICONS: Record<string, string> = {
  create: 'add_circle',
  update: 'edit',
  bulk_update: 'edit_note',
  delete: 'delete',
  publish: 'publish',
  unpublish: 'visibility_off',
  login: 'login',
  login_failed: 'gpp_bad',
  logout: 'logout',
  password_change: 'key',
};

/**
 * The audit log.
 *
 * Read-only by design: an audit trail somebody can edit is not an audit
 * trail. Each row records who did what to which record, with the before and
 * after state kept so a mistaken edit can be understood after the fact.
 */
export default function AuditPage() {
  const api = useApi();

  const [entries, setEntries] = useState<AuditLog[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');

  const [open, setOpen] = useState<AuditLog | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const result = await api.list<AuditLog>('/admin/audit-logs', {
        page,
        limit: 30,
        entity: entity || undefined,
        action: action || undefined,
      });

      setEntries(result.items);
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
  }, [api, page, entity, action]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), entity ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, entity]);

  return (
    <AdminShell
      title="Audit log"
      description="Every change anyone has made, with who made it and when."
    >
      <Panel padded={false}>
        <div className="flex flex-wrap items-end gap-4 border-b border-surface-line px-6 py-4">
          <Field label="Record type" className="w-56">
            <Input
              mono
              value={entity}
              placeholder="publication"
              onChange={(event) => {
                setEntity(event.target.value);
                setPage(1);
              }}
            />
          </Field>

          <Field label="Action" className="w-48">
            <Select
              value={action}
              onChange={(event) => {
                setAction(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Any action</option>
              {Object.keys(ACTION_TONES).map((value) => (
                <option key={value} value={value}>
                  {humanise(value)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {loading ? (
          <Spinner />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : entries.length === 0 ? (
          <EmptyState
            icon="history"
            title={entity || action ? 'Nothing matches' : 'Nothing recorded yet'}
            description="Changes made from this dashboard are recorded here automatically."
          />
        ) : (
          <>
            <ul className="divide-y divide-surface-line">
              {entries.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => setOpen(entry)}
                    className="flex w-full items-start gap-4 px-6 py-4 text-left transition-colors hover:bg-surface-sunken/60"
                  >
                    <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-card bg-surface-sunken text-ink-muted">
                      <Icon name={ACTION_ICONS[entry.action] ?? 'bolt'} size="sm" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <Pill tone={ACTION_TONES[entry.action] ?? 'neutral'}>
                          {humanise(entry.action)}
                        </Pill>
                        <span className="font-mono text-small text-ink">
                          {entry.entity}
                        </span>
                      </span>

                      <span className="mt-1 block text-small text-ink-muted">
                        {entry.actorEmail ?? 'System'}
                      </span>

                      {entry.entityId && (
                        <span className="mt-1 block font-mono text-caption text-ink-soft">
                          {entry.entityId}
                        </span>
                      )}
                    </span>

                    <span className="shrink-0 whitespace-nowrap text-right text-caption text-ink-soft">
                      {formatDateTime(entry.createdAt)}
                      {entry.ipAddress && (
                        <span className="mt-0.5 block font-mono">{entry.ipAddress}</span>
                      )}
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

      <Modal
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        title={open ? `${humanise(open.action)} · ${open.entity}` : ''}
        description={open ? formatDateTime(open.createdAt) : undefined}
        width="lg"
      >
        {open && (
          <div className="space-y-6">
            <dl className="grid gap-4 rounded-card bg-surface-sunken p-4 sm:grid-cols-2">
              {[
                ['Who', open.actorEmail ?? 'System'],
                ['Record', open.entityId ?? '—'],
                ['Address', open.ipAddress ?? '—'],
                ['When', formatDateTime(open.createdAt)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-caption uppercase tracking-[0.1em] text-ink-soft">
                    {label}
                  </dt>
                  <dd className="mt-1 break-all font-mono text-caption text-ink">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="grid gap-6 lg:grid-cols-2">
              {(
                [
                  ['Before', open.beforeState],
                  ['After', open.afterState],
                ] as const
              ).map(([label, state]) => (
                <div key={label}>
                  <p className="mb-2 text-base font-medium text-ink">{label}</p>
                  <pre className="max-h-80 overflow-auto rounded-card border border-surface-line bg-surface-sunken p-4 font-mono text-caption text-ink">
                    {state == null ? '—' : JSON.stringify(state, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </AdminShell>
  );
}
