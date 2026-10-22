'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { ApiError } from '@/lib/api';
import { useApi } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import type {
  MediaAsset,
  PublicationCategory,
  Publication,
  PublicationStatus,
} from '@/lib/types';
import {
  Button,
  Checkbox,
  Field,
  Input,
  ListInput,
  Panel,
  Pill,
  Select,
  Textarea,
  useToast,
} from './ui';
import { ImageField, MediaPicker } from './MediaPicker';

/**
 * The shape the form holds while editing.
 *
 * Separate from `Publication` because a form field is a string even when the
 * column is a timestamp or a uuid, and pretending otherwise means scattering
 * `?? ''` through the JSX.
 */
interface Draft {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  categoryId: string;
  coverImageId: string | null;
  coverImageUrl: string | null;
  coverAlt: string;
  status: PublicationStatus;
  isFeatured: boolean;
  authorName: string;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  scheduledFor: string;
}

const EMPTY: Draft = {
  title: '',
  slug: '',
  excerpt: '',
  body: '',
  categoryId: '',
  coverImageId: null,
  coverImageUrl: null,
  coverAlt: '',
  status: 'draft',
  isFeatured: false,
  authorName: '',
  tags: [],
  seoTitle: '',
  seoDescription: '',
  scheduledFor: '',
};

function toDraft(publication: Publication): Draft {
  return {
    title: publication.title,
    slug: publication.slug,
    excerpt: publication.excerpt ?? '',
    body: publication.body ?? '',
    categoryId: publication.categoryId ?? '',
    coverImageId: publication.coverImageId,
    coverImageUrl: publication.coverImageUrl,
    coverAlt: publication.coverAlt ?? '',
    status: publication.status,
    isFeatured: publication.isFeatured,
    authorName: publication.authorName ?? '',
    tags: publication.tags ?? [],
    seoTitle: publication.seoTitle ?? '',
    seoDescription: publication.seoDescription ?? '',
    // `datetime-local` wants `YYYY-MM-DDTHH:mm`, which is the ISO string
    // truncated — not a format `toISOString` offers directly.
    scheduledFor: publication.scheduledFor
      ? publication.scheduledFor.slice(0, 16)
      : '',
  };
}

/** Mirrors the backend's slug rule so the preview matches what gets saved. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

export function PublicationEditor({ publicationId }: { publicationId?: string }) {
  const api = useApi();
  const router = useRouter();
  const { notify } = useToast();
  const documentInput = useRef<HTMLInputElement>(null);

  const isNew = !publicationId;

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [record, setRecord] = useState<Publication | null>(null);
  const [categories, setCategories] = useState<PublicationCategory[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pickingAttachment, setPickingAttachment] = useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  // ── Load ────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!publicationId) return;

    try {
      const result = await api.get<Publication>(`/admin/publications/${publicationId}`);
      setRecord(result);
      setDraft(toDraft(result));
    } catch (caught) {
      notify((caught as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [api, publicationId, notify]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void api
      .list<PublicationCategory>('/admin/categories', { limit: 100 })
      .then((result) => setCategories(result.items))
      .catch(() => undefined);
  }, [api]);

  // ── Save ────────────────────────────────────────────────────────────────

  async function save(overrides: Partial<Draft> = {}) {
    const merged = { ...draft, ...overrides };
    setSaving(true);
    setErrors({});

    /*
     * Empty strings become null rather than being sent as "".
     *
     * The backend's optional-text validators accept null but reject a blank
     * string on a URL field, and an empty `categoryId` is not a uuid. Cleaning
     * up here keeps the form free of per-field special cases.
     */
    const payload = {
      title: merged.title,
      slug: merged.slug || undefined,
      excerpt: merged.excerpt || null,
      body: merged.body || null,
      categoryId: merged.categoryId || null,
      coverImageId: merged.coverImageId || null,
      coverImageUrl: merged.coverImageUrl || null,
      coverAlt: merged.coverAlt || null,
      status: merged.status,
      isFeatured: merged.isFeatured,
      authorName: merged.authorName || undefined,
      tags: merged.tags,
      seoTitle: merged.seoTitle || null,
      seoDescription: merged.seoDescription || null,
      scheduledFor: merged.scheduledFor
        ? new Date(merged.scheduledFor).toISOString()
        : null,
    };

    try {
      if (isNew) {
        const created = await api.post<Publication>('/admin/publications', payload);
        notify('Created');
        router.replace(`/admin/publications/${created.id}`);
      } else {
        const updated = await api.patch<Publication>(
          `/admin/publications/${publicationId}`,
          payload,
        );
        setRecord(updated);
        setDraft(toDraft(updated));
        notify('Saved');
      }
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

  // ── Document import ─────────────────────────────────────────────────────

  /**
   * Turns an uploaded document into the article body.
   *
   * This is the feature that replaces v1's Google Drive links: a `.docx` is
   * converted to HTML and becomes editable text below, and a `.pdf` is
   * attached and rendered by the article page's own viewer. Either way the
   * reader stays on the site.
   */
  async function importDocument(files: FileList | null) {
    if (!files?.length || !publicationId) return;

    setImporting(true);

    try {
      const form = new FormData();
      form.append('document', files[0]);

      const updated = await api.upload<Publication>(
        `/admin/publications/${publicationId}/import-document`,
        form,
      );

      setRecord(updated);
      setDraft(toDraft(updated));
      notify(
        updated.body
          ? 'Imported — the text is editable below'
          : 'Attached — readers will see it in the document viewer',
      );
    } catch (caught) {
      notify((caught as Error).message, 'error');
    } finally {
      setImporting(false);
      if (documentInput.current) documentInput.current.value = '';
    }
  }

  async function attachMedia(asset: MediaAsset) {
    if (!publicationId) return;

    try {
      await api.post(`/admin/publications/${publicationId}/attachments`, {
        mediaId: asset.id,
        label: asset.originalName,
      });
      notify('Attached');
      void load();
    } catch (caught) {
      notify((caught as Error).message, 'error');
    }
  }

  async function detachMedia(mediaId: string) {
    if (!publicationId) return;

    try {
      await api.remove(`/admin/publications/${publicationId}/attachments/${mediaId}`);
      void load();
    } catch (caught) {
      notify((caught as Error).message, 'error');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-24 text-ink-muted">
        <Icon name="progress_activity" className="animate-spin" />
        <span className="text-small">Loading…</span>
      </div>
    );
  }

  const previewSlug = draft.slug || slugify(draft.title) || 'untitled';

  return (
    <div className="space-y-6">
      {/* ── Sticky action bar ───────────────────────────────────────────── */}
      <div className="sticky top-[5.25rem] z-20 flex flex-wrap items-center justify-between gap-4 rounded-panel border border-surface-line bg-surface/95 px-6 py-4 shadow-float backdrop-blur-xl">
        {/* Wraps rather than overflowing: on a phone the back link, the
            status pill and the readable pill do not fit on one line. */}
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Link
            href="/admin/publications"
            className="flex items-center gap-1.5 text-small text-ink-muted transition-colors hover:text-primary"
          >
            <Icon name="arrow_back" size="sm" />
            Publications
          </Link>

          {record && (
            <>
              <span className="text-ink-soft">·</span>
              <Pill tone={record.status === 'published' ? 'positive' : 'neutral'}>
                {record.status}
              </Pill>
              {record.body ? (
                <Pill tone="positive" icon="check_circle">
                  Readable
                </Pill>
              ) : (
                <Pill tone="warning" icon="pending">
                  No content
                </Pill>
              )}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {record?.status === 'published' && (
            <Link href={`/publications/${record.slug}`} target="_blank">
              <Button variant="ghost" icon="open_in_new">
                <span className="hidden sm:inline">View</span>
              </Button>
            </Link>
          )}

          {record && record.status !== 'published' && (
            <Button
              variant="ghost"
              icon="publish"
              onClick={() => void save({ status: 'published' })}
              disabled={saving}
            >
              Publish
            </Button>
          )}

          <Button variant="secondary" icon="save" busy={saving} onClick={() => void save()}>
            {isNew ? 'Create' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* ── Main column ─────────────────────────────────────────────── */}
        <div className="space-y-6 xl:col-span-2">
          <Panel title="The piece">
            <div className="space-y-6">
              <Field label="Title" required error={errors.title}>
                <Input
                  value={draft.title}
                  onChange={(event) => set('title', event.target.value)}
                  placeholder="The title readers will see"
                />
              </Field>

              <Field
                label="Web address"
                hint={`neotericlp.com.ng/publications/${previewSlug}`}
                error={errors.slug}
              >
                <Input
                  mono
                  value={draft.slug}
                  onChange={(event) => set('slug', slugify(event.target.value))}
                  placeholder="generated-from-the-title"
                />
              </Field>

              <Field
                label="Summary"
                hint="Shown under the thumbnail on the News & Publications page, and in search results."
                error={errors.excerpt}
              >
                <Textarea
                  rows={3}
                  value={draft.excerpt}
                  maxLength={500}
                  onChange={(event) => set('excerpt', event.target.value)}
                  placeholder="One or two sentences on what this covers."
                />
              </Field>
            </div>
          </Panel>

          {/* ── Document import ───────────────────────────────────────── */}
          <Panel
            title="Content"
            description="What the reader sees on the article page — no Google Drive, no download."
            actions={
              !isNew && (
                <>
                  <input
                    ref={documentInput}
                    type="file"
                    accept=".docx,.doc,.pdf"
                    className="hidden"
                    onChange={(event) => void importDocument(event.target.files)}
                  />
                  <Button
                    variant="ghost"
                    icon="upload_file"
                    busy={importing}
                    onClick={() => documentInput.current?.click()}
                  >
                    Import a document
                  </Button>
                </>
              )
            }
          >
            {isNew ? (
              <div className="flex items-start gap-4 rounded-card border border-surface-line bg-surface-sunken p-4">
                <Icon name="info" className="shrink-0 text-ink-muted" />
                <p className="text-small text-ink-muted">
                  Create the publication first, then you can import a Word document or
                  PDF here and it will become the article text.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-6 flex items-start gap-4 rounded-card border border-primary-100 bg-primary-50/50 p-4">
                  <Icon name="auto_stories" className="shrink-0 text-primary" />
                  <p className="text-small text-primary-900">
                    Upload a <span className="font-mono">.docx</span> and its text is
                    converted into the editable content below. Upload a{' '}
                    <span className="font-mono">.pdf</span> and it is attached, then shown
                    in a reader on the article page. Either way nobody leaves the website.
                  </p>
                </div>

                <Field
                  label="Article content"
                  hint="HTML. Headings, paragraphs, lists, links, quotes and tables are kept; anything else is stripped before it reaches a reader."
                  error={errors.body}
                >
                  <Textarea
                    rows={18}
                    value={draft.body}
                    onChange={(event) => set('body', event.target.value)}
                    className="font-mono text-small"
                    placeholder="<p>Write or paste the article here…</p>"
                  />
                </Field>

                {record?.attachments && record.attachments.length > 0 && (
                  <div className="mt-6">
                    <p className="mb-3 text-small font-medium text-ink">Attachments</p>
                    <ul className="space-y-2">
                      {record.attachments.map((attachment) => (
                        <li
                          key={attachment.id}
                          className="flex items-center gap-3 rounded-card border border-surface-line px-4 py-3"
                        >
                          <Icon name="description" size="sm" className="text-ink-muted" />
                          <span className="min-w-0 flex-1 truncate text-small text-ink">
                            {attachment.label ?? attachment.media?.originalName ?? 'File'}
                          </span>
                          <button
                            type="button"
                            onClick={() => void detachMedia(attachment.mediaId)}
                            className="text-small text-ink-muted transition-colors hover:text-red-600"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-6">
                  <Button
                    variant="ghost"
                    icon="attach_file"
                    onClick={() => setPickingAttachment(true)}
                  >
                    Attach a file from the library
                  </Button>
                </div>
              </>
            )}
          </Panel>

          <Panel
            title="Search engines and AI"
            description="How this piece is described to Google and to AI assistants."
          >
            <div className="space-y-6">
              <Field
                label="Search title"
                hint={`Falls back to the title. ${draft.seoTitle.length}/60 is the comfortable length.`}
                error={errors.seoTitle}
              >
                <Input
                  value={draft.seoTitle}
                  maxLength={200}
                  onChange={(event) => set('seoTitle', event.target.value)}
                  placeholder={draft.title || 'Falls back to the title'}
                />
              </Field>

              <Field
                label="Search description"
                hint={`Falls back to the summary. ${draft.seoDescription.length}/160 is the comfortable length.`}
                error={errors.seoDescription}
              >
                <Textarea
                  rows={3}
                  value={draft.seoDescription}
                  maxLength={400}
                  onChange={(event) => set('seoDescription', event.target.value)}
                  placeholder={draft.excerpt || 'Falls back to the summary'}
                />
              </Field>

              <Field
                label="Tags"
                hint="Comma separated. Tags decide which pieces appear as related reading at the foot of the article."
              >
                <ListInput
                  value={draft.tags}
                  onChange={(next) => set('tags', next)}
                  placeholder="corporate law, taxation, compliance"
                />
              </Field>
            </div>
          </Panel>
        </div>

        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <div className="space-y-6">
          <Panel title="Publishing">
            <div className="space-y-6">
              <Field label="Status" error={errors.status}>
                <Select
                  value={draft.status}
                  onChange={(event) => set('status', event.target.value as PublicationStatus)}
                >
                  <option value="draft">Draft — only visible here</option>
                  <option value="scheduled">Scheduled — publishes itself</option>
                  <option value="published">Published — live on the website</option>
                  <option value="archived">Archived — off the website</option>
                </Select>
              </Field>

              {draft.status === 'scheduled' && (
                <Field
                  label="Publish on"
                  required
                  error={errors.scheduledFor}
                  hint="West Africa Time."
                >
                  <Input
                    type="datetime-local"
                    value={draft.scheduledFor}
                    onChange={(event) => set('scheduledFor', event.target.value)}
                  />
                </Field>
              )}

              <Field label="Category" error={errors.categoryId}>
                <Select
                  value={draft.categoryId}
                  onChange={(event) => set('categoryId', event.target.value)}
                >
                  <option value="">No category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Author" error={errors.authorName}>
                <Input
                  value={draft.authorName}
                  onChange={(event) => set('authorName', event.target.value)}
                  placeholder="M. A Mustapha & Co."
                />
              </Field>

              <Checkbox
                label="Feature this piece"
                description="Featured articles lead the News & Publications page."
                checked={draft.isFeatured}
                onChange={(next) => set('isFeatured', next)}
              />
            </div>
          </Panel>

          <Panel
            title="Thumbnail"
            description="Shown on the News & Publications page and when the link is shared."
          >
            <div className="space-y-6">
              <ImageField
                label="Cover image"
                url={draft.coverImageUrl}
                onChange={({ url, id }) =>
                  setDraft((current) => ({
                    ...current,
                    coverImageUrl: url,
                    coverImageId: id,
                  }))
                }
                hint="Landscape works best — the cards crop to 16 by 9."
              />

              <Field
                label="Image description"
                hint="Read aloud by screen readers, and used by search engines."
                error={errors.coverAlt}
              >
                <Input
                  value={draft.coverAlt}
                  maxLength={200}
                  onChange={(event) => set('coverAlt', event.target.value)}
                  placeholder="What the picture shows"
                />
              </Field>
            </div>
          </Panel>

          {record && (
            <Panel title="History">
              <dl className="space-y-4 text-small">
                {[
                  ['Created', formatDateTime(record.createdAt)],
                  ['Last saved', formatDateTime(record.updatedAt)],
                  ['Published', record.publishedAt ? formatDateTime(record.publishedAt) : '—'],
                  ['Reads', String(record.viewCount)],
                  ['Reading time', `${record.readingMinutes} min`],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-4">
                    <dt className="text-ink-muted">{label}</dt>
                    <dd
                      className={cn(
                        'text-right text-ink',
                        /\d/.test(value) && 'font-mono tabular-nums',
                      )}
                    >
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>

              {record.sourceUrl && (
                <div className="mt-6 border-t border-surface-line pt-4">
                  <p className="text-caption uppercase tracking-[0.1em] text-ink-soft">
                    Originally from
                  </p>
                  <p className="mt-2 break-all font-mono text-caption text-ink-muted">
                    {record.sourceUrl}
                  </p>
                  <p className="mt-2 text-caption text-ink-soft">
                    Kept as a record of where the piece came from. Readers are never sent
                    there.
                  </p>
                </div>
              )}
            </Panel>
          )}
        </div>
      </div>

      <MediaPicker
        open={pickingAttachment}
        onClose={() => setPickingAttachment(false)}
        onSelect={(asset) => void attachMedia(asset)}
        accept="any"
        title="Attach a file"
      />
    </div>
  );
}
