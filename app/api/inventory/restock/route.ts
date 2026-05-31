// POST /api/inventory/restock
//
// Parent-gated. Applies restockSchedule across every product with a schedule.
// Safe to call repeatedly on the same day — runRestockPass() short-circuits
// any product already restocked today (lastRestockAt guard).
//
// Intended consumers:
//   - Parent admin button in the MP Bank dashboard ("Run restock now")
//   - Vercel Cron job (configure outside this file) that hits this endpoint
//     daily at e.g. 06:00 local — cron setup is out of scope for this PR.
//
// Returns { restocked: [{id, name, qty, newStock}], skipped: number }.

import { NextResponse } from 'next/server';
import { isParentAuthenticated } from '@/lib/money/parent';
import { runRestockPass } from '@/lib/inventory';

export async function POST() {
  if (!(await isParentAuthenticated())) {
    return NextResponse.json({ error: 'Parent login required' }, { status: 401 });
  }
  try {
    const result = await runRestockPass();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
