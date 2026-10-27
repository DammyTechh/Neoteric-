# Deploying the website to Vercel

Deploy the backend first (see the backend's `DEPLOY-VERCEL.md`); you need its URL.

## 1. Create the project

1. Push this folder to GitHub (on its own, or as `frontend/` in the monorepo).
2. In Vercel: **Add New → Project**, import the repo.
3. If it is the monorepo, set **Root Directory** to `frontend`.
4. Framework Preset: **Next.js** (detected automatically).

## 2. Environment variables

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `https://<backend-project>.vercel.app/api/v1` |
| `NEXT_PUBLIC_SITE_URL` | `https://www.neotericlp.com.ng` (or the Vercel URL until the domain is connected) |

These are read at build time, so **redeploy** after changing either one.

## 3. Finish the backend side

Add this site's URL to the backend's `CORS_ORIGINS` and set the backend's
`ADMIN_URL` to `https://<this-site>/admin`, then redeploy the backend.

## How the API connection works

The browser never calls the backend domain directly. It calls this site's own
`/api/v1/...`, and `next.config.mjs` proxies that to `NEXT_PUBLIC_API_URL`.
Server-rendered pages call the backend directly.

This is needed because the admin session's refresh token is an httpOnly
`SameSite=strict` cookie. With two separate Vercel domains, the browser would
not send it to the backend, and admins would be logged out on every page
reload. Through the proxy it is a first-party cookie.

## Custom domain

Add `www.neotericlp.com.ng` under **Settings → Domains**, then update
`NEXT_PUBLIC_SITE_URL`, and the backend's `CORS_ORIGINS` and `ADMIN_URL`.
