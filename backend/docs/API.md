# Neoteric LP API — endpoint reference

**Version 2.0.0** · Base URL `/api/v1` · Interactive docs at `/api/docs`

This table is generated from the OpenAPI document (`npm run openapi:export`), so it
cannot drift from the running server. For request and response bodies, use the Swagger
UI at `/api/docs` — it is the authoritative reference.

---

## Conventions

### Response envelope

Every endpoint answers in one of two shapes.

```jsonc
// success
{ "success": true, "message": "Optional", "data": { }, "meta": { } }

// failure
{ "success": false, "error": { "code": "NOT_FOUND", "message": "..." }, "requestId": "..." }
```

Branch on `error.code`. It is stable. `error.message` is written for humans and may be
reworded without notice.

| Code | Status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400/422 | Field-level problems; see `error.issues` |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `ACCOUNT_LOCKED` | 401 | Too many failed sign-in attempts |
| `ACCOUNT_DISABLED` | 401 | The account was deactivated |
| `TOKEN_EXPIRED` | 401 | Access token expired — refresh it |
| `TOKEN_INVALID` | 401 | Token is malformed, revoked or forged |
| `FORBIDDEN` | 403 | Authenticated, but the role is insufficient |
| `NOT_FOUND` | 404 | No such record |
| `CONFLICT` | 409 | Conflicts with existing data |
| `UNPROCESSABLE` | 422 | Valid shape, but not a legal operation |
| `PAYLOAD_TOO_LARGE` | 413 | Upload exceeds the size limit |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | File type not accepted |
| `RATE_LIMITED` | 429 | Too many requests |
| `STORAGE_FAILED` | 502 | Supabase Storage is unreachable |
| `MAIL_FAILED` | 502 | SMTP send failed |
| `INTERNAL_ERROR` | 500 | A bug. `requestId` ties it to the server log |

### Pagination

List endpoints accept `page`, `limit` (max 100), `sortBy`, `sortDirection` and `search`,
and return a `meta` block:

```json
{ "page": 1, "limit": 20, "total": 27, "totalPages": 2, "hasNext": true, "hasPrevious": false }
```

`sortBy` is checked against a per-endpoint allow-list rather than escaped, because it is
interpolated into an `ORDER BY` clause where escaping would not be enough. An
unrecognised value falls back to the default rather than erroring.

### Authentication

```
POST /api/v1/auth/login   →  { accessToken, refreshToken, user, mustChangePassword }
```

Send `Authorization: Bearer <accessToken>`. Access tokens last 15 minutes; exchange the
refresh token at `POST /auth/refresh`, which **rotates** it — the old one is revoked, so a
stolen refresh token is usable at most once.

Both tokens are also set as `httpOnly` cookies, so a browser dashboard need not keep a
token anywhere reachable by injected script. Either mechanism works; use whichever suits
the client.

> **There is no registration endpoint.** The first administrator is created by
> `npm run db:seed:admin`. Every later account is created by an existing super-admin at
> `POST /admin/admins`. `POST /auth/register`, `/signup` and similar return 404 — verified,
> not assumed.

### Roles

| Role | Scope |
|---|---|
| `editor` | Publications, media, firm content |
| `admin` | The above, plus enquiries, newsletter, settings, deletions |
| `super_admin` | Everything, including operator accounts and the audit log |

`super_admin` implies every lower permission, so routes declare only the minimum they need.

### Rate limits

| Scope | Budget |
|---|---|
| General API | 300 requests / 15 min |
| Sign-in, password reset | 10 / 15 min (successful sign-ins are not counted) |
| Contact form, newsletter sign-up | 5 / 15 min |

---

## Endpoints

### Health

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | No | Liveness probe |
| `GET` | `/ready` | No | Readiness probe |

### Auth

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/login` | No | Sign in |
| `POST` | `/auth/refresh` | No | Exchange a refresh token |
| `POST` | `/auth/logout` | No | Sign out of this session |
| `POST` | `/auth/logout-all` | Yes | Sign out of every device |
| `GET` | `/auth/me` | Yes | The signed-in operator |
| `PATCH` | `/auth/me` | Yes | Update your own profile |
| `POST` | `/auth/forgot-password` | No | Request a password-reset link |
| `POST` | `/auth/reset-password` | No | Complete a password reset |
| `POST` | `/auth/change-password` | Yes | Change your password |
| `GET` | `/auth/config` | No | Public auth configuration |

### Site

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/site/homepage` | No | Everything the homepage needs |
| `GET` | `/settings` | No | Public site settings |

### Publications (public)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/publications` | No | The News & Publications index |
| `GET` | `/publications/categories` | No | Categories with article counts |
| `GET` | `/publications/sitemap` | No | Published slugs and timestamps |
| `GET` | `/publications/{slug}` | No | Read one article |

### Content (public)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/practice-areas` | No | List practice areas |
| `GET` | `/practice-areas/{slug}` | No | Get one practice area by slug |
| `GET` | `/industries` | No | List industries |
| `GET` | `/industries/{slug}` | No | Get one industry by slug |
| `GET` | `/team` | No | List team members |
| `GET` | `/team/{slug}` | No | Get one team member by slug |
| `GET` | `/testimonials` | No | List testimonials |
| `GET` | `/achievements` | No | List achievements |

### Forms (public)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/contact` | No | Submit the contact form |
| `POST` | `/newsletter/subscribe` | No | Subscribe to publication updates |
| `GET` | `/newsletter/confirm` | No | Confirm a subscription |
| `GET` | `/newsletter/unsubscribe` | No | Unsubscribe |

### Publications (admin)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/admin/publications` | Yes | List all publications |
| `POST` | `/admin/publications` | Yes | Create a publication |
| `GET` | `/admin/publications/{id}` | Yes | Get one publication |
| `PATCH` | `/admin/publications/{id}` | Yes | Update a publication |
| `DELETE` | `/admin/publications/{id}` | Yes | Delete a publication |
| `POST` | `/admin/publications/{id}/publish` | Yes | Publish now |
| `POST` | `/admin/publications/{id}/unpublish` | Yes | Return to draft |
| `POST` | `/admin/publications/{id}/feature` | Yes | Toggle the featured flag |
| `POST` | `/admin/publications/{id}/attachments` | Yes | Attach a file to an article |
| `GET` | `/admin/categories` | Yes | List categories |
| `POST` | `/admin/categories` | Yes | Create a category |

### Content (admin)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/admin/practice-areas` | Yes | List all practice areas |
| `POST` | `/admin/practice-areas` | Yes | Create a practice area |
| `POST` | `/admin/practice-areas/reorder` | Yes | Reorder practice areas |
| `GET` | `/admin/practice-areas/{id}` | Yes | Get one practice area |
| `PATCH` | `/admin/practice-areas/{id}` | Yes | Update a practice area |
| `DELETE` | `/admin/practice-areas/{id}` | Yes | Delete a practice area |
| `GET` | `/admin/industries` | Yes | List all industries |
| `POST` | `/admin/industries` | Yes | Create a industry |
| `POST` | `/admin/industries/reorder` | Yes | Reorder industries |
| `GET` | `/admin/industries/{id}` | Yes | Get one industry |
| `PATCH` | `/admin/industries/{id}` | Yes | Update a industry |
| `DELETE` | `/admin/industries/{id}` | Yes | Delete a industry |
| `GET` | `/admin/team` | Yes | List all team members |
| `POST` | `/admin/team` | Yes | Create a team member |
| `POST` | `/admin/team/reorder` | Yes | Reorder team members |
| `GET` | `/admin/team/{id}` | Yes | Get one team member |
| `PATCH` | `/admin/team/{id}` | Yes | Update a team member |
| `DELETE` | `/admin/team/{id}` | Yes | Delete a team member |
| `GET` | `/admin/testimonials` | Yes | List all testimonials |
| `POST` | `/admin/testimonials` | Yes | Create a testimonial |
| `POST` | `/admin/testimonials/reorder` | Yes | Reorder testimonials |
| `GET` | `/admin/testimonials/{id}` | Yes | Get one testimonial |
| `PATCH` | `/admin/testimonials/{id}` | Yes | Update a testimonial |
| `DELETE` | `/admin/testimonials/{id}` | Yes | Delete a testimonial |
| `GET` | `/admin/achievements` | Yes | List all achievements |
| `POST` | `/admin/achievements` | Yes | Create a achievement |
| `POST` | `/admin/achievements/reorder` | Yes | Reorder achievements |
| `GET` | `/admin/achievements/{id}` | Yes | Get one achievement |
| `PATCH` | `/admin/achievements/{id}` | Yes | Update a achievement |
| `DELETE` | `/admin/achievements/{id}` | Yes | Delete a achievement |

### Media

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/admin/media` | Yes | Browse the media library |
| `POST` | `/admin/media/upload` | Yes | Upload one file |
| `POST` | `/admin/media/upload-many` | Yes | Upload several files |
| `PATCH` | `/admin/media/{id}` | Yes | Update alt text, caption or folder |
| `DELETE` | `/admin/media/{id}` | Yes | Delete a file |

### Settings

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/admin/settings` | Yes | All settings, including private ones |
| `PUT` | `/admin/settings` | Yes | Save several settings at once |
| `PATCH` | `/admin/settings/key/{key}` | Yes | Update one setting |

### Inquiries

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/admin/inquiries` | Yes | The client enquiry queue |
| `GET` | `/admin/inquiries/counts` | Yes | Enquiry counts by status |
| `GET` | `/admin/inquiries/{id}` | Yes | Read one enquiry |
| `PATCH` | `/admin/inquiries/{id}` | Yes | Update status or internal note |
| `POST` | `/admin/inquiries/{id}/respond` | Yes | Email a response |

### Newsletter

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/admin/newsletter/subscribers` | Yes | List subscribers |
| `GET` | `/admin/newsletter/subscribers/export` | Yes | Export the confirmed list as CSV |
| `GET` | `/admin/newsletter/campaigns` | Yes | List campaigns |
| `POST` | `/admin/newsletter/campaigns` | Yes | Draft a campaign |
| `GET` | `/admin/newsletter/campaigns/{id}` | Yes | Read one campaign |
| `PATCH` | `/admin/newsletter/campaigns/{id}` | Yes | Edit a draft campaign |
| `DELETE` | `/admin/newsletter/campaigns/{id}` | Yes | Delete a campaign |
| `POST` | `/admin/newsletter/campaigns/{id}/send` | Yes | Send a campaign |

### Admin users

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/admin/admins` | Yes | List operator accounts |
| `POST` | `/admin/admins` | Yes | Create an account for a colleague |
| `PATCH` | `/admin/admins/{id}` | Yes | Update an account |
| `DELETE` | `/admin/admins/{id}` | Yes | Delete an account |

### Observability

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/admin/dashboard/stats` | Yes | Dashboard counters |
| `GET` | `/admin/audit-logs` | Yes | The audit trail |
| `GET` | `/admin/email-logs` | Yes | Email delivery log |

---

## Notes on particular endpoints

### `GET /publications` — the News & Publications index

The v2 centrepiece. In v1 this was a hardcoded array where each item was a title,
a truncated description and a link out to Google Drive. Now:

- Only `status = 'published'` rows with a `published_at` in the past are ever returned.
  `publishedOnly` is forced on server-side, so no query string can surface a draft.
- Each item carries `coverImageUrl` — the thumbnail the index grid renders.
- Filter with `?categorySlug=corporate-commercial`, `?tag=...`, `?search=...`.

### `GET /publications/{slug}` — the article page

Returns the article, three related pieces, and previous/next navigation, and increments
the view counter on a detached promise so a counting failure cannot break the page.

**`body` may be null.** The 27 articles migrated from v1 have no body yet — only the
original Drive link in `sourceUrl`. The frontend should render `body` when present and
fall back to `sourceUrl` otherwise. As the firm rewrites each piece in the dashboard, that
fallback stops being used, article by article, with no code change and no broken links.

### `POST /contact`

Files the enquiry, emails the firm (with `Reply-To` set to the sender, so hitting reply in
the inbox works), and sends an acknowledgement carrying a reference like `NLP-2026-0042`.

Carries a honeypot field named `website`. A filled value is **accepted and silently filed
as spam** rather than rejected — rejecting it would teach a bot which field to leave alone.

### `POST /admin/media/upload`

Images are validated against their magic numbers, not merely the declared `Content-Type`,
which is attacker-controlled. Identical re-uploads are detected by SHA-256 and return the
existing record instead of storing a second copy. If the catalogue row fails to write, the
stored object is removed rather than left orphaned.

### `POST /admin/newsletter/campaigns/{id}/send`

Sends in batches of 20 with a one-second pause, so the relay does not rate-limit or
greylist the run. One failed recipient is counted and skipped; the batch is not aborted.
Every message carries RFC 8058 `List-Unsubscribe` headers, which Gmail and Yahoo require
on bulk mail.
