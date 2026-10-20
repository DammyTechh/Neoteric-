import { Router } from 'express';
import { authController } from '@presentation/http/controllers/auth.controller';
import { authLimiter, requireAuth, validate } from '@presentation/http/middleware';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '@application/dto';

/**
 * Authentication.
 *
 * Worth stating plainly, because it is a deliberate product decision rather
 * than an oversight: **there is no POST /auth/register**. The firm's single
 * administrator account is created by `npm run db:seed:admin`, and further
 * accounts only by an existing super-admin at `POST /admin/admins`.
 *
 * The three unauthenticated endpoints here (login, forgot, reset) are the ones
 * an attacker can reach, so all three are rate limited.
 */
const router: Router = Router();

router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshSchema), authController.refresh);
router.post('/logout', authController.logout);

router.post(
  '/forgot-password',
  authLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword,
);
router.post(
  '/reset-password',
  authLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword,
);

router.get('/config', authController.config);

// ── Authenticated ───────────────────────────────────────────────────────────

router.get('/me', requireAuth, authController.me);
router.patch('/me', requireAuth, validate(updateProfileSchema), authController.updateProfile);
router.post(
  '/change-password',
  requireAuth,
  validate(changePasswordSchema),
  authController.changePassword,
);
router.post('/logout-all', requireAuth, authController.logoutEverywhere);

export default router;
