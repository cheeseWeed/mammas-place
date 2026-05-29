// POST /api/drive/reset
// Body: { user: string }
// Deletes the user's record entirely (PIN + all progress).
// Used by the "type reset to wipe" recovery flow.
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isValidUser, normalizeUser, readStore, writeStore } from '@/lib/drive-progress';

const COOKIE_NAME = 'dl_user';

export async function POST(req: NextRequest) {
  let body: { user?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!isValidUser(body.user)) {
    return NextResponse.json({ error: 'Bad user' }, { status: 400 });
  }
  const userKey = normalizeUser(body.user as string);
  const store = await readStore();
  if (!store.users[userKey]) {
    return NextResponse.json({ error: 'No record' }, { status: 404 });
  }
  delete store.users[userKey];
  await writeStore(store);

  // Best-effort: if the caller is logged in as that user, clear the cookie.
  const cookieJar = await cookies();
  const current = cookieJar.get(COOKIE_NAME)?.value;
  if (current === userKey) {
    cookieJar.delete(COOKIE_NAME);
  }

  return NextResponse.json({ ok: true });
}
