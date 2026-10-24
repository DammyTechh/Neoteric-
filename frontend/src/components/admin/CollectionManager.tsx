'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { Icon } from '@/components/ui/Icon';
import { ApiError } from '@/lib/api';
import { useApi, useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import type { CollectionSpec, FieldSpec } from './collections';
import { ImageField } from './MediaPicker';
import {
  Button,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  Input,
  ListInput,
  Modal,
  Panel,
  Pill,
  SearchInput,
  Select,
  Spinner,
  Textarea,
  useToast,
} from './ui';

/**
 * The largest page the API will serve.
 *
 * `paginationSchema` on the backend caps `limit` at 100 and rejects anything
 * above it, so this constant and that one must agree.
 */
const PAGE_SIZE = 100;

/** A record as it comes back from the API — shape varies by collection. */
type Record_ = { id: string; sortOrder: number } & Record<string, unknown>;

/** Everything the form holds, before it is cleaned up for the API. */
type Draft = Record<string, unknown>;

function blankDraft(spec: CollectionSpec): Draft {
  const draft: Draft = { sortOrder: 0 };

  for (const field of spec.fields) {
    switch (field.kind) {
      case 'boolean':
        draft[field.name] = true;
        break;
      case 'number':
        draft[field.name] = 0;
        break;
      case 'list':
        draft[field.name] = [];
        break;
      case 'select':
        draft[field.name] = field.options?.[0]?.value ?? '';
        break;
      default:
        draft[field.name] = '';
    }
    if (field.idField) draft[field.idField] = null;
  }

  return draft;
}

function toDraft(spec: CollectionSpec, record: Record_): Draft {
  const draft: Draft = { sortOrder: record.sortOrder ?? 0 };

  for (const field of spec.fields) {
    const value = record[field.name];

    if (field.kind === 'boolean') {
      draft[field.name] = value !== false;
    } else if (field.kind === 'list') {
      draft[field.name] = Array.isArray(value) ? value : [];
    } else if (field.kind === 'number') {
      draft[field.name] = typeof value === 'number' ? value : 0;
    } else {
      draft[field.name] = value == null ? '' : String(value);
    }

    if (field.idField) draft[field.idField] = record[field.idField] ?? null;
  }

  return draft;
}

/**
 * Prepares the draft for the API.
 *
 * Blank strings become null, because the backend's optional-text validators
 * accept null but reject `""` on URL and uuid fields — and an empty slug has
 * to be absent entirely so the server generates one.
 */
function toPayload(spec: CollectionSpec, draft: Draft): Record<string, unknown> {
  const payload: Record<string, unknown> = { sortOrder: Number(draft.sortOrder) || 0 };

  for (const field of spec.fields) {
    const value = draft[field.name];

    if (field.name === 'sortOrder') continue;

    if (field.kind === 'boolean') {
      payload[field.name] = Boolean(value);
    } else if (field.kind === 'list') {
      payload[field.name] = Array.isArray(value) ? value : [];
    } else if (field.name === 'rating') {
      payload[field.name] = value === '' || value == null ? null : Number(value);
    } else if (field.name === 'slug') {
      // Omitted rather than nulled: the server derives it from the name.
      if (value) payload[field.name] = value;
    } else {
      payload[field.name] = value === '' || value == null ? null : value;
    }

    if (field.idField) {
      payload[field.idField] = draft[field.idField] ?? null;
    }
  }

  return payload;
}

/** Renders one field according to its kind. */
function FieldControl({
  field,
  draft,
  error,
  onChange,
}: {
  field: FieldSpec;
  draft: Draft;
  error?: string;
  onChange: (patch: Draft) => void;
}) {
  const value = draft[field.name];
  const set = (next: unknown) => onChange({ [field.name]: next });

  if (field.kind === 'image') {
    return (
      <ImageField
        label={field.label}
        hint={field.hint}
        url={(value as string) || null}
        onChange={({ url, id }) =>
          onChange({
            [field.name]: url ?? '',
            ...(field.idField ? { [field.idField]: id } : {}),
          })
        }
      />
    );
  }

  if (field.kind === 'boolean') {
    return (
      <div className="rounded-card border border-surface-line bg-surface-sunken p-4">
        <Checkbox
          label={field.label}
          description={field.hint}
          checked={Boolean(value)}
          onChange={set}
        />
      </div>
    );
  }

  return (
    <Field label={field.label} hint={field.hint} error={error} required={field.required}>
      {field.kind === 'textarea' ? (
        <Textarea
          rows={3}
          value={String(value ?? '')}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          onChange={(event) => set(event.target.value)}
        />
      ) : field.kind === 'richtext' ? (
        <Textarea
          rows={8}
          value={String(value ?? '')}
          maxLength={field.maxLength}
          placeholder={field.placeholder ?? '<p>…</p>'}
          onChange={(event) => set(event.target.value)}
          className="font-mono text-small"
        />
      ) : field.kind === 'select' ? (
        <Select value={String(value ?? '')} onChange={(event) => set(event.target.value)}>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      ) : field.kind === 'list' ? (
        <ListInput
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={set}
          placeholder={field.placeholder}
        />
      ) : field.kind === 'number' ? (
        <Input
          mono
          type="number"
          min={0}
          value={Number(value ?? 0)}
          onChange={(event) => set(Number(event.target.value))}
        />
      ) : field.kind === 'colour' ? (
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={String(value || '#255859')}
            onChange={(event) => set(event.target.value)}
            className="h-11 w-14 shrink-0 cursor-pointer rounded-card border border-surface-line bg-surface p-1"
            aria-label={field.label}
          />
          <Input
            mono
            value={String(value ?? '')}
            placeholder="#255859"
            onChange={(event) => set(event.target.value)}
          />
        </div>
      ) : field.kind === 'icon' ? (
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-card border border-surface-line bg-surface-sunken text-ink-muted">
            <Icon name={String(value) || 'help'} size="sm" />
          </span>
          <Input
            mono
            value={String(value ?? '')}
            placeholder="balance"
            onChange={(event) => set(event.target.value)}
          />
        </div>
      ) : (
        <Input
          value={String(value ?? '')}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          onChange={(event) => set(event.target.value)}
        />
      )}
    </Field>
  );
}

/**
 * The list-plus-editor for one content collection.
 *
 * Reordering is done by moving a row up or down and PUTting the whole new
 * order, rather than drag and drop: the arrows work with a keyboard and on a
 * phone, which drag and drop does not.
 */
export function CollectionManager({ spec }: { spec: CollectionSpec }) {
  const api = useApi();
  const { notify } = useToast();
  const { user } = useAuth();

  const [items, setItems] = useState<Record_[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [editing, setEditing] = useState<Record_ | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<Record_ | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      /*
       * Every record, fetched a page at a time.
       *
       * This list is not paginated in the interface: reordering moves a row
       * against its neighbours and saves the whole order, so the component
       * needs the complete collection in hand. It used to ask for `limit: 200`
       * in one go, which the API rejects — `paginationSchema` caps `limit` at
       * 100 — and every one of the six collection pages failed to load with
       * "The submitted data is not valid".
       *
       * Asking for the maximum and following `hasNext` keeps that correct
       * however large a collection grows, rather than trading one hard-coded
       * number for another.
       */
      const all: Record_[] = [];
      let page = 1;

      // A stop so a misbehaving `hasNext` cannot spin forever.
      for (let guard = 0; guard < 50; guard += 1) {
        const result = await api.list<Record_>(spec.path, { page, limit: PAGE_SIZE });
        all.push(...result.items);

        if (!result.meta.hasNext || result.items.length === 0) break;
        page += 1;
      }

      setItems(all);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api, spec.path]);

  useEffect(() => {
    void load();
  }, [load]);

  function openEditor(record: Record_ | 'new') {
    setErrors({});
    setEditing(record);
    setDraft(
      record === 'new'
        ? { ...blankDraft(spec), sortOrder: items.length }
        : toDraft(spec, record),
    );
  }

  async function save() {
    if (!editing) return;

    setSaving(true);
    setErrors({});

    try {
      const payload = toPayload(spec, draft);

      if (editing === 'new') {
        await api.post(spec.path, payload);
        notify(`${spec.singular} added`);
      } else {
        await api.patch(`${spec.path}/${editing.id}`, payload);
        notify('Saved');
      }

      setEditing(null);
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

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);

    try {
      await api.remove(`${spec.path}/${deleting.id}`);
      notify('Deleted');
      setDeleting(null);
      void load();
    } catch (caught) {
      notify((caught as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  /** Swaps a row with its neighbour and saves the whole order. */
  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;

    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];

    // Optimistic: the arrows should feel instant.
    setItems(next);

    try {
      await api.post(`${spec.path}/reorder`, {
        order: next.map((item, position) => ({ id: item.id, sortOrder: position })),
      });
    } catch (caught) {
      notify((caught as Error).message, 'error');
      void load();
    }
  }

  /** Flips the visibility flag without opening the editor. */
  async function toggleActive(record: Record_) {
    const flag = spec.activeField;
    if (!flag) return;

    const next = record[flag] === false;

    try {
      await api.patch(`${spec.path}/${record.id}`, { [flag]: next });
      setItems((current) =>
        current.map((item) => (item.id === record.id ? { ...item, [flag]: next } : item)),
      );
    } catch (caught) {
      notify((caught as Error).message, 'error');
    }
  }

  const query = search.trim().toLowerCase();
  const visible = query
    ? items.filter((item) =>
        [spec.titleField, spec.subtitleField]
          .filter(Boolean)
          .some((key) => String(item[key as string] ?? '').toLowerCase().includes(query)),
      )
    : items;

  const canDelete = user?.role !== 'editor';
  const columns = spec.fields;

  return (
    <>
      <Panel padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-surface-line px-6 py-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={`Search ${spec.plural.toLowerCase()}…`}
          />
          <Button variant="secondary" icon="add" onClick={() => openEditor('new')}>
            Add {spec.singular.toLowerCase()}
          </Button>
        </div>

        {loading ? (
          <Spinner />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={spec.icon}
            title={query ? 'Nothing matches' : `No ${spec.plural.toLowerCase()} yet`}
            description={
              query
                ? 'Try a different search.'
                : `Add the first one and it appears on the website straight away.`
            }
            action={
              !query && (
                <Button variant="secondary" icon="add" onClick={() => openEditor('new')}>
                  Add {spec.singular.toLowerCase()}
                </Button>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-surface-line">
            {visible.map((record, index) => {
              const hidden = spec.activeField
                ? record[spec.activeField] === false
                : false;
              const imageUrl = spec.imageField
                ? (record[spec.imageField] as string | null)
                : null;

              return (
                <li
                  key={record.id}
                  className={cn(
                    'flex items-center gap-4 px-6 py-4 transition-colors hover:bg-surface-sunken/60',
                    hidden && 'opacity-60',
                  )}
                >
                  {/* ── Reorder ───────────────────────────────────────── */}
                  <div className="flex shrink-0 flex-col">
                    <IconButton
                      icon="keyboard_arrow_up"
                      label="Move up"
                      disabled={index === 0 || Boolean(query)}
                      onClick={() => void move(index, -1)}
                    />
                    <IconButton
                      icon="keyboard_arrow_down"
                      label="Move down"
                      disabled={index === visible.length - 1 || Boolean(query)}
                      onClick={() => void move(index, 1)}
                    />
                  </div>

                  {spec.imageField && (
                    <div className="relative hidden h-14 w-14 shrink-0 overflow-hidden rounded-full border border-surface-line bg-surface-sunken sm:block">
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt=""
                          fill
                          sizes="56px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <span className="absolute inset-0 grid place-items-center text-ink-soft">
                          <Icon name={spec.icon} size="sm" />
                        </span>
                      )}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-ink">
                        {String(record[spec.titleField] ?? 'Untitled')}
                      </p>
                      {hidden && <Pill tone="neutral" icon="visibility_off">Hidden</Pill>}
                      {spec.key === 'achievements' && (
                        <Pill tone="bronze">
                          {String(record.value ?? '')}
                          {String(record.suffix ?? '')}
                        </Pill>
                      )}
                      {spec.key === 'team' && (
                        <Pill tone="teal">
                          {record.teamGroup === 'non_legal' ? 'Operations' : 'Legal'}
                        </Pill>
                      )}
                      {spec.key === 'categories' &&
                        typeof record.publicationCount === 'number' && (
                          <Pill tone="neutral">
                            {record.publicationCount} articles
                          </Pill>
                        )}
                    </div>

                    {Boolean(spec.subtitleField && record[spec.subtitleField]) && (
                      <p className="mt-1 line-clamp-2 text-base text-ink-muted">
                        {String(record[spec.subtitleField as string] ?? '').replace(
                          /<[^>]*>/g,
                          '',
                        )}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {spec.activeField && (
                      <IconButton
                        icon={hidden ? 'visibility_off' : 'visibility'}
                        label={hidden ? 'Show on the website' : 'Hide from the website'}
                        onClick={() => void toggleActive(record)}
                      />
                    )}
                    <IconButton
                      icon="edit"
                      label="Edit"
                      onClick={() => openEditor(record)}
                    />
                    {canDelete && (
                      <IconButton
                        icon="delete"
                        label="Delete"
                        tone="danger"
                        onClick={() => setDeleting(record)}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {!loading && !error && visible.length > 0 && (
          <p className="border-t border-surface-line px-6 py-4 text-small text-ink-muted">
            <span className="font-mono">{visible.length}</span>{' '}
            {visible.length === 1
              ? spec.singular.toLowerCase()
              : (spec.countNoun ?? spec.plural).toLowerCase()}
            {query && ' matching'}
          </p>
        )}
      </Panel>

      {/* ── Editor ─────────────────────────────────────────────────────── */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? `Add ${spec.singular.toLowerCase()}` : `Edit ${spec.singular.toLowerCase()}`}
        description={spec.description}
        width="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="secondary" icon="save" busy={saving} onClick={() => void save()}>
              {editing === 'new' ? 'Add' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="grid gap-6 sm:grid-cols-2">
          {columns.map((field) => (
            <div key={field.name} className={field.wide ? 'sm:col-span-2' : undefined}>
              <FieldControl
                field={field}
                draft={draft}
                error={errors[field.name]}
                onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
              />
            </div>
          ))}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        busy={busy}
        title={`Delete this ${spec.singular.toLowerCase()}?`}
        message={`“${String(deleting?.[spec.titleField] ?? '')}” will be removed from the website. If you only want it off the site for now, hide it instead.`}
      />
    </>
  );
}
