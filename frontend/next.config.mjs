/**
 * The backend API, e.g. https://neoteric-api.vercel.app/api/v1
 * Set NEXT_PUBLIC_API_URL in the Vercel project's environment variables.
 */
const backendApi = new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1');
const apiPath = backendApi.pathname.replace(/\/$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Publication covers and media-library images are served from Supabase Storage.
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }],
  },

  /**
   * Proxies browser API calls through this site's own domain, so the admin
   * refresh-token cookie stays first-party. See API_BASE in src/lib/api.ts.
   */
  async rewrites() {
    return [
      {
        source: `${apiPath}/:path*`,
        destination: `${backendApi.origin}${apiPath}/:path*`,
      },
    ];
  },
};

export default nextConfig;
