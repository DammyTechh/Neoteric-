-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  NEOTERIC LP — v2 · PART 2 of 2 · SEED DATA FROM v1                     ║
-- ║                                                                           ║
-- ║  This is `migrations/0001_init.sql` split in two, for pasting into the     ║
-- ║  Supabase SQL editor without one very long paste. Run part 1, then 2.      ║
-- ║  The combined file is identical and is the canonical artifact — use it     ║
-- ║  with psql:  psql "$DATABASE_URL" -1 -f migrations/0001_init.sql           ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Requires part 1 to have been run first.

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
ON CONFLICT (label) DO NOTHING;

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
