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
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

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
    maxAge: COOKIE_MAX_AGE,
  });

  return NextResponse.json({ ok: true, user: userKey });
}
