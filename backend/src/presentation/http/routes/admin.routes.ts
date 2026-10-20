import { Router } from 'express';
import { container } from '@infrastructure/container';
import { createCrudController } from '@presentation/http/controllers/crud.controller';
import { publicationController } from '@presentation/http/controllers/publication.controller';
import {
  adminController,
  dashboardController,
  inquiryController,
  mediaController,
  newsletterController,
  settingsController,
} from '@presentation/http/controllers/misc.controller';
import { requireAuth, requireRole, upload, validate } from '@presentation/http/middleware';
import {
  attachmentSchema,
  auditQuerySchema,
  bulkSettingsSchema,
  createAchievementSchema,
  createAdminSchema,
  createCampaignSchema,
  createCategorySchema,
  createIndustrySchema,
  createPracticeAreaSchema,
  createPublicationSchema,
  createTeamMemberSchema,
  createTestimonialSchema,
  inquiryQuerySchema,
  mediaQuerySchema,
  paginationSchema,
  publicationQuerySchema,
  reorderSchema,
  respondToInquirySchema,
  subscriberQuerySchema,
  updateAchievementSchema,
  updateCampaignSchema,
  updateAdminSchema,
  updateCategorySchema,
  updateIndustrySchema,
  updateInquirySchema,
  updateMediaSchema,
  updatePracticeAreaSchema,
  updatePublicationSchema,
  updateSettingSchema,
  updateTeamMemberSchema,
  updateTestimonialSchema,
} from '@application/dto';

/**
 * The authenticated dashboard API.
 *
 * Every route below sits behind `requireAuth`, applied once at the top rather
 * than repeated per route — forgetting it on a single line is exactly the kind
 * of mistake that leaks a client enquiry list.
 *
 * Roles:
 *   editor       content: publications, media, the firm pages
 *   admin        the above, plus enquiries, newsletter and settings
 *   super_admin  everything, including operator accounts and the audit log
 */
const router: Router = Router();

router.use(requireAuth);

// ── Dashboard ───────────────────────────────────────────────────────────────

router.get('/dashboard/stats', dashboardController.stats);

// ── Publications ────────────────────────────────────────────────────────────

router.get(
  '/publications',
  validate(publicationQuerySchema, 'query'),
  publicationController.list,
);
router.post('/publications', validate(createPublicationSchema), publicationController.create);
router.get('/publications/:id', publicationController.getOne);
router.patch(
  '/publications/:id',
  validate(updatePublicationSchema),
  publicationController.update,
);
router.delete('/publications/:id', requireRole('admin'), publicationController.remove);

router.post('/publications/:id/publish', publicationController.publish);
router.post('/publications/:id/unpublish', publicationController.unpublish);
router.post('/publications/:id/feature', publicationController.toggleFeatured);

/**
 * Import a document as the article's content.
 *
 * The one route that retires a Google Drive link: upload the .docx and it
 * becomes the editable body, or the .pdf and it is served by the article
 * page's own viewer.
 */
router.post(
  '/publications/:id/import-document',
  upload.single('document'),
  publicationController.importDocument,
);

router.post(
  '/publications/:id/attachments',
  validate(attachmentSchema),
  publicationController.addAttachment,
);
router.delete('/publications/:id/attachments/:mediaId', publicationController.removeAttachment);

// ── Publication categories ──────────────────────────────────────────────────

router.get(
  '/categories',
  validate(paginationSchema, 'query'),
  publicationController.listCategories,
);
router.post('/categories', validate(createCategorySchema), publicationController.createCategory);
router.patch(
  '/categories/:id',
  validate(updateCategorySchema),
  publicationController.updateCategory,
);
router.delete('/categories/:id', requireRole('admin'), publicationController.removeCategory);
router.post(
  '/categories/reorder',
  validate(reorderSchema),
  publicationController.reorderCategories,
);

// ── Firm content ────────────────────────────────────────────────────────────

/**
 * Registers the seven standard routes for one content collection.
 *
 * Six collections, one shape: list, read, create, update, delete, reorder.
 * Describing that once keeps the route table readable and guarantees they
 * cannot drift apart.
 */
function registerContentRoutes(
  basePath: string,
  controller: ReturnType<typeof createCrudController>,
  schemas: { create: Parameters<typeof validate>[0]; update: Parameters<typeof validate>[0] },
  queryOptions?: { querySchema?: Parameters<typeof validate>[0] },
): void {
  const query = queryOptions?.querySchema ?? paginationSchema;

  router.get(basePath, validate(query, 'query'), controller.list);
  router.post(basePath, validate(schemas.create), controller.create);
  router.post(`${basePath}/reorder`, validate(reorderSchema), controller.reorder);
  router.get(`${basePath}/:id`, controller.getOne);
  router.patch(`${basePath}/:id`, validate(schemas.update), controller.update);
  router.delete(`${basePath}/:id`, requireRole('admin'), controller.remove);
}

registerContentRoutes(
  '/practice-areas',
  createCrudController(container.services.practiceAreas, {
    allowedSortFields: ['sort_order', 'name', 'created_at'],
    defaultSortBy: 'sort_order',
    defaultSortDirection: 'asc',
    resourceLabel: 'Practice area',
  }),
  { create: createPracticeAreaSchema, update: updatePracticeAreaSchema },
);

registerContentRoutes(
  '/industries',
  createCrudController(container.services.industries, {
    allowedSortFields: ['sort_order', 'name', 'created_at'],
    defaultSortBy: 'sort_order',
    defaultSortDirection: 'asc',
    resourceLabel: 'Industry',
  }),
  { create: createIndustrySchema, update: updateIndustrySchema },
);

registerContentRoutes(
  '/team',
  createCrudController(container.services.team, {
    allowedSortFields: ['sort_order', 'full_name', 'created_at'],
    defaultSortBy: 'sort_order',
    defaultSortDirection: 'asc',
    resourceLabel: 'Team member',
  }),
  { create: createTeamMemberSchema, update: updateTeamMemberSchema },
);

registerContentRoutes(
  '/testimonials',
  createCrudController(container.services.testimonials, {
    allowedSortFields: ['sort_order', 'created_at', 'author_name'],
    defaultSortBy: 'sort_order',
    defaultSortDirection: 'asc',
    resourceLabel: 'Testimonial',
  }),
  { create: createTestimonialSchema, update: updateTestimonialSchema },
);

registerContentRoutes(
  '/achievements',
  createCrudController(container.services.achievements, {
    allowedSortFields: ['sort_order', 'created_at'],
    defaultSortBy: 'sort_order',
    defaultSortDirection: 'asc',
    resourceLabel: 'Achievement',
  }),
  { create: createAchievementSchema, update: updateAchievementSchema },
);

// ── Media library ───────────────────────────────────────────────────────────

router.get('/media', validate(mediaQuerySchema, 'query'), mediaController.list);
router.get('/media/folders', mediaController.folders);
router.post('/media/upload', upload.single('file'), mediaController.upload);
router.post('/media/upload-many', upload.array('files', 10), mediaController.uploadMany);
router.get('/media/:id', mediaController.getOne);
router.patch('/media/:id', validate(updateMediaSchema), mediaController.update);
router.delete('/media/:id', mediaController.remove);

// ── Site settings ───────────────────────────────────────────────────────────

router.get('/settings', requireRole('admin'), settingsController.list);
router.put('/settings', requireRole('admin'), validate(bulkSettingsSchema), settingsController.updateMany);
router.get('/settings/:group', requireRole('admin'), settingsController.listGroup);
router.patch(
  '/settings/key/:key',
  requireRole('admin'),
  validate(updateSettingSchema),
  settingsController.update,
);

// ── Contact enquiries ───────────────────────────────────────────────────────

router.get(
  '/inquiries',
  requireRole('admin'),
  validate(inquiryQuerySchema, 'query'),
  inquiryController.list,
);
router.get('/inquiries/counts', requireRole('admin'), inquiryController.counts);
router.get('/inquiries/:id', requireRole('admin'), inquiryController.getOne);
router.patch(
  '/inquiries/:id',
  requireRole('admin'),
  validate(updateInquirySchema),
  inquiryController.update,
);
router.post(
  '/inquiries/:id/respond',
  requireRole('admin'),
  validate(respondToInquirySchema),
  inquiryController.respond,
);
router.delete('/inquiries/:id', requireRole('admin'), inquiryController.remove);

// ── Newsletter ──────────────────────────────────────────────────────────────

router.get(
  '/newsletter/subscribers',
  requireRole('admin'),
  validate(subscriberQuerySchema, 'query'),
  newsletterController.listSubscribers,
);
router.get(
  '/newsletter/subscribers/export',
  requireRole('admin'),
  newsletterController.exportSubscribers,
);
router.delete(
  '/newsletter/subscribers/:id',
  requireRole('admin'),
  newsletterController.removeSubscriber,
);

router.get(
  '/newsletter/campaigns',
  requireRole('admin'),
  validate(paginationSchema, 'query'),
  newsletterController.listCampaigns,
);
router.post(
  '/newsletter/campaigns',
  requireRole('admin'),
  validate(createCampaignSchema),
  newsletterController.createCampaign,
);
router.post(
  '/newsletter/campaigns/:id/send',
  requireRole('admin'),
  newsletterController.sendCampaign,
);
router.get('/newsletter/campaigns/:id', requireRole('admin'), newsletterController.getCampaign);
router.patch(
  '/newsletter/campaigns/:id',
  requireRole('admin'),
  validate(updateCampaignSchema),
  newsletterController.updateCampaign,
);
router.delete(
  '/newsletter/campaigns/:id',
  requireRole('admin'),
  newsletterController.removeCampaign,
);

// ── Operator accounts ───────────────────────────────────────────────────────
//
// Super-admin only. This is the sole path that creates an account — there is
// no public registration endpoint anywhere in the API.

router.get(
  '/admins',
  requireRole('super_admin'),
  validate(paginationSchema, 'query'),
  adminController.list,
);
router.post(
  '/admins',
  requireRole('super_admin'),
  validate(createAdminSchema),
  adminController.invite,
);
router.get('/admins/:id', requireRole('super_admin'), adminController.getOne);
router.patch(
  '/admins/:id',
  requireRole('super_admin'),
  validate(updateAdminSchema),
  adminController.update,
);
router.delete('/admins/:id', requireRole('super_admin'), adminController.remove);

// ── Observability ───────────────────────────────────────────────────────────

router.get(
  '/audit-logs',
  requireRole('super_admin'),
  validate(auditQuerySchema, 'query'),
  dashboardController.auditLog,
);
router.get(
  '/email-logs',
  requireRole('super_admin'),
  validate(paginationSchema, 'query'),
  dashboardController.emailLog,
);

export default router;
