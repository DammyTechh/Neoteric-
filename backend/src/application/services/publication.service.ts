import { CrudService } from './crud.service';
import { DocumentImportService } from './document-import.service';
import type { MediaService } from './media.service';
import type { Publication } from '@domain/entities';
import type {
  IAuditRepository,
  IPublicationAttachmentRepository,
  IPublicationRepository,
  ISettingsRepository,
  PublicationFilters,
} from '@domain/repositories';
import type { NewsletterService } from './newsletter.service';
import { AppError } from '@shared/errors/AppError';
import { createLogger } from '@shared/logger';
import { deriveExcerpt, sanitizeArticleHtml } from '@shared/utils/sanitize';
import type { Paginated, PaginationParams, RequestContext, UUID } from '@shared/types/common';

const log = createLogger('publications');

/**
 * News & Publications.
 *
 * This is the heart of the v2 change. In v1 each item was a title plus a
 * Google Drive link, so "reading an article" meant leaving the site for a
 * Drive viewer. Here an article has a body, a cover thumbnail and a slug of
 * its own.
 *
 * The back catalogue is brought across by `importDocument`: the firm uploads
 * the Word file or PDF that used to sit on Drive, and it becomes the page.
 * `sourceUrl` still records where a piece came from, but it is provenance now,
 * not a destination — no reader is ever sent off the site to read an article.
 */
export class PublicationService extends CrudService<Publication, PublicationFilters> {
  constructor(
    private readonly publications: IPublicationRepository,
    private readonly attachments: IPublicationAttachmentRepository,
    private readonly settings: ISettingsRepository,
    private readonly media: MediaService,
    private readonly documents: DocumentImportService,
    audit: IAuditRepository,
    private readonly newsletter?: NewsletterService,
  ) {
    super(publications, audit, {
      resource: 'Publication',
      auditEntity: 'publication',
      slugSource: 'title',
    });
  }

  // ── Public reads ──────────────────────────────────────────────────────────

  /** The News & Publications index. Drafts can never appear here. */
  async listPublic(
    params: PaginationParams,
    filters: Omit<PublicationFilters, 'publishedOnly' | 'status'>,
  ): Promise<Paginated<Publication>> {
    return this.publications.findMany(params, { ...filters, publishedOnly: true });
  }

  /**
   * A single article by slug, for the article page.
   *
   * The view counter is bumped on a detached promise: a failure to count a
   * read must never stop the read itself.
   */
  async getPublicBySlug(slug: string, countView = true): Promise<{
    publication: Publication;
    related: Publication[];
    previous: Publication | null;
    next: Publication | null;
  }> {
    const publication = await this.publications.findBySlugPublic(slug);
    if (!publication) throw AppError.notFound('Publication');

    const [related, adjacent, attachments] = await Promise.all([
      this.publications.findRelated(publication.id, publication.categoryId, 3),
      publication.publishedAt
        ? this.publications.findAdjacent(publication.publishedAt)
        : Promise.resolve({ previous: null, next: null }),
      this.attachments.listFor(publication.id),
    ]);

    if (countView) {
      void this.publications.incrementViewCount(publication.id).catch(() => undefined);
    }

    return {
      publication: { ...publication, attachments },
      related,
      previous: adjacent.previous,
      next: adjacent.next,
    };
  }

  async getAdminById(id: UUID): Promise<Publication> {
    const publication = await this.getById(id);
    const attachments = await this.attachments.listFor(id);
    return { ...publication, attachments };
  }

  async listPublishedSlugs() {
    return this.publications.listAllPublishedSlugs();
  }

  // ── Writes ────────────────────────────────────────────────────────────────

  override async create(
    data: Record<string, unknown>,
    context: RequestContext,
  ): Promise<Publication> {
    const payload = this.normalise(data);
    payload.createdBy = context.actor?.id ?? null;
    payload.updatedBy = context.actor?.id ?? null;

    const createdRow = await super.create(payload, context);

    if (createdRow.status === 'published') {
      void this.announce(createdRow);
    }

    return createdRow;
  }

  override async update(
    id: UUID,
    data: Record<string, unknown>,
    context: RequestContext,
  ): Promise<Publication> {
    const before = await this.getById(id);
    const payload = this.normalise(data, before);
    payload.updatedBy = context.actor?.id ?? null;

    const after = await super.update(id, payload, context);

    // Announce only on the draft → published transition, so re-saving a
    // published article does not email the list again.
    if (before.status !== 'published' && after.status === 'published') {
      void this.announce(after);
    }

    return after;
  }

  /** One-click publish from the dashboard list. */
  async publish(id: UUID, context: RequestContext): Promise<Publication> {
    const before = await this.getById(id);

    if (before.status === 'published') {
      throw AppError.conflict('That article is already published');
    }

    if (!before.body && !before.sourceUrl) {
      throw AppError.unprocessable(
        'Add the article body, or a source link, before publishing it',
      );
    }

    const updated = await this.update(
      id,
      { status: 'published', publishedAt: new Date().toISOString(), scheduledFor: null },
      context,
    );

    return updated;
  }

  async unpublish(id: UUID, context: RequestContext): Promise<Publication> {
    return this.update(id, { status: 'draft' }, context);
  }

  async toggleFeatured(id: UUID, context: RequestContext): Promise<Publication> {
    const current = await this.getById(id);
    return this.update(id, { isFeatured: !current.isFeatured }, context);
  }

  async addAttachment(
    publicationId: UUID,
    data: { mediaId: UUID; label?: string | null; sortOrder?: number },
  ) {
    await this.getById(publicationId);
    return this.attachments.attach({ publicationId, ...data });
  }

  /**
   * Turns an uploaded document into the article's content.
   *
   * This is the route by which the v1 back catalogue stops living on Google
   * Drive. A Word file is converted to real HTML and becomes the editable body;
   * a PDF is stored and rendered by the article page's inline viewer. Either
   * way the reader stays on the site, which is the whole point.
   */
  async importDocument(
    id: UUID,
    file: { buffer: Buffer; originalName: string; mimeType: string },
    options: { replaceBody?: boolean },
    context: RequestContext,
  ): Promise<{ publication: Publication; mode: 'converted' | 'attached'; warnings: string[] }> {
    const existing = await this.getById(id);

    // Refuse to silently destroy work someone has already done.
    if (existing.body && options.replaceBody !== true) {
      throw AppError.conflict(
        'This article already has content. Confirm that you want to replace it, or edit it directly.',
      );
    }

    // ── PDFs: stored and shown inline, not converted ──────────────────────
    if (DocumentImportService.isInlineViewable(file.mimeType)) {
      const asset = await this.media.upload(
        { ...file, folder: 'publications' },
        context,
      );

      await this.attachments.attach({
        publicationId: id,
        mediaId: asset.id,
        label: file.originalName,
        sortOrder: 0,
      });

      const publication = await this.update(
        id,
        { sourceUrl: asset.publicUrl },
        context,
      );

      return {
        publication,
        mode: 'attached',
        warnings: [
          'PDFs keep their original layout, so this one is shown in a reader on the article page rather than converted to editable text.',
        ],
      };
    }

    // ── Word documents: converted into the article body ───────────────────
    if (!DocumentImportService.isConvertible(file.mimeType)) {
      throw AppError.unsupportedMediaType(
        'Only Word documents (.docx) and PDFs can be imported as article content.',
      );
    }

    const imported = await this.documents.fromWord(file.buffer, file.originalName);

    // Images embedded in the document go into the media library, so the body
    // references our own storage rather than carrying megabytes of base64.
    const replacements = new Map<string, string>();

    for (const [index, image] of imported.images.entries()) {
      try {
        const asset = await this.media.upload(
          {
            buffer: image.buffer,
            originalName: `${existing.slug}-figure-${index + 1}`,
            mimeType: image.mimeType,
            folder: 'publications',
          },
          context,
        );
        replacements.set(image.placeholder, asset.publicUrl);
      } catch (error) {
        log.warn({ err: error, id, index }, 'embedded image upload failed; dropping it');
      }
    }

    const body = this.documents.replaceImagePlaceholders(imported.html, replacements);

    const publication = await this.update(
      id,
      {
        body,
        ...(existing.excerpt ? {} : { excerpt: imported.excerpt }),
      },
      context,
    );

    log.info(
      { id, images: replacements.size, warnings: imported.warnings.length },
      'document imported into article body',
    );

    return { publication, mode: 'converted', warnings: imported.warnings };
  }

  async removeAttachment(publicationId: UUID, mediaId: UUID): Promise<void> {
    await this.attachments.detach(publicationId, mediaId);
  }

  /** Run by the scheduler: flips anything whose publish time has arrived. */
  async runScheduledPublishing(): Promise<number> {
    const published = await this.publications.publishDueScheduled();

    for (const publication of published) {
      log.info({ id: publication.id, slug: publication.slug }, 'scheduled article published');
      void this.announce(publication);
    }

    return published.length;
  }

  /**
   * Normalises an incoming payload.
   *
   * Rich-text bodies are sanitised here rather than at the edge, because this
   * is the last point before persistence and the only one a background job
   * would also pass through.
   */
  private normalise(
    data: Record<string, unknown>,
    existing?: Publication,
  ): Record<string, unknown> {
    const payload = { ...data };

    if (payload.body !== undefined) {
      payload.body = sanitizeArticleHtml(payload.body as string | null);
    }

    // Derive the excerpt from the body when the editor left it blank.
    if (!payload.excerpt && payload.body) {
      payload.excerpt = deriveExcerpt(payload.body as string, 200);
    }

    // Publishing without an explicit date gets one now.
    if (payload.status === 'published' && !payload.publishedAt && !existing?.publishedAt) {
      payload.publishedAt = new Date().toISOString();
    }

    if (payload.status === 'scheduled') {
      const target = payload.scheduledFor as string | undefined;
      if (target && new Date(target) <= new Date()) {
        throw AppError.unprocessable('The scheduled time must be in the future');
      }
    }

    if (Array.isArray(payload.tags)) {
      // De-duplicate case-insensitively, keeping the editor's capitalisation.
      const seen = new Set<string>();
      payload.tags = (payload.tags as string[]).filter((tag) => {
        const key = tag.toLowerCase().trim();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    return payload;
  }

  /** Emails the mailing list, if the feature switch is on. */
  private async announce(publication: Publication): Promise<void> {
    try {
      const enabled = await this.settings.getValue<boolean>(
        'features.broadcast_on_publish',
        false,
      );

      if (!enabled || !this.newsletter) return;

      await this.newsletter.broadcastPublication(publication);
    } catch (error) {
      log.error({ err: error, id: publication.id }, 'publication announcement failed');
    }
  }
}
