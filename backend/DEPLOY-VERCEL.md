# Deploying the API to Vercel

Deploy the **backend first**, because the frontend needs its URL.

## 1. Create the project

1. Push this folder to GitHub (on its own, or as `backend/` in the monorepo).
2. In Vercel: **Add New → Project**, import the repo.
3. If it is the monorepo, set **Root Directory** to `backend`.
4. Leave Framework Preset as **Other**. `vercel.json` already sets the install,
   build and output settings.

## 2. Environment variables

Add these under **Settings → Environment Variables** before the first deploy.
Generate secrets with `openssl rand -base64 48`.

| Variable | Required | Value |
| --- | --- | --- |
| `NODE_ENV` | yes | `production` |
| `SUPABASE_URL` | yes | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Supabase service-role key (server only) |
| `JWT_ACCESS_SECRET` | yes | at least 32 characters |
| `JWT_REFRESH_SECRET` | yes | at least 32 characters, different from the above |
| `CRON_SECRET` | yes | random string; secures the scheduled-publishing cron |
| `CORS_ORIGINS` | yes | your frontend URL(s), comma-separated, e.g. `https://neoteric.vercel.app,https://www.neotericlp.com.ng` |
| `ADMIN_URL` | yes | `https://<frontend-domain>/admin` (used in reset/invite emails) |
| `SITE_URL` | yes | public site URL, e.g. `https://www.neotericlp.com.ng` |
| `SMTP_PASSWORD` | yes | Resend API key (otherwise no email is sent) |
| `SUPABASE_STORAGE_BUCKET` | no | default `neoteric-media` |
| `MAIL_FROM_EMAIL`, `MAIL_REPLY_TO`, `MAIL_ADMIN_RECIPIENTS` | no | see `.env.example` |

Everything else in `.env.example` has a sensible default.

## 3. Database (one-time, from your computer)

Vercel does not run migrations. Before the first deploy, from this folder with a
local `.env` filled in:

```bash
npm install
npm run db:migrate        # needs DATABASE_URL
npm run db:seed:admin     # needs SEED_ADMIN_PASSWORD
```

Also create the Supabase Storage bucket (`neoteric-media`, public) if it does not
exist yet; on Vercel the API no longer creates it at startup.

## 4. Check it

- `https://<backend>.vercel.app/health` → `{"success":true,...}`
- `https://<backend>.vercel.app/api/docs` → Swagger UI

## How it runs on Vercel

- `api/index.js` serves the whole Express app as one serverless function;
  `vercel.json` rewrites every path to it. `src/server.ts` is only used for
  `npm start` / Docker.
- **Scheduled publishing**: `src/server.ts` checks every minute. On Vercel,
  `api/cron/publish-scheduled.js` does it through a Vercel Cron Job. The Hobby
  plan allows one run a day, so `vercel.json` schedules it daily at 06:00 UTC.
  On Pro, change the schedule to `*/5 * * * *` (every 5 minutes) or
  `* * * * *`.
- **Emails sent after a response** (contact-form notifications, publication
  announcements, login alerts) use Vercel's `waitUntil`, so they are not cut
  off when the function finishes.

## Limits to know about

- **Uploads**: Vercel caps a request body at 4.5 MB, so media and document
  uploads larger than that fail on Vercel, even though `UPLOAD_MAX_FILE_SIZE_MB`
  allows 15.
- **Rate limiting** is in-memory, so each function instance counts separately.
  Limits still apply, but they are looser than on a single server.
