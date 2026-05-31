// POST /api/money/gift-card/redeem
// Kid-authed (dl_user cookie required — anon visitors blocked). Body:
// { code }. Atomically redeems the gift card and credits the kid's balance
// via lib/money/gift-card.ts redeemGiftCard().
//
// Returns { ok, cents, balanceCents, note? } on success. On already-redeemed
// / revoked / not-found, returns a 4xx with a `kind` field so the client can
// render a friendly error (vs. leaking whether the code is wrong or used).
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isValidUser, normalizeUser } from '@/lib/drive-progress';
import { GiftCardError, redeemGiftCard } from '@/lib/money/gift-card';

const COOKIE_NAME = 'dl_user';

export async function POST(req: NextRequest) {
  const jar = await cookies();
  const cookieUser = jar.get(COOKIE_NAME)?.value;
  if (!cookieUser || cookieUser === '__anon__') {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }
  if (!isValidUser(cookieUser)) {
    return NextResponse.json({ error: 'Bad cookie' }, { status: 400 });
  }
  const userKey = normalizeUser(cookieUser);

  let body: { code?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (!code) {
    return NextResponse.json({ error: 'Code required', kind: 'not_found' }, { status: 400 });
  }

  try {
    const result = await redeemGiftCard({ code, userName: userKey });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof GiftCardError) {
      const status = err.kind === 'not_found' ? 404 : 409;
      return NextResponse.json({ error: err.message, kind: err.kind }, { status });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'User not found') {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
