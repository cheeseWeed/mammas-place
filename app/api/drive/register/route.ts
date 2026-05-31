// POST /api/drive/register
// Body: { user: string, pin: string, displayName?: string }
// If user doesn't exist: create record, set dl_user cookie, return 200.
// If user exists: return 409 "taken — enter PIN or pick another name."
//
// displayName is optional; when provided we store it on DriveUser so the UI
// can render "Lilly" instead of the lowercase "lilly" username. Goes straight
// to the DB after the legacy readStore/writeStore path runs, because the
// legacy ProgressStore shape doesn't carry displayName.
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
import { prisma } from '@/lib/prisma';

const COOKIE_NAME = 'dl_user';
// 2-hour absolute TTL. Server-issued maxAge means powered-off laptops /
// browser crashes still log the kid out after 2 hours. Multi-kid shared-
// laptop setup. See /api/drive/login for full rationale.
const COOKIE_MAX_AGE_SEC = 2 * 60 * 60;

// Best-effort displayName sanitization. Keep it short, strip dangerous junk,
// fall back to undefined if it's empty/invalid so the column stays NULL.
function sanitizeDisplayName(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim().slice(0, 30);
  if (!trimmed) return undefined;
  // Same charset window as the username validator, but allow mixed case.
  if (!/^[A-Za-z0-9 _'\-]+$/.test(trimmed)) return undefined;
  return trimmed;
}

export async function POST(req: NextRequest) {
  let body: { user?: unknown; pin?: unknown; displayName?: unknown };
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

  // Persist displayName (if provided) directly — the legacy ProgressStore
  // shape doesn't include it, so a follow-up update is the cleanest hook.
  // Optional per spec: only write when the caller actually sent a value.
  const displayName = sanitizeDisplayName(body.displayName);
  if (displayName) {
    try {
      await prisma.driveUser.update({
        where: { name: userKey },
        data: { displayName },
      });
    } catch {
      // Non-fatal: the user still registered. UI just falls back to `name`.
    }
  }

  const cookieJar = await cookies();
  cookieJar.set(COOKIE_NAME, userKey, {
    httpOnly: false, // client JS in dashboard reads this too
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SEC,
  });

  return NextResponse.json({ ok: true, user: userKey });
}
