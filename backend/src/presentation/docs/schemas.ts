/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * OpenAPI component schemas.
 *
 * Hand-authored rather than generated from Zod: the request schemas and the
 * response shapes are not the same objects, and a generator that conflates
 * them produces documentation that is subtly wrong in exactly the places a
 * client integrator will trust it.
 */

const uuid = { type: 'string', format: 'uuid' } as const;
const dateTime = { type: 'string', format: 'date-time' } as const;
const nullableString = { type: ['string', 'null'] } as const;

export const schemas: Record<string, any> = {
  // ── Envelopes ─────────────────────────────────────────────────────────────

  PaginationMeta: {
    type: 'object',
    properties: {
      page: { type: 'integer', example: 1 },
      limit: { type: 'integer', example: 20 },
      total: { type: 'integer', example: 27 },
      totalPages: { type: 'integer', example: 2 },
      hasNext: { type: 'boolean' },
      hasPrevious: { type: 'boolean' },
    },
  },

  SuccessResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', enum: [true] },
      message: { type: 'string' },
      data: {},
      meta: { $ref: '#/components/schemas/PaginationMeta' },
    },
    required: ['success', 'data'],
  },

  ErrorResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', enum: [false] },
      error: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            example: 'VALIDATION_ERROR',
            description: 'Stable machine-readable code. Branch on this, not on the message.',
          },
          message: { type: 'string', example: 'The submitted data is not valid' },
          issues: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string', example: 'email' },
                message: { type: 'string', example: 'Must be a valid email address' },
              },
            },
          },
        },
        required: ['code', 'message'],
      },
      requestId: { type: 'string', description: 'Quote this when reporting a problem.' },
    },
    required: ['success', 'error'],
  },

  // ── Auth ──────────────────────────────────────────────────────────────────

  LoginRequest: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email', example: 'admin@neotericlp.com.ng' },
      password: { type: 'string', format: 'password', example: 'your-seeded-password' },
    },
  },

  AuthTokens: {
    type: 'object',
    properties: {
      accessToken: { type: 'string', description: 'JWT. Send as `Authorization: Bearer <token>`.' },
      refreshToken: { type: 'string', description: 'Rotated on every refresh.' },
      expiresIn: { type: 'integer', example: 900, description: 'Access token lifetime in seconds.' },
      tokenType: { type: 'string', enum: ['Bearer'] },
    },
  },

  LoginResponse: {
    allOf: [
      { $ref: '#/components/schemas/AuthTokens' },
      {
        type: 'object',
        properties: {
          user: { $ref: '#/components/schemas/AdminUser' },
          mustChangePassword: {
            type: 'boolean',
            description: 'True after an invite. Force the password screen before anything else.',
          },
        },
      },
    ],
  },

  AdminUser: {
    type: 'object',
    properties: {
      id: uuid,
      email: { type: 'string', format: 'email' },
      fullName: { type: 'string' },
      role: { type: 'string', enum: ['super_admin', 'admin', 'editor'] },
      avatarUrl: nullableString,
      isActive: { type: 'boolean' },
      mustChangePassword: { type: 'boolean' },
      lastLoginAt: { type: ['string', 'null'], format: 'date-time' },
      createdAt: dateTime,
      updatedAt: dateTime,
    },
  },

  // ── Publications ──────────────────────────────────────────────────────────

  PublicationCategory: {
    type: 'object',
    properties: {
      id: uuid,
      name: { type: 'string', example: 'Corporate & Commercial' },
      slug: { type: 'string', example: 'corporate-commercial' },
      description: nullableString,
      colour: { type: ['string', 'null'], example: '#255859' },
      sortOrder: { type: 'integer' },
      isActive: { type: 'boolean' },
      publicationCount: {
        type: 'integer',
        description: 'Only present on GET /publications/categories.',
      },
    },
  },

  Publication: {
    type: 'object',
    properties: {
      id: uuid,
      title: { type: 'string' },
      slug: { type: 'string', description: 'The article URL segment.' },
      excerpt: nullableString,
      body: {
        type: ['string', 'null'],
        description:
          'Sanitised HTML. Null for back-catalogue items not yet rewritten — fall back to sourceUrl.',
      },
      categoryId: { type: ['string', 'null'], format: 'uuid' },
      category: { $ref: '#/components/schemas/PublicationCategory' },
      coverImageId: { type: ['string', 'null'], format: 'uuid' },
      coverImageUrl: {
        type: ['string', 'null'],
        description: 'Thumbnail for the News & Publications index grid.',
      },
      coverAlt: nullableString,
      sourceUrl: {
        type: ['string', 'null'],
        description: 'Legacy Google Drive/Docs link carried over from v1.',
      },
      status: { type: 'string', enum: ['draft', 'scheduled', 'published', 'archived'] },
      isFeatured: { type: 'boolean' },
      authorName: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      readingMinutes: { type: 'integer' },
      viewCount: { type: 'integer' },
      seoTitle: nullableString,
      seoDescription: nullableString,
      ogImageUrl: nullableString,
      publishedAt: { type: ['string', 'null'], format: 'date-time' },
      scheduledFor: { type: ['string', 'null'], format: 'date-time' },
      createdAt: dateTime,
      updatedAt: dateTime,
    },
  },

  PublicationInput: {
    type: 'object',
    required: ['title'],
    properties: {
      title: { type: 'string', minLength: 3, maxLength: 300 },
      slug: { type: 'string', description: 'Derived from the title when omitted.' },
      excerpt: { type: 'string', maxLength: 500, description: 'Derived from the body when omitted.' },
      body: { type: 'string', description: 'HTML. Sanitised server-side before storage.' },
      categoryId: uuid,
      coverImageId: uuid,
      coverImageUrl: { type: 'string', format: 'uri' },
      coverAlt: { type: 'string' },
      sourceUrl: { type: 'string', format: 'uri' },
      status: {
        type: 'string',
        enum: ['draft', 'scheduled', 'published', 'archived'],
        default: 'draft',
      },
      isFeatured: { type: 'boolean' },
      authorName: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' }, maxItems: 15 },
      seoTitle: { type: 'string' },
      seoDescription: { type: 'string' },
      publishedAt: dateTime,
      scheduledFor: { ...dateTime, description: 'Required when status is `scheduled`.' },
    },
  },

  PublicationDetail: {
    type: 'object',
    properties: {
      publication: { $ref: '#/components/schemas/Publication' },
      related: { type: 'array', items: { $ref: '#/components/schemas/Publication' } },
      navigation: {
        type: 'object',
        properties: {
          previous: { $ref: '#/components/schemas/Publication' },
          next: { $ref: '#/components/schemas/Publication' },
        },
      },
    },
  },

  // ── Firm content ──────────────────────────────────────────────────────────

  PracticeArea: {
    type: 'object',
    properties: {
      id: uuid,
      name: { type: 'string', example: 'Corporate and Commercial Law' },
      slug: { type: 'string' },
      summary: nullableString,
      description: nullableString,
      imageUrl: nullableString,
      icon: nullableString,
      sortOrder: { type: 'integer' },
      isActive: { type: 'boolean' },
    },
  },

  Industry: {
    type: 'object',
    properties: {
      id: uuid,
      name: { type: 'string', example: 'Energy, Oil & Gas' },
      slug: { type: 'string' },
      description: nullableString,
      imageUrl: nullableString,
      sortOrder: { type: 'integer' },
      isActive: { type: 'boolean' },
    },
  },

  TeamMember: {
    type: 'object',
    properties: {
      id: uuid,
      fullName: { type: 'string', example: 'Moyosore A. Mustapha' },
      slug: { type: 'string' },
      roleTitle: { type: 'string', example: 'Principal Partner' },
      teamGroup: { type: 'string', enum: ['legal', 'non_legal'] },
      bio: nullableString,
      qualifications: { type: 'array', items: { type: 'string' } },
      imageUrl: nullableString,
      email: nullableString,
      linkedinUrl: nullableString,
      sortOrder: { type: 'integer' },
      isActive: { type: 'boolean' },
    },
  },

  Testimonial: {
    type: 'object',
    properties: {
      id: uuid,
      quote: { type: 'string' },
      authorName: { type: 'string' },
      authorRole: nullableString,
      authorCompany: nullableString,
      authorImageUrl: nullableString,
      rating: { type: ['integer', 'null'], minimum: 1, maximum: 5 },
      isPublished: { type: 'boolean' },
      sortOrder: { type: 'integer' },
    },
  },

  Achievement: {
    type: 'object',
    properties: {
      id: uuid,
      label: { type: 'string', example: 'Client satisfaction' },
      value: { type: 'string', example: '83%' },
      suffix: nullableString,
      description: nullableString,
      sortOrder: { type: 'integer' },
      isActive: { type: 'boolean' },
    },
  },

  // ── Media ─────────────────────────────────────────────────────────────────

  MediaAsset: {
    type: 'object',
    properties: {
      id: uuid,
      publicUrl: { type: 'string', format: 'uri' },
      originalName: { type: 'string' },
      mimeType: { type: 'string', example: 'image/webp' },
      sizeBytes: { type: 'integer' },
      width: { type: ['integer', 'null'] },
      height: { type: ['integer', 'null'] },
      altText: nullableString,
      caption: nullableString,
      folder: { type: 'string' },
      createdAt: dateTime,
    },
  },

  // ── Settings ──────────────────────────────────────────────────────────────

  SiteSetting: {
    type: 'object',
    properties: {
      key: { type: 'string', example: 'contact.phone' },
      value: { description: 'Any JSON value, shaped by `valueType`.' },
      valueType: {
        type: 'string',
        enum: ['string', 'text', 'number', 'boolean', 'json', 'image', 'url', 'email'],
      },
      groupName: { type: 'string', example: 'contact' },
      label: { type: 'string' },
      description: nullableString,
      isPublic: { type: 'boolean' },
      sortOrder: { type: 'integer' },
      updatedAt: dateTime,
    },
  },

  // ── Engagement ────────────────────────────────────────────────────────────

  ContactInquiryInput: {
    type: 'object',
    required: ['fullName', 'email', 'message'],
    properties: {
      fullName: { type: 'string', minLength: 2, maxLength: 160 },
      email: { type: 'string', format: 'email' },
      phone: { type: 'string' },
      company: { type: 'string' },
      subject: { type: 'string' },
      message: { type: 'string', minLength: 10, maxLength: 5000 },
      practiceAreaId: uuid,
      website: {
        type: 'string',
        description:
          'Honeypot. Leave empty — a filled value is accepted but silently filed as spam.',
      },
    },
  },

  ContactInquiry: {
    type: 'object',
    properties: {
      id: uuid,
      reference: { type: 'string', example: 'NLP-2026-0007' },
      fullName: { type: 'string' },
      email: { type: 'string', format: 'email' },
      phone: nullableString,
      company: nullableString,
      subject: nullableString,
      message: { type: 'string' },
      status: { type: 'string', enum: ['new', 'in_review', 'responded', 'closed', 'spam'] },
      internalNote: nullableString,
      respondedAt: { type: ['string', 'null'], format: 'date-time' },
      createdAt: dateTime,
    },
  },

  NewsletterSubscriber: {
    type: 'object',
    properties: {
      id: uuid,
      email: { type: 'string', format: 'email' },
      fullName: nullableString,
      status: { type: 'string', enum: ['pending', 'subscribed', 'unsubscribed', 'bounced'] },
      confirmedAt: { type: ['string', 'null'], format: 'date-time' },
      source: { type: 'string' },
      createdAt: dateTime,
    },
  },

  NewsletterCampaign: {
    type: 'object',
    properties: {
      id: uuid,
      subject: { type: 'string' },
      preheader: nullableString,
      body: nullableString,
      publicationId: { type: ['string', 'null'], format: 'uuid' },
      status: { type: 'string', enum: ['draft', 'scheduled', 'sending', 'sent', 'failed'] },
      sentAt: { type: ['string', 'null'], format: 'date-time' },
      recipientCount: { type: 'integer' },
      deliveredCount: { type: 'integer' },
      failedCount: { type: 'integer' },
    },
  },

  // ── Observability ─────────────────────────────────────────────────────────

  DashboardStats: {
    type: 'object',
    properties: {
      publicationsTotal: { type: 'integer' },
      publicationsPublished: { type: 'integer' },
      publicationsDraft: { type: 'integer' },
      publicationsScheduled: { type: 'integer' },
      publicationsViews: { type: 'integer' },
      inquiriesNew: { type: 'integer' },
      inquiriesTotal: { type: 'integer' },
      subscribersActive: { type: 'integer' },
      teamActive: { type: 'integer' },
      practiceAreasActive: { type: 'integer' },
      industriesActive: { type: 'integer' },
      testimonialsPublished: { type: 'integer' },
      mediaTotal: { type: 'integer' },
      inquiriesByStatus: { type: 'object', additionalProperties: { type: 'integer' } },
    },
  },

  AuditLog: {
    type: 'object',
    properties: {
      id: uuid,
      adminUserId: { type: ['string', 'null'], format: 'uuid' },
      actorEmail: nullableString,
      action: { type: 'string', example: 'update' },
      entity: { type: 'string', example: 'publication' },
      entityId: nullableString,
      beforeState: { type: ['object', 'null'] },
      afterState: { type: ['object', 'null'] },
      ipAddress: nullableString,
      createdAt: dateTime,
    },
  },

  ReorderRequest: {
    type: 'object',
    required: ['order'],
    properties: {
      order: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['id', 'sortOrder'],
          properties: { id: uuid, sortOrder: { type: 'integer', minimum: 0 } },
        },
      },
    },
  },
};
