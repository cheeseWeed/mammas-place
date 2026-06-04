// /api/feedback/[id]
//   PUT    → Parent-gated. Updates status and/or saves an admin reply.
//            Body: { status?: 'new'|'read'|'archived', reply?: string }.
//            Sending a reply stamps repliedAt and marks the row read (unless a
//            status was also passed). reply='' clears the reply.
//   DELETE → Parent-gated. Hard-deletes the feedback row. Irreversible
//            (distinct from 'archived', which only hides it).

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

  let body: { status?: unknown; reply?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const hasReply = typeof body.reply === 'string';
  const hasStatus = typeof body.status === 'string';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {};

  if (hasStatus) {
    const status = body.status as string;
    if (!ALLOWED_STATUSES.has(status)) {
      return NextResponse.json(
        { error: 'status must be new, read, or archived' },
        { status: 400 },
      );
    }
    data.status = status;
  }

  if (hasReply) {
    const reply = (body.reply as string).trim();
    if (reply.length > 2000) {
      return NextResponse.json({ error: 'Reply too long (max 2000 chars)' }, { status: 400 });
    }
    data.reply = reply || null;
    data.repliedAt = reply ? new Date() : null;
    // Replying implies you've read it — mark read unless an explicit status came too.
    if (reply && !hasStatus) data.status = 'read';
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update (status or reply required)' }, { status: 400 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = await (prisma as any).feedback.update({
      where: { id },
      data,
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

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  if (!(await isParentAuthenticated())) {
    return NextResponse.json({ error: 'Parent login required' }, { status: 401 });
  }
  const { id } = await params;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).feedback.delete({ where: { id } });
    return NextResponse.json({ ok: true, deleted: id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('P2025') || message.toLowerCase().includes('not found')) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
