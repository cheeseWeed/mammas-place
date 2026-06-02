// /admin/dashboard — legacy product-management portal. Its product CRUD now
// lives as the Products tab inside the unified MP Bank dashboard, so this
// redirects there. Auth is the parent PIN (handled by /admin/mp-bank).
import { redirect } from 'next/navigation';

export default function AdminDashboardRedirectPage() {
  redirect('/admin/mp-bank?tab=products');
}
