import express, { type Express } from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import routes from '@presentation/http/routes';
import { openApiDocument } from '@presentation/docs/openapi';
import {
  errorHandler,
  generalLimiter,
  notFoundHandler,
  requestContext,
} from '@presentation/http/middleware';
import { env, isProduction } from '@shared/config/env';
import { logger } from '@shared/logger';

export function createApp(): Express {
  const app = express();

  /**
   * Behind a load balancer (Render, Railway, Fly, nginx) the client address
   * arrives in X-Forwarded-For. Without this, rate limiting would bucket every
   * visitor under the proxy's single IP and the audit log would record it too.
   *
   * `1` rather than `true`: trusting the whole chain lets a client spoof its
   * own address by setting the header.
   */
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // ── Security headers ──────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              // Swagger UI needs inline styles and its own bundle.
              scriptSrc: ["'self'", "'unsafe-inline'"],
              styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
              fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
              imgSrc: ["'self'", 'data:', 'https:'],
              connectSrc: ["'self'", env.SUPABASE_URL],
              frameAncestors: ["'none'"],
              objectSrc: ["'none'"],
            },
          }
        : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // ── CORS ──────────────────────────────────────────────────────────────────
  app.use(
    cors({
      origin(origin, callback) {
        // No origin: curl, a server-side fetch, a health check. Allowed —
        // the browser same-origin policy is not what is being enforced here.
        if (!origin) return callback(null, true);

        if (env.CORS_ORIGINS.includes(origin)) return callback(null, true);

        logger.warn({ origin }, 'CORS origin refused');
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true, // required for the httpOnly auth cookies
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'RateLimit-Limit', 'RateLimit-Remaining'],
      maxAge: 86_400,
    }),
  );

  // ── Parsing ───────────────────────────────────────────────────────────────
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());
  app.use(compression());

  // ── Observability ─────────────────────────────────────────────────────────
  app.use(requestContext);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as { requestId?: string }).requestId ?? 'unknown',
      // Health checks every few seconds would otherwise drown the log.
      autoLogging: {
        ignore: (req) => req.url === '/health' || req.url === '/ready',
      },
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );

  // ── API documentation ─────────────────────────────────────────────────────
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: 'Neoteric LP API · v2',
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none',
        filter: true,
        tagsSorter: 'alpha',
      },
      // Matches the firm's palette, so the docs look like they belong to it.
      customCss: `
        .swagger-ui .topbar { display: none; }
        .swagger-ui .info .title { color: #255859; }
        .swagger-ui .btn.authorize { background: #255859; border-color: #255859; color: #fff; }
        .swagger-ui .btn.authorize svg { fill: #fff; }
        .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #255859; }
        .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #2d7374; }
        .swagger-ui .opblock.opblock-patch .opblock-summary-method { background: #c19766; }
        .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: #935f3b; }
      `,
    }),
  );

  /** The raw spec, for client-SDK generation and Postman imports. */
  app.get('/api/openapi.json', (_req, res) => {
    res.json(openApiDocument);
  });

  // ── API ───────────────────────────────────────────────────────────────────
  app.use(env.API_PREFIX, generalLimiter, routes);

  // Health probes at the root too, since most platforms expect them there.
  app.get('/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok', uptime: Math.floor(process.uptime()) } });
  });

  app.get('/', (_req, res) => {
    res.json({
      success: true,
      data: {
        service: 'Neoteric LP API',
        version: '2.0.0',
        documentation: '/api/docs',
        api: env.API_PREFIX,
      },
    });
  });

  // ── Fallbacks ─────────────────────────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
