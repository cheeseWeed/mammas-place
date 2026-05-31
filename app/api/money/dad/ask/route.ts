// POST /api/money/dad/ask
// Kid-authed (dl_user cookie required). Body:
// { centsAsked: 100..100000, reason: 1..200 chars, context?: 'portal'|'checkout',
//   shortfallCents?: number, cartTotalCents?: number }
//
// No kid-side cap — user wants kids to be able to ask whatever they want. Dad's
// decision engine handles greed via the `greedy` outcome (asks > cart * 1.5
// at checkout, or > 100 MP at portal) and a graduated amountDelta penalty.
//
// Server computes the outcome via lib/money/dad.ts (no parent involvement —
// Dad is automated). If the outcome credits MP, we do it atomically alongside
// writing the DadAsk row.
//
// Returns: { outcome, centsGranted, dadReply, balanceCents }.

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isValidUser, normalizeUser } from '@/lib/drive-progress';
import { credit, readBalance } from '@/lib/money/balance';
import { computeDecision, DadContext, DadOutcome } from '@/lib/money/dad';
import { prisma } from '@/lib/prisma';

const COOKIE_NAME = 'dl_user';
const MIN_CENTS = 100;     // 1 MP — must be at least 1 to count as an ask
const MAX_CENTS = 100_000; // 1000 MP — sanity cap so we can't accidentally credit a million

export async function POST(req: NextRequest) {
  // Cookie-based kid auth — matches the gift-card redeem pattern.
  const jar = await cookies();
  const cookieUser = jar.get(COOKIE_NAME)?.value;
  if (!cookieUser || cookieUser === '__anon__') {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }
  if (!isValidUser(cookieUser)) {
    return NextResponse.json({ error: 'Bad cookie' }, { status: 400 });
  }
  const userKey = normalizeUser(cookieUser);

  let body: {
    centsAsked?: unknown;
    reason?: unknown;
    context?: unknown;
    shortfallCents?: unknown;
    cartTotalCents?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const centsAsked = Number(body.centsAsked);
  if (!Number.isInteger(centsAsked) || centsAsked < MIN_CENTS || centsAsked > MAX_CENTS) {
    return NextResponse.json(
      { error: `centsAsked must be an integer between ${MIN_CENTS} and ${MAX_CENTS}` },
      { status: 400 },
    );
  }

  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 200) : '';
  if (reason.length < 1) {
    return NextResponse.json({ error: 'Reason required (1..200 chars)' }, { status: 400 });
  }

  const context: DadContext = body.context === 'checkout' ? 'checkout' : 'portal';

  let shortfallCents = 0;
  let cartTotalCents = 0;
  if (context === 'checkout') {
    const rawShort = Number(body.shortfallCents);
    if (Number.isInteger(rawShort) && rawShort > 0) {
      shortfallCents = Math.min(rawShort, 500_000); // sanity cap
    }
    const rawCart = Number(body.cartTotalCents);
    if (Number.isInteger(rawCart) && rawCart > 0) {
      cartTotalCents = Math.min(rawCart, 500_000);
    }
  }

  // Ensure user exists before we do anything else. readBalance returns null
  // for unknown users.
  const currentBalance = await readBalance(userKey);
  if (currentBalance === null) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Compute the outcome (no DB writes yet).
  const decision = await computeDecision({
    userName: userKey,
    centsAsked,
    reason,
    context,
    shortfallCents: shortfallCents || undefined,
    cartTotalCents: cartTotalCents || undefined,
  });

  // Credit if warranted, then write the DadAsk row. We credit first so the
  // DadAsk row only lands if the credit succeeded — keeps the "Dad sent the
  // money" promise honest.
  let balanceCents = currentBalance;
  if (decision.centsGranted > 0) {
    const reasonLabel = labelForOutcome(decision.outcome);
    try {
      balanceCents = await credit(userKey, decision.centsGranted, 'gift', reasonLabel);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Credit failed';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  try {
    await prisma.dadAsk.create({
      data: {
        userName: userKey,
        centsAsked,
        reason,
        outcome: decision.outcome,
        centsGranted: decision.centsGranted,
        dadReply: decision.dadReply,
        context,
      },
    });
  } catch (err) {
    // If the ledger row already landed, surfacing the audit-row failure to
    // the kid is just noise. Log it server-side and proceed.
    console.error('Failed to write DadAsk row', err);
  }

  return NextResponse.json({
    outcome: decision.outcome,
    centsGranted: decision.centsGranted,
    dadReply: decision.dadReply,
    balanceCents,
  });
}

function labelForOutcome(outcome: DadOutcome): string {
  switch (outcome) {
    case 'yes_full': return 'Dad said yes';
    case 'yes_partial': return 'Dad gave a partial yes';
    case 'pickup_tab': return 'Dad picked up the tab';
    default: return 'Dad gave you some MP';
  }
}
