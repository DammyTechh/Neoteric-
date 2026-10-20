import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { supabase } from '@infrastructure/database/supabase.client';
import type { IFileStorage, StoredFile } from '@domain/services';
import { env } from '@shared/config/env';
import { AppError } from '@shared/errors/AppError';
import { createLogger } from '@shared/logger';

const log = createLogger('storage');

/**
 * Media storage backed by a Supabase Storage bucket.
 *
 * Filenames are regenerated rather than reused: an uploaded name is attacker
 * -controlled, can collide, and can carry path separators. The original is
 * kept in the database row for display.
 */
export class SupabaseFileStorage implements IFileStorage {
  private readonly bucket = env.SUPABASE_STORAGE_BUCKET;

  async upload(input: {
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    folder?: string;
  }): Promise<StoredFile> {
    const folder = this.sanitizeFolder(input.folder ?? 'general');
    const extension = this.safeExtension(input.originalName, input.mimeType);
    const objectPath = `${folder}/${Date.now()}-${randomUUID()}${extension}`;

    const { error } = await supabase.storage.from(this.bucket).upload(objectPath, input.buffer, {
      contentType: input.mimeType,
      cacheControl: '31536000', // immutable: the path is unique per upload
      upsert: false,
    });

    if (error) {
      log.error({ err: error, objectPath }, 'upload failed');
      throw AppError.storage('The file could not be uploaded', error);
    }

    const { data } = supabase.storage.from(this.bucket).getPublicUrl(objectPath);

    return { path: objectPath, publicUrl: data.publicUrl, bucket: this.bucket };
  }

  async remove(objectPath: string): Promise<void> {
    const { error } = await supabase.storage.from(this.bucket).remove([objectPath]);

    if (error) {
      log.error({ err: error, objectPath }, 'delete failed');
      throw AppError.storage('The file could not be removed', error);
    }
  }

  /** Time-limited URL, for anything kept in a private bucket. */
  async signedUrl(objectPath: string, expiresInSeconds: number): Promise<string> {
    const { data, error } = await supabase.storage
      .from(this.bucket)
      .createSignedUrl(objectPath, expiresInSeconds);

    if (error || !data) {
      throw AppError.storage('Could not create a signed URL', error);
    }

    return data.signedUrl;
  }

  /** Creates the bucket on first boot if it is not already there. */
  async ensureBucket(): Promise<void> {
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      if (buckets?.some((bucket) => bucket.name === this.bucket)) return;

      const { error } = await supabase.storage.createBucket(this.bucket, {
        public: true,
        fileSizeLimit: `${env.UPLOAD_MAX_FILE_SIZE_MB}MB`,
        allowedMimeTypes: env.UPLOAD_ALLOWED_MIME,
      });

      if (error) {
        log.warn({ err: error }, 'could not create storage bucket — create it in the dashboard');
        return;
      }

      log.info({ bucket: this.bucket }, 'storage bucket created');
    } catch (error) {
      log.warn({ err: error }, 'storage bucket check skipped');
    }
  }

  /** Folder names are used in object paths, so keep them boring. */
  private sanitizeFolder(folder: string): string {
    const clean = folder
      .toLowerCase()
      .replace(/[^a-z0-9/_-]/g, '-')
      .replace(/\.{2,}/g, '') // no traversal
      .replace(/^\/+|\/+$/g, '')
      .replace(/-{2,}/g, '-');

    return clean || 'general';
  }

  /** Extension from the original name, validated against an allow-list. */
  private safeExtension(originalName: string, mimeType: string): string {
    const fromName = path.extname(originalName).toLowerCase();
    if (/^\.[a-z0-9]{1,5}$/.test(fromName)) return fromName;

    const fallback: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/avif': '.avif',
      'image/svg+xml': '.svg',
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    };

    return fallback[mimeType] ?? '';
  }
}
