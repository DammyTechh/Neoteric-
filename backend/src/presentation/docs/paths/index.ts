/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * OpenAPI path definitions.
 *
 * The six firm-content collections share one route shape, so they are
 * generated from a descriptor rather than written out six times — the same
 * reasoning as `registerContentRoutes` in the router. Where the two must
 * agree, having both driven by a list makes a mismatch visible.
 */

const PAGINATION_PARAMS = [
  { $ref: '#/components/parameters/Page' },
  { $ref: '#/components/parameters/Limit' },
  { $ref: '#/components/parameters/SortBy' },
  { $ref: '#/components/parameters/SortDirection' },
  { $ref: '#/components/parameters/Search' },
];

const AUTH = [{ bearerAuth: [] }, { cookieAuth: [] }];

/** A paginated list response wrapping the given schema. */
const listResponse = (schemaRef: string, description: string) => ({
  description,
  content: {
    'application/json': {
      schema: {
        allOf: [
          { $ref: '#/components/schemas/SuccessResponse' },
          {
            type: 'object',
            properties: {
              data: { type: 'array', items: { $ref: `#/components/schemas/${schemaRef}` } },
              meta: { $ref: '#/components/schemas/PaginationMeta' },
            },
          },
        ],
      },
    },
  },
});

/** A single-object response wrapping the given schema. */
const itemResponse = (schemaRef: string, description: string) => ({
  description,
  content: {
    'application/json': {
      schema: {
        allOf: [
          { $ref: '#/components/schemas/SuccessResponse' },
          { type: 'object', properties: { data: { $ref: `#/components/schemas/${schemaRef}` } } },
        ],
      },
    },
  },
});

const jsonBody = (schemaRef: string, required = true) => ({
  required,
  content: {
    'application/json': { schema: { $ref: `#/components/schemas/${schemaRef}` } },
  },
});

const COMMON_ERRORS = {
  400: { $ref: '#/components/responses/BadRequest' },
  401: { $ref: '#/components/responses/Unauthorized' },
  403: { $ref: '#/components/responses/Forbidden' },
  404: { $ref: '#/components/responses/NotFound' },
  422: { $ref: '#/components/responses/ValidationError' },
};

/** One of the six identically shaped firm-content collections. */
interface ContentCollection {
  path: string;
  schema: string;
  singular: string;
  plural: string;
  /** Whether the public API exposes a `/:slug` lookup. */
  publicSlug: boolean;
}

const COLLECTIONS: ContentCollection[] = [
  { path: 'practice-areas', schema: 'PracticeArea', singular: 'practice area', plural: 'practice areas', publicSlug: true },
  { path: 'industries', schema: 'Industry', singular: 'industry', plural: 'industries', publicSlug: true },
  { path: 'team', schema: 'TeamMember', singular: 'team member', plural: 'team members', publicSlug: true },
  { path: 'testimonials', schema: 'Testimonial', singular: 'testimonial', plural: 'testimonials', publicSlug: false },
  { path: 'achievements', schema: 'Achievement', singular: 'achievement', plural: 'achievements', publicSlug: false },
];

function buildContentPaths(): Record<string, any> {
  const paths: Record<string, any> = {};

  for (const collection of COLLECTIONS) {
    // Public read
    paths[`/${collection.path}`] = {
      get: {
        tags: ['Content (public)'],
        summary: `List ${collection.plural}`,
        description: `Returns only active ${collection.plural}, in display order.`,
        parameters: PAGINATION_PARAMS,
        responses: { 200: listResponse(collection.schema, `The ${collection.plural}.`) },
      },
    };

    if (collection.publicSlug) {
      paths[`/${collection.path}/{slug}`] = {
        get: {
          tags: ['Content (public)'],
          summary: `Get one ${collection.singular} by slug`,
          parameters: [{ $ref: '#/components/parameters/SlugPath' }],
          responses: {
            200: itemResponse(collection.schema, `The ${collection.singular}.`),
            404: { $ref: '#/components/responses/NotFound' },
          },
        },
      };
    }

    // Admin CRUD
    paths[`/admin/${collection.path}`] = {
      get: {
        tags: ['Content (admin)'],
        summary: `List all ${collection.plural}`,
        description: 'Includes inactive records, unlike the public endpoint.',
        security: AUTH,
        parameters: PAGINATION_PARAMS,
        responses: {
          200: listResponse(collection.schema, `The ${collection.plural}.`),
          ...COMMON_ERRORS,
        },
      },
      post: {
        tags: ['Content (admin)'],
        summary: `Create a ${collection.singular}`,
        security: AUTH,
        requestBody: jsonBody(collection.schema),
        responses: {
          201: itemResponse(collection.schema, 'Created.'),
          ...COMMON_ERRORS,
        },
      },
    };

    paths[`/admin/${collection.path}/reorder`] = {
      post: {
        tags: ['Content (admin)'],
        summary: `Reorder ${collection.plural}`,
        description: 'Persists the display order after a drag-and-drop in the dashboard.',
        security: AUTH,
        requestBody: jsonBody('ReorderRequest'),
        responses: { 200: { description: 'Order saved.' }, ...COMMON_ERRORS },
      },
    };

    paths[`/admin/${collection.path}/{id}`] = {
      get: {
        tags: ['Content (admin)'],
        summary: `Get one ${collection.singular}`,
        security: AUTH,
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        responses: { 200: itemResponse(collection.schema, 'Found.'), ...COMMON_ERRORS },
      },
      patch: {
        tags: ['Content (admin)'],
        summary: `Update a ${collection.singular}`,
        description: 'Partial update — send only the fields that changed.',
        security: AUTH,
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        requestBody: jsonBody(collection.schema),
        responses: { 200: itemResponse(collection.schema, 'Updated.'), ...COMMON_ERRORS },
      },
      delete: {
        tags: ['Content (admin)'],
        summary: `Delete a ${collection.singular}`,
        description: 'Requires the `admin` role.',
        security: AUTH,
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        responses: { 204: { description: 'Deleted.' }, ...COMMON_ERRORS },
      },
    };
  }

  return paths;
}

export function buildPaths(): Record<string, any> {
  return {
    // ── Health ──────────────────────────────────────────────────────────────

    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Liveness probe',
        description: 'Does not touch the database, so a database blip cannot restart the process.',
        responses: { 200: { description: 'The process is running.' } },
      },
    },

    '/ready': {
      get: {
        tags: ['Health'],
        summary: 'Readiness probe',
        description: 'Checks that the database is reachable.',
        responses: {
          200: { description: 'Ready to serve traffic.' },
          503: { description: 'Degraded — a dependency is unreachable.' },
        },
      },
    },

    // ── Auth ────────────────────────────────────────────────────────────────

    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Sign in',
        description:
          'The only way into the dashboard. Five failed attempts lock the account ' +
          'temporarily. An unknown email and a wrong password are deliberately ' +
          'indistinguishable, so this endpoint cannot be used to enumerate accounts.',
        requestBody: jsonBody('LoginRequest'),
        responses: {
          200: itemResponse('LoginResponse', 'Signed in.'),
          401: { $ref: '#/components/responses/Unauthorized' },
          422: { $ref: '#/components/responses/ValidationError' },
          429: { $ref: '#/components/responses/RateLimited' },
        },
      },
    },

    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Exchange a refresh token',
        description:
          'Rotates the refresh token: the one sent is revoked and a new one issued, ' +
          'so a stolen token is usable at most once.',
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { refreshToken: { type: 'string' } },
                description: 'Omit to use the refresh_token cookie.',
              },
            },
          },
        },
        responses: {
          200: itemResponse('AuthTokens', 'New token pair.'),
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Sign out of this session',
        responses: { 200: { description: 'Signed out.' } },
      },
    },

    '/auth/logout-all': {
      post: {
        tags: ['Auth'],
        summary: 'Sign out of every device',
        security: AUTH,
        responses: { 200: { description: 'All sessions revoked.' }, ...COMMON_ERRORS },
      },
    },

    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'The signed-in operator',
        security: AUTH,
        responses: { 200: itemResponse('AdminUser', 'Your account.'), ...COMMON_ERRORS },
      },
      patch: {
        tags: ['Auth'],
        summary: 'Update your own profile',
        security: AUTH,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  fullName: { type: 'string', minLength: 2 },
                  avatarUrl: { type: 'string', format: 'uri' },
                },
              },
            },
          },
        },
        responses: { 200: itemResponse('AdminUser', 'Updated.'), ...COMMON_ERRORS },
      },
    },

    '/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Request a password-reset link',
        description:
          'Always reports success, whether or not the address has an account — ' +
          'otherwise this endpoint would reveal which emails are registered. ' +
          'The link expires after 30 minutes and can be used once.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: { email: { type: 'string', format: 'email' } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Accepted.' },
          429: { $ref: '#/components/responses/RateLimited' },
        },
      },
    },

    '/auth/reset-password': {
      post: {
        tags: ['Auth'],
        summary: 'Complete a password reset',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token', 'password'],
                properties: {
                  token: { type: 'string' },
                  password: { type: 'string', minLength: 12 },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Password reset. All sessions were revoked.' },
          401: { $ref: '#/components/responses/Unauthorized' },
          422: { $ref: '#/components/responses/ValidationError' },
        },
      },
    },

    '/auth/change-password': {
      post: {
        tags: ['Auth'],
        summary: 'Change your password',
        description: 'Signs out every device, including this one.',
        security: AUTH,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['currentPassword', 'newPassword'],
                properties: {
                  currentPassword: { type: 'string' },
                  newPassword: { type: 'string', minLength: 12 },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Changed.' }, ...COMMON_ERRORS },
      },
    },

    '/auth/config': {
      get: {
        tags: ['Auth'],
        summary: 'Public auth configuration',
        description: 'Includes `registrationEnabled`, which is always false.',
        responses: { 200: { description: 'Configuration.' } },
      },
    },

    // ── Site ────────────────────────────────────────────────────────────────

    '/site/homepage': {
      get: {
        tags: ['Site'],
        summary: 'Everything the homepage needs',
        description:
          'Settings, practice areas, industries, team, testimonials, achievements and the ' +
          'latest publications in one request — so the homepage does not fire eight calls ' +
          'and flash eight loading states.',
        responses: { 200: { description: 'The homepage payload.' } },
      },
    },

    '/settings': {
      get: {
        tags: ['Site'],
        summary: 'Public site settings',
        description:
          'Grouped by prefix, so `contact.phone` is read as `data.contact.phone`. ' +
          'Private settings are never included here.',
        responses: { 200: { description: 'Public settings, grouped.' } },
      },
    },

    // ── Publications (public) ───────────────────────────────────────────────

    '/publications': {
      get: {
        tags: ['Publications (public)'],
        summary: 'The News & Publications index',
        description:
          'Published articles only — drafts and scheduled items can never appear here, ' +
          'whatever query is sent. Each item carries `coverImageUrl` for the index ' +
          'thumbnail.',
        parameters: [
          ...PAGINATION_PARAMS,
          {
            name: 'categorySlug',
            in: 'query',
            schema: { type: 'string' },
            description: 'Filter by category, e.g. `corporate-commercial`.',
          },
          { name: 'tag', in: 'query', schema: { type: 'string' } },
          {
            name: 'isFeatured',
            in: 'query',
            schema: { type: 'boolean' },
            description: 'Only the homepage feature rail.',
          },
        ],
        responses: { 200: listResponse('Publication', 'Published articles, newest first.') },
      },
    },

    '/publications/categories': {
      get: {
        tags: ['Publications (public)'],
        summary: 'Categories with article counts',
        description: 'Drives the filter rail on the index page.',
        responses: { 200: listResponse('PublicationCategory', 'Active categories.') },
      },
    },

    '/publications/sitemap': {
      get: {
        tags: ['Publications (public)'],
        summary: 'Published slugs and timestamps',
        description: "For the frontend's sitemap.xml.",
        responses: { 200: { description: 'Slugs with last-modified dates.' } },
      },
    },

    '/publications/{slug}': {
      get: {
        tags: ['Publications (public)'],
        summary: 'Read one article',
        description:
          'Returns the article with its related reading and previous/next links, and ' +
          'increments the view counter. When `body` is null the article has not been ' +
          'rewritten yet — fall back to `sourceUrl`, the original Drive link from v1.',
        parameters: [{ $ref: '#/components/parameters/SlugPath' }],
        responses: {
          200: itemResponse('PublicationDetail', 'The article.'),
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // ── Forms ───────────────────────────────────────────────────────────────

    '/contact': {
      post: {
        tags: ['Forms (public)'],
        summary: 'Submit the contact form',
        description:
          'Files the enquiry, emails the firm, and sends the sender an acknowledgement ' +
          'carrying a reference such as `NLP-2026-0007`. Rate limited, and carries a ' +
          'honeypot field.',
        requestBody: jsonBody('ContactInquiryInput'),
        responses: {
          201: { description: 'Received. The response carries the reference.' },
          422: { $ref: '#/components/responses/ValidationError' },
          429: { $ref: '#/components/responses/RateLimited' },
        },
      },
    },

    '/newsletter/subscribe': {
      post: {
        tags: ['Forms (public)'],
        summary: 'Subscribe to publication updates',
        description:
          'Double opt-in: the address receives a confirmation email and is not added to ' +
          'the list until the link is followed.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  fullName: { type: 'string' },
                  website: { type: 'string', description: 'Honeypot — leave empty.' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Confirmation email sent.' },
          429: { $ref: '#/components/responses/RateLimited' },
        },
      },
    },

    '/newsletter/confirm': {
      get: {
        tags: ['Forms (public)'],
        summary: 'Confirm a subscription',
        parameters: [{ name: 'token', in: 'query', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Confirmed.' }, 401: { $ref: '#/components/responses/Unauthorized' } },
      },
    },

    '/newsletter/unsubscribe': {
      get: {
        tags: ['Forms (public)'],
        summary: 'Unsubscribe',
        description: 'Also reachable as POST, for RFC 8058 one-click unsubscribe.',
        parameters: [{ name: 'token', in: 'query', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Unsubscribed.' } },
      },
    },

    // ── Publications (admin) ────────────────────────────────────────────────

    '/admin/publications': {
      get: {
        tags: ['Publications (admin)'],
        summary: 'List all publications',
        description: 'Includes drafts, scheduled and archived articles.',
        security: AUTH,
        parameters: [
          ...PAGINATION_PARAMS,
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['draft', 'scheduled', 'published', 'archived'] },
          },
          { name: 'categoryId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'tag', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: listResponse('Publication', 'All publications.'), ...COMMON_ERRORS },
      },
      post: {
        tags: ['Publications (admin)'],
        summary: 'Create a publication',
        description:
          'The slug is derived from the title when omitted and de-duplicated. The body ' +
          'is sanitised server-side, and the excerpt and reading time are derived from it ' +
          'when not supplied.',
        security: AUTH,
        requestBody: jsonBody('PublicationInput'),
        responses: { 201: itemResponse('Publication', 'Created.'), ...COMMON_ERRORS },
      },
    },

    '/admin/publications/{id}': {
      get: {
        tags: ['Publications (admin)'],
        summary: 'Get one publication',
        security: AUTH,
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        responses: { 200: itemResponse('Publication', 'Found.'), ...COMMON_ERRORS },
      },
      patch: {
        tags: ['Publications (admin)'],
        summary: 'Update a publication',
        description:
          'The slug is only recomputed if explicitly sent, so editing an article does ' +
          'not break its existing URL.',
        security: AUTH,
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        requestBody: jsonBody('PublicationInput'),
        responses: { 200: itemResponse('Publication', 'Updated.'), ...COMMON_ERRORS },
      },
      delete: {
        tags: ['Publications (admin)'],
        summary: 'Delete a publication',
        description: 'Requires the `admin` role.',
        security: AUTH,
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        responses: { 204: { description: 'Deleted.' }, ...COMMON_ERRORS },
      },
    },

    '/admin/publications/{id}/publish': {
      post: {
        tags: ['Publications (admin)'],
        summary: 'Publish now',
        description:
          'Refuses if the article has neither a body nor a source link. If the ' +
          '`features.broadcast_on_publish` setting is on, subscribers are emailed.',
        security: AUTH,
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        responses: {
          200: itemResponse('Publication', 'Live.'),
          409: { $ref: '#/components/responses/Conflict' },
          ...COMMON_ERRORS,
        },
      },
    },

    '/admin/publications/{id}/unpublish': {
      post: {
        tags: ['Publications (admin)'],
        summary: 'Return to draft',
        security: AUTH,
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        responses: { 200: itemResponse('Publication', 'Back to draft.'), ...COMMON_ERRORS },
      },
    },

    '/admin/publications/{id}/feature': {
      post: {
        tags: ['Publications (admin)'],
        summary: 'Toggle the featured flag',
        security: AUTH,
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        responses: { 200: itemResponse('Publication', 'Toggled.'), ...COMMON_ERRORS },
      },
    },

    '/admin/publications/{id}/import-document': {
      post: {
        tags: ['Publications (admin)'],
        summary: 'Import a document as the article content',
        description:
          'How the v1 back catalogue comes off Google Drive.\n\n' +
          '- **`.docx`** is converted to clean semantic HTML and becomes the editable ' +
          'article body. Headings, lists and emphasis are preserved; Word\'s inline ' +
          'styling is discarded so the article inherits the site typography. Embedded ' +
          'images are extracted into the media library rather than inlined as base64.\n' +
          '- **`.pdf`** cannot be converted faithfully — a PDF describes glyph ' +
          'positions, not structure — so it is stored and rendered by the article ' +
          "page's own inline viewer.\n\n" +
          'Either way the reader stays on the site. Refuses with 409 if the article ' +
          'already has a body, unless `replaceBody` is true.',
        security: AUTH,
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['document'],
                properties: {
                  document: { type: 'string', format: 'binary' },
                  replaceBody: {
                    type: 'boolean',
                    default: false,
                    description: 'Confirms overwriting an existing article body.',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description:
              'Imported. `mode` is `converted` for Word files or `attached` for PDFs; ' +
              '`warnings` carries anything the editor should look at.',
          },
          409: { $ref: '#/components/responses/Conflict' },
          415: { description: 'Not a Word document or PDF.' },
          ...COMMON_ERRORS,
        },
      },
    },

    '/admin/publications/{id}/attachments': {
      post: {
        tags: ['Publications (admin)'],
        summary: 'Attach a file to an article',
        description: 'For the signed PDF, exhibits, or whatever accompanies the piece.',
        security: AUTH,
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['mediaId'],
                properties: {
                  mediaId: { type: 'string', format: 'uuid' },
                  label: { type: 'string' },
                  sortOrder: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Attached.' }, ...COMMON_ERRORS },
      },
    },

    '/admin/categories': {
      get: {
        tags: ['Publications (admin)'],
        summary: 'List categories',
        security: AUTH,
        parameters: PAGINATION_PARAMS,
        responses: { 200: listResponse('PublicationCategory', 'Categories.'), ...COMMON_ERRORS },
      },
      post: {
        tags: ['Publications (admin)'],
        summary: 'Create a category',
        security: AUTH,
        requestBody: jsonBody('PublicationCategory'),
        responses: { 201: itemResponse('PublicationCategory', 'Created.'), ...COMMON_ERRORS },
      },
    },

    // ── Media ───────────────────────────────────────────────────────────────

    '/admin/media': {
      get: {
        tags: ['Media'],
        summary: 'Browse the media library',
        security: AUTH,
        parameters: [
          ...PAGINATION_PARAMS,
          { name: 'folder', in: 'query', schema: { type: 'string' } },
          { name: 'mimeGroup', in: 'query', schema: { type: 'string', enum: ['image', 'document'] } },
        ],
        responses: { 200: listResponse('MediaAsset', 'Media assets.'), ...COMMON_ERRORS },
      },
    },

    '/admin/media/upload': {
      post: {
        tags: ['Media'],
        summary: 'Upload one file',
        description:
          'Stored in Supabase Storage. Re-uploading an identical file returns the ' +
          'existing record rather than storing a second copy. Images are checked against ' +
          'their magic numbers, not just the declared content type.',
        security: AUTH,
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: { type: 'string', format: 'binary' },
                  folder: { type: 'string', default: 'general' },
                  altText: { type: 'string' },
                  caption: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: itemResponse('MediaAsset', 'Uploaded.'),
          413: { description: 'File too large.' },
          415: { description: 'File type not accepted.' },
          ...COMMON_ERRORS,
        },
      },
    },

    '/admin/media/upload-many': {
      post: {
        tags: ['Media'],
        summary: 'Upload several files',
        description:
          'Up to ten at once. Reports per-file outcomes rather than failing the whole ' +
          'batch because one file was rejected.',
        security: AUTH,
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  files: { type: 'array', items: { type: 'string', format: 'binary' } },
                  folder: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Upload results.' }, ...COMMON_ERRORS },
      },
    },

    '/admin/media/{id}': {
      patch: {
        tags: ['Media'],
        summary: 'Update alt text, caption or folder',
        security: AUTH,
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        requestBody: jsonBody('MediaAsset'),
        responses: { 200: itemResponse('MediaAsset', 'Updated.'), ...COMMON_ERRORS },
      },
      delete: {
        tags: ['Media'],
        summary: 'Delete a file',
        description: 'Removes the catalogue row and the stored object.',
        security: AUTH,
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        responses: { 204: { description: 'Deleted.' }, ...COMMON_ERRORS },
      },
    },

    // ── Settings ────────────────────────────────────────────────────────────

    '/admin/settings': {
      get: {
        tags: ['Settings'],
        summary: 'All settings, including private ones',
        security: AUTH,
        responses: { 200: listResponse('SiteSetting', 'Settings.'), ...COMMON_ERRORS },
      },
      put: {
        tags: ['Settings'],
        summary: 'Save several settings at once',
        description: 'For saving a whole settings form in one request.',
        security: AUTH,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['settings'],
                properties: {
                  settings: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['key'],
                      properties: { key: { type: 'string' }, value: {} },
                    },
                  },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Saved.' }, ...COMMON_ERRORS },
      },
    },

    '/admin/settings/key/{key}': {
      patch: {
        tags: ['Settings'],
        summary: 'Update one setting',
        security: AUTH,
        parameters: [
          { name: 'key', in: 'path', required: true, schema: { type: 'string' }, example: 'contact.phone' },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { value: {} } } } },
        },
        responses: { 200: itemResponse('SiteSetting', 'Saved.'), ...COMMON_ERRORS },
      },
    },

    // ── Inquiries ───────────────────────────────────────────────────────────

    '/admin/inquiries': {
      get: {
        tags: ['Inquiries'],
        summary: 'The client enquiry queue',
        description: 'Requires the `admin` role.',
        security: AUTH,
        parameters: [
          ...PAGINATION_PARAMS,
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['new', 'in_review', 'responded', 'closed', 'spam'] },
          },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
        ],
        responses: { 200: listResponse('ContactInquiry', 'Enquiries.'), ...COMMON_ERRORS },
      },
    },

    '/admin/inquiries/counts': {
      get: {
        tags: ['Inquiries'],
        summary: 'Enquiry counts by status',
        security: AUTH,
        responses: { 200: { description: 'Counts keyed by status.' }, ...COMMON_ERRORS },
      },
    },

    '/admin/inquiries/{id}': {
      get: {
        tags: ['Inquiries'],
        summary: 'Read one enquiry',
        security: AUTH,
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        responses: { 200: itemResponse('ContactInquiry', 'The enquiry.'), ...COMMON_ERRORS },
      },
      patch: {
        tags: ['Inquiries'],
        summary: 'Update status or internal note',
        security: AUTH,
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        requestBody: jsonBody('ContactInquiry'),
        responses: { 200: itemResponse('ContactInquiry', 'Updated.'), ...COMMON_ERRORS },
      },
    },

    '/admin/inquiries/{id}/respond': {
      post: {
        tags: ['Inquiries'],
        summary: 'Email a response',
        description: 'Sends a branded reply quoting the enquiry reference, then files it.',
        security: AUTH,
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['message'],
                properties: {
                  message: { type: 'string', minLength: 10 },
                  markResponded: { type: 'boolean', default: true },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Response sent.' }, ...COMMON_ERRORS },
      },
    },

    // ── Newsletter ──────────────────────────────────────────────────────────

    '/admin/newsletter/subscribers': {
      get: {
        tags: ['Newsletter'],
        summary: 'List subscribers',
        security: AUTH,
        parameters: [
          ...PAGINATION_PARAMS,
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['pending', 'subscribed', 'unsubscribed', 'bounced'] },
          },
        ],
        responses: { 200: listResponse('NewsletterSubscriber', 'Subscribers.'), ...COMMON_ERRORS },
      },
    },

    '/admin/newsletter/subscribers/export': {
      get: {
        tags: ['Newsletter'],
        summary: 'Export the confirmed list as CSV',
        security: AUTH,
        responses: {
          200: { description: 'CSV file.', content: { 'text/csv': { schema: { type: 'string' } } } },
          ...COMMON_ERRORS,
        },
      },
    },

    '/admin/newsletter/campaigns': {
      get: {
        tags: ['Newsletter'],
        summary: 'List campaigns',
        security: AUTH,
        parameters: PAGINATION_PARAMS,
        responses: { 200: listResponse('NewsletterCampaign', 'Campaigns.'), ...COMMON_ERRORS },
      },
      post: {
        tags: ['Newsletter'],
        summary: 'Draft a campaign',
        security: AUTH,
        requestBody: jsonBody('NewsletterCampaign'),
        responses: { 201: itemResponse('NewsletterCampaign', 'Saved.'), ...COMMON_ERRORS },
      },
    },

    '/admin/newsletter/campaigns/{id}': {
      get: {
        tags: ['Newsletter'],
        summary: 'Read one campaign',
        security: AUTH,
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        responses: { 200: itemResponse('NewsletterCampaign', 'The campaign.'), ...COMMON_ERRORS },
      },
      patch: {
        tags: ['Newsletter'],
        summary: 'Edit a draft campaign',
        description:
          'Refuses once the campaign has been sent — editing it then would rewrite ' +
          'history without recalling a single email.',
        security: AUTH,
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        requestBody: jsonBody('NewsletterCampaign'),
        responses: {
          200: itemResponse('NewsletterCampaign', 'Updated.'),
          409: { $ref: '#/components/responses/Conflict' },
          ...COMMON_ERRORS,
        },
      },
      delete: {
        tags: ['Newsletter'],
        summary: 'Delete a campaign',
        security: AUTH,
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        responses: {
          204: { description: 'Deleted.' },
          409: { $ref: '#/components/responses/Conflict' },
          ...COMMON_ERRORS,
        },
      },
    },

    '/admin/newsletter/campaigns/{id}/send': {
      post: {
        tags: ['Newsletter'],
        summary: 'Send a campaign',
        description:
          'Sends in batches of 20 with a pause between them, so the relay does not ' +
          'rate-limit or greylist the run. One failed recipient is counted and skipped.',
        security: AUTH,
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        responses: {
          200: { description: 'Sent. The response carries delivered and failed counts.' },
          409: { $ref: '#/components/responses/Conflict' },
          ...COMMON_ERRORS,
        },
      },
    },

    // ── Admin users ─────────────────────────────────────────────────────────

    '/admin/admins': {
      get: {
        tags: ['Admin users'],
        summary: 'List operator accounts',
        description: 'Super-admin only.',
        security: AUTH,
        parameters: PAGINATION_PARAMS,
        responses: { 200: listResponse('AdminUser', 'Accounts.'), ...COMMON_ERRORS },
      },
      post: {
        tags: ['Admin users'],
        summary: 'Create an account for a colleague',
        description:
          'Super-admin only. **This is the only endpoint in the API that creates an ' +
          'account** — there is no public registration. A temporary password is ' +
          'generated and emailed, and the recipient must change it on first sign-in.',
        security: AUTH,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'fullName'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  fullName: { type: 'string', minLength: 2 },
                  role: {
                    type: 'string',
                    enum: ['super_admin', 'admin', 'editor'],
                    default: 'editor',
                  },
                  password: {
                    type: 'string',
                    minLength: 12,
                    description: 'Omit to have one generated and emailed.',
                  },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Created and invited.' },
          409: { $ref: '#/components/responses/Conflict' },
          ...COMMON_ERRORS,
        },
      },
    },

    '/admin/admins/{id}': {
      patch: {
        tags: ['Admin users'],
        summary: 'Update an account',
        description:
          'Refuses to demote or deactivate the last active super-admin, and refuses to ' +
          'let an operator deactivate themselves.',
        security: AUTH,
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        requestBody: jsonBody('AdminUser'),
        responses: { 200: itemResponse('AdminUser', 'Updated.'), ...COMMON_ERRORS },
      },
      delete: {
        tags: ['Admin users'],
        summary: 'Delete an account',
        security: AUTH,
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        responses: { 204: { description: 'Deleted.' }, ...COMMON_ERRORS },
      },
    },

    // ── Observability ───────────────────────────────────────────────────────

    '/admin/dashboard/stats': {
      get: {
        tags: ['Observability'],
        summary: 'Dashboard counters',
        security: AUTH,
        responses: { 200: itemResponse('DashboardStats', 'Counters.'), ...COMMON_ERRORS },
      },
    },

    '/admin/audit-logs': {
      get: {
        tags: ['Observability'],
        summary: 'The audit trail',
        description:
          'Super-admin only. Every create, update, delete and send is recorded with ' +
          'before and after state.',
        security: AUTH,
        parameters: [
          ...PAGINATION_PARAMS,
          { name: 'entity', in: 'query', schema: { type: 'string' } },
          { name: 'action', in: 'query', schema: { type: 'string' } },
          { name: 'adminUserId', in: 'query', schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 200: listResponse('AuditLog', 'Audit entries.'), ...COMMON_ERRORS },
      },
    },

    '/admin/email-logs': {
      get: {
        tags: ['Observability'],
        summary: 'Email delivery log',
        description:
          'Super-admin only. Every send attempt, so a client who says they never ' +
          'received an acknowledgement can be answered from the record.',
        security: AUTH,
        parameters: PAGINATION_PARAMS,
        responses: { 200: { description: 'Email log entries.' }, ...COMMON_ERRORS },
      },
    },

    ...buildContentPaths(),
  };
}
