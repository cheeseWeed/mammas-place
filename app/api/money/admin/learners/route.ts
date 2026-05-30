// GET /api/money/admin/learners
// Parent-gated. Returns every learner with their current balance for the
// MP Bank dashboard's top section. Mirrors the pattern from credit/debit:
// check the parent cookie first, 401 if missing.
import { NextResponse } from 'next/server';
import { listAllLearners } from '@/lib/money/balance';
import { isParentAuthenticated } from '@/lib/money/parent';

export async function GET() {
  if (!(await isParentAuthenticated())) {
    return NextResponse.json({ error: 'Parent login required' }, { status: 401 });
  }
  const learners = await listAllLearners();
  return NextResponse.json({ learners });
}
