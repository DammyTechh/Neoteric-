import { Router } from 'express';
import adminRoutes from './admin.routes';
import authRoutes from './auth.routes';
import publicRoutes from './public.routes';
import { checkDatabaseConnection } from '@infrastructure/database/supabase.client';
import { asyncHandler } from '@presentation/http/middleware';
import { env } from '@shared/config/env';
import { ok } from '@shared/utils/http';

const router: Router = Router();

/**
 * Liveness: is the process up?
 *
 * Deliberately does not touch the database — a liveness probe that fails
 * during a brief database blip would restart a perfectly healthy container
 * and make the outage worse.
 */
router.get(
  '/health',
  asyncHandler(async (_req, res) => {
    return ok(res, {
      status: 'ok',
      service: 'neoteric-api',
      version: '2.0.0',
      environment: env.NODE_ENV,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  }),
);

/** Readiness: can this instance actually serve traffic? */
router.get(
  '/ready',
  asyncHandler(async (_req, res) => {
    const database = await checkDatabaseConnection();

    return res.status(database ? 200 : 503).json({
      success: database,
      data: {
        status: database ? 'ready' : 'degraded',
        checks: { database: database ? 'up' : 'down' },
        timestamp: new Date().toISOString(),
      },
    });
  }),
);

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/', publicRoutes);

export default router;
