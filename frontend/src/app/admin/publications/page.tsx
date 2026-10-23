'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AdminShell } from '@/components/admin/Shell';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  Pagination,
  Panel,
  Pill,
  SearchInput,
  Select,
  Spinner,
  StatusPill,
  Table,
  Td,
  Th,
  useToast,
} from '@/components/admin/ui';
import { Icon } from '@/components/ui/Icon';
import { useApi, useAuth } from '@/lib/auth';
import { formatNumber, formatRelative } from '@/lib/format';
import type { PublicationCategory, Publication, PublicationStatus } from '@/lib/types';

const STATUSES: PublicationStatus[] = ['draft', 'scheduled', 'published', 'archived'];

export default function PublicationsPage() {
  const api = useApi();
  const router = useRouter();
  const params = useSearchParams();
  const { notify } = useToast();
  const { user } = useAuth();

  const [items, setItems] = useState<Publication[]>([]);
  const [categories, setCategories] = useState<PublicationCategory[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [categoryId, setCategoryId] = useState('');

  const [deleting, setDeleting] = useState<Publication | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const result = await api.list<Publication>('/admin/publications', {
        page,
        limit: 20,
        search: search || undefined,
        status: status || undefined,
        categoryId: categoryId || undefined,
      });

      setItems(result.items);
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
  }, [api, page, search, status, categoryId]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  // The category filter list is static enough to fetch once.
  useEffect(() => {
    void api
      .list<PublicationCategory>('/admin/categories', { limit: 100 })
      .then((result) => setCategories(result.items))
      .catch(() => undefined);
  }, [api]);

  /** Publishes or unpublishes in place, without a full reload. */
  async function toggleStatus(publication: Publication) {
    const action = publication.status === 'published' ? 'unpublish' : 'publish';

    try {
      const updated = await api.post<Publication>(
        `/admin/publications/${publication.id}/${action}`,
      );
      setItems((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      notify(action === 'publish' ? 'Published to the website' : 'Taken off the website');
    } catch (caught) {
      notify((caught as Error).message, 'error');
    }
  }

  async function toggleFeatured(publication: Publication) {
    try {
      const updated = await api.post<Publication>(
        `/admin/publications/${publication.id}/feature`,
      );
      setItems((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (caught) {
      notify((caught as Error).message, 'error');
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);

    try {
      await api.remove(`/admin/publications/${deleting.id}`);
      notify('Deleted');
      setDeleting(null);
      void load();
    } catch (caught) {
      notify((caught as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const withoutBody = items.filter((item) => !item.body).length;

  return (
    <AdminShell
      title="Publications"
      description="News, insights and legal updates, read on the website itself."
      actions={
        <Button
          variant="secondary"
          icon="add"
          onClick={() => router.push('/admin/publications/new')}
        >
          <span className="hidden sm:inline">New</span>
        </Button>
      }
    >
      {withoutBody > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-4 rounded-card border border-amber-200 bg-amber-50 p-4">
          <Icon name="pending_actions" className="shrink-0 text-amber-600" />
          <p className="min-w-0 flex-1 text-base leading-relaxed text-amber-900">
            <span className="font-mono">{withoutBody}</span> of these have no content yet,
            so the article page tells readers the piece is being prepared. Open one and
            import its document to make it readable.
          </p>
        </div>
      )}

      <Panel padded={false}>
        <div className="flex flex-wrap items-end gap-4 border-b border-surface-line px-6 py-4">
          <SearchInput
            value={search}
            onChange={(next) => {
              setSearch(next);
              setPage(1);
            }}
            placeholder="Search titles and content…"
          />

          <Field label="Status" className="w-40">
            <Select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Any status</option>
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Category" className="w-48">
            <Select
              value={categoryId}
              onChange={(event) => {
                setCategoryId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Any category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
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
            icon="article"
            title="Nothing matches"
            description={
              search || status || categoryId
                ? 'Try a broader search, or clear the filters.'
                : 'Write the first publication, or import one from a Word document or PDF.'
            }
            action={
              <Link href="/admin/publications/new">
                <Button variant="secondary" icon="add">
                  New publication
                </Button>
              </Link>
            }
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Publication</Th>
                  <Th className="w-32">Status</Th>
                  <Th className="w-28">Reads</Th>
                  <Th className="w-32">Updated</Th>
                  <Th className="w-36 text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((publication) => (
                  <tr key={publication.id} className="group">
                    <Td>
                      <div className="flex items-start gap-4">
                        {/* The thumbnail the index page shows readers. */}
                        <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-card border border-surface-line bg-surface-sunken">
                          {publication.coverImageUrl ? (
                            <Image
                              src={publication.coverImageUrl}
                              alt=""
                              fill
                              sizes="80px"
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <span className="absolute inset-0 grid place-items-center text-ink-soft">
                              <Icon name="image_not_supported" size="sm" />
                            </span>
                          )}
                        </div>

                        <div className="min-w-0">
                          <Link
                            href={`/admin/publications/${publication.id}`}
                            prefetch={false}
                            className="font-medium text-ink transition-colors group-hover:text-primary"
                          >
                            {publication.title}
                          </Link>

                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            {publication.category && (
                              <Pill tone="teal">{publication.category.name}</Pill>
                            )}
                            {publication.isFeatured && <Pill tone="bronze" icon="star">Featured</Pill>}
                            {!publication.body && (
                              <Pill tone="warning" icon="pending">No content</Pill>
                            )}
                            {!publication.coverImageUrl && (
                              <Pill tone="neutral" icon="image">No thumbnail</Pill>
                            )}
                          </div>

                          <p className="mt-1.5 font-mono text-caption text-ink-soft">
                            /{publication.slug}
                          </p>
                        </div>
                      </div>
                    </Td>

                    <Td>
                      <StatusPill status={publication.status} />
                    </Td>

                    <Td className="font-mono tabular-nums text-ink-muted">
                      {formatNumber(publication.viewCount)}
                    </Td>

                    <Td className="whitespace-nowrap text-ink-muted">
                      {formatRelative(publication.updatedAt)}
                    </Td>

                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        <IconButton
                          icon={publication.isFeatured ? 'star' : 'star_outline'}
                          label={publication.isFeatured ? 'Remove from featured' : 'Feature'}
                          onClick={() => void toggleFeatured(publication)}
                        />
                        <IconButton
                          icon={
                            publication.status === 'published' ? 'visibility_off' : 'publish'
                          }
                          label={
                            publication.status === 'published'
                              ? 'Take off the website'
                              : 'Publish'
                          }
                          onClick={() => void toggleStatus(publication)}
                        />
                        <IconButton
                          icon="edit"
                          label="Edit"
                          onClick={() =>
                            router.push(`/admin/publications/${publication.id}`)
                          }
                        />
                        {user?.role !== 'editor' && (
                          <IconButton
                            icon="delete"
                            label="Delete"
                            tone="danger"
                            onClick={() => setDeleting(publication)}
                          />
                        )}
                      </div>
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
        )}
      </Panel>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        busy={busy}
        title="Delete this publication?"
        message={`“${deleting?.title}” will be removed from the website and the dashboard. This cannot be undone.`}
      />
    </AdminShell>
  );
}
