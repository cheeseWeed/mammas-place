// POST /api/drive/change-pin
// Body: { user: string, currentPin: string, newPin: string }
// The kid changes their own PIN. Requires the CURRENT PIN (or the temporary
// one the admin handed them after a reset) — so a logged-out browser can't
// hijack an account. Both PINs must be valid 4-digit codes.
import { NextRequest, NextResponse } from 'next/server';
import {
  hashPin,
  isValidPin,
  isValidUser,
  normalizeUser,
  readStore,
  writeStore,
} from '@/lib/drive-progress';

export async function POST(req: NextRequest) {
  let body: { user?: unknown; currentPin?: unknown; newPin?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!isValidUser(body.user)) {
    return NextResponse.json({ error: 'Bad user' }, { status: 400 });
  }
  if (!isValidPin(body.currentPin) || !isValidPin(body.newPin)) {
    return NextResponse.json({ error: 'PINs must be exactly 4 digits.' }, { status: 400 });
  }
  if (body.currentPin === body.newPin) {
    return NextResponse.json({ error: 'New PIN must be different.' }, { status: 400 });
  }

  const userKey = normalizeUser(body.user as string);
  const store = await readStore();
  const record = store.users[userKey];

  if (!record || record.pinHash !== hashPin(body.currentPin as string)) {
    return NextResponse.json({ error: 'Wrong name or current PIN.' }, { status: 401 });
  }

  record.pinHash = hashPin(body.newPin as string);
  await writeStore(store);

  return NextResponse.json({ ok: true });
}
