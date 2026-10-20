import { schemas } from './schemas';
import { buildPaths } from './paths';
import { env } from '@shared/config/env';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * The OpenAPI 3.0 document served at `/api/docs` and `/api/openapi.json`.
 *
 * 3.0 rather than 3.1 because Swagger UI's 3.1 support is still partial and
 * silently drops some constructs — documentation that renders wrongly is
 * worse than documentation written to the older spec.
 */
export const openApiDocument: Record<string, any> = {
  openapi: '3.0.3',

  info: {
    title: 'Neoteric LP API',
    version: '2.0.0',
    description: `
REST API for the Neoteric LP website and administration dashboard.

### What changed in v2

In v1 every piece of content was hardcoded in the React bundle, and each
**News & Publications** entry was a title plus a link out to Google Drive.
In v2 all of it is database-backed and editable from the dashboard, and an
article is a page on the site — a cover thumbnail on the index, a body, a
slug of its own. The original Drive links are preserved in \`sourceUrl\` so
nothing from v1 is lost while the back catalogue is rewritten.

### Authentication

Bearer JWT. Sign in at \`POST /auth/login\`, then send
\`Authorization: Bearer <accessToken>\`. Access tokens last 15 minutes;
exchange the refresh token at \`POST /auth/refresh\`, which rotates it.

Tokens are also set as httpOnly cookies, so a browser dashboard can rely on
those instead of storing anything in JavaScript-reachable storage.

> **There is no registration endpoint.** The firm's first administrator is
> created by \`npm run db:seed:admin\`. Further accounts are created only by an
> existing super-admin at \`POST /admin/admins\`. This is deliberate.

### Roles

| Role | Can do |
|---|---|
| \`editor\` | Publications, media, firm content |
| \`admin\` | The above, plus enquiries, newsletter, settings, deletions |
| \`super_admin\` | Everything, including operator accounts and the audit log |

### Responses

Every response uses the same envelope:

\`\`\`json
{ "success": true, "data": { }, "meta": { } }
\`\`\`

\`\`\`json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "..." } }
\`\`\`

Branch on \`error.code\`, which is stable, rather than on \`error.message\`,
which is written for humans and may be reworded.

### Rate limits

| Scope | Budget |
|---|---|
| General API | ${env.RATE_LIMIT_MAX} requests / ${env.RATE_LIMIT_WINDOW_MINUTES} min |
| Sign-in and password reset | ${env.AUTH_RATE_LIMIT_MAX} / ${env.RATE_LIMIT_WINDOW_MINUTES} min |
| Contact form, newsletter | ${env.PUBLIC_FORM_RATE_LIMIT_MAX} / ${env.RATE_LIMIT_WINDOW_MINUTES} min |
    `.trim(),
    contact: { name: 'Neoteric LP', url: 'https://www.neotericlp.com.ng' },
  },

  servers: [
    { url: `http://localhost:${env.PORT}${env.API_PREFIX}`, description: 'Local development' },
    { url: `https://api.neotericlp.com.ng${env.API_PREFIX}`, description: 'Production' },
  ],

  tags: [
    { name: 'Health', description: 'Liveness and readiness probes.' },
    { name: 'Auth', description: 'Sign-in, tokens, password management. No registration.' },
    { name: 'Site', description: 'Aggregated public payloads for the marketing site.' },
    { name: 'Publications (public)', description: 'The News & Publications index and articles.' },
    { name: 'Content (public)', description: 'Practice areas, industries, team, testimonials.' },
    { name: 'Forms (public)', description: 'Contact form and newsletter sign-up.' },
    { name: 'Publications (admin)', description: 'Authoring, publishing, scheduling, attachments.' },
    { name: 'Content (admin)', description: 'Managing the firm content collections.' },
    { name: 'Media', description: 'Uploads and the media library.' },
    { name: 'Settings', description: 'Site-wide copy, contact details, SEO defaults.' },
    { name: 'Inquiries', description: 'The client enquiry queue.' },
    { name: 'Newsletter', description: 'Subscribers and campaigns.' },
    { name: 'Admin users', description: 'Operator accounts. Super-admin only.' },
    { name: 'Observability', description: 'Dashboard counters, audit log, email log.' },
  ],

  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Paste the `accessToken` from `POST /auth/login`.',
      },
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'access_token',
        description: 'Set automatically by `POST /auth/login`.',
      },
    },

    schemas,

    parameters: {
      Page: {
        name: 'page',
        in: 'query',
        schema: { type: 'integer', minimum: 1, default: 1 },
        description: 'Page number, 1-based.',
      },
      Limit: {
        name: 'limit',
        in: 'query',
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        description: 'Items per page. Capped at 100.',
      },
      SortBy: {
        name: 'sortBy',
        in: 'query',
        schema: { type: 'string' },
        description: 'Column to sort by. Values outside the allow-list fall back to the default.',
      },
      SortDirection: {
        name: 'sortDirection',
        in: 'query',
        schema: { type: 'string', enum: ['asc', 'desc'] },
      },
      Search: {
        name: 'search',
        in: 'query',
        schema: { type: 'string', maxLength: 200 },
        description: 'Case-insensitive partial match.',
      },
      IdPath: {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
      SlugPath: {
        name: 'slug',
        in: 'path',
        required: true,
        schema: { type: 'string' },
      },
    },

    responses: {
      BadRequest: {
        description: 'The request was malformed.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
      Unauthorized: {
        description: 'Missing, expired or invalid credentials.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
      Forbidden: {
        description: 'Authenticated, but this role may not do that.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
      NotFound: {
        description: 'No such record.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
      Conflict: {
        description: 'Conflicts with something that already exists.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
      ValidationError: {
        description: 'Validation failed. `error.issues` names each field.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
      RateLimited: {
        description: 'Too many requests.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
    },
  },

  paths: buildPaths(),
};
