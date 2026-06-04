// GET /api/admin/whoami — lightweight identity probe for the header badge.
//
// The header is a client component and CAN'T read the httpOnly `mp_parent`
// godmode cookie, so it asks the server. Returns:
//   { isAdmin, impersonating, user }
// where `user` is the impersonated/kid username (from dl_user) if any.
//
// No gate — anyone may ask "who am I?"; we only ever report the caller's own
// state, never anyone else's.
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isParentAuthenticated } from '@/lib/money/parent';

const DL_COOKIE = 'dl_user';
const RETURN_COOKIE = 'mp_admin_return';

export async function GET() {
  const jar = await cookies();
  const isAdmin = await isParentAuthenticated();
  const dl = jar.get(DL_COOKIE)?.value || null;
  const user = dl && dl !== '__anon__' ? dl : null;
  // Only report impersonation when the borrowed session is STILL active — the
  // marker must be present AND match the live dl_user. A stale mp_admin_return
  // left behind after logout (dl_user cleared) is not impersonation.
  const marker = jar.get(RETURN_COOKIE)?.value || null;
  const impersonating = marker && user && marker === user ? marker : null;
  return NextResponse.json({ isAdmin, impersonating, user });
}
