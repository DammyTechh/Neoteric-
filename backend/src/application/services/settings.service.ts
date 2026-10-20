import type { SiteSetting } from '@domain/entities';
import type { IAuditRepository, ISettingsRepository } from '@domain/repositories';
import { createLogger } from '@shared/logger';
import type { RequestContext } from '@shared/types/common';

const log = createLogger('settings');

/**
 * Site settings: everything that used to be a hardcoded string in the v1
 * React tree — hero copy, the vision and mission statements, the office
 * address, phone number, social links and SEO defaults.
 *
 * Grouping them into a nested object for the public endpoint means the
 * frontend reads `settings.contact.phone` rather than hunting through a flat
 * list of keys.
 */
export class SettingsService {
  constructor(
    private readonly settings: ISettingsRepository,
    private readonly audit: IAuditRepository,
  ) {}

  /** Flat list, as the dashboard's settings form wants it. */
  async list(includePrivate: boolean): Promise<SiteSetting[]> {
    return this.settings.all(includePrivate);
  }

  async listGroup(groupName: string, includePrivate: boolean): Promise<SiteSetting[]> {
    return this.settings.byGroup(groupName, includePrivate);
  }

  /**
   * Nested by group, for the public site.
   *
   * `contact.phone` becomes `{ contact: { phone: … } }`.
   */
  async publicTree(): Promise<Record<string, Record<string, unknown>>> {
    const all = await this.settings.all(false);
    const tree: Record<string, Record<string, unknown>> = {};

    for (const setting of all) {
      const [group, ...rest] = setting.key.split('.');
      if (!group) continue;

      const field = rest.join('.') || group;
      tree[group] ??= {};
      tree[group][field] = setting.value;
    }

    return tree;
  }

  async update(key: string, value: unknown, context: RequestContext): Promise<SiteSetting> {
    const before = await this.settings.get(key);
    const after = await this.settings.upsert(key, value, context.actor?.id ?? null);

    await this.audit.record({
      adminUserId: context.actor?.id ?? null,
      actorEmail: context.actor?.email ?? null,
      action: 'update',
      entity: 'site_setting',
      entityId: key,
      beforeState: before ? { value: before.value } : null,
      afterState: { value: after.value },
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    });

    log.info({ key }, 'setting updated');
    return after;
  }

  /** Saves a whole settings form in one request. */
  async updateMany(
    entries: { key: string; value: unknown }[],
    context: RequestContext,
  ): Promise<SiteSetting[]> {
    const updated = await this.settings.upsertMany(entries, context.actor?.id ?? null);

    await this.audit.record({
      adminUserId: context.actor?.id ?? null,
      actorEmail: context.actor?.email ?? null,
      action: 'bulk_update',
      entity: 'site_setting',
      entityId: null,
      beforeState: null,
      afterState: { keys: entries.map((entry) => entry.key) },
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    });

    return updated;
  }
}
