import { BaseRepository, type QueryBuilder } from './base.repository';
import {
  supabase,
  translateDatabaseError,
  unwrapMaybe,
} from '@infrastructure/database/supabase.client';
import {
  toAuditLog,
  toDashboardStats,
  toEmailLog,
  toMediaAsset,
  toSiteSetting,
} from '@infrastructure/database/mappers';
import type { AuditLog, DashboardStats, EmailLog, MediaAsset, SiteSetting } from '@domain/entities';
import type {
  AuditFilters,
  IAuditRepository,
  IEmailLogRepository,
  IMediaRepository,
  ISettingsRepository,
  IStatsRepository,
  MediaFilters,
} from '@domain/repositories';
import type { Paginated, PaginationParams, UUID } from '@shared/types/common';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Media library ───────────────────────────────────────────────────────────

const MEDIA_COLUMNS = {
  bucket: 'bucket',
  storagePath: 'storage_path',
  publicUrl: 'public_url',
  originalName: 'original_name',
  mimeType: 'mime_type',
  sizeBytes: 'size_bytes',
  width: 'width',
  height: 'height',
  altText: 'alt_text',
  caption: 'caption',
  folder: 'folder',
  checksum: 'checksum',
  uploadedBy: 'uploaded_by',
};

export class MediaRepository
  extends BaseRepository<MediaAsset, MediaFilters>
  implements IMediaRepository
{
  constructor() {
    super({
      table: 'media_assets',
      resource: 'Media asset',
      mapper: toMediaAsset,
      columnMap: MEDIA_COLUMNS,
    });
  }

  protected override applyFilters(query: QueryBuilder, filters?: MediaFilters): QueryBuilder {
    let next = query;
    if (filters?.folder) next = next.eq('folder', filters.folder);
    if (filters?.mimeGroup === 'image') next = next.like('mime_type', 'image/%');
    if (filters?.mimeGroup === 'document') next = next.not('mime_type', 'like', 'image/%');
    if (filters?.search) {
      next = this.searchAcross(next, filters.search, ['original_name', 'alt_text', 'caption']);
    }
    return next;
  }

  /** Lets the upload path spot a file that is already in the library. */
  async findByChecksum(value: string): Promise<MediaAsset | null> {
    const result = await supabase
      .from('media_assets')
      .select('*')
      .eq('checksum', value)
      .maybeSingle();

    const row = unwrapMaybe(result as any, 'find media by checksum');
    return row ? toMediaAsset(row) : null;
  }

  async listFolders(): Promise<{ folder: string; count: number }[]> {
    const { data, error } = await supabase.from('media_assets').select('folder');
    if (error) throw translateDatabaseError(error, 'list media folders');

    const tally = new Map<string, number>();
    for (const row of (data ?? []) as any[]) {
      tally.set(row.folder, (tally.get(row.folder) ?? 0) + 1);
    }

    return [...tally.entries()]
      .map(([folder, count]) => ({ folder, count }))
      .sort((a, b) => a.folder.localeCompare(b.folder));
  }
}

// ── Site settings ───────────────────────────────────────────────────────────

export class SettingsRepository implements ISettingsRepository {
  async all(includePrivate: boolean): Promise<SiteSetting[]> {
    let query = supabase
      .from('site_settings')
      .select('*')
      .order('group_name', { ascending: true })
      .order('sort_order', { ascending: true });

    if (!includePrivate) query = query.eq('is_public', true);

    const { data, error } = await query;
    if (error) throw translateDatabaseError(error, 'list settings');
    return (data ?? []).map(toSiteSetting);
  }

  async byGroup(groupName: string, includePrivate: boolean): Promise<SiteSetting[]> {
    let query = supabase
      .from('site_settings')
      .select('*')
      .eq('group_name', groupName)
      .order('sort_order', { ascending: true });

    if (!includePrivate) query = query.eq('is_public', true);

    const { data, error } = await query;
    if (error) throw translateDatabaseError(error, 'list settings by group');
    return (data ?? []).map(toSiteSetting);
  }

  async get(key: string): Promise<SiteSetting | null> {
    const result = await supabase.from('site_settings').select('*').eq('key', key).maybeSingle();
    const row = unwrapMaybe(result as any, 'get setting');
    return row ? toSiteSetting(row) : null;
  }

  /** Reads a setting with a fallback — used for feature switches. */
  async getValue<T = unknown>(key: string, fallback: T): Promise<T> {
    const setting = await this.get(key);
    if (!setting || setting.value === null || setting.value === undefined) return fallback;
    return setting.value as T;
  }

  /**
   * Updates a setting's value.
   *
   * Deliberately an update rather than an upsert: the key set is defined by
   * the migration, so a typo in a key should 404, not silently create a
   * setting nothing reads.
   */
  async upsert(key: string, value: unknown, updatedBy?: UUID | null): Promise<SiteSetting> {
    const { data, error } = await supabase
      .from('site_settings')
      .update({ value, updated_by: updatedBy ?? null })
      .eq('key', key)
      .select('*')
      .maybeSingle();

    if (error) throw translateDatabaseError(error, 'update setting');
    if (!data) throw translateDatabaseError({ code: 'PGRST116' }, 'update setting');

    return toSiteSetting(data);
  }

  async upsertMany(
    entries: { key: string; value: unknown }[],
    updatedBy?: UUID | null,
  ): Promise<SiteSetting[]> {
    const results: SiteSetting[] = [];
    for (const entry of entries) {
      results.push(await this.upsert(entry.key, entry.value, updatedBy));
    }
    return results;
  }
}

// ── Audit log ───────────────────────────────────────────────────────────────

export class AuditRepository implements IAuditRepository {
  /**
   * Writes an audit row.
   *
   * Never throws: an audit failure must not roll back the action it was
   * describing, and the alternative is a 500 on an otherwise successful edit.
   */
  async record(entry: Omit<AuditLog, 'id' | 'createdAt'>): Promise<void> {
    const { error } = await supabase.from('audit_logs').insert({
      admin_user_id: entry.adminUserId,
      actor_email: entry.actorEmail,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId,
      before_state: entry.beforeState ?? null,
      after_state: entry.afterState ?? null,
      ip_address: entry.ipAddress,
      user_agent: entry.userAgent,
    });

    if (error) {
      // Logged by the Supabase client; swallowed here on purpose.
      translateDatabaseError(error, 'write audit log');
    }
  }

  async findMany(params: PaginationParams, filters?: AuditFilters): Promise<Paginated<AuditLog>> {
    let query = supabase.from('audit_logs').select('*', { count: 'exact' }) as QueryBuilder;

    if (filters?.adminUserId) query = query.eq('admin_user_id', filters.adminUserId);
    if (filters?.entity) query = query.eq('entity', filters.entity);
    if (filters?.action) query = query.eq('action', filters.action);
    if (filters?.from) query = query.gte('created_at', filters.from);
    if (filters?.to) query = query.lte('created_at', filters.to);

    const { data, error, count } = await query
      .order(params.sortBy, { ascending: params.sortDirection === 'asc' })
      .range(params.offset, params.offset + params.limit - 1);

    if (error) throw translateDatabaseError(error, 'list audit logs');

    const total = count ?? 0;
    const totalPages = Math.ceil(total / params.limit);

    return {
      items: (data ?? []).map(toAuditLog),
      meta: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages,
        hasNext: params.page < totalPages,
        hasPrevious: params.page > 1,
      },
    };
  }
}

// ── Email log ───────────────────────────────────────────────────────────────

export class EmailLogRepository implements IEmailLogRepository {
  async record(entry: Omit<EmailLog, 'id' | 'createdAt'>): Promise<void> {
    const { error } = await supabase.from('email_logs').insert({
      to_email: entry.toEmail,
      cc_emails: entry.ccEmails,
      template: entry.template,
      subject: entry.subject,
      status: entry.status,
      provider_message_id: entry.providerMessageId,
      error_message: entry.errorMessage,
      metadata: entry.metadata ?? {},
      sent_at: entry.sentAt,
    });

    if (error) translateDatabaseError(error, 'write email log');
  }

  async findMany(
    params: PaginationParams,
    filters?: { status?: string; template?: string },
  ): Promise<Paginated<EmailLog>> {
    let query = supabase.from('email_logs').select('*', { count: 'exact' }) as QueryBuilder;

    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.template) query = query.eq('template', filters.template);

    const { data, error, count } = await query
      .order(params.sortBy, { ascending: params.sortDirection === 'asc' })
      .range(params.offset, params.offset + params.limit - 1);

    if (error) throw translateDatabaseError(error, 'list email logs');

    const total = count ?? 0;
    const totalPages = Math.ceil(total / params.limit);

    return {
      items: (data ?? []).map(toEmailLog),
      meta: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages,
        hasNext: params.page < totalPages,
        hasPrevious: params.page > 1,
      },
    };
  }
}

// ── Dashboard stats ─────────────────────────────────────────────────────────

export class StatsRepository implements IStatsRepository {
  /** One round trip, courtesy of the `v_dashboard_stats` view. */
  async dashboard(): Promise<DashboardStats> {
    const { data, error } = await supabase.from('v_dashboard_stats').select('*').maybeSingle();
    if (error) throw translateDatabaseError(error, 'read dashboard stats');
    return toDashboardStats(data ?? {});
  }
}
