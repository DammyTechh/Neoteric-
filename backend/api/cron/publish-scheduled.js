/**
 * Publishes scheduled articles whose time has arrived.
 *
 * On a long-running server src/server.ts does this every minute in-process.
 * Serverless functions do not stay alive between requests, so on Vercel the
 * same work is triggered by a Vercel Cron Job (see "crons" in vercel.json).
 *
 * Vercel signs cron requests with `Authorization: Bearer $CRON_SECRET` when
 * the CRON_SECRET environment variable is set. Set it, so nobody else can
 * trigger this endpoint.
 */
const { container } = require('../../dist/infrastructure/container');

module.exports = async function handler(req, res) {
  const secret = process.env.CRON_SECRET;

  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid cron secret' },
    });
  }

  try {
    const published = await container.services.publications.runScheduledPublishing();
    return res.status(200).json({ success: true, data: { published } });
  } catch (error) {
    console.error('scheduled publishing failed', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Scheduled publishing failed' },
    });
  }
};
