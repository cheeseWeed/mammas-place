// Server component — gates the MP Bank dashboard.
// Cookie check runs on the server so unauthenticated parents never see the
// dashboard shell flash. Authenticated → render the client dashboard.
import { redirect } from 'next/navigation';
import { isParentAuthenticated } from '@/lib/money/parent';
import MpBankDashboard from '@/components/admin/MpBankDashboard';

export const dynamic = 'force-dynamic';

export default async function MpBankPage() {
  if (!(await isParentAuthenticated())) {
    redirect('/admin/mp-bank/login');
  }
  return <MpBankDashboard />;
}
