'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Icon } from '@/components/ui/Icon';
import { formatFileSize } from '@/lib/format';
import { useApi } from '@/lib/auth';
import { cn } from '@/lib/cn';
import type { MediaAsset, MediaFolder } from '@/lib/types';
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  SearchInput,
  Select,
  Spinner,
  useToast,
} from './ui';

/**
 * Picks an image from the library, or uploads a new one.
 *
 * Content fields store both the media id and its public URL. The id is the
 * real reference; the URL is denormalised so the public site can render a
 * thumbnail without a second query per card, which is what made v1's
 * publications index slow.
 */
export function MediaPicker({
  open,
  onClose,
  onSelect,
  accept = 'image',
  title = 'Choose an image',
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (asset: MediaAsset) => void;
  accept?: 'image' | 'document' | 'any';
  title?: string;
}) {
  const api = useApi();
  const { notify } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [assets, setAssets] = useState<MediaAsset[]>([]);
  /** `/admin/media/folders` returns each folder with how much is in it. */
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [folder, setFolder] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [media, folderList] = await Promise.all([
        api.list<MediaAsset>('/admin/media', {
          limit: 60,
          folder: folder || undefined,
          mimeGroup: accept === 'any' ? undefined : accept,
          search: query || undefined,
        }),
        api.get<MediaFolder[]>('/admin/media/folders').catch(() => [] as MediaFolder[]),
      ]);

      setAssets(media.items);
      setFolders(folderList);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api, folder, query, accept]);

  useEffect(() => {
    if (!open) return;

    // Debounced so typing in the search box does not fire a request per key.
    const timer = setTimeout(() => void load(), query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [open, load, query]);

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return;

    setUploading(true);

    try {
      const form = new FormData();
      form.append('file', files[0]);
      if (folder) form.append('folder', folder);

      const asset = await api.upload<MediaAsset>('/admin/media/upload', form);
      notify('Uploaded');
      onSelect(asset);
      onClose();
    } catch (caught) {
      notify((caught as Error).message, 'error');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  const acceptAttribute =
    accept === 'image'
      ? 'image/*'
      : accept === 'document'
        ? '.pdf,.doc,.docx'
        : undefined;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description="Pick something already uploaded, or add a new file."
      width="lg"
      footer={
        <>
          <input
            ref={fileInput}
            type="file"
            accept={acceptAttribute}
            className="hidden"
            onChange={(event) => void handleUpload(event.target.files)}
          />
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            icon="upload"
            busy={uploading}
            onClick={() => fileInput.current?.click()}
          >
            Upload a file
          </Button>
        </>
      }
    >
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <SearchInput value={query} onChange={setQuery} placeholder="Search by name…" />

        {folders.length > 0 && (
          <Field label="Folder" className="w-48">
            <Select value={folder} onChange={(event) => setFolder(event.target.value)}>
              <option value="">All folders</option>
              {folders.map((entry) => (
                <option key={entry.folder} value={entry.folder}>
                  {entry.folder} ({entry.count})
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      {loading ? (
        <Spinner label="Loading the library…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : assets.length === 0 ? (
        <EmptyState
          icon="image"
          title="Nothing here yet"
          description="Upload a file and it will appear in the library for next time."
        />
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {assets.map((asset) => {
            const isImage = asset.mimeType.startsWith('image/');

            return (
              <li key={asset.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(asset);
                    onClose();
                  }}
                  className={cn(
                    'group w-full overflow-hidden rounded-card border border-surface-line text-left',
                    'transition-all duration-300 ease-physical',
                    'hover:-translate-y-1 hover:border-primary-200 hover:shadow-lift',
                  )}
                >
                  <div className="relative aspect-[4/3] bg-surface-sunken">
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
                  </div>
                  <div className="p-3">
                    <p className="truncate text-small text-ink">{asset.originalName}</p>
                    <p className="mt-0.5 font-mono text-caption text-ink-soft">
                      {asset.width && asset.height
                        ? `${asset.width}×${asset.height}`
                        : formatFileSize(asset.sizeBytes)}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

/**
 * An image field: a thumbnail, a URL box, and a button into the library.
 *
 * The URL stays editable by hand because some images are hosted elsewhere —
 * the firm's older photographs among them — and forcing every one of those
 * through an upload would be busywork.
 */
export function ImageField({
  label,
  url,
  onChange,
  hint,
}: {
  label: string;
  url: string | null;
  onChange: (next: { url: string | null; id: string | null }) => void;
  hint?: string;
}) {
  const [picking, setPicking] = useState(false);

  return (
    <>
      <Field label={label} hint={hint}>
        <div className="flex items-start gap-4">
          <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-card border border-surface-line bg-surface-sunken">
            {url ? (
              <Image
                src={url}
                alt=""
                fill
                sizes="112px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <span className="absolute inset-0 grid place-items-center text-ink-soft">
                <Icon name="image" />
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <Input
              value={url ?? ''}
              placeholder="https://…"
              onChange={(event) =>
                onChange({ url: event.target.value || null, id: null })
              }
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" icon="photo_library" onClick={() => setPicking(true)}>
                Library
              </Button>
              {url && (
                <Button
                  variant="ghost"
                  icon="close"
                  onClick={() => onChange({ url: null, id: null })}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>
      </Field>

      <MediaPicker
        open={picking}
        onClose={() => setPicking(false)}
        onSelect={(asset) => onChange({ url: asset.publicUrl, id: asset.id })}
      />
    </>
  );
}
