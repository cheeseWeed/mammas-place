// POST /api/image-store/trade   { recipient, offeredImageId, wantedImageId?, askCents?, note? }
// GET  /api/image-store/trade            -> { incoming, outgoing, history }
//
// Propose a kid-to-kid trade, or read this kid's trade queues.
//
// What this route refuses to trust (same list as /api/image-store/buy):
//   1. The PROPOSER — taken from the dl_user cookie, never from the body, so
//      nobody can give away another kid's artwork.
//   2. The OWNERSHIP — the DB decides, and decides again inside the accept
//      transaction. A body cannot assert "I own this".
//   3. The APPROVAL STATUS — the SERVER compares askCents against
//      TRADE_APPROVAL_THRESHOLD_CENTS. A client cannot post `status: 'pending'`
//      to skip a parent.
//
// Sabbath: proposing a trade is shopping-shaped (art and MP change hands), so
// Sunday is a 403 exactly like /api/image-store/buy. Reading your queues is not
// shopping and stays open.

import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@/lib/family/auth';
import { touchSession } from '@/lib/auth-touch';
import { isSabbath } from '@/lib/sabbath';
import { centsToMP } from '@/lib/money/format';
import {
  listIncoming,
  listOutgoing,
  listTradeHistory,
  proposeTrade,
} from '@/lib/image-store/trade';

export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: 'Log in to see your trades' }, { status: 401 });
  }
  const [incoming, outgoing, history] = await Promise.all([
    listIncoming(user),
    listOutgoing(user),
    listTradeHistory(user),
  ]);
  return NextResponse.json({ incoming, outgoing, history, user });
}

export async function POST(req: NextRequest) {
  if (isSabbath(new Date(), req.headers.get('cookie') ?? '')) {
    return NextResponse.json(
      { error: 'Trading is closed on the Sabbath. Come back tomorrow!', sabbath: true },
      { status: 403 },
    );
  }

  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: 'Log in to trade' }, { status: 401 });
  }
  await touchSession();

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const result = await proposeTrade(user, body.recipient, {
    offeredImageId: body.offeredImageId,
    wantedImageId: body.wantedImageId,
    askCents: body.askCents,
    note: body.note,
  });

  if (result.ok) {
    return NextResponse.json({
      ok: true,
      status: result.status,
      tradeId: result.tradeId,
      needsApproval: result.needsApproval,
      message: result.needsApproval
        ? `Your offer is big (${centsToMP(result.askCents)}), so a grown-up has to say yes before it goes through. We told them!`
        : 'Offer sent! They will see it next time they look at their trades.',
    });
  }

  // Every propose failure is a kid-readable sentence, never a stack trace.
  // 409 for "the world says no" (ownership, duplicates), 400 for malformed.
  const status =
    result.status === 'unknown-user' || result.status === 'unknown-image'
      ? 404
      : result.status === 'bad-ask'
        ? 400
        : 409;

  return NextResponse.json(
    { ok: false, status: result.status, error: result.message, message: result.message },
    { status },
  );
}
