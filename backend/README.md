# Neoteric LP — API v2

Backend for the Neoteric LP website and administration dashboard.
Node.js · TypeScript · Express · Supabase (PostgreSQL) · Resend SMTP.

In v1 every piece of content was hardcoded in the React bundle, and each
**News & Publications** entry was a title plus a link out to Google Drive. In v2 all of it
is database-backed and editable from a dashboard, and an article is a page on the site —
a cover thumbnail on the index, a body, a slug of its own.

---

## Quick start

```bash
npm install
cp .env.example .env          # fill in the Supabase and SMTP values

npm run db:migrate            # applies migrations/0001_init.sql
npm run db:seed:admin         # creates the one administrator account

npm run dev                   # http://localhost:4000
```

Then open **http://localhost:4000/api/docs** for the interactive API reference.

### What you need before starting

| | Where to find it |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API |
| `DATABASE_URL` | Supabase → Project Settings → Database → Connection string → URI |
| `SMTP_PASSWORD` | Resend → API Keys (the username is literally `resend`) |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | `openssl rand -base64 48`, twice |

The process validates its whole environment at boot and refuses to start on a bad one, so
a missing SMTP password surfaces on deploy rather than the first time a client submits the
contact form.

While developing, set `MAIL_DRY_RUN=true` to have emails logged instead of sent.

---

## The database

**`migrations/0001_init.sql`** — one file, idempotent, self-contained. It creates
19 tables, 2 views, the triggers and the RLS policies, and seeds everything from v1.

### Three ways to apply it

**1. psql — the reliable path.** One command, all-or-nothing:

```bash
psql "$DATABASE_URL" -1 -f migrations/0001_init.sql
# or
npm run db:migrate
```

**2. Supabase SQL editor, split in two.** If you would rather paste, use the two
parts rather than the 1,179-line combined file — a long paste is where editors
truncate or autoformat:

```
migrations/0001_init.part1_schema.sql    (850 lines)  → run first
migrations/0001_init.part2_seed.sql      (349 lines)  → run second
```

Both are generated from the combined file and produce an identical database;
verified by running each path against PostgreSQL 16 and comparing row counts.

**3. Supabase SQL editor, combined file.** Works, but paste it in one go and
check the editor received all 1,179 lines before running.

### Updating seeded content after the first install

`0001_init.sql` seeds settings with `ON CONFLICT (key) DO NOTHING`. That is
correct for a seed — re-running it must never overwrite copy the firm has
since edited — but it also means re-running cannot *correct* a row. A content
fix therefore needs its own migration that says so:

```bash
psql "$DATABASE_URL" -f migrations/0003_update_about_content.sql
```

`0003` sets the full four-paragraph "Who We Are" text and the four images that
go with it. Safe to re-run; it touches three `site_settings` rows and nothing
else.

### If the API says `permission denied for table ...`

```
permission denied for table admin_users          (code 42501)
```

The tables exist but the role cannot touch them. On Supabase, `service_role`
bypasses RLS yet is still subject to ordinary table privileges, so every query
fails until they are granted. Apply the standalone fix — it changes no data and
is safe to re-run:

```bash
psql "$DATABASE_URL" -f migrations/0002_fix_privileges.sql
```

or paste that file into the SQL editor. `0001_init.sql` now contains the same
grants (section 11b), so a fresh install does not need it.

The server reports this distinctly at boot rather than leaving you to read a
scheduler stack trace: it tells apart "schema missing" (42P01) from
"privileges missing" (42501) and prints the command that fixes each.

### If you hit a syntax error on a word from the article text

An error like `relation "enforceable" does not exist`, or `syntax error at or
near "s"`, means a quote character was altered somewhere in the paste — one
mangled apostrophe shifts quote parity and the parser reads the remaining prose
as SQL. Some of those words (`into`, `as`, `order`) are SQL keywords, which is
why the error names a word from an article rather than pointing at the real spot.

Seed prose is dollar-quoted (`$txt$…$txt$`) specifically so this cannot happen,
since a dollar-quoted string is not terminated by an apostrophe. If you still
see it, the paste was truncated — use psql, or the two-part files.

### What gets seeded

| | |
|---|---|
| Practice areas | 13, in the original order |
| Industries | 11, with their descriptions — these are the hero carousel slides |
| Team members | 12 (Okonkwo Michael carried over but deactivated — he was commented out in v1, so he is restorable with a toggle rather than retyping) |
| Publications | 27, with their Google Drive links preserved as provenance |
| Categories | 10, with the 27 articles sorted into them |
| Achievements | 4 |
| Site settings | 34 — hero copy, vision, mission, address, socials, SEO defaults |

There is no `BEGIN`/`COMMIT` in the file: the Supabase editor already runs a
batch inside its own transaction, and a nested `COMMIT` ends it early. Use
`psql -1` when you want all-or-nothing.

### The administrator account

There is **no registration endpoint anywhere in the API**. The first account exists only
because `npm run db:seed:admin` created it, and every later account because a super-admin
invited a colleague from the dashboard.

The seed is a script rather than an INSERT in the migration because the password must be
bcrypt-hashed by the application — a plaintext password committed to a `.sql` file would
live forever in the repository history.

```bash
# with SEED_ADMIN_PASSWORD set in .env
npm run db:seed:admin

# or leave it unset and the script prompts for one
npm run db:seed:admin
```

Re-running it reports the existing account rather than overwriting it.

---

## Bringing the v1 articles across from Drive

The 27 publications migrated from v1 arrive with a `source_url` and no body,
so the article page has nothing to render. This pulls each document down,
converts it, and stores it as article HTML:

```bash
npm run db:import-drive            # import everything still empty
npm run db:import-drive -- --dry   # report what it would do, change nothing
npm run db:import-drive -- --slug=ai-governance-why-should-you-care
```

It only ever fills an **empty** body, so it is safe to re-run and cannot
overwrite an article someone has since edited in the dashboard.

Each document must be shared as *anyone with the link can view*. Anything
still restricted is listed at the end with the reason; fix the sharing in
Drive and run it again.

Google Docs convert cleanly to editable HTML. A **PDF** cannot be converted
faithfully — it describes glyph positions, not headings — so those are
reported and should be uploaded through the dashboard instead, where the
article page renders them in an inline reader. Either way the reader stays on
the site.

## Scripts

| | |
|---|---|
| `npm run dev` | Development server with reload |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run the compiled build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Apply the migration |
| `npm run db:seed:admin` | Create the administrator |
| `npm run db:import-drive` | Pull the v1 articles down from Google Drive |
| `npm run openapi:export` | Write `openapi.json` for Postman or client generation |
| `npm run mail:preview` | Render all 13 email templates to `.mail-preview/` |

`mail:preview` is worth knowing about: email templates are easy to break without
noticing, and this renders every one to a browsable HTML file in about two seconds without
sending anything.

---

## Layout

```
src/
├── domain/              Entities and repository interfaces. Depends on nothing.
├── application/         Services (business rules), Zod DTOs, email templates.
├── infrastructure/      Supabase repositories, SMTP mailer, storage, container.
├── presentation/        Express routes, controllers, middleware, OpenAPI.
├── shared/              Config, errors, logging, utilities.
└── scripts/             Migration, seeding, previews.
```

Dependencies point inward: `presentation → application → domain`, with
`infrastructure` implementing the domain's interfaces. `infrastructure/container.ts` is
the only file that calls `new` on a repository.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for why, and
[`docs/API.md`](docs/API.md) for the endpoint reference.

---

## What the dashboard can manage

| Area | |
|---|---|
| **Publications** | Draft, schedule, publish, feature. Rich-text body, cover thumbnail, categories, tags, SEO fields, file attachments, view counts |
| **Categories** | Create, reorder, colour-code |
| **Practice areas** | The 13 from v1 — edit, reorder, deactivate |
| **Industries** | The 11 from v1 |
| **Team** | Members, roles, bios, photos, legal/non-legal grouping, ordering |
| **Testimonials** | Replacing v1's five identical lorem-ipsum placeholders |
| **Achievements** | The four homepage counters |
| **Media library** | Uploads to Supabase Storage, alt text, captions, folders |
| **Site settings** | Hero copy, vision, mission, address, phone, socials, SEO defaults, feature switches |
| **Enquiries** | The client intake queue — statuses, internal notes, emailed replies |
| **Newsletter** | Subscribers, double opt-in, CSV export, campaigns |
| **Operator accounts** | Invite colleagues, assign roles, deactivate (super-admin only) |
| **Audit log** | Every change, with before and after state (super-admin only) |
| **Email log** | Every send attempt and its outcome (super-admin only) |

---

## Brand tokens

All colours live in `src/application/mail/templates/brand.ts`, mirroring
`frontend/src/lib/brand.ts`. The frontend's `npm run brand:check` compares the
two files and fails the build when they disagree, so an email and a web page
cannot drift into different shades of the same brand.

| Token | Value | Where it comes from |
|---|---|---|
| primary | `#255859` | v1 `tailwind.config.ts`, verbatim |
| secondary | `#c19766` | v1 `tailwind.config.ts`, verbatim |
| ink | `#2c2c2c` | the wordmark colour inside `neoteric.svg` |
| muted / soft / line | zinc 500 / 400 / 200 | what v1 used in practice (`text-zinc-500`, `border-zinc-200`) |

## Email

13 transactional templates, all in the firm's colours (`#255859` teal, `#c19766` bronze),
table-based and inline-styled so they survive Outlook, with a proper plain-text
alternative for each — which is what spam filters read and what a watch notification falls
back to.

Account: welcome, invite, password reset, password changed, sign-in alert, deactivation.
Enquiries: notification to the firm, acknowledgement to the sender, emailed reply.
Newsletter: confirmation, welcome, new publication, campaign, unsubscribe.

---

## Deployment

```bash
docker build -t neoteric-api .
docker run -p 4000:4000 --env-file .env neoteric-api
```

The image is multi-stage, runs as a non-root user, and has a healthcheck. On any Node
host, `npm ci && npm run build && npm start` is equivalent.

- `GET /health` — liveness. Deliberately does not touch the database, so a brief database
  blip cannot restart a healthy container and make the outage worse.
- `GET /ready` — readiness. Checks the database and returns 503 when it is unreachable.

Set `trust proxy` correctly for your platform (it is set to `1` for a single load
balancer); otherwise rate limiting buckets every visitor under the proxy's IP.

**Scaling past one instance**: the scheduled-publishing interval in `server.ts` must move
to a single worker or take a Postgres advisory lock first, or two instances will publish
and announce the same article twice.

---

## Verified

The following were checked against a running build rather than assumed:

- `migrations/0001_init.sql` applies cleanly to PostgreSQL 16 and is idempotent on re-run;
  seed counts, slug generation, full-text search and both views were queried back.
- `tsc --noEmit` passes with `strict`, `noUncheckedIndexedAccess` and `noUnusedLocals`.
- The server boots, serves 96 operations, and survives an unreachable database without
  crashing.
- `POST /auth/register`, `/auth/signup` and `/register` return 404 — there is no
  registration path.
- Every `/admin/*` route returns 401 anonymously; an `editor` token returns 403 on
  super-admin routes; a token signed with the wrong secret is rejected as `TOKEN_INVALID`.
- Validation returns field-level issues on both the login and contact endpoints.
- All 13 email templates render.
- `ts-prune` reports zero unused exports; `depcheck` reports zero unused dependencies.
- `application/` imports nothing from `infrastructure/`, and `domain/` imports nothing
  concrete at all — both checked by grep, not by assertion.
- ESLint passes with no warnings.
- The 99 endpoints in `docs/API.md` are generated from the live spec, so the reference
  cannot drift from the server.
