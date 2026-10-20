import type { CookieOptions, Request, Response } from 'express';
import { container } from '@infrastructure/container';
import { asyncHandler } from '@presentation/http/middleware';
import { env, isProduction } from '@shared/config/env';
import { AppError } from '@shared/errors/AppError';
import { ok } from '@shared/utils/http';

const { auth, admins } = container.services;

/**
 * Tokens are returned in the body *and* set as httpOnly cookies.
 *
 * The cookie suits a browser dashboard — it cannot be read by injected
 * script, which is the main thing that makes localStorage a poor place for a
 * token. The body suits a mobile client or anything without a cookie jar.
 * Supporting both costs one header and removes a whole class of argument.
 */
const cookieBase: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'strict' : 'lax',
  path: '/',
};

function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie('access_token', accessToken, { ...cookieBase, maxAge: 15 * 60 * 1000 });
  res.cookie('refresh_token', refreshToken, {
    ...cookieBase,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearAuthCookies(res: Response): void {
  res.clearCookie('access_token', cookieBase);
  res.clearCookie('refresh_token', cookieBase);
}

export const authController = {
  /**
   * Sign in. The only way into the dashboard — there is no registration
   * endpoint, by design.
   */
  login: asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const result = await auth.login(email, password, req.context);

    setAuthCookies(res, result.accessToken, result.refreshToken);

    return ok(
      res,
      {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
        tokenType: result.tokenType,
        mustChangePassword: result.mustChangePassword,
      },
      result.mustChangePassword
        ? 'Signed in. Please set a new password to continue.'
        : 'Signed in successfully',
    );
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    const token =
      req.body?.refreshToken ?? (req.cookies as Record<string, string> | undefined)?.refresh_token;

    if (!token) {
      throw AppError.unauthorized('No session to refresh', 'TOKEN_INVALID');
    }

    const tokens = await auth.refresh(token, req.context);
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    return ok(res, tokens, 'Session refreshed');
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    const token =
      req.body?.refreshToken ?? (req.cookies as Record<string, string> | undefined)?.refresh_token;

    await auth.logout(token);
    clearAuthCookies(res);

    return ok(res, { signedOut: true }, 'Signed out');
  }),

  logoutEverywhere: asyncHandler(async (req: Request, res: Response) => {
    await auth.logoutEverywhere(req.user!.id);
    clearAuthCookies(res);

    return ok(res, { signedOut: true }, 'Signed out of all devices');
  }),

  /** The signed-in operator's own record. */
  me: asyncHandler(async (req: Request, res: Response) => {
    return ok(res, await admins.getById(req.user!.id));
  }),

  updateProfile: asyncHandler(async (req: Request, res: Response) => {
    const updated = await admins.updateProfile(req.user!.id, req.body, req.context);
    return ok(res, updated, 'Profile updated');
  }),

  /**
   * Always reports success, whether or not the address has an account —
   * otherwise this endpoint enumerates valid emails.
   */
  forgotPassword: asyncHandler(async (req: Request, res: Response) => {
    await auth.requestPasswordReset(req.body.email, req.context);

    return ok(
      res,
      { sent: true },
      'If an account exists for that address, a reset link is on its way.',
    );
  }),

  resetPassword: asyncHandler(async (req: Request, res: Response) => {
    await auth.resetPassword(req.body.token, req.body.password, req.context);
    clearAuthCookies(res);

    return ok(
      res,
      { reset: true },
      'Your password has been reset. Please sign in with your new password.',
    );
  }),

  changePassword: asyncHandler(async (req: Request, res: Response) => {
    await auth.changePassword(
      req.user!.id,
      req.body.currentPassword,
      req.body.newPassword,
      req.context,
    );
    clearAuthCookies(res);

    return ok(
      res,
      { changed: true },
      'Password changed. You have been signed out of all devices.',
    );
  }),

  /** Lets the dashboard show which URLs it should be talking to. */
  config: asyncHandler(async (_req: Request, res: Response) => {
    return ok(res, {
      siteUrl: env.SITE_URL,
      adminUrl: env.ADMIN_URL,
      registrationEnabled: false,
      passwordMinLength: 12,
      accessTokenTtl: env.JWT_ACCESS_TTL,
    });
  }),
};
