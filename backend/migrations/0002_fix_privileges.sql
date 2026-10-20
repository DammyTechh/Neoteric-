-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  NEOTERIC LP — FIX: grant table privileges                                ║
-- ║                                                                           ║
-- ║  Run this if the schema is already in place and the API reports           ║
-- ║                                                                           ║
-- ║      permission denied for table admin_users          (code 42501)        ║
-- ║                                                                           ║
-- ║  That happens when the tables were created without the GRANTs below.      ║
-- ║  `service_role` bypasses RLS on Supabase but is still subject to table    ║
-- ║  privileges, so every query fails until these are applied.                ║
-- ║                                                                           ║
-- ║  It is the same section 11b that `0001_init.sql` now contains, extracted  ║
-- ║  so an existing database can be fixed without re-running the migration.   ║
-- ║  Safe to run repeatedly, and it touches no data.                          ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- The roles exist on Supabase; created here only for a plain Postgres.
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
