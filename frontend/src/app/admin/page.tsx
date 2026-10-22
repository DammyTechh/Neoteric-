import { redirect } from 'next/navigation';

/**
 * `/admin` itself has nothing to show.
 *
 * The guard on `/admin/dashboard` decides whether the person is signed in and
 * sends them to the login page if not, so this only has to forward.
 */
export default function AdminIndex() {
  redirect('/admin/dashboard');
}
