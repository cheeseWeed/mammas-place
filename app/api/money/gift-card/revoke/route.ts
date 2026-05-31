// POST /api/money/gift-card/revoke
// Parent-gated. Body: { code }. Marks an unredeemed card as revoked so it
// can no longer be claimed. Revoking an already-redeemed card is a no-op
// (the MP has already left the parent's hand and is in the kid's balance).
import { NextRequest, NextResponse } from 'next/server';
import { GiftCardError, revokeGiftCard } from '@/lib/money/gift-card';
import { isParentAuthenticated } from '@/lib/money/parent';

export async function POST(req: NextRequest) {
  if (!(await isParentAuthenticated())) {
    return NextResponse.json({ error: 'Parent login required' }, { status: 401 });
  }

  let body: { code?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (!code) {
    return NextResponse.json({ error: 'Code required' }, { status: 400 });
  }

  try {
    const result = await revokeGiftCard({ code });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof GiftCardError) {
      const status = err.kind === 'not_found' ? 404 : 409;
      return NextResponse.json({ error: err.message, kind: err.kind }, { status });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
