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
  label        text        NOT NULL,
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

-- ╭───────────────────────────────────────────────────────────────────────────╮
-- │ 12 · SEED DATA                                                            │
-- │ Lifted from v1 `src/assets/data/index.ts` so v2 boots with the real site. │
-- │ All inserts are ON CONFLICT DO NOTHING — re-running changes nothing.      │
-- ╰───────────────────────────────────────────────────────────────────────────╯

-- ── Publication categories ───────────────────────────────────────────────────
INSERT INTO public.publication_categories (name, slug, description, colour, sort_order) VALUES
  ('Corporate & Commercial', 'corporate-commercial', $txt$Company law, CAC compliance, governance and M&A.$txt$, '#255859', 1),
  ('Technology & Data',      'technology-data',      $txt$AI governance, fintech regulation, data protection.$txt$, '#2d7374', 2),
  ('Property & Real Estate', 'property-real-estate', $txt$Land title, due diligence and conveyancing.$txt$,        '#c19766', 3),
  ('Dispute Resolution',     'dispute-resolution',   $txt$Litigation, arbitration and procedure.$txt$,             '#ab7947', 4),
  ('Public & Political Law', 'public-political-law', $txt$Elections, security policy and constitutional law.$txt$, '#3a9291', 5),
  ('Intellectual Property',  'intellectual-property',$txt$Trademarks, copyright and the creative economy.$txt$,    '#935f3b', 6),
  ('Employment & HR',        'employment-hr',        $txt$Hiring, remote teams and workplace compliance.$txt$,     '#54adab', 7),
  ('Family Law',             'family-law',           $txt$Marriage, dissolution and personal status.$txt$,         '#764832', 8),
  ('ESG & Sustainability',   'esg-sustainability',   $txt$Reporting obligations and sustainability compliance.$txt$,'#7fc9c5', 9),
  ('Firm News',              'firm-news',            $txt$Announcements and updates from Neoteric LP.$txt$,        '#255859', 10)
ON CONFLICT (slug) DO NOTHING;

-- ── Practice areas (13, order preserved from v1) ─────────────────────────────
INSERT INTO public.practice_areas (name, slug, image_url, sort_order)
SELECT d.name, public.slugify(d.name), d.image_url, d.ord
FROM (VALUES
  ($txt$Corporate and Commercial Law$txt$, $txt$/images/industries/commercial.jpeg$txt$,   1),
  ('Entertainment Law',            $txt$/images/industries/media.jpg$txt$,         2),
  ('Legal Consulting',             $txt$/images/industries/consulting.jpeg$txt$,   3),
  ('Property Law',                 $txt$/images/industries/property2.jpeg$txt$,    4),
  ('Energy, Oil and Gas Law',      $txt$/images/industries/oilandgas.jpg$txt$,     5),
  ('Space Law',                    $txt$/images/industries/space.jpg$txt$,         6),
  ('Technology Law',               $txt$/images/industries/tech2.jpeg$txt$,        7),
  ('Sports Law',                   $txt$/images/industries/sports2.jpeg$txt$,      8),
  ('Maritime Law',                 $txt$/images/industries/marine2.jpeg$txt$,      9),
  ('Public and Political Law',     $txt$/images/industries/politics.jpg$txt$,     10),
  ('Dispute Resolution',           $txt$/images/industries/Dispute.jpeg$txt$,     11),
  ('Mergers and Acquisitions',     $txt$/images/industries/merger2.jpeg$txt$,     12),
  ('Medical Law',                  $txt$/images/industries/medical.jpg$txt$,      13)
) AS d(name, image_url, ord)
ON CONFLICT (name) DO NOTHING;

-- ── Industries (11) ──────────────────────────────────────────────────────────
INSERT INTO public.industries (name, slug, description, image_url, sort_order)
SELECT d.name, public.slugify(d.name), d.description, d.image_url, d.ord
FROM (VALUES
  ('Finance',
   $txt$We perform a multifaceted role in finance and banking; ensuring compliance with applicable laws and legislations, observing due diligence, assisting in documentation processes, and resolving financial disputes.$txt$,
   '/images/finance-bg.jpg', 1),
  ('Energy, Oil & Gas',
   $txt$We provide expert legal guidance to oil and gas startups, companies, and government entities; acquiring licenses and permits and adhering to regulatory compliances.$txt$,
   $txt$/images/industries/oilandgas2.jpg$txt$, 2),
  ('Tech startups',
   $txt$Our expertise in the tech industry includes providing advisory solutions and legal services to tech startups, ensuring data protection and compliance with various tech laws and regulations.$txt$,
   $txt$/images/industries/tech2.jpeg$txt$, 3),
  ('Media & Entertainment',
   $txt$We perform vital roles in the entertainment industry; representing artists, unions, entertainment companies and assisting in media management.$txt$,
   $txt$/images/industries/media2.jpeg$txt$, 4),
  ('Infrastructure',
   $txt$Our infrastructure services are wide-ranging, extending to preparing project development agreements, proffering legal advice on projects and infrastructure issues, and ensuring compliance with legal requirements.$txt$,
   $txt$/images/industries/infrastructure2.jpg$txt$, 5),
  ('Medical',
   $txt$Neoteric LP is well-versed in medical law and the various legislations regulating the healthcare business. We provide advisory services and assistance in medical-related legal concerns.$txt$,
   $txt$/images/industries/medical2.jpg$txt$, 6),
  ('Hospitality',
   $txt$Neoteric LP serves as a hospitality attorney; preparing, negotiating, and reviewing commercial contracts and agreements, assisting in property acquisition, and resolving labour and employment issues.$txt$,
   $txt$/images/industries/hospitality2.jpg$txt$, 7),
  ('Space',
   $txt$With our broad knowledge of space law, we assist governmental and commercial space activities; proffering legal advice and services required in space operations.$txt$,
   $txt$/images/industries/space2.jpg$txt$, 8),
  ('International trade',
   $txt$We operate as international trade lawyers, ensuring compliance with international trade laws, guiding contractual agreements, and providing strategic advice on complex international trade issues.$txt$,
   $txt$/images/industries/trade2.jpeg$txt$, 9),
  ('Maritime',
   $txt$Our role in the maritime industry includes procuring the registration and licensing of ships, acquiring required permits, and offering practical advice on shipping and maritime issues.$txt$,
   $txt$/images/industries/marine2.jpeg$txt$, 10),
  ('Politics',
   $txt$Our firm operates as lawyer-legislators, engaging in the policy-making process by utilizing our skills and expertise in the legal field at various levels of government, representing the interests of the government and citizens.$txt$,
   $txt$/images/industries/politics2.jpg$txt$, 11)
) AS d(name, description, image_url, ord)
ON CONFLICT (name) DO NOTHING;

-- ── Team members (12) ────────────────────────────────────────────────────────
INSERT INTO public.team_members (full_name, slug, role_title, team_group, image_url, sort_order)
SELECT d.full_name, public.slugify(d.full_name), d.role_title, d.grp::public.team_group, d.image_url, d.ord
FROM (VALUES
  ('Moyosore A. Mustapha',  'Principal Partner',            'legal',     $txt$/images/team/Moyosore_Mustapha.jpeg$txt$,          1),
  ('Adachukwu Okoh',        'Practice Manager',             'legal',     $txt$/images/team/Adachukwu_okoh.jpeg$txt$,             2),
  ('Oseluese E. Odianosen', 'Legal Associate',              'legal',     '/images/team/Ese.jpg',                         3),
  ('Oluwaseun Temiro',      'Legal Associate',              'legal',     $txt$/images/team/Oluwaseun_Temiro.png$txt$,            4),
  ('Floral Ejekwu',         'Legal Associate',              'legal',     $txt$/images/team/Floral_Ejekwu.png$txt$,               5),
  ('Diamond Izuogu',        'Legal Intern',                 'legal',     $txt$/images/team/Diamond_Izuogu.jpeg$txt$,             6),
  ('Feyisayo U. Mustapha',  'Finance Officer',              'non_legal', $txt$/images/team/FeyisayoMustapha.jpeg$txt$,           7),
  ('Omowole Samuel',        'Social Media Lead',            'non_legal', $txt$/images/team/Omowole_Samuel.jpeg$txt$,             8),
  ('Oloruntoba Ayomide',    'Media Magazine',               'non_legal', $txt$/images/team/Oloruntoba_Ayomide.jpeg$txt$,          9),
  ('Daramola Joshua',       $txt$Business Development Intern$txt$,  'non_legal', $txt$/images/team/Daramola_Joshua.jpeg$txt$,            10),
  ('Emili B. Onyepreye',    $txt$Business Development Intern$txt$,  'non_legal', $txt$/images/team/Emili_Blessing_Onyepreye.jpeg$txt$,   11),
  ('Okonkwo Michael',       $txt$Business Development Manager$txt$, 'non_legal', $txt$/images/team/okonkwo_Michael.jpeg$txt$,            12)
) AS d(full_name, role_title, grp, image_url, ord)
ON CONFLICT (slug) DO NOTHING;

-- Okonkwo Michael was commented out in v1 — carried over but switched off, so
-- the admin can restore him with a toggle instead of retyping the record.
UPDATE public.team_members SET is_active = false WHERE slug = 'okonkwo-michael';

-- ── Achievements (4) ─────────────────────────────────────────────────────────
INSERT INTO public.achievements (label, value, sort_order) VALUES
  ('Clientele',           '30',  1),
  ('Accepted briefs',     '72%', 2),
  ('Client satisfaction', '83%', 3),
  ('Delivered briefs',    '70%', 4)
ON CONFLICT DO NOTHING;

-- ── Site settings ────────────────────────────────────────────────────────────
INSERT INTO public.site_settings (key, value, value_type, group_name, label, description, is_public, sort_order) VALUES
  -- Identity
  ('site.name',        '"Neoteric LP"'::jsonb,                                'string', 'identity', 'Site name',        NULL, true,  1),
  ('site.url',         $txt$"https://www.neotericlp.com.ng"$txt$::jsonb,              'url',    'identity', 'Site URL',         NULL, true,  2),
  ('site.tagline',     $txt$"Legal Practitioners & Consultants in Nigeria"$txt$::jsonb,'string','identity', 'Tagline',          NULL, true,  3),
  ('site.logo_url',    '"/images/neoteric.svg"'::jsonb,                       'image',  'identity', 'Logo',             NULL, true,  4),
  ('site.locale',      '"en_NG"'::jsonb,                                      'string', 'identity', 'Locale',           NULL, true,  5),

  -- Hero
  ('hero.heading',     $txt$"Innovative legal solutions for a changing world"$txt$::jsonb, 'string', 'hero', 'Hero heading',    NULL, true,  1),
  ('hero.subheading',  $txt$"Neoteric LP is a Nigerian law firm delivering expert, technology-driven legal services across corporate, commercial, property, energy and technology practice."$txt$::jsonb,
                                                                              'text',   'hero',     'Hero subheading',  NULL, true,  2),
  ('hero.cta_label',   '"Speak to our team"'::jsonb,                          'string', 'hero',     'Hero CTA label',   NULL, true,  3),
  ('hero.cta_link',    '"#contactUs"'::jsonb,                                 'url',    'hero',     'Hero CTA link',    NULL, true,  4),

  -- About / vision / mission
  ('about.heading',    $txt$"Who We Are"$txt$::jsonb,                                 'string', 'about',    'About heading',    NULL, true,  1),
  ('about.body',       $txt$"Neoteric LP (M. A MUSTAPHA & CO) is a legal consulting law firm that has been operating as a new entity in the legal field of Nigeria. The firm has received reputable accolades for delivering top-notch services from satisfied clients around the country, and we pride ourselves on the ability to create long-lasting relationships with clients.\n\nThe firm operates outside the structure of a traditional law firm by adopting alternative models that diverge from this conventional structure to provide a more flexible and cost-effective way to manage legal workloads. We focus on staying current with the legal environment in Nigeria, using knowledge from domestic resources, laws, and regulations already in place, as well as international resources where needed.\n\nWe create new levels of providing legal advisory services and assistance that bridge the gap between society and legal matters in Nigeria. We embrace proprietary technology and utilize modern working practices in tackling legal issues and providing outstanding and effective solutions to diverse challenges facing legal services in the country.\n\nWe work closely with clients, offering them legal solutions tailored to their specific needs and business objectives. We serve as trusted advisors to businesses, helping them navigate the legal landscape, manage risks, and achieve their commercial goals while ensuring compliance with relevant laws and regulations, thereby guaranteeing that their activities are conducted in a legally sound manner."$txt$::jsonb,
                                                                              'text',   'about',    'About body',       NULL, true,  2),
  ('about.images',     $txt$["/images/about/img1.jpg","/images/about/img2.jpg","/images/about/img4.jpg","/images/about/img7.jpg"]$txt$::jsonb,
                                                                              'json',   'about',    'About images',     'Alternating with the paragraphs, in v1 order.', true, 5),
  ('vision.body',      $txt$"Our vision is to lead the legal profession by offering innovative and expert solutions while upholding the highest standards of professionalism and ethics. We aim to inspire confidence, trust, and reliability, fostering growth and excellence in diverse legal landscapes for a wider societal impact."$txt$::jsonb,
                                                                              'text',   'about',    'Our vision',       NULL, true,  3),
  ('mission.body',     $txt$"Our mission is to offer top-tier legal assistance and advisory services to individuals and corporations, meeting diverse legal needs with expertise and promptness. We aim to deliver exceptional and innovative solutions while ensuring client satisfaction through a deep understanding of the law and commitment to professional excellence."$txt$::jsonb,
                                                                              'text',   'about',    'Our mission',      NULL, true,  4),

  -- Contact
  ('contact.street',   $txt$"J10B, Zik Sunday Close, SunnyVale Estate"$txt$::jsonb,   'string', 'contact',  'Street',           NULL, true,  1),
  ('contact.area',     '"Lokogoma"'::jsonb,                                   'string', 'contact',  'Area',             NULL, true,  2),
  ('contact.city',     '"Abuja"'::jsonb,                                      'string', 'contact',  'City',             NULL, true,  3),
  ('contact.state',    '"FCT"'::jsonb,                                        'string', 'contact',  'State',            NULL, true,  4),
  ('contact.country',  '"Nigeria"'::jsonb,                                    'string', 'contact',  'Country',          NULL, true,  5),
  ('contact.phone',    '"+234 (0) 813-602-2316"'::jsonb,                      'string', 'contact',  'Phone',            NULL, true,  6),
  ('contact.email',    $txt$"M.aMustaphaattorneyatlaw@gmail.com"$txt$::jsonb,         'email',  'contact',  'Public email',     NULL, true,  7),
  ('contact.map_embed','null'::jsonb,                                         'url',    'contact',  'Google Maps embed',$txt$Optional iframe src for the contact map.$txt$, true, 8),

  -- Socials
  ('social.facebook',  $txt$"https://facebook.com/neotericlp"$txt$::jsonb,            'url',    'social',   'Facebook',         NULL, true,  1),
  ('social.twitter',   $txt$"https://twitter.com/LpNeoteric"$txt$::jsonb,             'url',    'social',   'X (Twitter)',      NULL, true,  2),
  ('social.instagram', $txt$"https://instagram.com/neoteric_lp"$txt$::jsonb,          'url',    'social',   'Instagram',        NULL, true,  3),
  ('social.linkedin',  'null'::jsonb,                                         'url',    'social',   'LinkedIn',         NULL, true,  4),

  -- SEO
  ('seo.title',        $txt$"Neoteric LP | Legal Practitioners & Consultants in Nigeria"$txt$::jsonb, 'string', 'seo', 'Default title', NULL, true, 1),
  ('seo.description',  $txt$"Neoteric LP is a Nigerian law firm providing innovative legal solutions across corporate and commercial law, dispute resolution, property law, energy law, technology law, and other areas of legal practice."$txt$::jsonb,
                                                                              'text',   'seo',      'Default description', NULL, true, 2),
  ('seo.keywords',     $txt$["Law Firm Nigeria","Law Firm Abuja","Corporate Lawyers Nigeria","Commercial Law","Property Law","Energy Law","Technology Law","Dispute Resolution","Legal Consultancy","Regulatory Compliance","Corporate Governance","Mergers and Acquisitions","Sports Law","Intellectual Property","Neoteric LP"]$txt$::jsonb,
                                                                              'json',   'seo',      'Default keywords', NULL, true, 3),
  ('seo.og_image',     $txt$"/images/neotericHor_1200by628.jpg"$txt$::jsonb,          'image',  'seo',      'Default OG image', NULL, true, 4),
  ('seo.twitter_handle','"@Neoteric_LP"'::jsonb,                              'string', 'seo',      'X handle',         NULL, true, 5),

  -- Feature switches (private)
  ($txt$features.newsletter_enabled$txt$,   'true'::jsonb,  'boolean', 'features', 'Newsletter sign-up',       $txt$Show the newsletter form on the site.$txt$,              false, 1),
  ($txt$features.testimonials_enabled$txt$, 'true'::jsonb,  'boolean', 'features', 'Testimonials section',     $txt$Show the testimonials carousel.$txt$,                    false, 2),
  ($txt$features.broadcast_on_publish$txt$, 'false'::jsonb, 'boolean', 'features', 'Email on publish',         $txt$Email subscribers automatically when an article is published.$txt$, false, 3),
  ($txt$features.auto_reply_inquiries$txt$, 'true'::jsonb,  'boolean', 'features', 'Acknowledge inquiries',    $txt$Send an automatic acknowledgement to contact-form senders.$txt$, false, 4)
ON CONFLICT (key) DO NOTHING;

-- ── Publications (28, carried over from v1 with their Drive links intact) ────
-- `body` is intentionally NULL: the admin fills the article in from the
-- dashboard. Until then the article page falls back to `source_url`.
-- `published_at` is spaced backwards so the original ordering is preserved.
INSERT INTO public.publications
  (title, slug, excerpt, source_url, status, published_at, category_id, author_name, tags)
SELECT
  d.title,
  public.slugify(left(d.title, 120)),
  d.excerpt,
  d.source_url,
  'published'::public.publication_status,
  now() - (d.ord || ' days')::interval,
  (SELECT id FROM public.publication_categories WHERE slug = d.category_slug),
  'Neoteric LP',
  d.tags::text[]
FROM (VALUES
  ($txt$Due Diligence in Nigerian Real Estate: A Safeguard for Diaspora Buyers and Institutional Lenders$txt$,
   $txt$For Nigerians abroad purchasing property back home, and for banks and financiers taking land as security, due diligence is the difference between an asset and a liability.$txt$,
   $txt$https://drive.google.com/file/d/1sgBUnmOuNwnJfOrocqtOiw_6jmx9WZHf/view?usp=drive_link$txt$,
   'property-real-estate', ARRAY['real estate','due diligence','diaspora'], 1),

  ($txt$When a Rumour Almost Broke a Fintech: What the OPay Crisis Teaches Every Nigerian Business About Reputation, Defamation and the Law$txt$,
   $txt$On Sunday the 30th of August 2026, a message began circulating across Nigerian WhatsApp groups, X and other social media platforms.$txt$,
   $txt$https://docs.google.com/document/d/1m5XoNqM1Mcz2gzHp86NJ6fodlslZApba/edit?usp=sharing&ouid=111620331763298639087&rtpof=true&sd=true$txt$,
   'technology-data', ARRAY['fintech','defamation','reputation'], 2),

  ($txt$AI Governance: Why Should You Care?$txt$,
   $txt$There is no doubt that the dispensation which evolved around the various phases of growth in artificial intelligence demands a governance conversation.$txt$,
   $txt$https://docs.google.com/document/d/1yVoiYWALVafhKQAo74czQMpu41NNyAUW/edit?usp=sharing&ouid=111620331763298639087&rtpof=true&sd=true$txt$,
   'technology-data', ARRAY['artificial intelligence','governance'], 3),

  ($txt$Loan Agreements in Nigeria: Legal Frameworks and Key Clauses Borrowers and Lenders Should Understand$txt$,
   $txt$Loan transactions play a crucial role in commercial activity in Nigeria. Businesses rely on loans to finance expansion and operations.$txt$,
   $txt$https://drive.google.com/file/d/12I0DLLEUeZdtLl9zW2J8D5M7lPZriw7f/view?usp=drivesdk$txt$,
   'corporate-commercial', ARRAY['lending','contracts','banking'], 4),

  ($txt$The CAC Has Come for 100,000 Companies: Are You Already in Breach?$txt$,
   $txt$July 2026 was a busy month for the Corporate Affairs Commission, and a great many companies may already be out of compliance.$txt$,
   $txt$https://docs.google.com/document/d/1cpvo7rnjvAF4CjgoNWhrP8naT6ZxQ2en/edit?usp=sharing&ouid=111620331763298639087&rtpof=true&sd=true$txt$,
   'corporate-commercial', ARRAY['CAC','compliance'], 5),

  ($txt$Dissolution of Marriage in Nigeria: Procedures Under Statutory, Customary, and Islamic Law$txt$,
   $txt$Popular culture has created the impression that divorce is as simple as signing a few documents and walking away. The law says otherwise.$txt$,
   $txt$https://drive.google.com/file/d/107COrxdSDJe8PpYKegnvS6nkPjgZLeiI/view?usp=sharing$txt$,
   'family-law', ARRAY['marriage','divorce','customary law'], 6),

  ($txt$Is Your Company Letterhead Compliant? The CAC August 1 Deadline Every Business in Nigeria Must Know$txt$,
   $txt$If your company sends out invoices, quotations, letters or any official correspondence, there is something you need to check.$txt$,
   $txt$https://docs.google.com/document/d/1JpNCF1WH_HybJKpKXIm_o8sP6OYUXXct/edit?usp=drivesdk&ouid=111620331763298639087&rtpof=true&sd=true$txt$,
   'corporate-commercial', ARRAY['CAC','compliance','letterhead'], 7),

  ($txt$ESG Compliance in Nigeria: Legal Obligations and Importance$txt$,
   $txt$Environmental, Social, and Governance considerations have evolved from voluntary corporate social responsibility into enforceable obligations.$txt$,
   $txt$https://drive.google.com/file/d/1IY-aytSDIy4vmUb8PYpn9PL8j0TEjDgA/view?usp=drive_link$txt$,
   'esg-sustainability', ARRAY['ESG','compliance'], 8),

  ($txt$When Can a Court Revisit Its Own Judgment?$txt$,
   $txt$A legal examination of the doctrine of functus officio and the law on necessary parties, through the lens of the NDC case.$txt$,
   $txt$https://drive.google.com/file/d/1mViJ5gFvJfb24VuLkT9tC-HK7vlY3ppY/view?usp=drive_link$txt$,
   'dispute-resolution', ARRAY['litigation','functus officio'], 9),

  ($txt$Can Social Media Posts Constitute Criminal Offences?$txt$,
   $txt$The rise of social media has fundamentally transformed how people communicate and express opinions — and where the criminal law now reaches.$txt$,
   $txt$https://docs.google.com/document/d/1DfU2gPakCIq_hRfAZpTLD82Mdij_3lel/edit?usp=drive_link&ouid=111620331763298639087&rtpof=true&sd=true$txt$,
   'technology-data', ARRAY['social media','criminal law'], 10),

  ($txt$Can State Police Solve Nigeria's Security Crisis?$txt$,
   $txt$In typical Nigerian fashion, the increasingly complex, multifaceted and geographically uneven security problem invites a structural answer.$txt$,
   $txt$https://docs.google.com/document/d/1RhLQKj34rsCInrUIYPsNZ8Gr8p-0MAdK/edit?usp=drive_link&ouid=111620331763298639087&rtpof=true&sd=true$txt$,
   'public-political-law', ARRAY['security','federalism'], 11),

  ($txt$ESG and Sustainability Reporting in Nigeria: The 2028 Deadline is Closer Than You Think$txt$,
   $txt$There is a conversation happening in Nigerian boardrooms right now that many companies are still treating as a future problem.$txt$,
   $txt$https://docs.google.com/document/d/1rcu57zbadHhl_xpbhpbxuXA-NHl5XZzY/edit?usp=drive_link&ouid=111620331763298639087&rtpof=true&sd=true$txt$,
   'esg-sustainability', ARRAY['ESG','reporting'], 12),

  ($txt$The Nigeria Tax Act 2025: What Every Business in Nigeria Needs to Know Right Now$txt$,
   $txt$On the 26th of June 2025, President Bola Ahmed Tinubu signed four bills into law that together represent the most significant overhaul in decades.$txt$,
   $txt$https://docs.google.com/document/d/1tZpTQmASMh-H5UaB0eYnFcc7VVlDTbYq/edit?usp=drive_link&ouid=111620331763298639087&rtpof=true&sd=true$txt$,
   'corporate-commercial', ARRAY['tax','legislation'], 13),

  ($txt$Defamation: Analyzing Social Media Defamation Under Nigerian Law$txt$,
   $txt$In today's digital age, a single social media post can destroy a person's reputation within minutes.$txt$,
   $txt$https://drive.google.com/file/d/1jm8DyTUc0wmuTW726cTGtyh5SDwfy1xi/view?usp=drive_link$txt$,
   'dispute-resolution', ARRAY['defamation','social media'], 14),

  ($txt$Electronic Transmission of Election Results: What the New Electoral Reforms Mean for Nigeria$txt$,
   $txt$Nigeria's electoral process has remained one of the most sensitive aspects of its democracy since the return to civilian rule in 1999.$txt$,
   $txt$https://docs.google.com/document/d/1MMKLhl3g7mZqdT4b4Qf-NoNcC6XQPPa2/edit?usp=sharing&ouid=111620331763298639087&rtpof=true&sd=true$txt$,
   'public-political-law', ARRAY['elections','electoral act'], 15),

  ($txt$Breaking Down the Nigeria Democratic Congress (NDC) Legal Battles From 2017 Till Today$txt$,
   $txt$As the much anticipated 2027 general elections draw closer, Nigeria's political landscape is being reshaped in the courts.$txt$,
   $txt$https://drive.google.com/file/d/17JzLFX8QjUrMdr5UYrKaSJUAEeb-3Ob2/view?usp=drive_link$txt$,
   'public-political-law', ARRAY['elections','political parties'], 16),

  ($txt$Protecting Your Ideas and Creativity in the 21st Century: What Every Creative Should Know$txt$,
   $txt$In an increasingly competitive and brand-driven economy, trademarks and copyright serve as the creative's first line of defence.$txt$,
   $txt$https://drive.google.com/file/d/1D6tIXBnfKse4UHR7veJDhmx1m9-6M-Xe/view?usp=drive_link$txt$,
   'intellectual-property', ARRAY['intellectual property','creatives'], 17),

  ($txt$Trademark Under Nigerian Law: Definition, Registrability, and Procedure for Registration$txt$,
   $txt$In an increasingly competitive and brand-driven economy, trademarks serve as the anchor of commercial identity.$txt$,
   $txt$https://drive.google.com/file/d/1S4hLviRtO4NfZ9N1mJfnIn27t43qtFmz/view?usp=drive_link$txt$,
   'intellectual-property', ARRAY['trademark','registration'], 18),

  ($txt$Who Regulates Fintech in Nigeria? Unpacking the Growing Oversight Debate$txt$,
   $txt$Every time you send money to a friend on your banking app instead of going to the bank, several regulators have a view.$txt$,
   $txt$https://docs.google.com/document/d/1S9vJGfy65HKcYfMWY3yePUlqk7_bUfIE/edit?usp=drive_link&ouid=111620331763298639087&rtpof=true&sd=true$txt$,
   'technology-data', ARRAY['fintech','regulation'], 19),

  ($txt$The Resignation Directive and the Electoral Act: When Executive Power Outruns the Law$txt$,
   $txt$On the 19th of March 2026, President Bola Ahmed Tinubu issued a directive requiring all political appointees seeking office to resign.$txt$,
   $txt$https://docs.google.com/document/d/11_2ptcAbVBSTCQB6vprVcRUOAhc-x5IL/edit?usp=drive_link&ouid=111620331763298639087&rtpof=true&sd=true$txt$,
   'public-political-law', ARRAY['electoral act','executive power'], 20),

  ($txt$Data Privacy and Protection in Nigeria: An Overview of the Key Concepts and Relevant Laws$txt$,
   $txt$As Nigeria embraces digital transformation, it becomes increasingly important to examine how personal data is governed.$txt$,
   $txt$https://drive.google.com/file/d/1wtLOvpQ0Z11t5YjWKVPPEuSouyV0ctt5/view?usp=drive_link$txt$,
   'technology-data', ARRAY['data protection','NDPA','privacy'], 21),

  ($txt$Artificial Intelligence and the Creative Industry: Innovation, Disruption, and the Urgent Call for Legal Reform$txt$,
   $txt$The rapid integration of artificial intelligence into creative industries is transforming how artistic work is made and owned.$txt$,
   $txt$https://docs.google.com/document/d/1bwI6hDQBmKU8zjV8dJwjxbz6IkxHx2y2/edit?usp=drive_link&ouid=111620331763298639087&rtpof=true&sd=true$txt$,
   'intellectual-property', ARRAY['artificial intelligence','copyright','creatives'], 22),

  ($txt$Has World War III Started? What This Means for Africa and Nigeria's Economy$txt$,
   $txt$On the 28th of February 2026, the United States and Israel launched coordinated strikes on Iran, and the economic shockwaves reached Africa.$txt$,
   $txt$https://docs.google.com/document/d/1EoCt6dBDr1lxQYAenIf5w_I83V-hxyhn/edit?usp=drive_link&ouid=111620331763298639087&rtpof=true&sd=true$txt$,
   'public-political-law', ARRAY['geopolitics','economy'], 23),

  ($txt$Hiring in Nigeria, Managing Globally$txt$,
   $txt$Legal and HR risks Nigerian businesses must understand before building remote and hybrid teams.$txt$,
   $txt$https://drive.google.com/file/d/1nGp_2uDqUwNt8-Vzw3-QgsAngiGlQY39/view?usp=sharing$txt$,
   'employment-hr', ARRAY['employment','remote work'], 24),

  ($txt$Company Secretary: Analyzing the Role and Its Importance for Good Corporate Governance Under Nigerian Laws$txt$,
   $txt$The company secretary is routinely treated as an administrative afterthought. Under CAMA, the role carries far more weight than that.$txt$,
   $txt$https://drive.google.com/file/d/1nwWJ852lsLAhKmCdFvHBNw0F-HU5Gna2/view?usp=sharing$txt$,
   'corporate-commercial', ARRAY['corporate governance','CAMA'], 25),

  ($txt$How to Prove Land Ownership in Nigeria$txt$,
   $txt$With the increasing number of land disputes occurring in Nigeria, all landowners should know how to prove ownership over their lands.$txt$,
   $txt$https://docs.google.com/document/d/1OF18fT1yUpxnushlpzPnR2ygq0umjiKpvliVcElFgvs/edit?usp=sharing$txt$,
   'property-real-estate', ARRAY['land','title','property'], 26),

  ($txt$When Procedure Becomes a Barrier: Can Default Fees Stall Fundamental Rights Cases?$txt$,
   $txt$One recurring challenge litigation lawyers encounter is the imposition of default fees when they are unable to respond in time.$txt$,
   $txt$https://drive.google.com/file/d/1neVezIpx11Tk9TsOpmenhep8UE-KaMmt/view?usp=sharing$txt$,
   'dispute-resolution', ARRAY['fundamental rights','procedure'], 27)
) AS d(title, excerpt, source_url, category_slug, tags, ord)
ON CONFLICT (slug) DO NOTHING;

-- Put the three most recent on the homepage feature rail.
UPDATE public.publications
SET is_featured = true
WHERE id IN (
  SELECT id FROM public.publications
  WHERE status = 'published'
  ORDER BY published_at DESC
  LIMIT 3
);

-- ╭───────────────────────────────────────────────────────────────────────────╮
-- │ NEXT STEP                                                                 │
-- │   npm run db:seed:admin                                                   │
-- │ Creates the single super-admin from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD│
-- │ with a bcrypt hash. There is no registration endpoint anywhere in the API.│
-- ╰───────────────────────────────────────────────────────────────────────────╯
