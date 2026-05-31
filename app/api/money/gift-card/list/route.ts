// GET /api/money/gift-card/list
// Parent-gated. Returns every gift card (newest first) with a derived status
// for the admin dashboard's Gift Cards panel.
import { NextResponse } from 'next/server';
import { listGiftCards } from '@/lib/money/gift-card';
import { isParentAuthenticated } from '@/lib/money/parent';

export async function GET() {
  if (!(await isParentAuthenticated())) {
    return NextResponse.json({ error: 'Parent login required' }, { status: 401 });
  }
  const cards = await listGiftCards();
  return NextResponse.json({ cards });
}
