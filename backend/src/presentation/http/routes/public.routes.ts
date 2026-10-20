import { Router } from 'express';
import { container } from '@infrastructure/container';
import { createCrudController } from '@presentation/http/controllers/crud.controller';
import { publicationController } from '@presentation/http/controllers/publication.controller';
import {
  inquiryController,
  newsletterController,
  settingsController,
  siteController,
} from '@presentation/http/controllers/misc.controller';
import {
  publicFormLimiter,
  validate,
} from '@presentation/http/middleware';
import {
  confirmSubscriptionSchema,
  createInquirySchema,
  paginationSchema,
  publicationQuerySchema,
  subscribeSchema,
  unsubscribeSchema,
} from '@application/dto';

/**
 * The unauthenticated API the marketing site reads from.
 *
 * Everything here is either published content or a form submission. There is
 * no route in this file that can reveal a draft, read a client enquiry, or
 * create an account.
 */
const router: Router = Router();

const ACTIVE_ONLY = { isActive: true } as const;

// ── Homepage ────────────────────────────────────────────────────────────────

router.get('/site/homepage', siteController.homepage);
router.get('/settings', settingsController.publicTree);

// ── News & Publications ─────────────────────────────────────────────────────
//
// The centrepiece of v2: in v1 these links went straight to Google Drive.

router.get(
  '/publications',
  validate(publicationQuerySchema, 'query'),
  publicationController.listPublic,
);
router.get('/publications/sitemap', publicationController.sitemap);
router.get('/publications/categories', publicationController.listCategoriesPublic);
router.get('/publications/:slug', publicationController.getPublicBySlug);

// ── Firm content ────────────────────────────────────────────────────────────

const practiceAreas = createCrudController(container.services.practiceAreas, {
  allowedSortFields: ['sort_order', 'name'],
  defaultSortBy: 'sort_order',
  defaultSortDirection: 'asc',
  buildFilters: (query) => ({ ...ACTIVE_ONLY, search: query.search }),
  resourceLabel: 'Practice area',
});

const industries = createCrudController(container.services.industries, {
  allowedSortFields: ['sort_order', 'name'],
  defaultSortBy: 'sort_order',
  defaultSortDirection: 'asc',
  buildFilters: (query) => ({ ...ACTIVE_ONLY, search: query.search }),
  resourceLabel: 'Industry',
});

const team = createCrudController(container.services.team, {
  allowedSortFields: ['sort_order', 'full_name'],
  defaultSortBy: 'sort_order',
  defaultSortDirection: 'asc',
  buildFilters: (query) => ({
    ...ACTIVE_ONLY,
    teamGroup: query.teamGroup,
    search: query.search,
  }),
  resourceLabel: 'Team member',
});

const testimonials = createCrudController(container.services.testimonials, {
  allowedSortFields: ['sort_order', 'created_at'],
  defaultSortBy: 'sort_order',
  defaultSortDirection: 'asc',
  buildFilters: () => ({ isPublished: true }),
  resourceLabel: 'Testimonial',
});

const achievements = createCrudController(container.services.achievements, {
  allowedSortFields: ['sort_order'],
  defaultSortBy: 'sort_order',
  defaultSortDirection: 'asc',
  buildFilters: () => ACTIVE_ONLY,
  resourceLabel: 'Achievement',
});

router.get('/practice-areas', validate(paginationSchema, 'query'), practiceAreas.list);
router.get('/practice-areas/:slug', practiceAreas.getBySlug);

router.get('/industries', validate(paginationSchema, 'query'), industries.list);
router.get('/industries/:slug', industries.getBySlug);

router.get('/team', validate(paginationSchema, 'query'), team.list);
router.get('/team/:slug', team.getBySlug);

router.get('/testimonials', validate(paginationSchema, 'query'), testimonials.list);
router.get('/achievements', validate(paginationSchema, 'query'), achievements.list);

// ── Forms ───────────────────────────────────────────────────────────────────
//
// Rate limited: these are the only unauthenticated endpoints that write.

router.post(
  '/contact',
  publicFormLimiter,
  validate(createInquirySchema),
  inquiryController.submit,
);

router.post(
  '/newsletter/subscribe',
  publicFormLimiter,
  validate(subscribeSchema),
  newsletterController.subscribe,
);

router.post(
  '/newsletter/confirm',
  validate(confirmSubscriptionSchema),
  newsletterController.confirm,
);
router.get('/newsletter/confirm', newsletterController.confirm);

router.post(
  '/newsletter/unsubscribe',
  validate(unsubscribeSchema),
  newsletterController.unsubscribe,
);
// GET so the one-click unsubscribe link in an email footer works directly.
router.get('/newsletter/unsubscribe', newsletterController.unsubscribe);

export default router;
