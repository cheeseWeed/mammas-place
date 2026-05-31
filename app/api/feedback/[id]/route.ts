// PUT /api/feedback/[id]
// Parent-gated. Updates the row's status — used by the Feedback admin tab to
// move a row between New → Read → Archived. Body: { status: 'new'|'read'|'archived' }.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isParentAuthenticated } from '@/lib/money/parent';

export const dynamic = 'force-dynamic';

const ALLOWED_STATUSES = new Set(['new', 'read', 'archived']);

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  if (!(await isParentAuthenticated())) {
    return NextResponse.json({ error: 'Parent login required' }, { status: 401 });
  }
  const { id } = await params;

  let body: { status?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const status = typeof body.status === 'string' ? body.status : '';
  if (!ALLOWED_STATUSES.has(status)) {
    return NextResponse.json(
      { error: 'status must be new, read, or archived' },
      { status: 400 },
    );
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = await (prisma as any).feedback.update({
      where: { id },
      data: { status },
    });
    return NextResponse.json({ feedback: row });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('P2025') || message.toLowerCase().includes('not found')) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
