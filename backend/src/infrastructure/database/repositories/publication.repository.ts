import { BaseRepository, type QueryBuilder } from './base.repository';
import {
  supabase,
  translateDatabaseError,
  unwrapMaybe,
} from '@infrastructure/database/supabase.client';
import { toPublication, toPublicationAttachment } from '@infrastructure/database/mappers';
import type { Publication, PublicationAttachment } from '@domain/entities';
import type {
  IPublicationAttachmentRepository,
  IPublicationRepository,
  PublicationFilters,
} from '@domain/repositories';
import type { UUID } from '@shared/types/common';

/* eslint-disable @typescript-eslint/no-explicit-any */

const PUBLICATION_COLUMNS = {
  title: 'title',
  slug: 'slug',
  excerpt: 'excerpt',
  body: 'body',
  categoryId: 'category_id',
  coverImageId: 'cover_image_id',
  coverImageUrl: 'cover_image_url',
  coverAlt: 'cover_alt',
  sourceUrl: 'source_url',
  status: 'status',
  isFeatured: 'is_featured',
  authorName: 'author_name',
  tags: 'tags',
  seoTitle: 'seo_title',
  seoDescription: 'seo_description',
  ogImageUrl: 'og_image_url',
  publishedAt: 'published_at',
  scheduledFor: 'scheduled_for',
  createdBy: 'created_by',
  updatedBy: 'updated_by',
  viewCount: 'view_count',
};

/** Pulls the category across in the same round trip. */
const SELECT_WITH_CATEGORY =
  '*, publication_categories!publications_category_id_fkey(id, name, slug, colour)';

export class PublicationRepository
  extends BaseRepository<Publication, PublicationFilters>
  implements IPublicationRepository
{
  constructor() {
    super({
      table: 'publications',
      resource: 'Publication',
      mapper: toPublication,
      columnMap: PUBLICATION_COLUMNS,
      selectColumns: SELECT_WITH_CATEGORY,
    });
  }

  protected override applyFilters(query: QueryBuilder, filters?: PublicationFilters): QueryBuilder {
    let next = query;

    // `publishedOnly` is forced on by every public route, so an unpublished
    // draft cannot be reached by guessing a query string.
    if (filters?.publishedOnly) {
      next = next.eq('status', 'published').lte('published_at', new Date().toISOString());
    } else if (filters?.status) {
      next = next.eq('status', filters.status);
    }

    if (filters?.categoryId) next = next.eq('category_id', filters.categoryId);
    if (filters?.isFeatured !== undefined) next = next.eq('is_featured', filters.isFeatured);
    if (filters?.tag) next = next.contains('tags', [filters.tag]);
    if (filters?.search) {
      next = this.searchAcross(next, filters.search, ['title', 'excerpt']);
    }

    return next;
  }

  /** Public article fetch: published rows only, never a draft. */
  async findBySlugPublic(slug: string): Promise<Publication | null> {
    const result = await supabase
      .from('publications')
      .select(SELECT_WITH_CATEGORY)
      .eq('slug', slug)
      .eq('status', 'published')
      .lte('published_at', new Date().toISOString())
      .maybeSingle();

    const row = unwrapMaybe(result as any, 'find publication by slug');
    return row ? toPublication(row) : null;
  }

  /**
   * Bumps the view counter and the per-day rollup.
   *
   * Runs through an RPC so the increment is atomic; two readers landing on the
   * same article at once would otherwise lose a count to a read-modify-write
   * race. Failure is swallowed deliberately — a missed view must never break
   * the page it was counting.
   */
  async incrementViewCount(id: UUID): Promise<void> {
    const { error } = await supabase.rpc('increment_publication_view', { p_publication_id: id });
    if (error) {
      // Fall back to a non-atomic update if the RPC is missing.
      await supabase
        .from('publications')
        .update({ view_count: (await this.currentViewCount(id)) + 1 })
        .eq('id', id);
    }
  }

  private async currentViewCount(id: UUID): Promise<number> {
    const { data } = await supabase.from('publications').select('view_count').eq('id', id).maybeSingle();
    return Number((data as any)?.view_count ?? 0);
  }

  /** "More like this" — same category first, newest first, excluding self. */
  async findRelated(id: UUID, categoryId: UUID | null, limit: number): Promise<Publication[]> {
    let query = supabase
      .from('publications')
      .select(SELECT_WITH_CATEGORY)
      .eq('status', 'published')
      .lte('published_at', new Date().toISOString())
      .neq('id', id)
      .order('published_at', { ascending: false })
      .limit(limit);

    if (categoryId) query = query.eq('category_id', categoryId);

    const { data, error } = await query;
    if (error) throw translateDatabaseError(error, 'find related publications');

    const related = (data ?? []).map(toPublication);

    // Not enough in the same category — top up with the latest from anywhere.
    if (related.length < limit && categoryId) {
      const exclude = [id, ...related.map((p) => p.id)];
      const { data: filler } = await supabase
        .from('publications')
        .select(SELECT_WITH_CATEGORY)
        .eq('status', 'published')
        .lte('published_at', new Date().toISOString())
        .not('id', 'in', `(${exclude.join(',')})`)
        .order('published_at', { ascending: false })
        .limit(limit - related.length);

      related.push(...(filler ?? []).map(toPublication));
    }

    return related;
  }

  /** Previous / next article, for the arrows at the foot of an article page. */
  async findAdjacent(
    publishedAt: string,
  ): Promise<{ previous: Publication | null; next: Publication | null }> {
    const now = new Date().toISOString();

    const [previous, next] = await Promise.all([
      supabase
        .from('publications')
        .select(SELECT_WITH_CATEGORY)
        .eq('status', 'published')
        .lt('published_at', publishedAt)
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('publications')
        .select(SELECT_WITH_CATEGORY)
        .eq('status', 'published')
        .gt('published_at', publishedAt)
        .lte('published_at', now)
        .order('published_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    return {
      previous: previous.data ? toPublication(previous.data) : null,
      next: next.data ? toPublication(next.data) : null,
    };
  }

  /**
   * Flips any article whose scheduled time has arrived to `published`.
   * Driven by the scheduler in `jobs/`.
   */
  async publishDueScheduled(): Promise<Publication[]> {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('publications')
      .update({ status: 'published', published_at: now })
      .eq('status', 'scheduled')
      .lte('scheduled_for', now)
      .select(SELECT_WITH_CATEGORY);

    if (error) throw translateDatabaseError(error, 'publish scheduled publications');
    return (data ?? []).map(toPublication);
  }

  /** Feeds the frontend sitemap. */
  async listAllPublishedSlugs(): Promise<{ slug: string; updatedAt: string }[]> {
    const { data, error } = await supabase
      .from('publications')
      .select('slug, updated_at')
      .eq('status', 'published')
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false });

    if (error) throw translateDatabaseError(error, 'list published slugs');
    return (data ?? []).map((row: any) => ({ slug: row.slug, updatedAt: row.updated_at }));
  }
}

// ── Attachments ─────────────────────────────────────────────────────────────

export class PublicationAttachmentRepository implements IPublicationAttachmentRepository {
  async listFor(publicationId: UUID): Promise<PublicationAttachment[]> {
    const { data, error } = await supabase
      .from('publication_attachments')
      .select('*, media_assets(*)')
      .eq('publication_id', publicationId)
      .order('sort_order', { ascending: true });

    if (error) throw translateDatabaseError(error, 'list publication attachments');
    return (data ?? []).map(toPublicationAttachment);
  }

  async attach(data: {
    publicationId: UUID;
    mediaId: UUID;
    label?: string | null;
    sortOrder?: number;
  }): Promise<PublicationAttachment> {
    const { data: row, error } = await supabase
      .from('publication_attachments')
      .insert({
        publication_id: data.publicationId,
        media_id: data.mediaId,
        label: data.label ?? null,
        sort_order: data.sortOrder ?? 0,
      })
      .select('*, media_assets(*)')
      .single();

    if (error) throw translateDatabaseError(error, 'attach file to publication');
    return toPublicationAttachment(row);
  }

  async detach(publicationId: UUID, mediaId: UUID): Promise<void> {
    const { error } = await supabase
      .from('publication_attachments')
      .delete()
      .eq('publication_id', publicationId)
      .eq('media_id', mediaId);

    if (error) throw translateDatabaseError(error, 'detach file from publication');
  }
}
