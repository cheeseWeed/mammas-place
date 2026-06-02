// Shared server-side auth resolution for family routes.
//
// Three gates:
//   - member:  logged-in user (dl_user cookie) who belongs to SOME family.
//   - parent:  member who is also listed as a parent of that family.
//   - admin:   the app Admin (existing mp_parent cookie) — top tier, can grant
//              parent status and create families.

import 'server-only';
import { cookies } from 'next/headers';
import { isValidUser, normalizeUser } from '../drive-progress';
import { isParentAuthenticated } from '../money/parent';
import { familyOf, isFamilyParent } from './family';

const COOKIE_NAME = 'dl_user';

export async function currentUser(): Promise<string | null> {
  const jar = await cookies();
  const c = jar.get(COOKIE_NAME)?.value;
  if (!c || c === '__anon__' || !isValidUser(c)) return null;
  return normalizeUser(c);
}

export async function isAdmin(): Promise<boolean> {
  return isParentAuthenticated();
}

// Resolve the member context: who they are + which family they're in.
export async function memberContext(): Promise<{ user: string; familyId: string } | null> {
  const user = await currentUser();
  if (!user) return null;
  const familyId = await familyOf(user);
  if (!familyId) return null;
  return { user, familyId };
}

// Resolve a parent-of-family context. A user may MANAGE a family if they are a
// parent of it. Admin may manage ANY family (pass the familyId explicitly).
export async function parentContext(
  familyId?: string,
): Promise<{ user: string | 'admin'; familyId: string } | null> {
  // Admin path — must specify which family.
  if (await isAdmin()) {
    if (familyId) return { user: 'admin', familyId };
  }
  const user = await currentUser();
  if (!user) return null;
  const fam = familyId ?? (await familyOf(user));
  if (!fam) return null;
  if (await isFamilyParent(user, fam)) return { user, familyId: fam };
  return null;
}
