// /api/money/admin/learners
//   GET    → parent-gated. Every learner + current balance for the MP Bank
//            dashboard's top section.
//   DELETE → parent-gated. Hard-deletes a learner and (via schema cascades)
//            all their transactions, orders, earnings, dad-asks, and gift
//            cards. Irreversible. Query param: ?name=<learner name>.
import { NextRequest, NextResponse } from 'next/server';
import { listAllLearners } from '@/lib/money/balance';
import { isParentAuthenticated } from '@/lib/money/parent';
import { prisma } from '@/lib/prisma';

export async function GET() {
  if (!(await isParentAuthenticated())) {
    return NextResponse.json({ error: 'Parent login required' }, { status: 401 });
  }
  const learners = await listAllLearners();
  return NextResponse.json({ learners });
}

export async function DELETE(req: NextRequest) {
  if (!(await isParentAuthenticated())) {
    return NextResponse.json({ error: 'Parent login required' }, { status: 401 });
  }

  const name = new URL(req.url).searchParams.get('name')?.trim();
  if (!name) {
    return NextResponse.json({ error: 'Learner name is required' }, { status: 400 });
  }

  try {
    // DriveUser is the PK; all child rows (mp_transactions, mp_orders,
    // mp_earnings, dad-asks, gift cards) declare onDelete: Cascade, so the
    // single delete tears down the whole economy footprint for this user.
    await prisma.driveUser.delete({ where: { name } });
    return NextResponse.json({ ok: true, deleted: name });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('P2025') || message.toLowerCase().includes('not found')) {
      return NextResponse.json({ error: 'Learner not found' }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
