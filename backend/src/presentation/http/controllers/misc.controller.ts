import type { Request, Response } from 'express';
import { container } from '@infrastructure/container';
import { asyncHandler, parsedQuery } from '@presentation/http/middleware';
import { AppError } from '@shared/errors/AppError';
import { created, noContent, ok, paginated } from '@shared/utils/http';
import { parsePagination } from '@shared/utils/pagination';
import type { UUID } from '@shared/types/common';

/* eslint-disable @typescript-eslint/no-explicit-any */

const {
  media,
  settings,
  inquiries,
  newsletter,
  admins,
  practiceAreas,
  industries,
  team,
  testimonials,
  achievements,
} = container.services;

const { audit, emailLogs, stats } = container.repositories;

// ── Media ───────────────────────────────────────────────────────────────────

export const mediaController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const query = parsedQuery<any>(req);
    const result = await media.list(
      parsePagination(query, {
        allowedSortFields: ['created_at', 'original_name', 'size_bytes'],
        defaultSortBy: 'created_at',
      }),
      { folder: query.folder, mimeGroup: query.mimeGroup, search: query.search },
    );
    return paginated(res, result.items, result.meta);
  }),

  getOne: asyncHandler(async (req: Request, res: Response) => {
    return ok(res, await media.getById(req.params.id as UUID));
  }),

  upload: asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) throw AppError.badRequest('No file was included in the request');

    const asset = await media.upload(
      {
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
        folder: req.body?.folder,
        altText: req.body?.altText ?? null,
        caption: req.body?.caption ?? null,
      },
      req.context,
    );

    return created(res, asset, 'File uploaded');
  }),

  /** Several files in one request — the drag-and-drop case. */
  uploadMany: asyncHandler(async (req: Request, res: Response) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) throw AppError.badRequest('No files were included in the request');

    const results = await Promise.allSettled(
      files.map((file) =>
        media.upload(
          {
            buffer: file.buffer,
            originalName: file.originalname,
            mimeType: file.mimetype,
            folder: req.body?.folder,
          },
          req.context,
        ),
      ),
    );

    // Report per-file outcomes rather than failing the batch on one bad file.
    const uploaded = results
      .filter((result) => result.status === 'fulfilled')
      .map((result) => (result as PromiseFulfilledResult<unknown>).value);

    const failed = results
      .map((result, index) =>
        result.status === 'rejected'
          ? { file: files[index]?.originalname, reason: String((result as PromiseRejectedResult).reason?.message ?? 'Upload failed') }
          : null,
      )
      .filter(Boolean);

    return created(
      res,
      { uploaded, failed },
      `${uploaded.length} file${uploaded.length === 1 ? '' : 's'} uploaded`,
    );
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    return ok(res, await media.update(req.params.id as UUID, req.body, req.context), 'Updated');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await media.remove(req.params.id as UUID, req.context);
    return noContent(res);
  }),

  folders: asyncHandler(async (_req: Request, res: Response) => {
    return ok(res, await media.folders());
  }),
};

// ── Settings ────────────────────────────────────────────────────────────────

export const settingsController = {
  /** Public, grouped shape the marketing site consumes. */
  publicTree: asyncHandler(async (_req: Request, res: Response) => {
    return ok(res, await settings.publicTree());
  }),

  list: asyncHandler(async (_req: Request, res: Response) => {
    return ok(res, await settings.list(true));
  }),

  listGroup: asyncHandler(async (req: Request, res: Response) => {
    return ok(res, await settings.listGroup(req.params.group as string, true));
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const setting = await settings.update(req.params.key as string, req.body.value, req.context);
    return ok(res, setting, 'Setting saved');
  }),

  updateMany: asyncHandler(async (req: Request, res: Response) => {
    const updated = await settings.updateMany(req.body.settings, req.context);
    return ok(res, updated, `${updated.length} settings saved`);
  }),
};

// ── Contact enquiries ───────────────────────────────────────────────────────

export const inquiryController = {
  /** Public contact-form submission. */
  submit: asyncHandler(async (req: Request, res: Response) => {
    const result = await inquiries.submit(req.body, req.context);
    return created(res, { reference: result.reference }, result.message);
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const query = parsedQuery<any>(req);
    const result = await inquiries.list(
      parsePagination(query, {
        allowedSortFields: ['created_at', 'status', 'full_name'],
        defaultSortBy: 'created_at',
      }),
      { status: query.status, search: query.search, from: query.from, to: query.to },
    );
    return paginated(res, result.items, result.meta);
  }),

  getOne: asyncHandler(async (req: Request, res: Response) => {
    return ok(res, await inquiries.getById(req.params.id as UUID));
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const inquiry = await inquiries.updateStatus(
      req.params.id as UUID,
      req.body.status,
      req.body.internalNote,
      req.context,
    );
    return ok(res, inquiry, 'Enquiry updated');
  }),

  respond: asyncHandler(async (req: Request, res: Response) => {
    const inquiry = await inquiries.respond(
      req.params.id as UUID,
      req.body.message,
      req.body.markResponded,
      req.context,
    );
    return ok(res, inquiry, 'Response sent');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await inquiries.remove(req.params.id as UUID, req.context);
    return noContent(res);
  }),

  counts: asyncHandler(async (_req: Request, res: Response) => {
    return ok(res, await inquiries.statusCounts());
  }),
};

// ── Newsletter ──────────────────────────────────────────────────────────────

export const newsletterController = {
  subscribe: asyncHandler(async (req: Request, res: Response) => {
    const result = await newsletter.subscribe(req.body, req.context);
    return created(res, { subscribed: true }, result.message);
  }),

  confirm: asyncHandler(async (req: Request, res: Response) => {
    const token = (req.body?.token ?? req.query.token) as string;
    const result = await newsletter.confirm(token);
    return ok(res, { confirmed: true }, result.message);
  }),

  unsubscribe: asyncHandler(async (req: Request, res: Response) => {
    const token = (req.body?.token ?? req.query.token) as string;
    const result = await newsletter.unsubscribe(token);
    return ok(res, { unsubscribed: true }, result.message);
  }),

  listSubscribers: asyncHandler(async (req: Request, res: Response) => {
    const query = parsedQuery<any>(req);
    const result = await newsletter.listSubscribers(
      parsePagination(query, {
        allowedSortFields: ['created_at', 'email', 'status'],
        defaultSortBy: 'created_at',
      }),
      { status: query.status, search: query.search },
    );
    return paginated(res, result.items, result.meta);
  }),

  removeSubscriber: asyncHandler(async (req: Request, res: Response) => {
    await newsletter.removeSubscriber(req.params.id as UUID, req.context);
    return noContent(res);
  }),

  exportSubscribers: asyncHandler(async (_req: Request, res: Response) => {
    const csv = await newsletter.exportSubscribers();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="neoteric-subscribers-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    return res.send(csv);
  }),

  listCampaigns: asyncHandler(async (req: Request, res: Response) => {
    const query = parsedQuery<any>(req);
    const result = await newsletter.listCampaigns(
      parsePagination(query, {
        allowedSortFields: ['created_at', 'sent_at', 'subject'],
        defaultSortBy: 'created_at',
      }),
    );
    return paginated(res, result.items, result.meta);
  }),

  createCampaign: asyncHandler(async (req: Request, res: Response) => {
    return created(res, await newsletter.createCampaign(req.body, req.context), 'Campaign saved');
  }),

  getCampaign: asyncHandler(async (req: Request, res: Response) => {
    return ok(res, await newsletter.getCampaign(req.params.id as UUID));
  }),

  updateCampaign: asyncHandler(async (req: Request, res: Response) => {
    const campaign = await newsletter.updateCampaign(
      req.params.id as UUID,
      req.body,
      req.context,
    );
    return ok(res, campaign, 'Campaign updated');
  }),

  removeCampaign: asyncHandler(async (req: Request, res: Response) => {
    await newsletter.removeCampaign(req.params.id as UUID, req.context);
    return noContent(res);
  }),

  sendCampaign: asyncHandler(async (req: Request, res: Response) => {
    const result = await newsletter.sendCampaign(req.params.id as UUID, req.context);
    return ok(res, result, `Sent to ${result.sent} subscriber${result.sent === 1 ? '' : 's'}`);
  }),
};

// ── Admin users ─────────────────────────────────────────────────────────────

export const adminController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const query = parsedQuery<any>(req);
    const result = await admins.list(
      parsePagination(query, {
        allowedSortFields: ['created_at', 'email', 'full_name', 'last_login_at'],
        defaultSortBy: 'created_at',
      }),
    );
    return paginated(res, result.items, result.meta);
  }),

  getOne: asyncHandler(async (req: Request, res: Response) => {
    return ok(res, await admins.getById(req.params.id as UUID));
  }),

  /**
   * Creates an account for a colleague. Note this is an *admin* route behind
   * `requireRole('super_admin')` — it is not public registration.
   */
  invite: asyncHandler(async (req: Request, res: Response) => {
    const result = await admins.invite(req.body, req.context);
    return created(
      res,
      { user: result.user, temporaryPassword: result.temporaryPassword },
      'Account created and an invitation has been emailed',
    );
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    return ok(res, await admins.update(req.params.id as UUID, req.body, req.context), 'Updated');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await admins.remove(req.params.id as UUID, req.context);
    return noContent(res);
  }),
};

// ── Dashboard, audit, email log ─────────────────────────────────────────────

export const dashboardController = {
  /** The numbers on the dashboard landing page. */
  stats: asyncHandler(async (_req: Request, res: Response) => {
    const [counters, inquiryCounts] = await Promise.all([
      stats.dashboard(),
      inquiries.statusCounts(),
    ]);

    return ok(res, { ...counters, inquiriesByStatus: inquiryCounts });
  }),

  auditLog: asyncHandler(async (req: Request, res: Response) => {
    const query = parsedQuery<any>(req);
    const result = await audit.findMany(
      parsePagination(query, {
        allowedSortFields: ['created_at', 'action', 'entity'],
        defaultSortBy: 'created_at',
      }),
      {
        adminUserId: query.adminUserId,
        entity: query.entity,
        action: query.action,
        from: query.from,
        to: query.to,
      },
    );
    return paginated(res, result.items, result.meta);
  }),

  emailLog: asyncHandler(async (req: Request, res: Response) => {
    const query = parsedQuery<any>(req);
    const result = await emailLogs.findMany(
      parsePagination(query, {
        allowedSortFields: ['created_at', 'status', 'template'],
        defaultSortBy: 'created_at',
      }),
      { status: query.status, template: query.template },
    );
    return paginated(res, result.items, result.meta);
  }),
};

// ── The public homepage payload ─────────────────────────────────────────────

export const siteController = {
  /**
   * Everything the homepage needs, in one request.
   *
   * v1 rendered from a single hardcoded module, so one round trip is the
   * closest equivalent — it keeps the homepage from making eight calls and
   * flashing eight loading states.
   */
  homepage: asyncHandler(async (_req: Request, res: Response) => {
    const listParams = {
      page: 1,
      limit: 100,
      offset: 0,
      sortBy: 'sort_order',
      sortDirection: 'asc' as const,
    };

    const [
      settingsTree,
      practiceAreaList,
      industryList,
      teamList,
      testimonialList,
      achievementList,
      latestPublications,
    ] = await Promise.all([
      settings.publicTree(),
      practiceAreas.list(listParams, { isActive: true }),
      industries.list(listParams, { isActive: true }),
      team.list(listParams, { isActive: true }),
      testimonials.list(listParams, { isPublished: true }),
      achievements.list(listParams, { isActive: true }),
      container.services.publications.listPublic(
        { page: 1, limit: 8, offset: 0, sortBy: 'published_at', sortDirection: 'desc' },
        {},
      ),
    ]);

    return ok(res, {
      settings: settingsTree,
      practiceAreas: practiceAreaList.items,
      industries: industryList.items,
      team: teamList.items,
      testimonials: testimonialList.items,
      achievements: achievementList.items,
      publications: latestPublications.items,
    });
  }),
};
