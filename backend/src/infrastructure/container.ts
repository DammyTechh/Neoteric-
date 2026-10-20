import {
  AdminUserRepository,
  PasswordResetRepository,
  RefreshTokenRepository,
} from '@infrastructure/database/repositories/admin.repository';
import {
  AchievementRepository,
  IndustryRepository,
  PracticeAreaRepository,
  PublicationCategoryRepository,
  TeamRepository,
  TestimonialRepository,
} from '@infrastructure/database/repositories/content.repository';
import {
  CampaignRepository,
  InquiryRepository,
  SubscriberRepository,
} from '@infrastructure/database/repositories/engagement.repository';
import {
  PublicationAttachmentRepository,
  PublicationRepository,
} from '@infrastructure/database/repositories/publication.repository';
import {
  AuditRepository,
  EmailLogRepository,
  MediaRepository,
  SettingsRepository,
  StatsRepository,
} from '@infrastructure/database/repositories/support.repository';
import { ResendMailer } from '@infrastructure/mail/resend.mailer';
import { SupabaseFileStorage } from '@infrastructure/storage/supabase.storage';

import { AdminService } from '@application/services/admin.service';
import { AuthService } from '@application/services/auth.service';
import { CrudService } from '@application/services/crud.service';
import { DocumentImportService } from '@application/services/document-import.service';
import { InquiryService } from '@application/services/inquiry.service';
import { MediaService } from '@application/services/media.service';
import { NewsletterService } from '@application/services/newsletter.service';
import { PublicationService } from '@application/services/publication.service';
import { SettingsService } from '@application/services/settings.service';

/**
 * Composition root.
 *
 * Every concrete dependency is chosen exactly once, here. Nothing else in the
 * codebase calls `new` on a repository, which is what makes the layering more
 * than a naming convention — swapping Supabase for something else is a change
 * to this file and the repositories it names, and no service moves.
 *
 * Built once at boot and reused; these objects are stateless.
 */
function buildContainer() {
  // ── Repositories ──────────────────────────────────────────────────────────
  const adminUsers = new AdminUserRepository();
  const refreshTokens = new RefreshTokenRepository();
  const passwordResets = new PasswordResetRepository();

  const publications = new PublicationRepository();
  const publicationAttachments = new PublicationAttachmentRepository();
  const categories = new PublicationCategoryRepository();

  const practiceAreas = new PracticeAreaRepository();
  const industries = new IndustryRepository();
  const team = new TeamRepository();
  const testimonials = new TestimonialRepository();
  const achievements = new AchievementRepository();

  const inquiries = new InquiryRepository();
  const subscribers = new SubscriberRepository();
  const campaigns = new CampaignRepository();

  const media = new MediaRepository();
  const settings = new SettingsRepository();
  const audit = new AuditRepository();
  const emailLogs = new EmailLogRepository();
  const stats = new StatsRepository();

  // ── Outbound services ─────────────────────────────────────────────────────
  const mailer = new ResendMailer(emailLogs);
  const storage = new SupabaseFileStorage();

  // ── Application services ──────────────────────────────────────────────────
  const newsletterService = new NewsletterService(
    subscribers,
    campaigns,
    publications,
    mailer,
    audit,
  );

  const mediaService = new MediaService(media, storage, audit);

  const publicationService = new PublicationService(
    publications,
    publicationAttachments,
    settings,
    mediaService,
    new DocumentImportService(),
    audit,
    newsletterService,
  );

  return {
    repositories: {
      adminUsers,
      refreshTokens,
      passwordResets,
      publications,
      publicationAttachments,
      categories,
      practiceAreas,
      industries,
      team,
      testimonials,
      achievements,
      inquiries,
      subscribers,
      campaigns,
      media,
      settings,
      audit,
      emailLogs,
      stats,
    },

    services: {
      mailer,
      storage,

      auth: new AuthService(adminUsers, refreshTokens, passwordResets, mailer),
      admins: new AdminService(adminUsers, refreshTokens, mailer, audit),
      publications: publicationService,
      newsletter: newsletterService,
      media: mediaService,
      settings: new SettingsService(settings, audit),
      inquiries: new InquiryService(inquiries, practiceAreas, settings, mailer, audit),

      // The five plain content collections need no behaviour beyond CRUD,
      // ordering and auditing, so they use the generic service directly.
      categories: new CrudService(categories, audit, {
        resource: 'Category',
        auditEntity: 'publication_category',
        slugSource: 'name',
        autoSortOrder: true,
      }),
      practiceAreas: new CrudService(practiceAreas, audit, {
        resource: 'Practice area',
        auditEntity: 'practice_area',
        slugSource: 'name',
        autoSortOrder: true,
      }),
      industries: new CrudService(industries, audit, {
        resource: 'Industry',
        auditEntity: 'industry',
        slugSource: 'name',
        autoSortOrder: true,
      }),
      team: new CrudService(team, audit, {
        resource: 'Team member',
        auditEntity: 'team_member',
        slugSource: 'fullName',
        autoSortOrder: true,
      }),
      testimonials: new CrudService(testimonials, audit, {
        resource: 'Testimonial',
        auditEntity: 'testimonial',
        autoSortOrder: true,
      }),
      achievements: new CrudService(achievements, audit, {
        resource: 'Achievement',
        auditEntity: 'achievement',
        autoSortOrder: true,
      }),
    },
  };
}

export type Container = ReturnType<typeof buildContainer>;

export const container: Container = buildContainer();
