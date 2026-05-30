// POST /api/drive/register
// Body: { user: string, pin: string }
// If user doesn't exist: create record, set dl_user cookie, return 200.
// If user exists: return 409 "taken — enter PIN or pick another name."
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  emptyUser,
  hashPin,
  isValidPin,
  isValidUser,
  normalizeUser,
  readStore,
  writeStore,
} from '@/lib/drive-progress';

const COOKIE_NAME = 'dl_user';
// Session cookie (no maxAge) — browser drops on window close. Multi-kid
// shared-laptop setup, requested by user 2026-05-30.

export async function POST(req: NextRequest) {
  let body: { user?: unknown; pin?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!isValidUser(body.user)) {
    return NextResponse.json(
      { error: 'Name must be 1-30 letters/numbers/spaces.' },
      { status: 400 },
    );
  }
  if (!isValidPin(body.pin)) {
    return NextResponse.json(
      { error: 'PIN must be exactly 4 digits.' },
      { status: 400 },
    );
  }

  const userKey = normalizeUser(body.user);
  const store = await readStore();

  if (store.users[userKey]) {
    return NextResponse.json(
      { error: 'taken — enter PIN or pick another name.' },
      { status: 409 },
    );
  }

  store.users[userKey] = emptyUser(hashPin(body.pin));
  await writeStore(store);

  const cookieJar = await cookies();
  cookieJar.set(COOKIE_NAME, userKey, {
    httpOnly: false, // client JS in dashboard reads this too
    sameSite: 'lax',
    path: '/',
    // No maxAge → session cookie, dropped on browser close.
  });

  return NextResponse.json({ ok: true, user: userKey });
}
