// POST /api/family/check-off    { jobId }       → check a job done today (credits MP)
// DELETE /api/family/check-off?jobId=...        → undo today's check-off (claws back)
//
// Member-gated. MP credits immediately — no parent approval (per spec). The
// doer is the logged-in user. Idempotent per (job, day).

import { NextRequest, NextResponse } from 'next/server';
import { memberContext } from '@/lib/family/auth';
import { checkOffJob, undoCheckOff } from '@/lib/family/jobs';
import { familyToday } from '@/lib/family/today';

export async function POST(req: NextRequest) {
  const ctx = await memberContext();
  if (!ctx) return NextResponse.json({ error: 'Not in a family' }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const jobId = typeof body.jobId === 'string' ? body.jobId : '';
  if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 });

  const result = await checkOffJob(ctx.familyId, jobId, ctx.user, familyToday());
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}

export async function DELETE(req: NextRequest) {
  const ctx = await memberContext();
  if (!ctx) return NextResponse.json({ error: 'Not in a family' }, { status: 403 });
  const jobId = req.nextUrl.searchParams.get('jobId') ?? '';
  if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 });

  const result = await undoCheckOff(ctx.familyId, jobId, ctx.user, familyToday());
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
