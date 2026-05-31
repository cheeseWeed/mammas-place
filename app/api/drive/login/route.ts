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

const COOKIE_NAME = 'dl_user';
// 2-hour absolute TTL. Server-issued maxAge means powered-off laptops /
// browser crashes still log the kid out after 2 hours. An active session
// stays alive because every authed API call refreshes this cookie (see
// lib/cookie-refresh.ts middleware-style helper).
//
// User picked 2h on 2026-05-30 as the right balance: short enough that
// a shared family laptop forgets a kid after a couple hours, long enough
// that a quick browser-close-and-reopen doesn't punish the active user.
const COOKIE_MAX_AGE_SEC = 2 * 60 * 60; // 7200

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
