// /admin/upload — image upload tool. Now parent-PIN-gated like the rest of the
// merged admin (was previously behind the retired admin/admin portal).
// Cookie check runs server-side so unauthenticated users never see the UI flash.
import { redirect } from 'next/navigation';
import { isParentAuthenticated } from '@/lib/money/parent';
import UploadClient from './UploadClient';

export const dynamic = 'force-dynamic';

export default async function AdminUploadPage() {
  if (!(await isParentAuthenticated())) {
    redirect('/admin/mp-bank/login');
  }
  return <UploadClient />;
}
