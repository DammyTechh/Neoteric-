import type { AdminUser } from '@domain/entities';
import type {
  IAdminUserRepository,
  IAuditRepository,
  IRefreshTokenRepository,
} from '@domain/repositories';
import { adminAccountDeactivated, adminInvite } from '@application/mail/templates';
import { AppError } from '@shared/errors/AppError';
import { createLogger } from '@shared/logger';
import { generateToken, hashPassword } from '@shared/utils/crypto';
import type { AdminRole, Paginated, PaginationParams, RequestContext, UUID } from '@shared/types/common';
import type { IMailer } from '@domain/services';

const log = createLogger('admin-users');

/**
 * Management of the dashboard operator accounts.
 *
 * Note what is absent: there is no public `register`. The first account comes
 * from the seed script; every subsequent one is created here by an existing
 * super-admin, which is the only path that exists.
 */
export class AdminService {
  constructor(
    private readonly admins: IAdminUserRepository,
    private readonly refreshTokens: IRefreshTokenRepository,
    private readonly mailer: IMailer,
    private readonly audit: IAuditRepository,
  ) {}

  async list(params: PaginationParams): Promise<Paginated<AdminUser>> {
    return this.admins.findMany(params);
  }

  async getById(id: UUID): Promise<AdminUser> {
    const user = await this.admins.findById(id);
    if (!user) throw AppError.notFound('Admin user');
    return user;
  }

  /**
   * Invites a colleague.
   *
   * A generated password is emailed and flagged `mustChangePassword`, so the
   * one-time secret in an inbox stops being a valid credential the moment it
   * is used.
   */
  async invite(
    data: { email: string; fullName: string; role: AdminRole; password?: string },
    context: RequestContext,
  ): Promise<{ user: AdminUser; temporaryPassword: string | null }> {
    const existing = await this.admins.findByEmail(data.email);
    if (existing) {
      throw AppError.conflict('An account with that email address already exists');
    }

    const generated = !data.password;
    const password = data.password ?? this.generatePassword();

    const user = await this.admins.createWithPassword({
      email: data.email,
      passwordHash: await hashPassword(password),
      fullName: data.fullName,
      role: data.role,
      mustChangePassword: generated,
      createdBy: context.actor?.id ?? null,
    });

    await this.mailer.sendQuietly({
      to: user.email,
      ...adminInvite({
        fullName: user.fullName,
        email: user.email,
        temporaryPassword: password,
        invitedBy: context.actor?.fullName ?? 'An administrator',
        role: user.role,
      }),
      template: 'admin.invite',
      metadata: { userId: user.id },
    });

    await this.audit.record({
      adminUserId: context.actor?.id ?? null,
      actorEmail: context.actor?.email ?? null,
      action: 'create',
      entity: 'admin_user',
      entityId: user.id,
      beforeState: null,
      afterState: { email: user.email, role: user.role },
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    });

    log.info({ userId: user.id, role: user.role }, 'admin user invited');

    // Returned only when the caller supplied no password, so it can be shown
    // once in the dashboard if the email does not arrive.
    return { user, temporaryPassword: generated ? password : null };
  }

  async update(
    id: UUID,
    data: { fullName?: string; role?: AdminRole; isActive?: boolean },
    context: RequestContext,
  ): Promise<AdminUser> {
    const before = await this.getById(id);

    // Locking everyone out of the dashboard is a one-way door.
    if (before.role === 'super_admin' && (data.role !== undefined || data.isActive === false)) {
      const remaining = await this.admins.countByRole('super_admin');
      const losingSuperAdmin = data.role !== 'super_admin' || data.isActive === false;

      if (remaining <= 1 && losingSuperAdmin) {
        throw AppError.unprocessable(
          'This is the only active super-administrator. Promote another account first.',
        );
      }
    }

    if (id === context.actor?.id && data.isActive === false) {
      throw AppError.unprocessable('You cannot deactivate your own account');
    }

    const after = await this.admins.update(id, data);

    // Revoking access should end existing sessions, not wait for them to expire.
    if (data.isActive === false) {
      await this.refreshTokens.revokeAllForUser(id);
      await this.mailer.sendQuietly({
        to: after.email,
        ...adminAccountDeactivated({ fullName: after.fullName }),
        template: 'admin.account-deactivated',
        metadata: { userId: id },
      });
    }

    await this.audit.record({
      adminUserId: context.actor?.id ?? null,
      actorEmail: context.actor?.email ?? null,
      action: 'update',
      entity: 'admin_user',
      entityId: id,
      beforeState: { role: before.role, isActive: before.isActive },
      afterState: { role: after.role, isActive: after.isActive },
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    });

    return after;
  }

  async remove(id: UUID, context: RequestContext): Promise<void> {
    const user = await this.getById(id);

    if (id === context.actor?.id) {
      throw AppError.unprocessable('You cannot delete your own account');
    }

    if (user.role === 'super_admin') {
      const remaining = await this.admins.countByRole('super_admin');
      if (remaining <= 1) {
        throw AppError.unprocessable(
          'This is the only super-administrator account and cannot be deleted',
        );
      }
    }

    await this.refreshTokens.revokeAllForUser(id);
    await this.admins.delete(id);

    await this.audit.record({
      adminUserId: context.actor?.id ?? null,
      actorEmail: context.actor?.email ?? null,
      action: 'delete',
      entity: 'admin_user',
      entityId: id,
      beforeState: { email: user.email, role: user.role },
      afterState: null,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    });

    log.info({ userId: id }, 'admin user deleted');
  }

  async updateProfile(
    id: UUID,
    data: { fullName?: string; avatarUrl?: string | null },
    context: RequestContext,
  ): Promise<AdminUser> {
    await this.getById(id);
    const updated = await this.admins.update(id, data);

    await this.audit.record({
      adminUserId: context.actor?.id ?? null,
      actorEmail: context.actor?.email ?? null,
      action: 'update_profile',
      entity: 'admin_user',
      entityId: id,
      beforeState: null,
      afterState: data,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    });

    return updated;
  }

  /**
   * A readable 16-character temporary password.
   *
   * Characters that are easy to confuse in an email (O/0, l/1/I) are left out,
   * because this will be retyped by a human at least once.
   */
  private generatePassword(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const raw = generateToken(32);

    let password = '';
    for (let index = 0; index < 16; index += 1) {
      password += alphabet[raw.charCodeAt(index) % alphabet.length];
    }

    return password;
  }
}
