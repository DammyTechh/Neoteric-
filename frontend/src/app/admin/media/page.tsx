'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
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
  SearchInput,
  Select,
  Spinner,
  Textarea,
  useToast,
} from '@/components/admin/ui';
import { Icon } from '@/components/ui/Icon';
import { useApi } from '@/lib/auth';
import { formatDate, formatFileSize } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { MediaAsset, MediaFolder } from '@/lib/types';

export default function MediaPage() {
  const api = useApi();
  const { notify } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [folder, setFolder] = useState('');
  const [kind, setKind] = useState('');

  const [editing, setEditing] = useState<MediaAsset | null>(null);
  const [draft, setDraft] = useState({ altText: '', caption: '', folder: '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<MediaAsset | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [media, folderList] = await Promise.all([
        api.list<MediaAsset>('/admin/media', {
          page,
          limit: 36,
          search: search || undefined,
          folder: folder || undefined,
          mimeGroup: kind || undefined,
        }),
        api.get<MediaFolder[]>('/admin/media/folders').catch(() => [] as MediaFolder[]),
      ]);

      setAssets(media.items);
      setFolders(folderList);
      setMeta({
        page: media.meta.page,
        totalPages: media.meta.totalPages,
        total: media.meta.total,
      });
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api, page, search, folder, kind]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  /**
   * Uploads a batch.
   *
   * `upload-many` takes up to ten at a time, so larger drops are sliced into
   * runs of ten rather than rejected — which is what someone dragging a
   * folder of photographs will do on their first try.
   */
  async function upload(files: FileList | File[] | null) {
    const list = files ? Array.from(files) : [];
    if (list.length === 0) return;

    setUploading(true);
    let uploaded = 0;

    try {
      for (let index = 0; index < list.length; index += 10) {
        const batch = list.slice(index, index + 10);
        const form = new FormData();

        if (batch.length === 1) {
          form.append('file', batch[0]);
          if (folder) form.append('folder', folder);
          await api.upload('/admin/media/upload', form);
        } else {
          for (const file of batch) form.append('files', file);
          if (folder) form.append('folder', folder);
          await api.upload('/admin/media/upload-many', form);
        }

        uploaded += batch.length;
      }

      notify(`Uploaded ${uploaded} ${uploaded === 1 ? 'file' : 'files'}`);
      void load();
    } catch (caught) {
      notify((caught as Error).message, 'error');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  function openEditor(asset: MediaAsset) {
    setEditing(asset);
    setDraft({
      altText: asset.altText ?? '',
      caption: asset.caption ?? '',
      folder: asset.folder ?? '',
    });
  }

  async function saveDetails() {
    if (!editing) return;
    setSaving(true);

    try {
      const updated = await api.patch<MediaAsset>(`/admin/media/${editing.id}`, {
        altText: draft.altText || null,
        caption: draft.caption || null,
        folder: draft.folder || undefined,
      });

      setAssets((current) =>
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
      await api.remove(`/admin/media/${deleting.id}`);
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
      title="Media library"
      description="Every image and document on the website."
      actions={
        <>
          <input
            ref={fileInput}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => void upload(event.target.files)}
          />
          <Button
            variant="secondary"
            icon="upload"
            busy={uploading}
            onClick={() => fileInput.current?.click()}
          >
            <span className="hidden sm:inline">Upload</span>
          </Button>
        </>
      }
    >
      {/* ── Drop zone ───────────────────────────────────────────────────── */}
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void upload(event.dataTransfer.files);
        }}
        className={cn(
          'mb-6 rounded-panel border-2 border-dashed p-8 text-center transition-colors duration-300',
          dragging
            ? 'border-primary bg-primary-50/60'
            : 'border-surface-line bg-surface',
        )}
      >
        <Icon
          name={dragging ? 'file_download' : 'cloud_upload'}
          size="xl"
          className={dragging ? 'text-primary' : 'text-ink-soft'}
        />
        <p className="mt-3 text-base text-ink">
          {dragging ? 'Drop them here' : 'Drag files here to upload'}
        </p>
        <p className="mt-1 text-small text-ink-muted">
          Images and documents, up to ten at a time
          {folder && (
            <>
              {' '}
              · into <span className="font-mono">{folder}</span>
            </>
          )}
        </p>
      </div>

      <Panel padded={false}>
        <div className="flex flex-wrap items-end gap-4 border-b border-surface-line px-6 py-4">
          <SearchInput
            value={search}
            onChange={(next) => {
              setSearch(next);
              setPage(1);
            }}
            placeholder="Search file names…"
          />

          <Field label="Folder" className="w-44">
            <Select
              value={folder}
              onChange={(event) => {
                setFolder(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All folders</option>
              {folders.map((entry) => (
                <option key={entry.folder} value={entry.folder}>
                  {entry.folder} ({entry.count})
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Type" className="w-40">
            <Select
              value={kind}
              onChange={(event) => {
                setKind(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Everything</option>
              <option value="image">Images</option>
              <option value="document">Documents</option>
            </Select>
          </Field>
        </div>

        {loading ? (
          <Spinner />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : assets.length === 0 ? (
          <EmptyState
            icon="perm_media"
            title={search || folder || kind ? 'Nothing matches' : 'The library is empty'}
            description="Upload an image and it becomes available to every page and publication."
          />
        ) : (
          <>
            <ul className="grid gap-4 p-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {assets.map((asset) => {
                const isImage = asset.mimeType.startsWith('image/');

                return (
                  <li
                    key={asset.id}
                    className="group overflow-hidden rounded-card border border-surface-line transition-all duration-300 ease-physical hover:-translate-y-1 hover:shadow-lift"
                  >
                    <div className="relative aspect-square bg-surface-sunken">
                      {isImage ? (
                        <Image
                          src={asset.publicUrl}
                          alt={asset.altText ?? asset.originalName}
                          fill
                          sizes="200px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <span className="absolute inset-0 grid place-items-center text-ink-soft">
                          <Icon name="description" size="xl" />
                        </span>
                      )}

                      {/* Actions appear on hover, and on focus for keyboards. */}
                      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-primary-950/60 opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
                        <button
                          type="button"
                          onClick={() => openEditor(asset)}
                          className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-ink transition-colors hover:bg-white"
                          aria-label={`Edit ${asset.originalName}`}
                        >
                          <Icon name="edit" size="sm" />
                        </button>
                        <a
                          href={asset.publicUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-ink transition-colors hover:bg-white"
                          aria-label={`Open ${asset.originalName}`}
                        >
                          <Icon name="open_in_new" size="sm" />
                        </a>
                        <button
                          type="button"
                          onClick={() => setDeleting(asset)}
                          className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-red-600 transition-colors hover:bg-white"
                          aria-label={`Delete ${asset.originalName}`}
                        >
                          <Icon name="delete" size="sm" />
                        </button>
                      </div>

                      {!asset.altText && isImage && (
                        <span className="absolute left-2 top-2">
                          <Pill tone="warning">No alt text</Pill>
                        </span>
                      )}
                    </div>

                    <div className="p-3">
                      <p className="truncate text-small text-ink" title={asset.originalName}>
                        {asset.originalName}
                      </p>
                      <p className="mt-0.5 font-mono text-caption text-ink-soft">
                        {asset.width && asset.height
                          ? `${asset.width}×${asset.height}`
                          : formatFileSize(asset.sizeBytes)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="border-t border-surface-line">
              <Pagination
                page={meta.page}
                totalPages={meta.totalPages}
                total={meta.total}
                onChange={setPage}
              />
            </div>
          </>
        )}
      </Panel>

      {/* ── Details ─────────────────────────────────────────────────────── */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="File details"
        width="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              icon="save"
              busy={saving}
              onClick={() => void saveDetails()}
            >
              Save
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-6">
            {editing.mimeType.startsWith('image/') && (
              <div className="relative aspect-video overflow-hidden rounded-card bg-surface-sunken">
                <Image
                  src={editing.publicUrl}
                  alt=""
                  fill
                  sizes="600px"
                  className="object-contain"
                  unoptimized
                />
              </div>
            )}

            <Field
              label="Image description"
              hint="What the picture shows. Screen readers read this aloud, and search engines use it to understand the image."
            >
              <Input
                value={draft.altText}
                maxLength={300}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, altText: event.target.value }))
                }
                placeholder="Two colleagues reviewing a contract"
              />
            </Field>

            <Field label="Caption">
              <Textarea
                rows={2}
                value={draft.caption}
                maxLength={500}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, caption: event.target.value }))
                }
              />
            </Field>

            <Field label="Folder" hint="Used only to keep the library tidy.">
              <Input
                mono
                value={draft.folder}
                maxLength={80}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, folder: event.target.value }))
                }
                placeholder="team"
              />
            </Field>

            <dl className="space-y-3 rounded-card bg-surface-sunken p-4 text-small">
              {[
                ['File name', editing.originalName],
                ['Type', editing.mimeType],
                ['Size', formatFileSize(editing.sizeBytes)],
                [
                  'Dimensions',
                  editing.width && editing.height
                    ? `${editing.width} × ${editing.height}`
                    : '—',
                ],
                ['Uploaded', formatDate(editing.createdAt)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-4">
                  <dt className="text-ink-muted">{label}</dt>
                  <dd className="break-all text-right font-mono text-caption text-ink">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        busy={busy}
        title="Delete this file?"
        message={`“${deleting?.originalName}” will be removed. Any page or publication still using it will show a broken image, so check first.`}
      />
    </AdminShell>
  );
}
