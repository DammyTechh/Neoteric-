import type { MediaAsset } from '@domain/entities';
import type { IAuditRepository, IMediaRepository, MediaFilters } from '@domain/repositories';
import type { IFileStorage } from '@domain/services';
import { env } from '@shared/config/env';
import { AppError } from '@shared/errors/AppError';
import { createLogger } from '@shared/logger';
import { checksum } from '@shared/utils/crypto';
import type { Paginated, PaginationParams, RequestContext, UUID } from '@shared/types/common';

const log = createLogger('media');

export interface UploadInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  folder?: string;
  altText?: string | null;
  caption?: string | null;
}

/**
 * The media library — every image and document the admin uploads.
 *
 * Storage and catalogue are kept in step: a row without bytes is a broken
 * image on the site, and bytes without a row are an invisible storage bill.
 */
export class MediaService {
  constructor(
    private readonly media: IMediaRepository,
    private readonly storage: IFileStorage,
    private readonly audit: IAuditRepository,
  ) {}

  async list(params: PaginationParams, filters?: MediaFilters): Promise<Paginated<MediaAsset>> {
    return this.media.findMany(params, filters);
  }

  async getById(id: UUID): Promise<MediaAsset> {
    const asset = await this.media.findById(id);
    if (!asset) throw AppError.notFound('Media asset');
    return asset;
  }

  async upload(input: UploadInput, context: RequestContext): Promise<MediaAsset> {
    this.assertAcceptable(input);

    // Re-uploading the same file returns the existing record rather than
    // paying for a second copy — editors do this constantly.
    const digest = checksum(input.buffer);
    const existing = await this.media.findByChecksum(digest);

    if (existing) {
      log.info({ id: existing.id }, 'upload matched an existing asset by checksum');
      return existing;
    }

    const stored = await this.storage.upload({
      buffer: input.buffer,
      originalName: input.originalName,
      mimeType: input.mimeType,
      folder: input.folder,
    });

    const dimensions = this.readImageDimensions(input.buffer, input.mimeType);

    try {
      const asset = await this.media.create({
        bucket: stored.bucket,
        storagePath: stored.path,
        publicUrl: stored.publicUrl,
        originalName: input.originalName,
        mimeType: input.mimeType,
        sizeBytes: input.buffer.length,
        width: dimensions?.width ?? null,
        height: dimensions?.height ?? null,
        altText: input.altText ?? null,
        caption: input.caption ?? null,
        folder: input.folder ?? 'general',
        checksum: digest,
        uploadedBy: context.actor?.id ?? null,
      });

      await this.audit.record({
        adminUserId: context.actor?.id ?? null,
        actorEmail: context.actor?.email ?? null,
        action: 'upload',
        entity: 'media_asset',
        entityId: asset.id,
        beforeState: null,
        afterState: { originalName: asset.originalName, sizeBytes: asset.sizeBytes },
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
      });

      return asset;
    } catch (error) {
      // The bytes are already in the bucket; if the row failed, remove them
      // rather than leaving an orphan nothing will ever reference.
      await this.storage.remove(stored.path).catch(() => undefined);
      throw error;
    }
  }

  async update(
    id: UUID,
    data: { altText?: string | null; caption?: string | null; folder?: string },
    context: RequestContext,
  ): Promise<MediaAsset> {
    await this.getById(id);
    const updated = await this.media.update(id, data);

    await this.audit.record({
      adminUserId: context.actor?.id ?? null,
      actorEmail: context.actor?.email ?? null,
      action: 'update',
      entity: 'media_asset',
      entityId: id,
      beforeState: null,
      afterState: data,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    });

    return updated;
  }

  /**
   * Removes the row first, then the bytes.
   *
   * That order is deliberate: a row left pointing at a deleted object shows a
   * broken image on the public site, whereas an orphaned object is merely
   * wasted storage that a later sweep can reclaim.
   */
  async remove(id: UUID, context: RequestContext): Promise<void> {
    const asset = await this.getById(id);

    await this.media.delete(id);
    await this.storage.remove(asset.storagePath).catch((error) => {
      log.warn({ err: error, path: asset.storagePath }, 'orphaned object left in storage');
    });

    await this.audit.record({
      adminUserId: context.actor?.id ?? null,
      actorEmail: context.actor?.email ?? null,
      action: 'delete',
      entity: 'media_asset',
      entityId: id,
      beforeState: { originalName: asset.originalName, storagePath: asset.storagePath },
      afterState: null,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    });
  }

  async folders() {
    return this.media.listFolders();
  }

  private assertAcceptable(input: UploadInput): void {
    const maxBytes = env.UPLOAD_MAX_FILE_SIZE_MB * 1024 * 1024;

    if (input.buffer.length > maxBytes) {
      throw AppError.payloadTooLarge(
        `That file is larger than the ${env.UPLOAD_MAX_FILE_SIZE_MB}MB limit`,
      );
    }

    if (input.buffer.length === 0) {
      throw AppError.unprocessable('That file is empty');
    }

    if (!env.UPLOAD_ALLOWED_MIME.includes(input.mimeType)) {
      throw AppError.unsupportedMediaType(
        'That file type is not accepted. Images, PDFs and Word documents are supported.',
      );
    }

    // The declared MIME type is attacker-controlled, so check the bytes too.
    if (input.mimeType.startsWith('image/') && !this.looksLikeImage(input.buffer, input.mimeType)) {
      throw AppError.unprocessable('That file does not appear to be a valid image');
    }
  }

  /** Magic-number check against the declared type. */
  private looksLikeImage(buffer: Buffer, mimeType: string): boolean {
    if (buffer.length < 12) return false;

    switch (mimeType) {
      case 'image/jpeg':
        return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
      case 'image/png':
        return (
          buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
        );
      case 'image/webp':
        return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
      case 'image/avif':
        return buffer.toString('ascii', 4, 8) === 'ftyp';
      case 'image/svg+xml': {
        // SVG is XML, and XML can carry script — the sanitiser on render is
        // the real defence; here just confirm it is plausibly SVG.
        const head = buffer.toString('utf8', 0, Math.min(buffer.length, 1024)).toLowerCase();
        return head.includes('<svg');
      }
      default:
        return true;
    }
  }

  /**
   * Width and height for PNG and JPEG, read straight from the header.
   *
   * Avoids pulling in an image library for two numbers whose only job is to
   * let the frontend reserve layout space and avoid a content shift.
   */
  private readImageDimensions(
    buffer: Buffer,
    mimeType: string,
  ): { width: number; height: number } | null {
    try {
      if (mimeType === 'image/png' && buffer.length >= 24) {
        return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
      }

      if (mimeType === 'image/jpeg') {
        let offset = 2;

        while (offset < buffer.length - 9) {
          if (buffer[offset] !== 0xff) {
            offset += 1;
            continue;
          }

          const marker = buffer[offset + 1]!;

          // SOF0–SOF3 and SOF5–SOF15 carry the frame dimensions.
          if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
            return {
              height: buffer.readUInt16BE(offset + 5),
              width: buffer.readUInt16BE(offset + 7),
            };
          }

          offset += 2 + buffer.readUInt16BE(offset + 2);
        }
      }
    } catch {
      // Dimensions are a nicety; never fail an upload over them.
    }

    return null;
  }
}
