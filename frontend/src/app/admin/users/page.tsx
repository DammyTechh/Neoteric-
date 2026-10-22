'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin/Shell';
import {
  Button,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  Input,
  Modal,
  Panel,
  Pill,
  Select,
  Spinner,
  Table,
  Td,
  Th,
  useToast,
} from '@/components/admin/ui';
import { Icon } from '@/components/ui/Icon';
import { ApiError } from '@/lib/api';
import { useApi, useAuth } from '@/lib/auth';
import { formatDate, formatRelative } from '@/lib/format';
import type { AdminRole, AdminUser } from '@/lib/types';

const ROLES: { value: AdminRole; label: string; description: string }[] = [
  {
    value: 'editor',
    label: 'Editor',
    description: 'Publications, media and the firm pages.',
  },
  {
    value: 'admin',
    label: 'Administrator',
    description: 'All of the above, plus enquiries, the newsletter and site settings.',
  },
  {
    value: 'super_admin',
    label: 'Super administrator',
    description: 'Everything, including these accounts and the audit log.',
  },
];

/**
 * Operator accounts.
 *
 * This page is the only way an account comes into existence — there is no
 * registration endpoint in the API at all. The first super-admin is created
 * by the seed script; everyone else is invited from here.
 */
export default function UsersPage() {
  const api = useApi();
  const { user: currentUser } = useAuth();
  const { notify } = useToast();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [inviting, setInviting] = useState(false);
  const [draft, setDraft] = useState({ email: '', fullName: '', role: 'editor' as AdminRole });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [editDraft, setEditDraft] = useState({
    fullName: '',
    role: 'editor' as AdminRole,
    isActive: true,
  });

  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const result = await api.list<AdminUser>('/admin/admins', { limit: 100 });
      setUsers(result.items);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Invites an operator.
   *
   * No password is sent in the request: the backend generates one, emails it,
   * and flags the account so the first sign-in forces a change. That keeps a
   * temporary password out of this form, out of the browser's history and out
   * of whatever is between here and the server.
   */
  async function invite() {
    setSaving(true);
    setErrors({});

    try {
      await api.post('/admin/admins', {
        email: draft.email,
        fullName: draft.fullName,
        role: draft.role,
      });

      notify(`Invitation sent to ${draft.email}`);
      setInviting(false);
      setDraft({ email: '', fullName: '', role: 'editor' });
      void load();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setErrors(caught.fieldErrors);
        notify(caught.message, 'error');
      } else {
        notify((caught as Error).message, 'error');
      }
    } finally {
      setSaving(false);
    }
  }

  function openEditor(user: AdminUser) {
    setEditing(user);
    setEditDraft({ fullName: user.fullName, role: user.role, isActive: user.isActive });
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);

    try {
      const updated = await api.patch<AdminUser>(`/admin/admins/${editing.id}`, editDraft);
      setUsers((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      notify('Saved');
      setEditing(null);
    } catch (caught) {
      notify((caught as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);

    try {
      await api.remove(`/admin/admins/${deleting.id}`);
      notify('Account removed');
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
      title="Operators"
      description="Who can sign in to this dashboard, and what they can reach."
      actions={
        <Button variant="secondary" icon="person_add" onClick={() => setInviting(true)}>
          <span className="hidden sm:inline">Invite</span>
        </Button>
      }
    >
      <div className="mb-6 flex items-start gap-3 rounded-card border border-surface-line bg-surface-sunken p-4">
        <Icon name="shield" className="shrink-0 text-ink-muted" />
        <p className="text-small text-ink-muted">
          There is no public sign-up for this dashboard. Accounts exist only because
          someone on this page created them, and an invited operator must change the
          emailed password before they can do anything.
        </p>
      </div>

      <Panel padded={false}>
        {loading ? (
          <Spinner />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : users.length === 0 ? (
          <EmptyState icon="manage_accounts" title="No operators" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Operator</Th>
                <Th className="w-44">Role</Th>
                <Th className="w-36">Last signed in</Th>
                <Th className="w-28 text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isSelf = user.id === currentUser?.id;

                return (
                  <tr key={user.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-caption font-medium text-white">
                          {user.fullName
                            .split(' ')
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((part) => part[0])
                            .join('')}
                        </span>
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                            {user.fullName}
                            {isSelf && <Pill tone="teal">You</Pill>}
                            {!user.isActive && (
                              <Pill tone="danger" icon="block">
                                Suspended
                              </Pill>
                            )}
                            {user.mustChangePassword && (
                              <Pill tone="warning" icon="key">
                                Password not set
                              </Pill>
                            )}
                          </p>
                          <p className="mt-0.5 font-mono text-caption text-ink-soft">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </Td>

                    <Td>
                      <Pill tone={user.role === 'super_admin' ? 'bronze' : 'neutral'}>
                        {ROLES.find((role) => role.value === user.role)?.label ?? user.role}
                      </Pill>
                    </Td>

                    <Td className="whitespace-nowrap text-ink-muted">
                      {user.lastLoginAt ? formatRelative(user.lastLoginAt) : 'Never'}
                      <p className="mt-0.5 text-caption text-ink-soft">
                        Added {formatDate(user.createdAt)}
                      </p>
                    </Td>

                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        <IconButton icon="edit" label="Edit" onClick={() => openEditor(user)} />
                        <IconButton
                          icon="delete"
                          label={isSelf ? 'You cannot remove your own account' : 'Remove'}
                          tone="danger"
                          disabled={isSelf}
                          onClick={() => setDeleting(user)}
                        />
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Panel>

      {/* ── Invite ──────────────────────────────────────────────────────── */}
      <Modal
        open={inviting}
        onClose={() => setInviting(false)}
        title="Invite an operator"
        description="They receive an email with a temporary password they must change."
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setInviting(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              icon="send"
              busy={saving}
              disabled={!draft.email || draft.fullName.trim().length < 2}
              onClick={() => void invite()}
            >
              Send invitation
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <Field label="Full name" required error={errors.fullName}>
            <Input
              value={draft.fullName}
              onChange={(event) =>
                setDraft((current) => ({ ...current, fullName: event.target.value }))
              }
            />
          </Field>

          <Field label="Email" required error={errors.email}>
            <Input
              type="email"
              value={draft.email}
              onChange={(event) =>
                setDraft((current) => ({ ...current, email: event.target.value }))
              }
              placeholder="name@neotericlp.com.ng"
            />
          </Field>

          <Field label="Role" error={errors.role}>
            <Select
              value={draft.role}
              onChange={(event) =>
                setDraft((current) => ({ ...current, role: event.target.value as AdminRole }))
              }
            >
              {ROLES.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </Select>
          </Field>

          <div className="rounded-card bg-surface-sunken p-4">
            <p className="text-small text-ink-muted">
              {ROLES.find((role) => role.value === draft.role)?.description}
            </p>
          </div>
        </div>
      </Modal>

      {/* ── Edit ────────────────────────────────────────────────────────── */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.fullName ?? ''}
        description={editing?.email}
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              icon="save"
              busy={saving}
              onClick={() => void saveEdit()}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <Field label="Full name">
            <Input
              value={editDraft.fullName}
              onChange={(event) =>
                setEditDraft((current) => ({ ...current, fullName: event.target.value }))
              }
            />
          </Field>

          <Field label="Role">
            <Select
              value={editDraft.role}
              onChange={(event) =>
                setEditDraft((current) => ({
                  ...current,
                  role: event.target.value as AdminRole,
                }))
              }
            >
              {ROLES.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </Select>
          </Field>

          <div className="rounded-card border border-surface-line bg-surface-sunken p-4">
            <Checkbox
              label="Account is active"
              description="Suspended operators keep their work but cannot sign in."
              checked={editDraft.isActive}
              onChange={(next) =>
                setEditDraft((current) => ({ ...current, isActive: next }))
              }
              disabled={editing?.id === currentUser?.id}
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        busy={busy}
        confirmLabel="Remove account"
        title="Remove this operator?"
        message={`${deleting?.fullName} will no longer be able to sign in. Anything they published stays on the website. To keep the account but block access, suspend it instead.`}
      />
    </AdminShell>
  );
}
