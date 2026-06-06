// GET /api/money/balance?user=<name> → { cents: number }
// 404 if user not registered.
// Side effect: bumps the dl_user cookie's 2h TTL so active kids stay logged in.
// Side effect: lazily delivers any scheduled MP gifts whose deliver date has
//   passed (no cron on this stack — gifts "arrive" the first time the recipient
//   checks their balance on/after the date). See lib/money/gift.ts.
import { NextRequest, NextResponse } from 'next/server';
import { isValidUser, normalizeUser } from '@/lib/drive-progress';
import { readBalance } from '@/lib/money/balance';
import { deliverDueGifts } from '@/lib/money/gift';
import { touchSession } from '@/lib/auth-touch';

export async function GET(req: NextRequest) {
  const userParam = req.nextUrl.searchParams.get('user');
  if (!userParam || !isValidUser(userParam)) {
    return NextResponse.json({ error: 'Bad user param' }, { status: 400 });
  }
  const userKey = normalizeUser(userParam);
  // Deliver any due gifts BEFORE reading the balance so the credited MP is
  // reflected in the number we return. Never let a delivery hiccup 500 the
  // balance read.
  try {
    await deliverDueGifts(userKey);
  } catch {
    // ignore — the next read (or /gift/mine) will retry delivery
  }
  const cents = await readBalance(userKey);
  if (cents === null) {
    return NextResponse.json({ error: 'No record' }, { status: 404 });
  }
  await touchSession();
  return NextResponse.json({ cents });
}
