-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  0004 · Repair duplicated achievements                                   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- WHAT WENT WRONG
--
-- `public.achievements` was created without a unique constraint on `label`,
-- and its seed ended with a bare `ON CONFLICT DO NOTHING`. With no constraint
-- to conflict against, that clause never fires: running 0001_init.sql a second
-- time appends another four rows rather than skipping them.
--
-- The homepage band renders one cell per row, so a database that saw the
-- migration three times shows "30 Clientele" three times.
--
-- WHAT THIS DOES
--
--   1. Collapses duplicates, keeping the oldest row for each label so any
--      edits made in the dashboard survive.
--   2. Adds the unique constraint that should have been there, which makes
--      0001's seed genuinely idempotent from now on.
--   3. Settles the four figures on their intended values.
--
-- Safe to run more than once. Running it against an already-correct database
-- changes nothing.
--
-- 0001_init.sql has been corrected too, so a database created from scratch
-- after this point never needs this file.

-- ── 1 · Collapse duplicates ─────────────────────────────────────────────────
--
-- Oldest row per label wins; `id` breaks ties when two share a timestamp,
-- which they will, since the seed inserts them in one statement.

DELETE FROM public.achievements a
USING public.achievements keeper
WHERE a.label = keeper.label
  AND (a.created_at, a.id) > (keeper.created_at, keeper.id);

-- ── 2 · Add the missing constraint ──────────────────────────────────────────
--
-- Guarded, because this file may run against a database already created from
-- the corrected 0001, where the constraint exists under its own name.

-- Asking Postgres to add it and ignoring the "already exists" is both shorter
-- and more reliable than interrogating the catalogue: the corrected 0001
-- declares `label text NOT NULL UNIQUE`, whose auto-generated constraint is
-- named `achievements_label_key` — the same name used here.

DO $$
BEGIN
  ALTER TABLE public.achievements
    ADD CONSTRAINT achievements_label_key UNIQUE (label);
EXCEPTION
  WHEN duplicate_table OR duplicate_object THEN
    NULL;  -- already present, nothing to do
END $$;

-- ── 3 · Settle the four figures ─────────────────────────────────────────────
--
-- DO UPDATE rather than DO NOTHING: this file exists to correct databases
-- that already hold rows, and DO NOTHING would leave a wrong value in place.
-- Only the figure and its position are touched; a description or icon added
-- from the dashboard is left alone.

INSERT INTO public.achievements (label, value, sort_order, is_active) VALUES
  ('Clientele',           '30',  1, true),
  ('Accepted briefs',     '72%', 2, true),
  ('Client satisfaction', '83%', 3, true),
  ('Delivered briefs',    '70%', 4, true)
ON CONFLICT (label) DO UPDATE
  SET value      = EXCLUDED.value,
      sort_order = EXCLUDED.sort_order,
      is_active  = true,
      updated_at = now();

-- Anything beyond those four is hidden rather than deleted, so a figure the
-- firm added deliberately is recoverable from the dashboard.
UPDATE public.achievements
   SET is_active = false,
       updated_at = now()
 WHERE label NOT IN (
   'Clientele', 'Accepted briefs', 'Client satisfaction', 'Delivered briefs'
 )
   AND is_active;

-- ── Check ───────────────────────────────────────────────────────────────────
--
-- Expect exactly four rows:
--
--   SELECT label, value, sort_order
--     FROM public.achievements
--    WHERE is_active
--    ORDER BY sort_order;
