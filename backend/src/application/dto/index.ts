import { z } from 'zod';

/**
 * Request schemas.
 *
 * Validation lives here rather than in the controllers so the same rules can
 * be reused by a background job, a CLI script or a test without dragging
 * Express along.
 */

// ── Primitives ──────────────────────────────────────────────────────────────

export const uuidSchema = z.string().uuid('Must be a valid identifier');
export const slugSchema = z
  .string()
  .min(1)
  .max(140)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be a lowercase, hyphen-separated slug');

const emailSchema = z.string().trim().toLowerCase().email('Must be a valid email address');
const urlSchema = z.string().trim().url('Must be a valid URL');
const optionalUrl = z.union([urlSchema, z.literal(''), z.null()]).optional();
const optionalText = (max: number) => z.string().trim().max(max).nullish();

/**
 * Passwords.
 *
 * Length is the control that matters; a composition rule that demands a
 * symbol mostly produces `Password1!`. A 12-character floor plus a check
 * against the obvious choices is the better trade.
 */
const WEAK_PASSWORDS = new Set([
  'password1234',
  'administrator',
  'neotericlp01',
  'qwertyuiop12',
  '123456789012',
  'letmein12345',
]);

export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password must be at most 128 characters')
  .refine((value) => !WEAK_PASSWORDS.has(value.toLowerCase()), {
    message: 'That password is too easy to guess. Please choose another.',
  })
  .refine((value) => !/^(.)\1+$/.test(value), {
    message: 'Password cannot be a single repeated character',
  });

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  sortBy: z.string().optional(),
  sortDirection: z.enum(['asc', 'desc']).optional(),
  search: z.string().trim().max(200).optional(),
});

const booleanParam = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((value) => value === true || value === 'true')
  .optional();

// ── Auth ────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: passwordSchema,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Your current password is required'),
    newPassword: passwordSchema,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'The new password must be different from the current one',
    path: ['newPassword'],
  });

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  avatarUrl: optionalUrl,
});

// ── Admin users ─────────────────────────────────────────────────────────────

export const createAdminSchema = z.object({
  email: emailSchema,
  fullName: z.string().trim().min(2, 'Full name is required').max(120),
  role: z.enum(['super_admin', 'admin', 'editor']).default('editor'),
  /** Omit to have one generated and emailed. */
  password: passwordSchema.optional(),
});

export const updateAdminSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  role: z.enum(['super_admin', 'admin', 'editor']).optional(),
  isActive: z.boolean().optional(),
});

// ── Publications ────────────────────────────────────────────────────────────

export const publicationBaseSchema = z.object({
  title: z.string().trim().min(3, 'Title is required').max(300),
  slug: slugSchema.optional(),
  excerpt: optionalText(500),
  body: z.string().nullish(),
  categoryId: uuidSchema.nullish(),
  coverImageId: uuidSchema.nullish(),
  coverImageUrl: optionalUrl,
  coverAlt: optionalText(200),
  sourceUrl: optionalUrl,
  status: z.enum(['draft', 'scheduled', 'published', 'archived']).default('draft'),
  isFeatured: z.boolean().optional(),
  authorName: z.string().trim().max(160).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(15).optional(),
  seoTitle: optionalText(200),
  seoDescription: optionalText(400),
  ogImageUrl: optionalUrl,
  publishedAt: z.string().datetime().nullish(),
  scheduledFor: z.string().datetime().nullish(),
});

export const createPublicationSchema = publicationBaseSchema.refine(
  (data) => data.status !== 'scheduled' || Boolean(data.scheduledFor),
  { message: 'A scheduled article needs a date to publish on', path: ['scheduledFor'] },
);

export const updatePublicationSchema = publicationBaseSchema.partial();

export const publicationQuerySchema = paginationSchema.extend({
  status: z.enum(['draft', 'scheduled', 'published', 'archived']).optional(),
  categoryId: uuidSchema.optional(),
  categorySlug: z.string().trim().optional(),
  tag: z.string().trim().optional(),
  isFeatured: booleanParam,
});

export const attachmentSchema = z.object({
  mediaId: uuidSchema,
  label: optionalText(160),
  sortOrder: z.number().int().min(0).optional(),
});

// ── Content collections ─────────────────────────────────────────────────────

export const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: slugSchema.optional(),
  description: optionalText(500),
  colour: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex colour such as #255859')
    .nullish(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});
export const updateCategorySchema = createCategorySchema.partial();

export const createPracticeAreaSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: slugSchema.optional(),
  summary: optionalText(300),
  description: optionalText(4000),
  imageId: uuidSchema.nullish(),
  imageUrl: optionalUrl,
  icon: optionalText(80),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  seoTitle: optionalText(200),
  seoDescription: optionalText(400),
});
export const updatePracticeAreaSchema = createPracticeAreaSchema.partial();

export const createIndustrySchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: slugSchema.optional(),
  description: optionalText(4000),
  imageId: uuidSchema.nullish(),
  imageUrl: optionalUrl,
  icon: optionalText(80),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});
export const updateIndustrySchema = createIndustrySchema.partial();

export const createTeamMemberSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  slug: slugSchema.optional(),
  roleTitle: z.string().trim().min(2).max(160),
  teamGroup: z.enum(['legal', 'non_legal']).default('legal'),
  bio: optionalText(4000),
  qualifications: z.array(z.string().trim().max(120)).max(12).optional(),
  imageId: uuidSchema.nullish(),
  imageUrl: optionalUrl,
  email: z.union([emailSchema, z.literal(''), z.null()]).optional(),
  phone: optionalText(40),
  linkedinUrl: optionalUrl,
  twitterUrl: optionalUrl,
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});
export const updateTeamMemberSchema = createTeamMemberSchema.partial();

export const createTestimonialSchema = z.object({
  quote: z.string().trim().min(10, 'The quote is a little short').max(2000),
  authorName: z.string().trim().min(2).max(160),
  authorRole: optionalText(160),
  authorCompany: optionalText(160),
  authorImageId: uuidSchema.nullish(),
  authorImageUrl: optionalUrl,
  rating: z.number().int().min(1).max(5).nullish(),
  isPublished: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});
export const updateTestimonialSchema = createTestimonialSchema.partial();

export const createAchievementSchema = z.object({
  label: z.string().trim().min(2).max(120),
  value: z.string().trim().min(1).max(40),
  suffix: optionalText(20),
  description: optionalText(400),
  icon: optionalText(80),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});
export const updateAchievementSchema = createAchievementSchema.partial();

export const reorderSchema = z.object({
  order: z
    .array(z.object({ id: uuidSchema, sortOrder: z.number().int().min(0) }))
    .min(1, 'Nothing to reorder')
    .max(200),
});

// ── Media ───────────────────────────────────────────────────────────────────

export const updateMediaSchema = z.object({
  altText: optionalText(300),
  caption: optionalText(500),
  folder: z.string().trim().max(80).optional(),
});

export const mediaQuerySchema = paginationSchema.extend({
  folder: z.string().trim().optional(),
  mimeGroup: z.enum(['image', 'document']).optional(),
});

// ── Settings ────────────────────────────────────────────────────────────────

export const updateSettingSchema = z.object({
  value: z.unknown(),
});

export const bulkSettingsSchema = z.object({
  settings: z
    .array(z.object({ key: z.string().trim().min(1).max(100), value: z.unknown() }))
    .min(1)
    .max(100),
});

// ── Contact enquiries ───────────────────────────────────────────────────────

export const createInquirySchema = z.object({
  fullName: z.string().trim().min(2, 'Please tell us your name').max(160),
  email: emailSchema,
  phone: optionalText(40),
  company: optionalText(160),
  subject: optionalText(200),
  message: z
    .string()
    .trim()
    .min(10, 'Please give us a little more detail')
    .max(5000, 'Please keep your message under 5000 characters'),
  practiceAreaId: uuidSchema.nullish(),
  /**
   * Honeypot. A real browser leaves it empty; most naive bots fill every
   * field they find. Submissions that fill it are accepted and silently
   * marked as spam rather than rejected, so the bot learns nothing.
   */
  website: z.string().max(0).optional().or(z.string().optional()),
});

export const updateInquirySchema = z.object({
  status: z.enum(['new', 'in_review', 'responded', 'closed', 'spam']).optional(),
  internalNote: optionalText(4000),
});

export const respondToInquirySchema = z.object({
  message: z.string().trim().min(10, 'The response is a little short').max(10000),
  markResponded: z.boolean().default(true),
});

export const inquiryQuerySchema = paginationSchema.extend({
  status: z.enum(['new', 'in_review', 'responded', 'closed', 'spam']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

// ── Newsletter ──────────────────────────────────────────────────────────────

export const subscribeSchema = z.object({
  email: emailSchema,
  fullName: z.string().trim().max(160).nullish(),
  source: z.string().trim().max(60).optional(),
  website: z.string().max(0).optional().or(z.string().optional()), // honeypot
});

export const confirmSubscriptionSchema = z.object({
  token: z.string().min(1, 'Confirmation token is required'),
});

export const unsubscribeSchema = z.object({
  token: z.string().min(1, 'Unsubscribe token is required'),
});

export const createCampaignSchema = z.object({
  subject: z.string().trim().min(3).max(200),
  preheader: optionalText(200),
  body: z.string().trim().min(10).nullish(),
  publicationId: uuidSchema.nullish(),
  scheduledFor: z.string().datetime().nullish(),
});
export const updateCampaignSchema = createCampaignSchema.partial();

export const subscriberQuerySchema = paginationSchema.extend({
  status: z.enum(['pending', 'subscribed', 'unsubscribed', 'bounced']).optional(),
});

// ── Audit ───────────────────────────────────────────────────────────────────

export const auditQuerySchema = paginationSchema.extend({
  adminUserId: uuidSchema.optional(),
  entity: z.string().trim().max(60).optional(),
  action: z.string().trim().max(60).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
