// /api/admin/impersonate — ADMIN-only "log in as any user" (no password).
//
// POST   { user }  → admin becomes that DriveUser: sets the `dl_user` cookie to
//                    them + an `mp_admin_return` marker cookie so the sitewide
//                    banner knows to offer "Return to admin". The admin keeps
//                    their `mp_parent` cookie throughout, so exiting just clears
//                    the impersonation and drops them back in the dashboard.
// DELETE           → stop impersonating: clear `dl_user` + the marker. The
//                    `mp_parent` cookie is untouched.
//
// Gate: must hold the parent/admin cookie. A kid can never reach this because
// isParentAuthenticated() checks `mp_parent`, which kid logins never set.

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isParentAuthenticated } from '@/lib/money/parent';
import { isValidUser, normalizeUser } from '@/lib/drive-progress';
import { prisma } from '@/lib/prisma';

const DL_COOKIE = 'dl_user';
const RETURN_COOKIE = 'mp_admin_return';
// Mirror the drive login TTL so an impersonated session expires on the same
// clock as a real kid session.
const DL_MAX_AGE_SEC = 2 * 60 * 60;
const RETURN_MAX_AGE_SEC = 2 * 60 * 60;

export async function POST(req: NextRequest) {
  if (!(await isParentAuthenticated())) {
    return NextResponse.json({ error: 'Admin login required' }, { status: 401 });
  }

  let body: { user?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!isValidUser(body.user)) {
    return NextResponse.json({ error: 'Bad user' }, { status: 400 });
  }
  const userKey = normalizeUser(body.user);

  // Confirm the target exists so we don't strand the admin in a ghost session.
  const exists = await prisma.driveUser.findUnique({ where: { name: userKey }, select: { name: true } });
  if (!exists) {
    return NextResponse.json({ error: 'No such user' }, { status: 404 });
  }

  const jar = await cookies();
  // dl_user matches the real /api/drive/login cookie shape (httpOnly:false so
  // client contexts like LearnerContext can read it).
  jar.set(DL_COOKIE, userKey, { httpOnly: false, sameSite: 'lax', path: '/', maxAge: DL_MAX_AGE_SEC });
  // Marker the banner reads. httpOnly:false on purpose — the client banner
  // needs to see it. Holds the impersonated name for the banner label.
  jar.set(RETURN_COOKIE, userKey, { httpOnly: false, sameSite: 'lax', path: '/', maxAge: RETURN_MAX_AGE_SEC });

  return NextResponse.json({ ok: true, user: userKey });
}

export async function DELETE() {
  // No admin-gate needed to STOP impersonating — anyone can exit a borrowed
  // session, and we only clear the borrowed identity, not the admin cookie.
  const jar = await cookies();
  jar.delete(DL_COOKIE);
  jar.delete(RETURN_COOKIE);
  return NextResponse.json({ ok: true });
}
