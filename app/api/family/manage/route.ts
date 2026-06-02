// /api/family/manage — parent-gated family management.
//
// GET    ?familyId=        → family view (parents + members + balances) + redemption log
// POST   { action, ... }   → one of:
//    addMember    { username }
//    removeMember { username }
//    setParent    { username, makeParent }   — give mom/dad parent access to this family
//    takePoints   { username, mp, reason }    — claw back MP (e.g. 2× for a poor job)

import { NextRequest, NextResponse } from 'next/server';
import { parentContext } from '@/lib/family/auth';
import {
  getFamilyView,
  addMember,
  removeMember,
  setFamilyParent,
} from '@/lib/family/family';
import { takePoints, listRedemptions } from '@/lib/family/jobs';

export async function GET(req: NextRequest) {
  const familyId = req.nextUrl.searchParams.get('familyId') ?? undefined;
  const ctx = await parentContext(familyId);
  if (!ctx) return NextResponse.json({ error: 'Parent access required' }, { status: 403 });

  const [view, redemptions] = await Promise.all([
    getFamilyView(ctx.familyId),
    listRedemptions(ctx.familyId, 50),
  ]);
  return NextResponse.json({ ok: true, family: view, redemptions });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const familyId = typeof body.familyId === 'string' ? body.familyId : undefined;
  const ctx = await parentContext(familyId);
  if (!ctx) return NextResponse.json({ error: 'Parent access required' }, { status: 403 });

  const action = body.action;
  const username = typeof body.username === 'string' ? body.username : '';

  switch (action) {
    case 'addMember': {
      if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });
      const res = await addMember(ctx.familyId, username);
      if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
      return NextResponse.json({ ok: true });
    }
    case 'removeMember': {
      if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });
      await removeMember(ctx.familyId, username);
      return NextResponse.json({ ok: true });
    }
    case 'setParent': {
      if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });
      await setFamilyParent(ctx.familyId, username, body.makeParent !== false);
      return NextResponse.json({ ok: true });
    }
    case 'takePoints': {
      const mp = Number(body.mp);
      const reason = typeof body.reason === 'string' ? body.reason : 'Points taken';
      if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });
      if (!Number.isFinite(mp) || mp <= 0) return NextResponse.json({ error: 'mp must be positive' }, { status: 400 });
      const res = await takePoints(username, mp, reason);
      if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
      return NextResponse.json({ ok: true, balanceCents: res.balanceCents, tookCents: res.tookCents });
    }
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
