// POST /api/music/pass-off  (parent-gated)
//
// The parent confirms a piece is performance-ready. We stamp passedOffAt, mint
// a pass-off gift card (200 MP by default, or challenge.passOffRewardCents if
// the piece is in a challenge), then re-evaluate challenge deadline bonuses
// (finish-all / play-all-in-one-day) which may now be earnable.
//
// Body: { user, pieceId, defaultRewardCents? }
//
// The minted gift card code comes back so the parent can hand/print it. The
// kid redeems it like any MP gift card (existing /redeem flow), keeping a
// single economy + audit trail.

import { NextRequest, NextResponse } from 'next/server';
import { isParentAuthenticated } from '@/lib/money/parent';
import { normalizeUser } from '@/lib/drive-progress';
import { passOffPiece } from '@/lib/music/profile';
import { musicToday } from '@/lib/music/today';

// Default pass-off reward when the piece is NOT part of a challenge: 200 MP.
const DEFAULT_PASS_OFF_CENTS = 200 * 100;

export async function POST(req: NextRequest) {
  if (!(await isParentAuthenticated())) {
    return NextResponse.json({ error: 'Parent login required' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const user = typeof body.user === 'string' ? normalizeUser(body.user) : '';
  const pieceId = typeof body.pieceId === 'string' ? body.pieceId : '';
  if (!user) return NextResponse.json({ error: 'user required' }, { status: 400 });
  if (!pieceId) return NextResponse.json({ error: 'pieceId required' }, { status: 400 });

  const defaultRewardCents =
    Number.isFinite(Number(body.defaultRewardCents)) && Number(body.defaultRewardCents) > 0
      ? Math.round(Number(body.defaultRewardCents))
      : DEFAULT_PASS_OFF_CENTS;

  const by = body.by === 'teacher' || body.by === 'mom' || body.by === 'dad' ? body.by : undefined;

  const result = await passOffPiece(user, pieceId, {
    defaultRewardCents,
    todayStr: musicToday(),
    by,
  });

  if (!result.ok) {
    const status = result.error === 'Already passed off' ? 409 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json(result);
}
