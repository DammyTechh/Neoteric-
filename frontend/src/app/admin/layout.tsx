import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth';
import { ToastProvider } from '@/components/admin/ui';

export const metadata: Metadata = {
  title: { default: 'Dashboard', template: '%s · Neoteric LP Dashboard' },
  // The dashboard must never appear in a search result, whatever robots.txt
  // happens to say; this header is the instruction crawlers actually obey.
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Nothing under `/admin` is prerendered.
 *
 * Every page here is behind the auth guard and reads live data with a token
 * held in memory, so a build-time snapshot would be an empty shell at best.
 * Opting the whole segment out is also what lets these pages read the query
 * string — `?status=new`, `?open=<id>` — without each one needing its own
 * Suspense boundary to satisfy static export.
 */
export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>{children}</ToastProvider>
    </AuthProvider>
  );
}
