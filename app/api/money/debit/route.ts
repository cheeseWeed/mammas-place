// POST /api/money/debit
// Parent-gated. Body: { user, cents, reason }
// Manual deduction (e.g. parent corrects an error). Kids spend via /order, not this.
import { NextRequest, NextResponse } from 'next/server';
import { isValidUser } from '@/lib/drive-progress';
import { debit, InsufficientFundsError } from '@/lib/money/balance';
import { isParentAuthenticated } from '@/lib/money/parent';

export async function POST(req: NextRequest) {
  if (!(await isParentAuthenticated())) {
    return NextResponse.json({ error: 'Parent login required' }, { status: 401 });
  }

  let body: { user?: unknown; cents?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!isValidUser(body.user)) {
    return NextResponse.json({ error: 'Bad user' }, { status: 400 });
  }
  const cents = Number(body.cents);
  if (!Number.isInteger(cents) || cents <= 0 || cents > 1_000_000) {
    return NextResponse.json({ error: 'Bad cents' }, { status: 400 });
  }
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 200) : '';
  if (!reason) {
    return NextResponse.json({ error: 'Reason required' }, { status: 400 });
  }

  try {
    const balanceCents = await debit(body.user as string, cents, 'adjust', reason);
    return NextResponse.json({ ok: true, balanceCents });
  } catch (err) {
    if (err instanceof InsufficientFundsError) {
      return NextResponse.json(
        { error: 'Insufficient funds', balanceCents: err.balanceCents, neededCents: err.neededCents },
        { status: 402 },
      );
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'User not found') {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
