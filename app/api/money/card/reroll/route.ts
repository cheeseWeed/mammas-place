// POST /api/money/card/reroll
// Parent-gated. Body: { userName }. Rotates the kid's MP account card
// number — used when a card leaks. Returns the new number.
//
// (Lives under /api/money/card/reroll rather than the planned
// /api/money/admin/card/reroll path because there's no other /card endpoints
// that need to coexist with it for Phase 6a — keeps the URL short and the
// parent gate is enforced at the handler regardless.)
import { NextRequest, NextResponse } from 'next/server';
import { isValidUser } from '@/lib/drive-progress';
import { formatCard, rerollCardForUser } from '@/lib/money/card';
import { isParentAuthenticated } from '@/lib/money/parent';

export async function POST(req: NextRequest) {
  if (!(await isParentAuthenticated())) {
    return NextResponse.json({ error: 'Parent login required' }, { status: 401 });
  }

  let body: { userName?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!isValidUser(body.userName)) {
    return NextResponse.json({ error: 'Bad userName' }, { status: 400 });
  }

  try {
    const cardNumber = await rerollCardForUser(body.userName as string);
    return NextResponse.json({
      ok: true,
      cardNumber,
      formatted: formatCard(cardNumber),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'User not found') {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
