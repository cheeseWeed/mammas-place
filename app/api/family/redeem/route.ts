// POST /api/family/redeem   { mp, reward }
//
// A member redeems MP for an external reward they type in. Debits immediately
// (can't overspend), logs it to the family's Redemption table so parents can
// SEE what was spent, and returns a fun message ("Have fun!"). No approval —
// the real-world OK happens in person.

import { NextRequest, NextResponse } from 'next/server';
import { memberContext } from '@/lib/family/auth';
import { redeem } from '@/lib/family/jobs';

export async function POST(req: NextRequest) {
  const ctx = await memberContext();
  if (!ctx) return NextResponse.json({ error: 'Not in a family' }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const mp = Number(body.mp);
  const reward = typeof body.reward === 'string' ? body.reward : '';
  if (!Number.isFinite(mp) || mp <= 0) return NextResponse.json({ error: 'How much MP?' }, { status: 400 });

  const result = await redeem(ctx.familyId, ctx.user, mp, reward);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
