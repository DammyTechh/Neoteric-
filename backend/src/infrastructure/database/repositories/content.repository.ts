import { BaseRepository, type QueryBuilder } from './base.repository';
import { supabase, translateDatabaseError } from '@infrastructure/database/supabase.client';
import {
  toAchievement,
  toIndustry,
  toPracticeArea,
  toPublicationCategory,
  toTeamMember,
  toTestimonial,
} from '@infrastructure/database/mappers';
import type {
  Achievement,
  Industry,
  PracticeArea,
  PublicationCategory,
  TeamMember,
  Testimonial,
} from '@domain/entities';
import type {
  ActiveFilter,
  IAchievementRepository,
  IIndustryRepository,
  IPracticeAreaRepository,
  IPublicationCategoryRepository,
  ITeamRepository,
  ITestimonialRepository,
  TeamFilters,
  TestimonialFilters,
} from '@domain/repositories';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * The firm's editorial content: practice areas, industries, the team page,
 * testimonials, the achievement counters and publication categories.
 *
 * All six behave the same way — an ordered, toggleable list — so they share
 * `BaseRepository` and add only their column map.
 */

// ── Practice areas ──────────────────────────────────────────────────────────

const PRACTICE_AREA_COLUMNS = {
  name: 'name',
  slug: 'slug',
  summary: 'summary',
  description: 'description',
  imageId: 'image_id',
  imageUrl: 'image_url',
  icon: 'icon',
  sortOrder: 'sort_order',
  isActive: 'is_active',
  seoTitle: 'seo_title',
  seoDescription: 'seo_description',
};

export class PracticeAreaRepository
  extends BaseRepository<PracticeArea, ActiveFilter>
  implements IPracticeAreaRepository
{
  constructor() {
    super({
      table: 'practice_areas',
      resource: 'Practice area',
      mapper: toPracticeArea,
      columnMap: PRACTICE_AREA_COLUMNS,
      sortColumn: 'sort_order',
    });
  }

  protected override applyFilters(query: QueryBuilder, filters?: ActiveFilter): QueryBuilder {
    let next = query;
    if (filters?.isActive !== undefined) next = next.eq('is_active', filters.isActive);
    if (filters?.search) next = this.searchAcross(next, filters.search, ['name', 'description']);
    return next;
  }
}

// ── Industries ──────────────────────────────────────────────────────────────

const INDUSTRY_COLUMNS = {
  name: 'name',
  slug: 'slug',
  description: 'description',
  imageId: 'image_id',
  imageUrl: 'image_url',
  icon: 'icon',
  sortOrder: 'sort_order',
  isActive: 'is_active',
};

export class IndustryRepository
  extends BaseRepository<Industry, ActiveFilter>
  implements IIndustryRepository
{
  constructor() {
    super({
      table: 'industries',
      resource: 'Industry',
      mapper: toIndustry,
      columnMap: INDUSTRY_COLUMNS,
      sortColumn: 'sort_order',
    });
  }

  protected override applyFilters(query: QueryBuilder, filters?: ActiveFilter): QueryBuilder {
    let next = query;
    if (filters?.isActive !== undefined) next = next.eq('is_active', filters.isActive);
    if (filters?.search) next = this.searchAcross(next, filters.search, ['name', 'description']);
    return next;
  }
}

// ── Team ────────────────────────────────────────────────────────────────────

const TEAM_COLUMNS = {
  fullName: 'full_name',
  slug: 'slug',
  roleTitle: 'role_title',
  teamGroup: 'team_group',
  bio: 'bio',
  qualifications: 'qualifications',
  imageId: 'image_id',
  imageUrl: 'image_url',
  email: 'email',
  phone: 'phone',
  linkedinUrl: 'linkedin_url',
  twitterUrl: 'twitter_url',
  sortOrder: 'sort_order',
  isActive: 'is_active',
};

export class TeamRepository
  extends BaseRepository<TeamMember, TeamFilters>
  implements ITeamRepository
{
  constructor() {
    super({
      table: 'team_members',
      resource: 'Team member',
      mapper: toTeamMember,
      columnMap: TEAM_COLUMNS,
      sortColumn: 'sort_order',
    });
  }

  protected override applyFilters(query: QueryBuilder, filters?: TeamFilters): QueryBuilder {
    let next = query;
    if (filters?.isActive !== undefined) next = next.eq('is_active', filters.isActive);
    if (filters?.teamGroup) next = next.eq('team_group', filters.teamGroup);
    if (filters?.search) next = this.searchAcross(next, filters.search, ['full_name', 'role_title']);
    return next;
  }
}

// ── Testimonials ────────────────────────────────────────────────────────────

const TESTIMONIAL_COLUMNS = {
  quote: 'quote',
  authorName: 'author_name',
  authorRole: 'author_role',
  authorCompany: 'author_company',
  authorImageId: 'author_image_id',
  authorImageUrl: 'author_image_url',
  rating: 'rating',
  isPublished: 'is_published',
  sortOrder: 'sort_order',
};

export class TestimonialRepository
  extends BaseRepository<Testimonial, TestimonialFilters>
  implements ITestimonialRepository
{
  constructor() {
    super({
      table: 'testimonials',
      resource: 'Testimonial',
      mapper: toTestimonial,
      columnMap: TESTIMONIAL_COLUMNS,
      sortColumn: 'sort_order',
    });
  }

  protected override applyFilters(query: QueryBuilder, filters?: TestimonialFilters): QueryBuilder {
    let next = query;
    if (filters?.isPublished !== undefined) next = next.eq('is_published', filters.isPublished);
    if (filters?.search) next = this.searchAcross(next, filters.search, ['author_name', 'quote']);
    return next;
  }
}

// ── Achievements ────────────────────────────────────────────────────────────

const ACHIEVEMENT_COLUMNS = {
  label: 'label',
  value: 'value',
  suffix: 'suffix',
  description: 'description',
  icon: 'icon',
  sortOrder: 'sort_order',
  isActive: 'is_active',
};

export class AchievementRepository
  extends BaseRepository<Achievement, ActiveFilter>
  implements IAchievementRepository
{
  constructor() {
    super({
      table: 'achievements',
      resource: 'Achievement',
      mapper: toAchievement,
      columnMap: ACHIEVEMENT_COLUMNS,
      sortColumn: 'sort_order',
    });
  }

  protected override applyFilters(query: QueryBuilder, filters?: ActiveFilter): QueryBuilder {
    let next = query;
    if (filters?.isActive !== undefined) next = next.eq('is_active', filters.isActive);
    if (filters?.search) next = this.searchAcross(next, filters.search, ['label', 'description']);
    return next;
  }
}

// ── Publication categories ──────────────────────────────────────────────────

const CATEGORY_COLUMNS = {
  name: 'name',
  slug: 'slug',
  description: 'description',
  colour: 'colour',
  sortOrder: 'sort_order',
  isActive: 'is_active',
};

export class PublicationCategoryRepository
  extends BaseRepository<PublicationCategory, ActiveFilter>
  implements IPublicationCategoryRepository
{
  constructor() {
    super({
      table: 'publication_categories',
      resource: 'Category',
      mapper: toPublicationCategory,
      columnMap: CATEGORY_COLUMNS,
      sortColumn: 'sort_order',
    });
  }

  protected override applyFilters(query: QueryBuilder, filters?: ActiveFilter): QueryBuilder {
    let next = query;
    if (filters?.isActive !== undefined) next = next.eq('is_active', filters.isActive);
    if (filters?.search) next = this.searchAcross(next, filters.search, ['name', 'description']);
    return next;
  }

  /**
   * Categories with the number of published articles in each — the counts the
   * filter rail on the News & Publications page shows.
   */
  async withCounts(): Promise<(PublicationCategory & { publicationCount: number })[]> {
    const { data, error } = await supabase
      .from('publication_categories')
      .select('*, publications(count)')
      .eq('is_active', true)
      .eq('publications.status', 'published')
      .order('sort_order', { ascending: true });

    if (error) throw translateDatabaseError(error, 'list categories with counts');

    return (data ?? []).map((row: any) => ({
      ...toPublicationCategory(row),
      publicationCount: Number(row.publications?.[0]?.count ?? 0),
    }));
  }
}
