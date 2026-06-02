// /admin — legacy entry point. The product portal and MP Bank were merged into
// one parent-PIN-gated dashboard at /admin/mp-bank, so this just redirects.
// Kept so old bookmarks/links to /admin still land somewhere useful.
import { redirect } from 'next/navigation';

export default function AdminRedirectPage() {
  redirect('/admin/mp-bank');
}
