-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  NEOTERIC LP — UPDATE: "Who We Are" content                               ║
-- ║                                                                           ║
-- ║  Run this once against an existing database:                              ║
-- ║                                                                           ║
-- ║      psql "$DATABASE_URL" -f migrations/0003_update_about_content.sql      ║
-- ║                                                                           ║
-- ║  Why a separate file: `0001_init.sql` seeds settings with                  ║
-- ║  `ON CONFLICT (key) DO NOTHING`, which is right for a seed — re-running    ║
-- ║  it must never overwrite copy the firm has since edited. The consequence   ║
-- ║  is that re-running it also cannot *correct* a row, so a content fix       ║
-- ║  needs its own migration that says so explicitly.                          ║
-- ║                                                                           ║
-- ║  This sets the full four-paragraph "Who We Are" text from the live v1      ║
-- ║  site, and points the section at the four strongest photographs in         ║
-- ║  public/images/about.                                                      ║
-- ║                                                                           ║
-- ║  Safe to re-run. Only touches three `site_settings` rows.                  ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- ── The heading ──────────────────────────────────────────────────────────────
INSERT INTO public.site_settings
  (key, value, value_type, group_name, label, description, is_public, sort_order)
VALUES
  ($txt$about.heading$txt$, $txt$"Who We Are"$txt$::jsonb,
   'string', 'about', 'About heading', NULL, true, 1)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ── The four paragraphs, verbatim from the live v1 site ─────────────────────
-- Stored as one value with blank lines between paragraphs; the frontend splits
-- on them and alternates each one against an image.
INSERT INTO public.site_settings
  (key, value, value_type, group_name, label, description, is_public, sort_order)
VALUES
  ($txt$about.body$txt$,
   to_jsonb(
     $txt$Neoteric LP (M. A MUSTAPHA & CO) is a legal consulting law firm that has been operating as a new entity in the legal field of Nigeria. The firm has received reputable accolades for delivering top-notch services from satisfied clients around the country, and we pride ourselves on the ability to create long-lasting relationships with clients.

The firm operates outside the structure of a traditional law firm by adopting alternative models that diverge from this conventional structure to provide a more flexible and cost-effective way to manage legal workloads. We focus on staying current with the legal environment in Nigeria, using knowledge from domestic resources, laws, and regulations already in place, as well as international resources where needed.

We create new levels of providing legal advisory services and assistance that bridge the gap between society and legal matters in Nigeria. We embrace proprietary technology and utilize modern working practices in tackling legal issues and providing outstanding and effective solutions to diverse challenges facing legal services in the country.

We work closely with clients, offering them legal solutions tailored to their specific needs and business objectives. We serve as trusted advisors to businesses, helping them navigate the legal landscape, manage risks, and achieve their commercial goals while ensuring compliance with relevant laws and regulations, thereby guaranteeing that their activities are conducted in a legally sound manner.$txt$::text
   ),
   'text', 'about', 'About body',
   'Four paragraphs, blank line separated. Each is paired with the image at the matching position.',
   true, 2)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description;

-- ── The images ───────────────────────────────────────────────────────────────
-- Chosen on resolution and subject, in this order:
--   img3  736×1104  Lady Justice and gavel in a library — the strongest of the
--                   set and twice the resolution of the rest. Unused in v1.
--   img2  396× 594  Signing a contract, gavel and scales alongside.
--   img1  396× 230  A handshake across documents.
--   img4  375× 250  Gavel and contract on a desk.
--
-- Deliberately left out: img5 and img6 are bright-blue technology composites
-- in the style of 2010s stock art. They clash with the teal-and-bronze palette
-- and read as clipart next to the photographs. img7 is the smallest file in
-- the folder and visibly soft at section width.
--
-- These are editable from the dashboard, so swapping in higher-resolution
-- photography later needs no code change.
INSERT INTO public.site_settings
  (key, value, value_type, group_name, label, description, is_public, sort_order)
VALUES
  ($txt$about.images$txt$,
   $txt$["/images/about/img3.jpg","/images/about/img2.jpg","/images/about/img1.jpg","/images/about/img4.jpg"]$txt$::jsonb,
   'json', 'about', 'About images',
   'One per paragraph, in order. Replace with higher-resolution photography when available.',
   true, 5)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description;

-- ── Confirm ──────────────────────────────────────────────────────────────────
DO $$
DECLARE
  paragraphs integer;
  images     integer;
BEGIN
  SELECT array_length(string_to_array(value #>> '{}', E'\n\n'), 1)
    INTO paragraphs FROM public.site_settings WHERE key = 'about.body';

  SELECT jsonb_array_length(value)
    INTO images FROM public.site_settings WHERE key = 'about.images';

  RAISE NOTICE 'Who We Are updated: % paragraphs, % images', paragraphs, images;

  IF paragraphs <> 4 THEN
    RAISE WARNING 'Expected 4 paragraphs but found %', paragraphs;
  END IF;
END
$$;
