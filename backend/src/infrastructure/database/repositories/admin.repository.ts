import { BaseRepository } from './base.repository';
import {
  supabase,
  translateDatabaseError,
  unwrapMaybe,
} from '@infrastructure/database/supabase.client';
import { toAdminUser, toAdminUserWithSecret } from '@infrastructure/database/mappers';
import type { AdminUser, AdminUserWithSecret } from '@domain/entities';
import type {
  IAdminUserRepository,
  IPasswordResetRepository,
  IRefreshTokenRepository,
} from '@domain/repositories';
import type { AdminRole, UUID } from '@shared/types/common';

/* eslint-disable @typescript-eslint/no-explicit-any */

const ADMIN_COLUMNS = {
  email: 'email',
  fullName: 'full_name',
  role: 'role',
  avatarUrl: 'avatar_url',
  isActive: 'is_active',
  mustChangePassword: 'must_change_password',
};

/** Never selected into a response — only the auth service sees the hash. */
const SAFE_COLUMNS =
  'id, email, full_name, role, avatar_url, is_active, must_change_password, ' +
  'last_login_at, last_login_ip, failed_login_attempts, locked_until, ' +
  'password_changed_at, created_at, updated_at';

export class AdminUserRepository
  extends BaseRepository<AdminUser>
  implements IAdminUserRepository
{
  constructor() {
    super({
      table: 'admin_users',
      resource: 'Admin user',
      mapper: toAdminUser,
      columnMap: ADMIN_COLUMNS,
      selectColumns: SAFE_COLUMNS,
    });
  }

  /** Includes the password hash. Only ever called from the auth service. */
  async findByEmail(email: string): Promise<AdminUserWithSecret | null> {
    const result = await supabase
      .from('admin_users')
      .select('*')
      .ilike('email', email.trim())
      .maybeSingle();

    const row = unwrapMaybe(result as any, 'find admin by email');
    return row ? toAdminUserWithSecret(row) : null;
  }

  async findByIdWithSecret(id: UUID): Promise<AdminUserWithSecret | null> {
    const result = await supabase.from('admin_users').select('*').eq('id', id).maybeSingle();
    const row = unwrapMaybe(result as any, 'find admin by id');
    return row ? toAdminUserWithSecret(row) : null;
  }

  async createWithPassword(data: {
    email: string;
    passwordHash: string;
    fullName: string;
    role: AdminRole;
    mustChangePassword?: boolean;
    createdBy?: UUID | null;
  }): Promise<AdminUser> {
    const { data: row, error } = await supabase
      .from('admin_users')
      .insert({
        email: data.email.trim().toLowerCase(),
        password_hash: data.passwordHash,
        full_name: data.fullName,
        role: data.role,
        must_change_password: data.mustChangePassword ?? false,
        created_by: data.createdBy ?? null,
      })
      .select(SAFE_COLUMNS)
      .single();

    if (error) throw translateDatabaseError(error, 'create admin user');
    return toAdminUser(row);
  }

  async updatePassword(id: UUID, passwordHash: string): Promise<void> {
    const { error } = await supabase
      .from('admin_users')
      .update({
        password_hash: passwordHash,
        password_changed_at: new Date().toISOString(),
        must_change_password: false,
        failed_login_attempts: 0,
        locked_until: null,
      })
      .eq('id', id);

    if (error) throw translateDatabaseError(error, 'update password');
  }

  /** Clears the lockout counters on a good login. */
  async recordSuccessfulLogin(id: UUID, ipAddress: string | null): Promise<void> {
    const { error } = await supabase
      .from('admin_users')
      .update({
        last_login_at: new Date().toISOString(),
        last_login_ip: ipAddress,
        failed_login_attempts: 0,
        locked_until: null,
      })
      .eq('id', id);

    if (error) throw translateDatabaseError(error, 'record login');
  }

  async recordFailedLogin(id: UUID, lockUntil: Date | null): Promise<void> {
    const current = await supabase
      .from('admin_users')
      .select('failed_login_attempts')
      .eq('id', id)
      .maybeSingle();

    const attempts = Number((current.data as any)?.failed_login_attempts ?? 0) + 1;

    const { error } = await supabase
      .from('admin_users')
      .update({
        failed_login_attempts: attempts,
        locked_until: lockUntil ? lockUntil.toISOString() : null,
      })
      .eq('id', id);

    if (error) throw translateDatabaseError(error, 'record failed login');
  }

  /** Guards the "you cannot remove the last super-admin" rule. */
  async countByRole(role: AdminRole): Promise<number> {
    const { count, error } = await supabase
      .from('admin_users')
      .select('id', { count: 'exact', head: true })
      .eq('role', role)
      .eq('is_active', true);

    if (error) throw translateDatabaseError(error, 'count admins by role');
    return count ?? 0;
  }
}

// ── Refresh tokens ──────────────────────────────────────────────────────────

export class RefreshTokenRepository implements IRefreshTokenRepository {
  async create(data: {
    adminUserId: UUID;
    tokenHash: string;
    expiresAt: Date;
    userAgent?: string | null;
    ipAddress?: string | null;
  }): Promise<void> {
    const { error } = await supabase.from('refresh_tokens').insert({
      admin_user_id: data.adminUserId,
      token_hash: data.tokenHash,
      expires_at: data.expiresAt.toISOString(),
      user_agent: data.userAgent ?? null,
      ip_address: data.ipAddress ?? null,
    });

    if (error) throw translateDatabaseError(error, 'store refresh token');
  }

  /** Only tokens that are unexpired and not revoked come back. */
  async findActiveByHash(tokenHash: string): Promise<{ id: UUID; adminUserId: UUID } | null> {
    const { data, error } = await supabase
      .from('refresh_tokens')
      .select('id, admin_user_id')
      .eq('token_hash', tokenHash)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error) throw translateDatabaseError(error, 'find refresh token');
    if (!data) return null;

    return { id: (data as any).id, adminUserId: (data as any).admin_user_id };
  }

  async revokeByHash(tokenHash: string): Promise<void> {
    const { error } = await supabase
      .from('refresh_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('token_hash', tokenHash);

    if (error) throw translateDatabaseError(error, 'revoke refresh token');
  }

  /** Used on password change and on "sign out everywhere". */
  async revokeAllForUser(adminUserId: UUID): Promise<void> {
    const { error } = await supabase
      .from('refresh_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('admin_user_id', adminUserId)
      .is('revoked_at', null);

    if (error) throw translateDatabaseError(error, 'revoke all refresh tokens');
  }

  async deleteExpired(): Promise<number> {
    const { error, count } = await supabase
      .from('refresh_tokens')
      .delete({ count: 'exact' })
      .lt('expires_at', new Date().toISOString());

    if (error) throw translateDatabaseError(error, 'prune refresh tokens');
    return count ?? 0;
  }
}

// ── Password resets ─────────────────────────────────────────────────────────

export class PasswordResetRepository implements IPasswordResetRepository {
  async create(data: {
    adminUserId: UUID;
    tokenHash: string;
    expiresAt: Date;
    requestedIp?: string | null;
  }): Promise<void> {
    const { error } = await supabase.from('password_reset_tokens').insert({
      admin_user_id: data.adminUserId,
      token_hash: data.tokenHash,
      expires_at: data.expiresAt.toISOString(),
      requested_ip: data.requestedIp ?? null,
    });

    if (error) throw translateDatabaseError(error, 'create reset token');
  }

  async findValidByHash(tokenHash: string): Promise<{ id: UUID; adminUserId: UUID } | null> {
    const { data, error } = await supabase
      .from('password_reset_tokens')
      .select('id, admin_user_id')
      .eq('token_hash', tokenHash)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error) throw translateDatabaseError(error, 'find reset token');
    if (!data) return null;

    return { id: (data as any).id, adminUserId: (data as any).admin_user_id };
  }

  async markUsed(id: UUID): Promise<void> {
    const { error } = await supabase
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw translateDatabaseError(error, 'consume reset token');
  }

  /** A new request invalidates older outstanding links. */
  async invalidateAllForUser(adminUserId: UUID): Promise<void> {
    const { error } = await supabase
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('admin_user_id', adminUserId)
      .is('used_at', null);

    if (error) throw translateDatabaseError(error, 'invalidate reset tokens');
  }
}
