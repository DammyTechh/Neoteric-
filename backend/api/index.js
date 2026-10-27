/**
 * Vercel serverless entry point.
 *
 * Vercel runs `npm run build` first (tsc + tsc-alias → dist/), then bundles
 * this file as a function. Every request is rewritten here by vercel.json, so
 * the full Express app — routes, Swagger docs, health checks — is served from
 * one function, exactly as it is by `npm start`.
 *
 * src/server.ts is not used on Vercel: there is no port to listen on, and the
 * one-minute scheduler is replaced by the cron in api/cron/publish-scheduled.js.
 */
const { createApp } = require('../dist/app');

module.exports = createApp();
