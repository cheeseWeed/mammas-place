// POST /api/money/gift-card/give
// Parent-gated. Body: { cents, user, note? }
// "Give a gift card directly to a kid" — mints a card AND immediately redeems
// it to the chosen kid's balance, so the admin doesn't have to print a code
// and have the kid type it. One step: their MP goes up right away. The card row
// is still recorded (minted + redeemed) so it shows in the gift-card log.
import { NextRequest, NextResponse } from 'next/server';
import { createGiftCard, redeemGiftCard } from '@/lib/money/gift-card';
import { isParentAuthenticated } from '@/lib/money/parent';
import { isValidUser, normalizeUser } from '@/lib/drive-progress';

export async function POST(req: NextRequest) {
  if (!(await isParentAuthenticated())) {
    return NextResponse.json({ error: 'Parent login required' }, { status: 401 });
  }

  let body: { cents?: unknown; user?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const cents = Number(body.cents);
  if (!Number.isInteger(cents) || cents <= 0 || cents > 1_000_000) {
    return NextResponse.json({ error: 'Bad cents' }, { status: 400 });
  }
  if (!isValidUser(body.user)) {
    return NextResponse.json({ error: 'Pick a kid to give it to' }, { status: 400 });
  }
  const userKey = normalizeUser(body.user as string);
  const note = typeof body.note === 'string' ? body.note : undefined;

  try {
    const card = await createGiftCard({ cents, note });
    const result = await redeemGiftCard({ code: card.code, userName: userKey });
    return NextResponse.json({
      ok: true,
      code: card.code,
      cents: result.cents,
      balanceCents: result.balanceCents,
      user: userKey,
      note: card.note,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'User not found') {
      return NextResponse.json({ error: 'No such kid' }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
