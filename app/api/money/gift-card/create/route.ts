// POST /api/money/gift-card/create
// Parent-gated. Body: { cents, note? }. Mints a new single-use gift card and
// returns the public code + amount + optional note. Parent then prints the
// resulting code (admin UI handles the print view).
import { NextRequest, NextResponse } from 'next/server';
import { createGiftCard } from '@/lib/money/gift-card';
import { isParentAuthenticated } from '@/lib/money/parent';

export async function POST(req: NextRequest) {
  if (!(await isParentAuthenticated())) {
    return NextResponse.json({ error: 'Parent login required' }, { status: 401 });
  }

  let body: { cents?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const cents = Number(body.cents);
  if (!Number.isInteger(cents) || cents <= 0 || cents > 1_000_000) {
    return NextResponse.json({ error: 'Bad cents' }, { status: 400 });
  }
  const note = typeof body.note === 'string' ? body.note : undefined;

  try {
    const card = await createGiftCard({ cents, note });
    return NextResponse.json({ ok: true, ...card });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
