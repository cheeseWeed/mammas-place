// POST /api/drive/login
// Body: { user: string, pin: string }
// Hash PIN, compare to stored hash. 200 + set cookie on match, 401 otherwise.
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  hashPin,
  isValidPin,
  isValidUser,
  normalizeUser,
  readStore,
} from '@/lib/drive-progress';
import { DL_COOKIE_MAX_AGE_SEC } from '@/lib/auth-touch';

const COOKIE_NAME = 'dl_user';
// 8-hour absolute TTL (shared constant — see lib/auth-touch.ts for the full
// rationale). Server-issued maxAge means powered-off laptops / browser
// crashes still log the kid out after 8 hours. An active session stays alive
// because authed API calls (earn / progress / balance / audiobooks) call
// touchSession() to slide the window forward.
//
// History: 2h was picked on 2026-05-30 for the shared family laptop, but a
// driver-license study session outlasts 2h — kids were logged out mid-quiz
// (lilly, feedback 2026-07). Bumped to 8h + sliding refresh.
const COOKIE_MAX_AGE_SEC = DL_COOKIE_MAX_AGE_SEC;

export async function POST(req: NextRequest) {
  let body: { user?: unknown; pin?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!isValidUser(body.user) || !isValidPin(body.pin)) {
    return NextResponse.json({ error: 'Wrong name or PIN.' }, { status: 401 });
  }

  const userKey = normalizeUser(body.user);
  const store = await readStore();
  const record = store.users[userKey];

  if (!record || record.pinHash !== hashPin(body.pin)) {
    return NextResponse.json({ error: 'Wrong name or PIN.' }, { status: 401 });
  }

  const cookieJar = await cookies();
  cookieJar.set(COOKIE_NAME, userKey, {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SEC,
  });

  return NextResponse.json({ ok: true, user: userKey });
}
