import jwt, { type SignOptions } from 'jsonwebtoken';
import type { AdminUser } from '@domain/entities';
import type {
  IAdminUserRepository,
  IPasswordResetRepository,
  IRefreshTokenRepository,
} from '@domain/repositories';
import {
  adminLoginAlert,
  adminPasswordChanged,
  adminPasswordReset,
} from '@application/mail/templates';
import { env } from '@shared/config/env';
import { AppError } from '@shared/errors/AppError';
import { createLogger } from '@shared/logger';
import { generateToken, hashPassword, hashToken, verifyPassword } from '@shared/utils/crypto';
import type { AdminRole, AuthenticatedActor, RequestContext, UUID } from '@shared/types/common';
import type { IMailer } from '@domain/services';

const log = createLogger('auth');

const RESET_TTL_MINUTES = 30;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface LoginResult extends AuthTokens {
  user: AdminUser;
  mustChangePassword: boolean;
}

interface AccessTokenClaims {
  sub: UUID;
  email: string;
  role: AdminRole;
  name: string;
}

/**
 * Authentication for the admin dashboard.
 *
 * Deliberately *not* Supabase Auth. The requirement is a single seeded
 * operator account with no public registration path, which is a much smaller
 * problem than a general identity provider — and owning the token lifecycle
 * keeps the no-signup guarantee verifiable by reading one file rather than
 * trusting a dashboard toggle not to be flipped.
 *
 * There is no `register` method on this class, and no route that reaches one.
 * Accounts come from `npm run db:seed:admin` or from an existing super-admin
 * inviting a colleague.
 */
export class AuthService {
  constructor(
    private readonly admins: IAdminUserRepository,
    private readonly refreshTokens: IRefreshTokenRepository,
    private readonly passwordResets: IPasswordResetRepository,
    private readonly mailer: IMailer,
  ) {}

  async login(
    email: string,
    password: string,
    context: RequestContext,
  ): Promise<LoginResult> {
    const user = await this.admins.findByEmail(email);

    /**
     * An unknown email and a wrong password must be indistinguishable, both in
     * the response and in how long it takes. Without the dummy comparison
     * below, a missing account returns noticeably faster than a bad password
     * and the login form becomes an account-enumeration oracle.
     */
    if (!user) {
      await verifyPassword(password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva');
      throw AppError.invalidCredentials();
    }

    if (!user.isActive) {
      throw AppError.unauthorized(
        'This account has been deactivated. Please contact your administrator.',
        'ACCOUNT_DISABLED',
      );
    }

    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const minutes = Math.ceil(
        (new Date(user.lockedUntil).getTime() - Date.now()) / 60_000,
      );
      throw AppError.unauthorized(
        `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
        'ACCOUNT_LOCKED',
      );
    }

    const matches = await verifyPassword(password, user.passwordHash);

    if (!matches) {
      const attempts = user.failedLoginAttempts + 1;
      const shouldLock = attempts >= env.MAX_LOGIN_ATTEMPTS;
      const lockUntil = shouldLock
        ? new Date(Date.now() + env.LOCKOUT_MINUTES * 60_000)
        : null;

      await this.admins.recordFailedLogin(user.id, lockUntil);
      log.warn({ userId: user.id, attempts, locked: shouldLock }, 'failed login');

      if (shouldLock) {
        throw AppError.unauthorized(
          `Too many failed attempts. This account is locked for ${env.LOCKOUT_MINUTES} minutes.`,
          'ACCOUNT_LOCKED',
        );
      }

      throw AppError.invalidCredentials();
    }

    await this.admins.recordSuccessfulLogin(user.id, context.ipAddress ?? null);

    const tokens = await this.issueTokens(user, context);

    // Advisory only — a failed alert must not block a valid sign-in.
    void this.mailer.sendQuietly({
      to: user.email,
      ...adminLoginAlert({
        fullName: user.fullName,
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
      }),
      template: 'admin.login-alert',
      metadata: { userId: user.id },
    });

    log.info({ userId: user.id, email: user.email }, 'login succeeded');

    const { passwordHash: _passwordHash, ...safeUser } = user;

    return {
      ...tokens,
      user: safeUser,
      mustChangePassword: user.mustChangePassword,
    };
  }

  /**
   * Exchanges a refresh token for a new pair, rotating the old one.
   *
   * Rotation means a stolen refresh token is usable at most once, and the
   * legitimate holder's next refresh fails — a signal worth having.
   */
  async refresh(refreshToken: string, context: RequestContext): Promise<AuthTokens> {
    let payload: { sub: string };

    try {
      payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET, {
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
      }) as { sub: string };
    } catch (error) {
      const expired = error instanceof jwt.TokenExpiredError;
      throw AppError.unauthorized(
        expired ? 'Your session has expired. Please sign in again.' : 'Invalid session token',
        expired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
      );
    }

    const tokenHash = hashToken(refreshToken);
    const stored = await this.refreshTokens.findActiveByHash(tokenHash);

    if (!stored || stored.adminUserId !== payload.sub) {
      throw AppError.unauthorized('This session is no longer valid', 'TOKEN_INVALID');
    }

    const user = await this.admins.findByIdWithSecret(stored.adminUserId);
    if (!user || !user.isActive) {
      await this.refreshTokens.revokeAllForUser(stored.adminUserId);
      throw AppError.unauthorized('This account is no longer active', 'ACCOUNT_DISABLED');
    }

    await this.refreshTokens.revokeByHash(tokenHash);
    return this.issueTokens(user, context);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await this.refreshTokens.revokeByHash(hashToken(refreshToken)).catch(() => undefined);
  }

  async logoutEverywhere(userId: UUID): Promise<void> {
    await this.refreshTokens.revokeAllForUser(userId);
  }

  /**
   * Starts a password reset.
   *
   * Always resolves, whether or not the address exists — otherwise the
   * endpoint tells an attacker which emails have accounts.
   */
  async requestPasswordReset(email: string, context: RequestContext): Promise<void> {
    const user = await this.admins.findByEmail(email);

    if (!user || !user.isActive) {
      log.info({ email }, 'password reset requested for unknown or inactive account');
      return;
    }

    await this.passwordResets.invalidateAllForUser(user.id);

    const token = generateToken(32);
    const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60_000);

    await this.passwordResets.create({
      adminUserId: user.id,
      tokenHash: hashToken(token),
      expiresAt,
      requestedIp: context.ipAddress ?? null,
    });

    const resetUrl = `${env.ADMIN_URL}/reset-password?token=${encodeURIComponent(token)}`;

    await this.mailer.sendQuietly({
      to: user.email,
      ...adminPasswordReset({
        fullName: user.fullName,
        resetUrl,
        expiresInMinutes: RESET_TTL_MINUTES,
      }),
      template: 'admin.password-reset',
      metadata: { userId: user.id },
    });

    log.info({ userId: user.id }, 'password reset email dispatched');
  }

  async resetPassword(token: string, newPassword: string, context: RequestContext): Promise<void> {
    const record = await this.passwordResets.findValidByHash(hashToken(token));

    if (!record) {
      throw AppError.unauthorized(
        'This reset link is invalid or has expired. Please request a new one.',
        'TOKEN_INVALID',
      );
    }

    const user = await this.admins.findByIdWithSecret(record.adminUserId);
    if (!user) throw AppError.notFound('Account');

    // Reusing the current password defeats the point of the reset.
    if (await verifyPassword(newPassword, user.passwordHash)) {
      throw AppError.unprocessable('Please choose a password you have not used before');
    }

    await this.admins.updatePassword(user.id, await hashPassword(newPassword));
    await this.passwordResets.markUsed(record.id);

    // Anyone holding a session from before the reset loses it.
    await this.refreshTokens.revokeAllForUser(user.id);

    await this.mailer.sendQuietly({
      to: user.email,
      ...adminPasswordChanged({
        fullName: user.fullName,
        ipAddress: context.ipAddress ?? null,
      }),
      template: 'admin.password-changed',
      metadata: { userId: user.id },
    });

    log.info({ userId: user.id }, 'password reset completed');
  }

  async changePassword(
    userId: UUID,
    currentPassword: string,
    newPassword: string,
    context: RequestContext,
  ): Promise<void> {
    const user = await this.admins.findByIdWithSecret(userId);
    if (!user) throw AppError.notFound('Account');

    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw AppError.unauthorized('Your current password is incorrect', 'INVALID_CREDENTIALS');
    }

    await this.admins.updatePassword(userId, await hashPassword(newPassword));
    await this.refreshTokens.revokeAllForUser(userId);

    await this.mailer.sendQuietly({
      to: user.email,
      ...adminPasswordChanged({
        fullName: user.fullName,
        ipAddress: context.ipAddress ?? null,
      }),
      template: 'admin.password-changed',
      metadata: { userId },
    });

    log.info({ userId }, 'password changed');
  }

  /** Verifies an access token. Used by the auth guard on every request. */
  verifyAccessToken(token: string): AuthenticatedActor {
    try {
      const claims = jwt.verify(token, env.JWT_ACCESS_SECRET, {
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
      }) as AccessTokenClaims;

      return {
        id: claims.sub,
        email: claims.email,
        role: claims.role,
        fullName: claims.name,
      };
    } catch (error) {
      const expired = error instanceof jwt.TokenExpiredError;
      throw AppError.unauthorized(
        expired ? 'Your session has expired' : 'Invalid authentication token',
        expired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
      );
    }
  }

  private async issueTokens(
    user: Pick<AdminUser, 'id' | 'email' | 'role' | 'fullName'>,
    context: RequestContext,
  ): Promise<AuthTokens> {
    const claims: AccessTokenClaims = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.fullName,
    };

    const signOptions: SignOptions = {
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    };

    const accessToken = jwt.sign(claims, env.JWT_ACCESS_SECRET, {
      ...signOptions,
      expiresIn: env.JWT_ACCESS_TTL as SignOptions['expiresIn'],
    });

    const refreshToken = jwt.sign({ sub: user.id }, env.JWT_REFRESH_SECRET, {
      ...signOptions,
      expiresIn: env.JWT_REFRESH_TTL as SignOptions['expiresIn'],
    });

    const decoded = jwt.decode(refreshToken) as { exp: number };

    await this.refreshTokens.create({
      adminUserId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(decoded.exp * 1000),
      userAgent: context.userAgent ?? null,
      ipAddress: context.ipAddress ?? null,
    });

    const accessClaims = jwt.decode(accessToken) as { exp: number; iat: number };

    return {
      accessToken,
      refreshToken,
      expiresIn: accessClaims.exp - accessClaims.iat,
      tokenType: 'Bearer',
    };
  }
}
