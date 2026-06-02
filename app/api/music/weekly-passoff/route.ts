// POST /api/music/weekly-passoff  (parent-gated)
//
// Records a WEEKLY pass-off — teacher / mom / dad confirms the kid played a
// piece for them this week. Recurring (not the one-time competition pass-off).
// Credits the weekly reward (default 150 MP) straight to the balance. Atomic +
// idempotent per (user, piece, date).
//
// Body: { user, pieceId, by: 'teacher'|'mom'|'dad', rewardCents?, note? }
//
// Parent-gated because the kid shouldn't self-credit. A parent records it on
// the teacher's behalf (or for their own mom/dad pass-off).

import { NextRequest, NextResponse } from 'next/server';
import { isParentAuthenticated } from '@/lib/money/parent';
import { normalizeUser } from '@/lib/drive-progress';
import { weeklyPassOff } from '@/lib/music/profile';
import { musicToday } from '@/lib/music/today';
import type { PassOffBy } from '@/lib/music/types';

// Default weekly reward: 150 MP (per the family rule for non-competition songs).
const DEFAULT_WEEKLY_CENTS = 150 * 100;
const VALID_BY = new Set<PassOffBy>(['teacher', 'mom', 'dad']);

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
  const by = body.by as PassOffBy;
  if (!user) return NextResponse.json({ error: 'user required' }, { status: 400 });
  if (!pieceId) return NextResponse.json({ error: 'pieceId required' }, { status: 400 });
  if (!VALID_BY.has(by)) return NextResponse.json({ error: 'by must be teacher|mom|dad' }, { status: 400 });

  const rewardCents =
    Number.isFinite(Number(body.rewardCents)) && Number(body.rewardCents) > 0
      ? Math.round(Number(body.rewardCents))
      : DEFAULT_WEEKLY_CENTS;

  const result = await weeklyPassOff(user, pieceId, {
    by,
    rewardCents,
    todayStr: musicToday(),
    note: typeof body.note === 'string' ? body.note : undefined,
  });

  if (!result.ok) {
    const status = result.error === 'Already passed off today' ? 409 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json(result);
}
