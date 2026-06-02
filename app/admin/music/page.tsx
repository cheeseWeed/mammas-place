// Parent music admin — server-gated, mirrors /admin/mp-bank.
// Cookie check on the server so an unauthenticated parent is redirected
// before any dashboard shell renders.
import { redirect } from 'next/navigation';
import { isParentAuthenticated } from '@/lib/money/parent';
import MusicAdminDashboard from '@/components/admin/MusicAdminDashboard';

export const dynamic = 'force-dynamic';

export default async function AdminMusicPage() {
  if (!(await isParentAuthenticated())) {
    redirect('/admin/mp-bank/login');
  }
  return <MusicAdminDashboard />;
}
