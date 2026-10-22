-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  0005 · Store the Who We Are copy as paragraphs                          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- WHY
--
-- `about.body` was a single JSON string whose paragraphs were separated by
-- blank lines. The homepage renders one zigzag row per paragraph, so the
-- section depends entirely on those blank lines surviving — the database, the
-- SQL editor they were pasted through, the API, and any later edit in the
-- dashboard. Lose them anywhere and four paragraphs silently become one, and
-- the section renders as a single slab of text beside a single image.
--
-- A JSON array cannot lose its separators. Each paragraph is its own element,
-- so the number of rows is explicit rather than inferred from whitespace.
--
-- The frontend accepts both shapes, so this migration is not required for the
-- site to work — it removes a class of breakage rather than fixing a crash.
--
-- Safe to run more than once.

-- ── The four paragraphs ─────────────────────────────────────────────────────
--
-- Dollar-quoted individually. The copy contains apostrophes and parentheses,
-- and this is the form that cannot be broken by one mangled quote.

UPDATE public.site_settings
   SET value = jsonb_build_array(
         $p1$Neoteric LP (M. A MUSTAPHA & CO) is a legal consulting law firm that has been operating as a new entity in the legal field of Nigeria. The firm has received reputable accolades for delivering top-notch services from satisfied clients around the country, and we pride ourselves on the ability to create long-lasting relationships with clients.$p1$,
         $p2$The firm operates outside the structure of a traditional law firm by adopting alternative models that diverge from this conventional structure to provide a more flexible and cost-effective way to manage legal workloads. We focus on staying current with the legal environment in Nigeria, using knowledge from domestic resources, laws, and regulations already in place, as well as international resources where needed.$p2$,
         $p3$We create new levels of providing legal advisory services and assistance that bridge the gap between society and legal matters in Nigeria. We embrace proprietary technology and utilize modern working practices in tackling legal issues and providing outstanding and effective solutions to diverse challenges facing legal services in the country.$p3$,
         $p4$We work closely with clients, offering them legal solutions tailored to their specific needs and business objectives. We serve as trusted advisors to businesses, helping them navigate the legal landscape, manage risks, and achieve their commercial goals while ensuring compliance with relevant laws and regulations, thereby guaranteeing that their activities are conducted in a legally sound manner.$p4$
       ),
       -- The dashboard picks its editor from this; `json` gives the array
       -- editor rather than a single-line text box.
       value_type = 'json',
       description = 'One entry per paragraph. Each becomes a row in the Who We Are zigzag, paired with the matching image from about.images.',
       updated_at = now()
 WHERE key = 'about.body';

-- ── One image per paragraph ─────────────────────────────────────────────────
--
-- The section pairs these by index, so a short list means images repeat.
-- Four paragraphs, four photographs.

UPDATE public.site_settings
   SET value = $imgs$[
         "/images/about/img3.jpg",
         "/images/about/img2.jpg",
         "/images/about/img1.jpg",
         "/images/about/img4.jpg"
       ]$imgs$::jsonb,
       value_type = 'json',
       description = 'Paired with about.body by position. Replace these with higher-resolution photographs from the media library when you have them.',
       updated_at = now()
 WHERE key = 'about.images';

-- ── Check ───────────────────────────────────────────────────────────────────

DO $$
DECLARE
  paragraphs integer;
  images     integer;
BEGIN
  SELECT jsonb_array_length(value) INTO paragraphs
    FROM public.site_settings WHERE key = 'about.body';

  SELECT jsonb_array_length(value) INTO images
    FROM public.site_settings WHERE key = 'about.images';

  IF paragraphs IS DISTINCT FROM 4 THEN
    RAISE EXCEPTION 'about.body should hold 4 paragraphs, found %', paragraphs;
  END IF;

  RAISE NOTICE 'Who We Are: % paragraphs, % images', paragraphs, images;
END $$;
