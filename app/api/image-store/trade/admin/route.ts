// GET  /api/image-store/trade/admin            -> every trade + the approval queue
// POST /api/image-store/trade/admin            { tradeId, action: 'approve' }
//
// PARENT VISIBILITY. Every trade is visible here, which is the point: a paid
// trade also writes MpTransaction rows and so shows up in the ledger, but a pure
// SWAP moves no MP and would otherwise be invisible to a parent. This endpoint
// is how "every trade visible to the parent" is actually satisfied.
//
// Admin-gated with the same mp_parent godmode check as the rest of MP Bank
// (lib/family/auth isAdmin -> lib/money/parent isParentAuthenticated): session
// cookie, HMAC-signed stamp, hard 30-minute cap. A kid cookie gets 403 here.

import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/family/auth';
import { approveTrade, listAllTrades, listPendingApproval } from '@/lib/image-store/trade';

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }
  const [all, awaiting] = await Promise.all([listAllTrades(), listPendingApproval()]);
  return NextResponse.json({ trades: all, awaitingApproval: awaiting });
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  let body: { tradeId?: unknown; action?: unknown };
  try {
    body = (await req.json()) as { tradeId?: unknown; action?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (body.action !== 'approve') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  // Approving only lifts the block — it flips 'blocked' -> 'pending'. The KID
  // still has to accept, so a parent can never move another person's artwork or
  // MP on their behalf. Both parties still confirm.
  const result = await approveTrade(body.tradeId);
  if (result.ok) {
    return NextResponse.json({
      ok: true,
      status: result.status,
      message: 'Approved. The kid can accept it now.',
    });
  }
  return NextResponse.json(
    { ok: false, status: result.status, error: result.message },
    { status: result.status === 'not-found' ? 404 : 409 },
  );
}
