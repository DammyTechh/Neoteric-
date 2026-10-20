# Architecture

## The shape of it

Four layers, dependencies pointing inward only.

```
┌─────────────────────────────────────────────────────────────┐
│  presentation/     Express routes, controllers, middleware,  │
│                    the OpenAPI document                      │
│       ↓ depends on                                           │
│  application/      Services and DTOs — the business rules    │
│       ↓ depends on                                           │
│  domain/           Entities and interfaces. Depends on       │
│                    nothing but itself.                       │
│       ↑ implemented by                                       │
│  infrastructure/   Supabase, SMTP, storage                   │
└─────────────────────────────────────────────────────────────┘
```

`domain/` holds entities and the repository interfaces. It imports no framework and no
driver, which is what makes the rest of the arrangement enforceable rather than
aspirational: if a Supabase type ever appears in `domain/`, the layering has been broken
and it is visible in the diff.

`application/` depends on those interfaces, never on Supabase. `infrastructure/` supplies
the implementations. The two meet in exactly one place.

Both properties are mechanically checkable, and both currently hold:

```bash
grep -r "@infrastructure" src/application/   # no matches
grep -r "@infrastructure\|@presentation\|supabase\|express" src/domain/   # no matches
```

That is why `IContentRepository` exists in `domain/repositories`: the generic
`CrudService` needs slug lookup, ordering and a next-sort-position, and declaring that in
the domain is what lets the service depend on an interface rather than on
`BaseRepository`. Likewise `IMailer` carries `sendQuietly` and `close`, so no service has
to reach for the concrete `ResendMailer`.

Email templates live in `application/mail/templates` rather than beside the SMTP
transport. They are pure functions that render copy — the firm's words, not plumbing —
and keeping them out of `infrastructure/` is what lets the application layer stay free of
infrastructure imports entirely.

### The composition root

`src/infrastructure/container.ts` is the only file in the codebase that calls `new` on a
repository. Everything else receives its dependencies through a constructor.

That is not ceremony. It means swapping Supabase for `pg`, Prisma, or an in-memory fake
for tests is a change to that one file plus a new set of repository implementations — and
no service moves. It also means a service can be tested by handing it a stub object, with
no database, no network and no container.

## Why these choices

### Supabase client, not an ORM

The schema is a single migration the firm's developer can read, and the queries are
simple: filtered lists, a join to the category, a handful of counters. An ORM would add a
schema language that duplicates the SQL, a migration tool that generates files nobody
reads, and a query builder that still needs raw SQL for the full-text search.

The cost is that PostgREST's filter syntax is stringly-typed. That is confined to
`infrastructure/database/`, behind interfaces, which is where that kind of thing belongs.

### Own JWT auth, not Supabase Auth

The requirement is one seeded operator account and no public registration. Supabase Auth
is built for the opposite — self-service signup, email verification, social providers —
and switching all that off means trusting a dashboard toggle that someone can flip.

Owning the token lifecycle makes the no-registration guarantee checkable by reading
`auth.routes.ts`: there is no register handler, so there is no register route. It also
makes refresh-token rotation, account lockout and "sign out everywhere" straightforward
rather than something to work around.

### Service-role key, authorisation in the application

The API talks to Postgres with the service-role key, which bypasses Row Level Security.
Authorisation lives in `requireAuth` and `requireRole`, where it can be read in one file
and audited in one place.

RLS is still switched on for every table, with anon-readable policies for published
content only. That is defence in depth: if the anon key ever leaks, it reaches published
articles and nothing else — not drafts, not client enquiries, not the operator accounts.

### A generic CRUD service

Six content collections — practice areas, industries, team, testimonials, achievements,
categories — are structurally identical: an ordered list the admin creates, edits,
reorders and toggles. `CrudService` and `createCrudController` implement that once.

Six hand-written copies would be six places for a slug bug or a missing audit row to hide,
and they would drift. Publications, which has real behaviour of its own (publishing,
scheduling, sanitising, announcing), extends the same base and adds only what is genuinely
specific.

## Request lifecycle

```
request
  → helmet, cors, body parsing, cookies
  → requestContext        attaches a request id and IP, echoed in X-Request-Id
  → pino-http             structured log, health checks excluded
  → rate limiter
  → requireAuth           admin routes only; verifies the JWT, attaches the actor
  → requireRole           admin routes only
  → validate(schema)      Zod; replaces the input with the parsed, stripped result
  → controller            unwraps, calls a service, formats the envelope
      → service           business rules, sanitising, auditing, mail
          → repository    Supabase, row → entity mapping
  → errorHandler          the single place an error becomes a response
```

Validation replaces the request body with the parsed result rather than merely checking
it, so handlers downstream work with coerced, trimmed, typed data — and any field not in
the schema has been stripped before it can reach a repository.

The error handler reports known `AppError`s verbatim and reduces everything else to a
generic 500 with the stack in the log only. A driver message in a response body is an
information leak.

## Data model notes

### Publications

`body` is nullable on purpose. The 27 articles carried over from v1 have no body — only
the original Google Drive link in `source_url`. The article page renders `body` when it is
there and falls back to `source_url` otherwise, so the back catalogue can be rewritten one
piece at a time with no code change and no broken links. Nothing from v1 is lost on day
one, and nothing has to be migrated in a big bang.

Two check constraints keep the index query honest: a `published` row must carry a
`published_at`, and a `scheduled` row must carry a `scheduled_for`. Those are the two
invariants the feed depends on, so the database enforces them rather than trusting every
future code path to remember.

`search_vector` is maintained by a trigger with weighted fields (title A, excerpt and tags
B, body C) and backed by a GIN index. Reading time is computed in the same trigger, so it
cannot disagree with the body it describes.

### Site settings

Everything that was a magic string in the v1 React tree — hero copy, vision, mission, the
office address, phone number, social links, SEO defaults — is a row in `site_settings`,
keyed `group.field`. The public endpoint nests them, so the frontend reads
`settings.contact.phone` rather than searching a flat list.

`is_public` separates what the marketing site may read from what only the dashboard sees;
the feature switches are private.

### Audit log

Every create, update, delete and send is recorded with before and after state, the actor
and the IP. For a law firm this is not optional bookkeeping — "who changed that published
article, and when" is a question that will eventually be asked.

Audit writes never throw. An audit failure must not roll back the action it was
describing, and the alternative is a 500 on an otherwise successful edit.

## Operational notes

### Scheduled publishing

An in-process interval flips due articles to published every 60 seconds. The cadence is a
minute and the work is a single indexed `UPDATE`, so a queue would be more moving parts
than the problem deserves.

**If the API is ever scaled beyond one instance**, this must move to a single worker or
take a Postgres advisory lock — otherwise two instances will both publish the same article
and both announce it to the mailing list. The comment in `server.ts` says so at the call
site.

### Graceful shutdown

`SIGTERM` stops accepting connections, lets in-flight requests finish, closes the SMTP
pool, and forces exit after 15 seconds. Without it a deploy cuts off whatever was
mid-flight — including a newsletter send halfway through its recipient list.

### Email

Resend over SMTP rather than its REST API, so moving to SES, Postmark or a client's own
relay is four environment variables rather than a rewrite.

Every attempt is written to `email_logs`. When a client insists they never received an
acknowledgement, that question is answerable from the database instead of from memory.

Mail that is a side effect rather than the point — the contact-form notification, the
login alert — is sent through `sendQuietly`, which swallows failures. A client's enquiry
is already safely stored by then; an SMTP hiccup must not turn their submission into an
error page.

## What is deliberately not here

- **Tests.** There are none yet. The architecture is built for them — services take their
  dependencies through constructors and the interfaces are already defined — but writing
  them was not in scope for this pass. The first ones worth having are around
  `AuthService` (lockout, rotation, the enumeration-resistant login) and
  `PublicationService.normalise`.
- **Caching.** No Redis, no in-memory cache. At this traffic level Postgres is not the
  bottleneck, and a cache is a correctness problem waiting to happen. `GET /site/homepage`
  exists so the homepage makes one request instead of eight; that is the optimisation that
  was actually needed.
- **A job queue.** One periodic task, running every 60 seconds. See above.
