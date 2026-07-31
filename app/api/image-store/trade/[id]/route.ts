// POST /api/image-store/trade/[id]   { action: 'accept' | 'decline' | 'cancel' }
//
// The SECOND of the two confirmations. Proposing was the first; this is where
// art and MP actually move.
//
// Auth: dl_user cookie. WHICH action a caller may take is decided by which side
// of the trade they are on, and that is checked in lib/image-store/trade.ts
// against the stored row — never against anything in the body:
//   * accept / decline -> the RECIPIENT only.
//   * cancel           -> the PROPOSER only.
//
// Nothing here decides an outcome. Every branch below is mapping a result VALUE
// from the trade engine onto a status code and a sentence a kid can read. The
// atomicity, the race guards, and the money all live in acceptTrade().
//
// Sabbath: accepting moves MP and artwork, so it is closed Sunday like buying.
// DECLINING and CANCELLING stay open every day — saying "no thanks" is not
// shopping, and a kid should never be stuck with an offer they cannot refuse.

import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@/lib/family/auth';
import { touchSession } from '@/lib/auth-touch';
import { isSabbath } from '@/lib/sabbath';
import { centsToMP } from '@/lib/money/format';
import { acceptTrade, cancelTrade, declineTrade, titleFor } from '@/lib/image-store/trade';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: 'Log in to answer a trade' }, { status: 401 });
  }
  await touchSession();

  const { id } = await params;

  let body: { action?: unknown };
  try {
    body = (await req.json()) as { action?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const action = typeof body.action === 'string' ? body.action.trim() : '';

  // --- decline / cancel: open every day, no money, no art movement ---

  if (action === 'decline' || action === 'cancel') {
    const result =
      action === 'decline' ? await declineTrade(user, id) : await cancelTrade(user, id);
    if (result.ok) {
      return NextResponse.json({
        ok: true,
        status: result.status,
        message:
          result.status === 'declined'
            ? 'No thanks sent. Nothing changed hands.'
            : 'Offer taken back. Nothing changed hands.',
      });
    }
    return NextResponse.json(
      { ok: false, status: result.status, error: result.message, message: result.message },
      { status: result.status === 'not-found' ? 404 : result.status === 'not-yours' ? 403 : 409 },
    );
  }

  if (action !== 'accept') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  // --- accept: this is the one that moves things ---

  if (isSabbath(new Date(), req.headers.get('cookie') ?? '')) {
    return NextResponse.json(
      { error: 'Trading is closed on the Sabbath. Your offer will still be here tomorrow!', sabbath: true },
      { status: 403 },
    );
  }

  const result = await acceptTrade(user, id);

  if (result.ok) {
    const got = titleFor(result.offeredImageId);
    const gave = result.wantedImageId ? titleFor(result.wantedImageId) : null;
    const rookie = result.offeredEditionNumber === 1;
    return NextResponse.json({
      ok: true,
      status: result.status,
      tradeId: result.tradeId,
      offeredImageId: result.offeredImageId,
      wantedImageId: result.wantedImageId,
      askCents: result.askCents,
      offeredEditionNumber: result.offeredEditionNumber,
      wantedEditionNumber: result.wantedEditionNumber,
      balanceCents: result.balanceCents,
      message: rookie
        ? `${got} is yours — and it is EDITION #1, the very first one ever sold! 🏆${
            gave ? ` ${gave} went to them.` : ''
          }`
        : `${got} (Edition #${result.offeredEditionNumber}) is yours!${
            gave ? ` ${gave} went to them.` : ''
          }${result.askCents > 0 ? ` You paid ${centsToMP(result.askCents)}.` : ''}`,
    });
  }

  switch (result.status) {
    case 'not-found':
      return NextResponse.json(
        { ok: false, status: result.status, error: result.message, message: result.message },
        { status: 404 },
      );

    case 'not-yours':
      return NextResponse.json(
        { ok: false, status: result.status, error: result.message, message: result.message },
        { status: 403 },
      );

    case 'needs-approval':
      return NextResponse.json(
        { ok: false, status: result.status, error: result.message, message: result.message },
        { status: 403 },
      );

    case 'insufficient-funds':
      // 402, same as a buy the kid cannot afford. NOTHING was taken — the whole
      // transaction rolled back, art included.
      return NextResponse.json(
        {
          ok: false,
          status: result.status,
          error: 'Insufficient funds',
          askCents: result.askCents,
          balanceCents: result.balanceCents,
          shortfallCents: result.shortfallCents,
          message: `${result.message} You need ${centsToMP(result.shortfallCents)} more.`,
        },
        { status: 402 },
      );

    // 409 Conflict — the offer was real but the world moved under it. Every one
    // of these means NOTHING was taken and NOTHING moved.
    case 'not-live':
    case 'stale-offer':
    case 'stale-wanted':
    case 'recipient-already-owns-offered':
    case 'proposer-already-owns-wanted':
      return NextResponse.json(
        { ok: false, status: result.status, error: result.message, message: result.message },
        { status: 409 },
      );

    case 'unknown-user':
      return NextResponse.json(
        { ok: false, status: result.status, error: result.message, message: result.message },
        { status: 404 },
      );
  }
}
