// /api/family/jobs — parent-gated job CRUD + catalog load.
//
// POST   { name, room, frequency, mp?, emoji?, assignedTo?, notes?, familyId? } → add
// PATCH  { jobId, ...fields, familyId? } → edit (incl. archived)
// DELETE ?jobId=&familyId=               → delete
// POST   { action: 'loadCatalog', familyId? } → load the 171-job starter catalog
//
// familyId is optional for a parent (defaults to their own family); required
// when the caller is Admin acting on a specific family.

import { NextRequest, NextResponse } from 'next/server';
import { parentContext } from '@/lib/family/auth';
import { addJob, updateJob, deleteJob, loadCatalog, type AddJobInput } from '@/lib/family/jobs';
import { FREQUENCIES, type Frequency } from '@/lib/family/types';

const VALID_FREQ = new Set(FREQUENCIES.map((f) => f.value));

function bodyFamilyId(body: Record<string, unknown>): string | undefined {
  return typeof body.familyId === 'string' ? body.familyId : undefined;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const ctx = await parentContext(bodyFamilyId(body));
  if (!ctx) return NextResponse.json({ error: 'Parent access required' }, { status: 403 });

  // Catalog load.
  if (body.action === 'loadCatalog') {
    const res = await loadCatalog(ctx.familyId);
    return NextResponse.json({ ok: true, ...res });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const room = typeof body.room === 'string' ? body.room.trim() : '';
  const frequency = body.frequency as Frequency;
  if (!name) return NextResponse.json({ error: 'Job name required' }, { status: 400 });
  if (!room) return NextResponse.json({ error: 'Room required' }, { status: 400 });
  if (!VALID_FREQ.has(frequency)) return NextResponse.json({ error: 'Bad frequency' }, { status: 400 });

  const input: AddJobInput = {
    name,
    room,
    frequency,
    mp: body.mp !== undefined && Number.isFinite(Number(body.mp)) ? Number(body.mp) : undefined,
    emoji: typeof body.emoji === 'string' ? body.emoji : undefined,
    assignedTo: typeof body.assignedTo === 'string' && body.assignedTo ? body.assignedTo : undefined,
    notes: typeof body.notes === 'string' ? body.notes : undefined,
  };
  const job = await addJob(ctx.familyId, input);
  return NextResponse.json({ ok: true, job });
}

export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const ctx = await parentContext(bodyFamilyId(body));
  if (!ctx) return NextResponse.json({ error: 'Parent access required' }, { status: 403 });
  const jobId = typeof body.jobId === 'string' ? body.jobId : '';
  if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 });

  const patch: Partial<AddJobInput> & { archived?: boolean } = {};
  if (typeof body.name === 'string') patch.name = body.name;
  if (typeof body.room === 'string') patch.room = body.room;
  if (typeof body.frequency === 'string' && VALID_FREQ.has(body.frequency as Frequency)) patch.frequency = body.frequency as Frequency;
  if (body.mp !== undefined && Number.isFinite(Number(body.mp))) patch.mp = Number(body.mp);
  if (typeof body.emoji === 'string') patch.emoji = body.emoji;
  if (body.assignedTo !== undefined) patch.assignedTo = typeof body.assignedTo === 'string' ? body.assignedTo : undefined;
  if (typeof body.notes === 'string') patch.notes = body.notes;
  if (typeof body.archived === 'boolean') patch.archived = body.archived;

  const job = await updateJob(ctx.familyId, jobId, patch);
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  return NextResponse.json({ ok: true, job });
}

export async function DELETE(req: NextRequest) {
  const familyId = req.nextUrl.searchParams.get('familyId') ?? undefined;
  const ctx = await parentContext(familyId);
  if (!ctx) return NextResponse.json({ error: 'Parent access required' }, { status: 403 });
  const jobId = req.nextUrl.searchParams.get('jobId') ?? '';
  if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 });
  const ok = await deleteJob(ctx.familyId, jobId);
  if (!ok) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
