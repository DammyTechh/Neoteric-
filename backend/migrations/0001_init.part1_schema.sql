-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  NEOTERIC LP — v2 · PART 1 of 2 · SCHEMA, RLS, VIEWS, PRIVILEGES        ║
-- ║                                                                           ║
-- ║  This is `migrations/0001_init.sql` split in two, for pasting into the     ║
-- ║  Supabase SQL editor without one very long paste. Run part 1, then 2.      ║
-- ║  The combined file is identical and is the canonical artifact — use it     ║
-- ║  with psql:  psql "$DATABASE_URL" -1 -f migrations/0001_init.sql           ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  NEOTERIC LP — v2 DATABASE                                                ║
-- ║  Single-file migration · PostgreSQL 15+ (Supabase)                        ║
-- ║                                                                           ║
-- ║  Sections                                                                 ║
-- ║    00  Extensions & conventions                                           ║
-- ║    01  Helper functions & triggers                                        ║
-- ║    02  Enumerated types                                                   ║
-- ║    03  Identity & access  (admin_users, sessions, resets)                 ║
-- ║    04  Media library                                                      ║
-- ║    05  Publications  (News & Publications)                                ║
-- ║    06  Firm content   (practice areas, industries, team, testimonials)    ║
-- ║    07  Site settings & achievements                                       ║
-- ║    08  Engagement     (contact inquiries, newsletter, campaigns)          ║
-- ║    09  Observability  (audit log, email log)                              ║
-- ║    10  Row Level Security                                                 ║
-- ║    11  Views                                                              ║
-- ║    12  Seed data — migrated verbatim from the v1 hardcoded site           ║
-- ║                                                                           ║
-- ║  No BEGIN/COMMIT: the Supabase SQL editor already runs a statement batch  ║
-- ║  inside its own transaction, and a nested COMMIT ends it early. Use       ║
-- ║  psql with a single -1 flag if you want it all-or-nothing.                ║
-- ║                                                                           ║
-- ║  Seed prose is dollar-quoted ($txt$...$txt$) rather than single-quoted,   ║
-- ║  so an apostrophe mangled in copy/paste cannot shift quote parity and     ║
-- ║  turn the rest of the file into nonsense.                                 ║
-- ║                                                                           ║
-- ║  Idempotent: safe to re-run. Does NOT create the admin account —          ║
-- ║  run `npm run db:seed:admin` for that (the password must be hashed by     ║
-- ║  the application, never stored as plaintext in a migration).              ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- ╭───────────────────────────────────────────────────────────────────────────╮
-- │ 00 · EXTENSIONS                                                           │
-- ╰───────────────────────────────────────────────────────────────────────────╯

CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- gen_random_uuid(), digest()
CREATE EXTENSION IF NOT EXISTS "unaccent";    -- slug transliteration
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- fuzzy search on titles

-- Supabase ships the `anon`, `authenticated` and `service_role` roles; a plain
-- Postgres instance (local dev, CI, a self-hosted replica) does not. Create
-- them when absent so this file runs unchanged in every environment.
--
-- `service_role` is given BYPASSRLS to match Supabase, where it is the role
-- the API connects as and authorisation is enforced in application code.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
END
$$;

-- ╭───────────────────────────────────────────────────────────────────────────╮
-- │ 01 · HELPER FUNCTIONS & TRIGGERS                                          │
-- ╰───────────────────────────────────────────────────────────────────────────╯

-- Keeps `updated_at` honest without the application having to remember.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- URL-safe slug from arbitrary text. Deterministic, accent-folding.
--   slugify('ESG & Sustainability — Nigeria')  ->  'esg-sustainability-nigeria'
CREATE OR REPLACE FUNCTION public.slugify(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT trim(both '-' from
    regexp_replace(
      regexp_replace(
        lower(public.unaccent(input)),
        '[^a-z0-9]+', '-', 'g'
      ),
      '-{2,}', '-', 'g'
    )
  );
$$;

-- Rough reading time in minutes from an HTML body (225 wpm, floor 1).
CREATE OR REPLACE FUNCTION public.reading_minutes(body text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT GREATEST(
    1,
    CEIL(
      COALESCE(
        array_length(
          regexp_split_to_array(
            trim(regexp_replace(COALESCE(body, ''), '<[^>]*>', ' ', 'g')),
            '\s+'
          ),
          1
        ),
        0
      )::numeric / 225
    )::integer
  );
$$;

-- Maintains the full-text search column on publications.
CREATE OR REPLACE FUNCTION public.publications_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector :=
      setweight(to_tsvector('english', COALESCE(NEW.title, '')),   'A')
   || setweight(to_tsvector('english', COALESCE(NEW.excerpt, '')), 'B')
   || setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'B')
   || setweight(to_tsvector('english', regexp_replace(COALESCE(NEW.body, ''), '<[^>]*>', ' ', 'g')), 'C');

  NEW.reading_minutes := public.reading_minutes(NEW.body);
  RETURN NEW;
END;
$$;

-- ╭───────────────────────────────────────────────────────────────────────────╮
-- │ 02 · ENUMERATED TYPES                                                     │
-- ╰───────────────────────────────────────────────────────────────────────────╯

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_role') THEN
    CREATE TYPE public.admin_role AS ENUM ('super_admin', 'admin', 'editor');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'publication_status') THEN
    CREATE TYPE public.publication_status AS ENUM ('draft', 'scheduled', 'published', 'archived');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'team_group') THEN
    CREATE TYPE public.team_group AS ENUM ('legal', 'non_legal');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inquiry_status') THEN
    CREATE TYPE public.inquiry_status AS ENUM ('new', 'in_review', 'responded', 'closed', 'spam');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscriber_status') THEN
    CREATE TYPE public.subscriber_status AS ENUM ('pending', 'subscribed', 'unsubscribed', 'bounced');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'campaign_status') THEN
    CREATE TYPE public.campaign_status AS ENUM ('draft', 'scheduled', 'sending', 'sent', 'failed');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_status') THEN
    CREATE TYPE public.email_status AS ENUM ('queued', 'sent', 'failed', 'skipped');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'setting_type') THEN
    CREATE TYPE public.setting_type AS ENUM ('string', 'text', 'number', 'boolean', 'json', 'image', 'url', 'email');
  END IF;
END
$$;

-- ╭───────────────────────────────────────────────────────────────────────────╮
-- │ 03 · IDENTITY & ACCESS                                                    │
-- │                                                                           │
-- │ There is no public registration. Accounts exist only because the seed     │
-- │ script created the first super-admin, or because a super-admin invited    │
-- │ a colleague from the dashboard.                                           │
-- ╰───────────────────────────────────────────────────────────────────────────╯

CREATE TABLE IF NOT EXISTS public.admin_users (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                  text        NOT NULL,
  password_hash          text        NOT NULL,
  full_name              text        NOT NULL,
  role                   public.admin_role NOT NULL DEFAULT 'admin',
  avatar_url             text,
  is_active              boolean     NOT NULL DEFAULT true,
  must_change_password   boolean     NOT NULL DEFAULT false,
  last_login_at          timestamptz,
  last_login_ip          text,
  failed_login_attempts  smallint    NOT NULL DEFAULT 0,
  locked_until           timestamptz,
  password_changed_at    timestamptz NOT NULL DEFAULT now(),
  created_by             uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT admin_users_email_format CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

-- Case-insensitive uniqueness without depending on the `citext` extension,
-- which is not enabled on every Supabase project.
CREATE UNIQUE INDEX IF NOT EXISTS admin_users_email_lower_key
  ON public.admin_users (lower(email));
CREATE INDEX IF NOT EXISTS admin_users_role_idx   ON public.admin_users (role);
CREATE INDEX IF NOT EXISTS admin_users_active_idx ON public.admin_users (is_active) WHERE is_active;

DROP TRIGGER IF EXISTS trg_admin_users_updated_at ON public.admin_users;
CREATE TRIGGER trg_admin_users_updated_at
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE  public.admin_users IS 'Dashboard operators. Seeded + invite-only; no self-registration.';
COMMENT ON COLUMN public.admin_users.email IS 'Login identifier. Unique case-insensitively via admin_users_email_lower_key.';

-- Refresh-token rotation. One row per issued refresh token; the raw token is
-- never stored, only a SHA-256 hash.
CREATE TABLE IF NOT EXISTS public.refresh_tokens (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id  uuid        NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  token_hash     text        NOT NULL UNIQUE,
  expires_at     timestamptz NOT NULL,
  revoked_at     timestamptz,
  replaced_by    uuid REFERENCES public.refresh_tokens(id) ON DELETE SET NULL,
  user_agent     text,
  ip_address     text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx    ON public.refresh_tokens (admin_user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_expires_idx ON public.refresh_tokens (expires_at);

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id  uuid        NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  token_hash     text        NOT NULL UNIQUE,
  expires_at     timestamptz NOT NULL,
  used_at        timestamptz,
  requested_ip   text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx ON public.password_reset_tokens (admin_user_id);

-- ╭───────────────────────────────────────────────────────────────────────────╮
-- │ 04 · MEDIA LIBRARY                                                        │
-- │ Backed by Supabase Storage. Rows are the catalogue; bytes live in the     │
-- │ bucket named by SUPABASE_STORAGE_BUCKET.                                  │
-- ╰───────────────────────────────────────────────────────────────────────────╯

CREATE TABLE IF NOT EXISTS public.media_assets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket         text        NOT NULL,
  storage_path   text        NOT NULL,
  public_url     text        NOT NULL,
  original_name  text        NOT NULL,
  mime_type      text        NOT NULL,
  size_bytes     bigint      NOT NULL CHECK (size_bytes >= 0),
  width          integer,
  height         integer,
  alt_text       text,
  caption        text,
  folder         text        NOT NULL DEFAULT 'general',
  checksum       text,
  uploaded_by    uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  UNIQUE (bucket, storage_path)
);

CREATE INDEX IF NOT EXISTS media_assets_folder_idx  ON public.media_assets (folder);
CREATE INDEX IF NOT EXISTS media_assets_mime_idx    ON public.media_assets (mime_type);
CREATE INDEX IF NOT EXISTS media_assets_created_idx ON public.media_assets (created_at DESC);

DROP TRIGGER IF EXISTS trg_media_assets_updated_at ON public.media_assets;
CREATE TRIGGER trg_media_assets_updated_at
  BEFORE UPDATE ON public.media_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ╭───────────────────────────────────────────────────────────────────────────╮
-- │ 05 · PUBLICATIONS  ("News & Publications")                                │
-- │                                                                           │
-- │ v1 linked each item straight out to Google Drive. v2 keeps `source_url`   │
-- │ so nothing is lost, but the canonical read is now `body` rendered on      │
-- │ our own article page, with `cover_image_url` driving the index thumbnail. │
-- ╰───────────────────────────────────────────────────────────────────────────╯

CREATE TABLE IF NOT EXISTS public.publication_categories (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL UNIQUE,
  slug         text        NOT NULL UNIQUE,
  description  text,
  colour       text,
  sort_order   integer     NOT NULL DEFAULT 0,
  is_active    boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_publication_categories_updated_at ON public.publication_categories;
CREATE TRIGGER trg_publication_categories_updated_at
  BEFORE UPDATE ON public.publication_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.publications (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title            text        NOT NULL,
  slug             text        NOT NULL UNIQUE,
  excerpt          text,
  body             text,
  category_id      uuid REFERENCES public.publication_categories(id) ON DELETE SET NULL,

  -- Thumbnail shown on the News & Publications index.
  cover_image_id   uuid REFERENCES public.media_assets(id) ON DELETE SET NULL,
  cover_image_url  text,
  cover_alt        text,

  -- Preserved from v1: the original Drive / Docs link.
  source_url       text,

  status           public.publication_status NOT NULL DEFAULT 'draft',
  is_featured      boolean     NOT NULL DEFAULT false,
  author_name      text        NOT NULL DEFAULT 'Neoteric LP',
  tags             text[]      NOT NULL DEFAULT '{}',

  reading_minutes  integer     NOT NULL DEFAULT 1,
  view_count       bigint      NOT NULL DEFAULT 0,

  seo_title        text,
  seo_description  text,
  og_image_url     text,

  published_at     timestamptz,
  scheduled_for    timestamptz,

  created_by       uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  updated_by       uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  search_vector    tsvector,

  -- A published row must carry a publish date; a scheduled row must carry a
  -- future target. Keeps the index query honest.
  CONSTRAINT publications_published_has_date
    CHECK (status <> 'published' OR published_at IS NOT NULL),
  CONSTRAINT publications_scheduled_has_target
    CHECK (status <> 'scheduled' OR scheduled_for IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS publications_status_idx       ON public.publications (status);
CREATE INDEX IF NOT EXISTS publications_published_at_idx ON public.publications (published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS publications_category_idx     ON public.publications (category_id);
CREATE INDEX IF NOT EXISTS publications_featured_idx     ON public.publications (is_featured) WHERE is_featured;
CREATE INDEX IF NOT EXISTS publications_tags_idx         ON public.publications USING gin (tags);
CREATE INDEX IF NOT EXISTS publications_search_idx       ON public.publications USING gin (search_vector);
CREATE INDEX IF NOT EXISTS publications_title_trgm_idx   ON public.publications USING gin (title gin_trgm_ops);

-- Feed query: published, newest first.
CREATE INDEX IF NOT EXISTS publications_feed_idx
  ON public.publications (published_at DESC)
  WHERE status = 'published';

DROP TRIGGER IF EXISTS trg_publications_search ON public.publications;
CREATE TRIGGER trg_publications_search
  BEFORE INSERT OR UPDATE OF title, excerpt, body, tags ON public.publications
  FOR EACH ROW EXECUTE FUNCTION public.publications_search_vector();

DROP TRIGGER IF EXISTS trg_publications_updated_at ON public.publications;
CREATE TRIGGER trg_publications_updated_at
  BEFORE UPDATE ON public.publications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON COLUMN public.publications.source_url IS
  'Legacy Google Drive/Docs link carried over from v1. Optional once `body` is filled in.';
COMMENT ON COLUMN public.publications.cover_image_url IS
  'Thumbnail for the News & Publications index grid.';

-- Downloadable files attached to an article (the signed PDF, exhibits, etc.)
CREATE TABLE IF NOT EXISTS public.publication_attachments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id  uuid        NOT NULL REFERENCES public.publications(id) ON DELETE CASCADE,
  media_id        uuid        NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
  label           text,
  sort_order      integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (publication_id, media_id)
);

CREATE INDEX IF NOT EXISTS publication_attachments_pub_idx
  ON public.publication_attachments (publication_id, sort_order);

-- One row per article view, aggregated by day — keeps `view_count` cheap while
-- still allowing a trend chart in the dashboard.
CREATE TABLE IF NOT EXISTS public.publication_views (
  publication_id  uuid        NOT NULL REFERENCES public.publications(id) ON DELETE CASCADE,
  viewed_on       date        NOT NULL DEFAULT CURRENT_DATE,
  views           bigint      NOT NULL DEFAULT 0,

  PRIMARY KEY (publication_id, viewed_on)
);

-- Atomic view counter. Two readers landing on the same article at the same
-- moment would otherwise lose a count to a read-modify-write race, so the
-- increment happens inside the database rather than in application code.
CREATE OR REPLACE FUNCTION public.increment_publication_view(p_publication_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.publications
     SET view_count = view_count + 1
   WHERE id = p_publication_id;

  INSERT INTO public.publication_views (publication_id, viewed_on, views)
  VALUES (p_publication_id, CURRENT_DATE, 1)
  ON CONFLICT (publication_id, viewed_on)
  DO UPDATE SET views = public.publication_views.views + 1;
END;
$$;

-- ╭───────────────────────────────────────────────────────────────────────────╮
-- │ 06 · FIRM CONTENT                                                         │
-- ╰───────────────────────────────────────────────────────────────────────────╯

CREATE TABLE IF NOT EXISTS public.practice_areas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL UNIQUE,
  slug         text        NOT NULL UNIQUE,
  summary      text,
  description  text,
  image_id     uuid REFERENCES public.media_assets(id) ON DELETE SET NULL,
  image_url    text,
  icon         text,
  sort_order   integer     NOT NULL DEFAULT 0,
  is_active    boolean     NOT NULL DEFAULT true,
  seo_title        text,
  seo_description  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS practice_areas_sort_idx ON public.practice_areas (sort_order, name);

DROP TRIGGER IF EXISTS trg_practice_areas_updated_at ON public.practice_areas;
CREATE TRIGGER trg_practice_areas_updated_at
  BEFORE UPDATE ON public.practice_areas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.industries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL UNIQUE,
  slug         text        NOT NULL UNIQUE,
  description  text,
  image_id     uuid REFERENCES public.media_assets(id) ON DELETE SET NULL,
  image_url    text,
  icon         text,
  sort_order   integer     NOT NULL DEFAULT 0,
  is_active    boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS industries_sort_idx ON public.industries (sort_order, name);

DROP TRIGGER IF EXISTS trg_industries_updated_at ON public.industries;
CREATE TRIGGER trg_industries_updated_at
  BEFORE UPDATE ON public.industries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.team_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     text        NOT NULL,
  slug          text        NOT NULL UNIQUE,
  role_title    text        NOT NULL,
  team_group    public.team_group NOT NULL DEFAULT 'legal',
  bio           text,
  qualifications text[]     NOT NULL DEFAULT '{}',
  image_id      uuid REFERENCES public.media_assets(id) ON DELETE SET NULL,
  image_url     text,
  email         text,
  phone         text,
  linkedin_url  text,
  twitter_url   text,
  sort_order    integer     NOT NULL DEFAULT 0,
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS team_members_sort_idx  ON public.team_members (team_group, sort_order);
CREATE INDEX IF NOT EXISTS team_members_active_idx ON public.team_members (is_active) WHERE is_active;

DROP TRIGGER IF EXISTS trg_team_members_updated_at ON public.team_members;
CREATE TRIGGER trg_team_members_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.testimonials (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote              text        NOT NULL,
  author_name        text        NOT NULL,
  author_role        text,
  author_company     text,
  author_image_id    uuid REFERENCES public.media_assets(id) ON DELETE SET NULL,
  author_image_url   text,
  rating             smallint CHECK (rating BETWEEN 1 AND 5),
  is_published       boolean     NOT NULL DEFAULT false,
  sort_order         integer     NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS testimonials_published_idx
  ON public.testimonials (sort_order) WHERE is_published;

DROP TRIGGER IF EXISTS trg_testimonials_updated_at ON public.testimonials;
CREATE TRIGGER trg_testimonials_updated_at
  BEFORE UPDATE ON public.testimonials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ╭───────────────────────────────────────────────────────────────────────────╮
-- │ 07 · SITE SETTINGS & ACHIEVEMENTS                                         │
-- ╰───────────────────────────────────────────────────────────────────────────╯

CREATE TABLE IF NOT EXISTS public.achievements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- UNIQUE is load-bearing, not decoration: the seed in part 2 relies on it
  -- to make re-running these files a no-op. Without it `ON CONFLICT DO
  -- NOTHING` has no constraint to detect a conflict against, so every re-run
  -- appends another four rows and the homepage band repeats itself.
  label        text        NOT NULL UNIQUE,
  value        text        NOT NULL,
  suffix       text,
  description  text,
  icon         text,
  sort_order   integer     NOT NULL DEFAULT 0,
  is_active    boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_achievements_updated_at ON public.achievements;
CREATE TRIGGER trg_achievements_updated_at
  BEFORE UPDATE ON public.achievements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Everything that used to be a magic string in the React tree: hero copy,
-- vision, mission, address, phone, socials, SEO defaults.
CREATE TABLE IF NOT EXISTS public.site_settings (
  key           text PRIMARY KEY,
  value         jsonb       NOT NULL DEFAULT 'null'::jsonb,
  value_type    public.setting_type NOT NULL DEFAULT 'string',
  group_name    text        NOT NULL DEFAULT 'general',
  label         text        NOT NULL,
  description   text,
  is_public     boolean     NOT NULL DEFAULT true,
  sort_order    integer     NOT NULL DEFAULT 0,
  updated_by    uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS site_settings_group_idx ON public.site_settings (group_name, sort_order);

DROP TRIGGER IF EXISTS trg_site_settings_updated_at ON public.site_settings;
CREATE TRIGGER trg_site_settings_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON COLUMN public.site_settings.is_public IS
  'Public settings are served unauthenticated at GET /settings; private ones only to admins.';

-- ╭───────────────────────────────────────────────────────────────────────────╮
-- │ 08 · ENGAGEMENT                                                           │
-- ╰───────────────────────────────────────────────────────────────────────────╯

CREATE TABLE IF NOT EXISTS public.contact_inquiries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference         text        NOT NULL UNIQUE,
  full_name         text        NOT NULL,
  email             text        NOT NULL,
  phone             text,
  company           text,
  subject           text,
  message           text        NOT NULL,
  practice_area_id  uuid REFERENCES public.practice_areas(id) ON DELETE SET NULL,
  status            public.inquiry_status NOT NULL DEFAULT 'new',
  internal_note     text,
  responded_at      timestamptz,
  responded_by      uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  source            text        NOT NULL DEFAULT 'website',
  ip_address        text,
  user_agent        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT contact_inquiries_email_format CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

CREATE INDEX IF NOT EXISTS contact_inquiries_status_idx  ON public.contact_inquiries (status, created_at DESC);
CREATE INDEX IF NOT EXISTS contact_inquiries_created_idx ON public.contact_inquiries (created_at DESC);
CREATE INDEX IF NOT EXISTS contact_inquiries_email_idx   ON public.contact_inquiries (lower(email));

DROP TRIGGER IF EXISTS trg_contact_inquiries_updated_at ON public.contact_inquiries;
CREATE TRIGGER trg_contact_inquiries_updated_at
  BEFORE UPDATE ON public.contact_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Human-friendly reference: NLP-2026-0007
CREATE OR REPLACE FUNCTION public.next_inquiry_reference()
RETURNS text
LANGUAGE sql
VOLATILE
AS $$
  SELECT 'NLP-' || to_char(now(), 'YYYY') || '-' ||
         lpad((
           SELECT (count(*) + 1)::text
           FROM public.contact_inquiries
           WHERE date_part('year', created_at) = date_part('year', now())
         ), 4, '0');
$$;

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email               text        NOT NULL,
  full_name           text,
  status              public.subscriber_status NOT NULL DEFAULT 'pending',
  confirm_token_hash  text,
  unsubscribe_token   text        NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  confirmed_at        timestamptz,
  unsubscribed_at     timestamptz,
  bounce_count        smallint    NOT NULL DEFAULT 0,
  source              text        NOT NULL DEFAULT 'website',
  ip_address          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT newsletter_subscribers_email_format CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscribers_email_key
  ON public.newsletter_subscribers (lower(email));
CREATE INDEX IF NOT EXISTS newsletter_subscribers_status_idx
  ON public.newsletter_subscribers (status);

DROP TRIGGER IF EXISTS trg_newsletter_subscribers_updated_at ON public.newsletter_subscribers;
CREATE TRIGGER trg_newsletter_subscribers_updated_at
  BEFORE UPDATE ON public.newsletter_subscribers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.newsletter_campaigns (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject          text        NOT NULL,
  preheader        text,
  body             text,
  publication_id   uuid REFERENCES public.publications(id) ON DELETE SET NULL,
  status           public.campaign_status NOT NULL DEFAULT 'draft',
  scheduled_for    timestamptz,
  sent_at          timestamptz,
  recipient_count  integer     NOT NULL DEFAULT 0,
  delivered_count  integer     NOT NULL DEFAULT 0,
  failed_count     integer     NOT NULL DEFAULT 0,
  error_message    text,
  created_by       uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS newsletter_campaigns_status_idx ON public.newsletter_campaigns (status, created_at DESC);

DROP TRIGGER IF EXISTS trg_newsletter_campaigns_updated_at ON public.newsletter_campaigns;
CREATE TRIGGER trg_newsletter_campaigns_updated_at
  BEFORE UPDATE ON public.newsletter_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ╭───────────────────────────────────────────────────────────────────────────╮
-- │ 09 · OBSERVABILITY                                                        │
-- ╰───────────────────────────────────────────────────────────────────────────╯

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id  uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  actor_email    text,
  action         text        NOT NULL,
  entity         text        NOT NULL,
  entity_id      text,
  before_state   jsonb,
  after_state    jsonb,
  ip_address     text,
  user_agent     text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_actor_idx   ON public.audit_logs (admin_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx  ON public.audit_logs (entity, entity_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON public.audit_logs (created_at DESC);

CREATE TABLE IF NOT EXISTS public.email_logs (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email             text        NOT NULL,
  cc_emails            text[],
  template             text        NOT NULL,
  subject              text        NOT NULL,
  status               public.email_status NOT NULL DEFAULT 'queued',
  provider_message_id  text,
  error_message        text,
  metadata             jsonb       NOT NULL DEFAULT '{}'::jsonb,
  sent_at              timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_logs_status_idx   ON public.email_logs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS email_logs_template_idx ON public.email_logs (template);
CREATE INDEX IF NOT EXISTS email_logs_to_idx       ON public.email_logs (lower(to_email));

-- ╭───────────────────────────────────────────────────────────────────────────╮
-- │ 10 · ROW LEVEL SECURITY                                                   │
-- │                                                                           │
-- │ The API talks to Postgres with the service-role key, which bypasses RLS   │
-- │ entirely — authorisation is enforced in the application layer. RLS is     │
-- │ still switched on so that a leaked anon key cannot read private tables,   │
-- │ and so published content stays readable if you ever query direct from     │
-- │ the browser.                                                              │
-- ╰───────────────────────────────────────────────────────────────────────────╯

ALTER TABLE public.admin_users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refresh_tokens          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publication_categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publications            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publication_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publication_views       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_areas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.industries              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_inquiries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_campaigns    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs              ENABLE ROW LEVEL SECURITY;

-- Anonymous read access, limited to content the firm has chosen to publish.
DROP POLICY IF EXISTS "public reads published publications" ON public.publications;
CREATE POLICY "public reads published publications"
  ON public.publications FOR SELECT TO anon, authenticated
  USING (status = 'published' AND published_at <= now());

DROP POLICY IF EXISTS "public reads categories" ON public.publication_categories;
CREATE POLICY "public reads categories"
  ON public.publication_categories FOR SELECT TO anon, authenticated
  USING (is_active);

DROP POLICY IF EXISTS "public reads practice areas" ON public.practice_areas;
CREATE POLICY "public reads practice areas"
  ON public.practice_areas FOR SELECT TO anon, authenticated
  USING (is_active);

DROP POLICY IF EXISTS "public reads industries" ON public.industries;
CREATE POLICY "public reads industries"
  ON public.industries FOR SELECT TO anon, authenticated
  USING (is_active);

DROP POLICY IF EXISTS "public reads team" ON public.team_members;
CREATE POLICY "public reads team"
  ON public.team_members FOR SELECT TO anon, authenticated
  USING (is_active);

DROP POLICY IF EXISTS "public reads testimonials" ON public.testimonials;
CREATE POLICY "public reads testimonials"
  ON public.testimonials FOR SELECT TO anon, authenticated
  USING (is_published);

DROP POLICY IF EXISTS "public reads achievements" ON public.achievements;
CREATE POLICY "public reads achievements"
  ON public.achievements FOR SELECT TO anon, authenticated
  USING (is_active);

DROP POLICY IF EXISTS "public reads public settings" ON public.site_settings;
CREATE POLICY "public reads public settings"
  ON public.site_settings FOR SELECT TO anon, authenticated
  USING (is_public);

DROP POLICY IF EXISTS "public reads media" ON public.media_assets;
CREATE POLICY "public reads media"
  ON public.media_assets FOR SELECT TO anon, authenticated
  USING (true);

-- Everything else: no anon policy at all, therefore no anon access.

-- ╭───────────────────────────────────────────────────────────────────────────╮
-- │ 11 · VIEWS                                                                │
-- ╰───────────────────────────────────────────────────────────────────────────╯

-- The News & Publications index, pre-joined and ready to serve.
CREATE OR REPLACE VIEW public.v_published_publications AS
SELECT
  p.id,
  p.title,
  p.slug,
  p.excerpt,
  p.cover_image_url,
  p.cover_alt,
  p.source_url,
  p.author_name,
  p.tags,
  p.reading_minutes,
  p.view_count,
  p.is_featured,
  p.published_at,
  p.seo_title,
  p.seo_description,
  p.og_image_url,
  c.id   AS category_id,
  c.name AS category_name,
  c.slug AS category_slug,
  c.colour AS category_colour
FROM public.publications p
LEFT JOIN public.publication_categories c ON c.id = p.category_id
WHERE p.status = 'published'
  AND p.published_at <= now();

-- Dashboard counters in a single round trip.
CREATE OR REPLACE VIEW public.v_dashboard_stats AS
SELECT
  (SELECT count(*) FROM public.publications)                                      AS publications_total,
  (SELECT count(*) FROM public.publications WHERE status = 'published')           AS publications_published,
  (SELECT count(*) FROM public.publications WHERE status = 'draft')               AS publications_draft,
  (SELECT count(*) FROM public.publications WHERE status = 'scheduled')           AS publications_scheduled,
  (SELECT COALESCE(sum(view_count), 0) FROM public.publications)                  AS publications_views,
  (SELECT count(*) FROM public.contact_inquiries WHERE status = 'new')            AS inquiries_new,
  (SELECT count(*) FROM public.contact_inquiries)                                 AS inquiries_total,
  (SELECT count(*) FROM public.newsletter_subscribers WHERE status = 'subscribed') AS subscribers_active,
  (SELECT count(*) FROM public.team_members WHERE is_active)                      AS team_active,
  (SELECT count(*) FROM public.practice_areas WHERE is_active)                    AS practice_areas_active,
  (SELECT count(*) FROM public.industries WHERE is_active)                        AS industries_active,
  (SELECT count(*) FROM public.testimonials WHERE is_published)                   AS testimonials_published,
  (SELECT count(*) FROM public.media_assets)                                      AS media_total;

-- ╭───────────────────────────────────────────────────────────────────────────╮
-- │ 11b · PRIVILEGES                                                          │
-- │                                                                           │
-- │ RLS decides which *rows* a role may see. GRANT decides whether it may     │
-- │ touch the *table* at all, and the two are independent — `service_role`    │
-- │ carries BYPASSRLS on Supabase, so it is exempt from every policy above    │
-- │ and still gets "permission denied for table ..." without these grants.    │
-- │                                                                           │
-- │ Supabase sets default privileges for tables created through its own       │
-- │ tooling, but a migration run straight against the database does not       │
-- │ inherit them, so the grants are made explicitly here.                     │
-- ╰───────────────────────────────────────────────────────────────────────────╯

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- ── The API ─────────────────────────────────────────────────────────────────
-- Connects as `service_role` and needs full access to everything; it is the
-- trusted backend, and authorisation lives in `requireAuth` / `requireRole`.
GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE          ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- ── Anonymous and signed-in browsers ────────────────────────────────────────
-- Read-only, and only on the tables that carry an anon SELECT policy. The
-- policies narrow this to published content; the grants make sure a leaked
-- anon key cannot even name the private tables.
--
-- Deliberately NOT granted: admin_users, refresh_tokens,
-- password_reset_tokens, contact_inquiries, newsletter_subscribers,
-- newsletter_campaigns, audit_logs, email_logs, publication_views.
GRANT SELECT ON TABLE
  public.publications,
  public.publication_categories,
  public.publication_attachments,
  public.practice_areas,
  public.industries,
  public.team_members,
  public.testimonials,
  public.achievements,
  public.site_settings,
  public.media_assets
TO anon, authenticated;

GRANT SELECT ON public.v_published_publications TO anon, authenticated;
GRANT SELECT ON public.v_dashboard_stats        TO service_role;

-- The public article page bumps the view counter through this RPC.
GRANT EXECUTE ON FUNCTION public.increment_publication_view(uuid)
  TO anon, authenticated, service_role;

-- ── Anything added later ────────────────────────────────────────────────────
-- So a future table does not reintroduce the same failure. New tables reach
-- `service_role` automatically; anon stays opt-in, one GRANT at a time.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO service_role;

