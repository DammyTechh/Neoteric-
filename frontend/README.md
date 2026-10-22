# Neoteric LP — Frontend v2

Public website and administration dashboard.
Next.js 14 (App Router) · TypeScript · Tailwind.

```bash
npm install
cp .env.example .env.local     # point NEXT_PUBLIC_API_URL at the backend
npm run dev                    # http://localhost:3000
```

The backend must be running (default `http://localhost:4000/api/v1`).

## Design system

| | |
|---|---|
| Brand colours | `#255859` teal, `#c19766` bronze — **carried over from v1 unchanged**, all 24 ramp values byte-identical to v1's `tailwind.config.ts` |
| Ink | `#2c2c2c` — the wordmark colour from `neoteric.svg`, so body text matches the logo |
| Neutrals | Tailwind `zinc` (500/400/200), which is what v1 used in practice |
| Typeface | Archivo 400/500/600/700 |
| Monospace | IBM Plex Mono 400/500/600 — dates, figures, references and codes only, never running text |
| Icons | Material Symbols Rounded, via `<Icon name="check_circle" />` |
| Spacing | 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 only |

Fonts are loaded through `next/font`, which fetches them at build time and
serves them from your own origin — no third-party round trip at runtime and no
layout shift. Material Symbols is the one exception: it is a variable icon font
whose ligature lookup `next/font` cannot preprocess, so it comes from Google
with a preconnect.

## Brand tokens, and keeping them in sync

Every colour comes from `src/lib/brand.ts`. `tailwind.config.ts` imports it
rather than repeating the values, and the backend's email templates mirror the
same file at `backend/src/application/mail/templates/brand.ts`.

```bash
npm run brand:check     # also runs as part of `npm run build`
```

The check compares the two token files and exits non-zero if any value
disagrees. The two codebases deploy independently, so the tokens are
duplicated rather than shared through a package — and duplication without a
check is exactly how a web page and an email end up in different shades of the
same brand.

## Brand assets

The logo is the supplied artwork, not a recreation:

| | |
|---|---|
| `public/images/neoteric.svg` | horizontal wordmark — `#2c2c2c` with a `#c19766` accent. Used in the header and footer via `<Logo />`, inverted on dark grounds |
| `public/images/neoteric-icon.svg` | the bronze mark alone. Used as the watermark on dark panels, as v1 did |
| `src/app/{favicon.ico,icon.png,apple-icon.png}` | v1's own icons |
| `public/images/` | all 65 of v1's photographs, including the 11 industry images the hero carousel rotates through |

## Depth

Two-layer shadows (a tight contact shadow plus a wide soft one), tinted with
the brand teal rather than black. Cards tilt toward the cursor at a 2° ceiling;
the hero's industry images hold a slow Ken Burns push. Everything is gated
behind `prefers-reduced-motion`.

## Search engine & AI discoverability

| Route | |
|---|---|
| `/sitemap.xml` | Generated from the database — every published article, category and homepage section, with real `lastModified` dates |
| `/robots.txt` | Allows the AI crawlers by name (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, OAI-SearchBot, CCBot…), disallows `/admin` |
| `/feed.xml` | RSS of the 50 most recent publications |

Structured data (JSON-LD):

- **Homepage** — `LegalService` + `Organization` carrying the address, phone,
  socials, all 13 practice areas as an `OfferCatalog` and the team as
  `employee`. This is what gets the firm surfaced for *"maritime lawyer
  Abuja"* rather than only for its own name. Plus `WebSite` with a
  `SearchAction`, which is what earns a sitelinks search box.
- **Publications index** — `CollectionPage` wrapping an `ItemList` of every
  article, so a crawler sees all of them from one page.
- **Article** — `Article` with `articleBody`, `wordCount`, `keywords`,
  `articleSection`, `timeRequired` and `isAccessibleForFree`. The body text
  matters: without it an assistant sees a headline and nothing to answer
  from.
- **Breadcrumbs** on both publication routes.

The AI crawlers are allowed deliberately. A law firm's publications are
written to be found and cited; being quotable by an assistant answering a
question about Nigerian law is the modern version of ranking for it.

## Structure

```
src/
├── app/
│   ├── page.tsx                  homepage
│   ├── publications/             index + article pages
│   ├── admin/                    the dashboard (see below)
│   └── layout.tsx
├── components/
│   ├── home/                     hero carousel + sections
│   ├── publications/             cards, thumbnails, document viewer
│   ├── layout/                   header, footer
│   ├── forms/                    contact, newsletter
│   ├── admin/                    dashboard shell, controls, editors
│   └── ui/                       icon, card, reveal primitives
└── lib/                          api client, auth, types, formatting
```

## Section order

Follows the live v1 site, so returning visitors land somewhere familiar:

hero (industries carousel) → achievements → who we are → practice areas →
our team → vision & mission → testimonials → news → contact

Industries have no section of their own: the hero carousel **is** the
industries showcase, exactly as in v1.

## Publications

The index shows a cover thumbnail on every card. Where an article has no
uploaded cover — true of all 27 pieces carried over from v1 until one is set —
a cover is generated: a brand gradient, the article's initials and its
category, seeded from the title so it is stable.

The article page renders, in order: the HTML body; failing that, an attached
PDF in an inline viewer; failing that, a short notice. There is deliberately
no fourth option linking out to Google Drive.

## The dashboard

Lives at `/admin`. `/admin` itself redirects to `/admin/dashboard`; signed-out
visitors land on `/admin/login`.

There is **no sign-up page**, because there is no registration endpoint in the
API. The first account comes from the backend's `npm run db:seed:admin`, and
every later one is invited by a super-administrator from **Operators**. An
invited operator is emailed a temporary password and cannot reach anything
until they have replaced it.

```
/admin/dashboard                 figures, recently edited, unanswered enquiries
/admin/publications              list, filters, publish / feature / delete
/admin/publications/new          create
/admin/publications/[id]         edit, and import a .docx or .pdf as the body
/admin/media                     library: drag-and-drop upload, alt text, folders
/admin/content/[collection]      practice areas · industries · team ·
                                 testimonials · achievements · categories
/admin/inquiries                 contact form inbox, reply by email
/admin/newsletter                subscribers and campaigns
/admin/settings                  every word and picture on the public pages
/admin/users                     operator accounts and roles
/admin/audit                     who changed what, and when
/admin/change-password           also forced after a first sign-in
/admin/forgot-password           → /admin/reset-password
```

### Why it is built this way

**The six content collections share one page.** `components/admin/collections.ts`
describes each collection as data — its fields, their kinds, which one is the
title, which flag hides it from the site — and `CollectionManager` renders the
list and the editor from that description. Adding a field is one line; the six
collections cannot drift apart.

**The access token is held in memory only.** The refresh token is an httpOnly
cookie the API sets, so nothing here touches `localStorage` — an article body
is rendered as HTML on this site, and a token in storage is readable by any
script that gets in. On a hard refresh the provider quietly mints a new access
token from the cookie before deciding whether anyone is signed in, and it
refreshes again every twelve minutes so a long edit never ends in a 401.

**Nothing under `/admin` is prerendered** (`dynamic = 'force-dynamic'` on the
segment) and the whole tree is `noindex`. A build-time snapshot of a page
behind an auth guard would be an empty shell, and these pages read the query
string — `?status=new`, `?open=<id>` — which static export will not allow.

**Reordering uses arrows, not drag-and-drop**, so it works with a keyboard and
on a phone. Moving a row PUTs the whole new order.

### Importing the v1 Google Drive articles

Open a publication, press **Import a document**, and choose the file:

- a `.docx` is converted to HTML and becomes the editable article text;
- a `.pdf` is attached and rendered by the article page's own viewer.

Either way the reader stays on the site. To do all 27 at once instead, run the
backend's `npm run db:import-drive`.
