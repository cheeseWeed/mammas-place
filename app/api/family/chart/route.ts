// GET /api/family/chart
//
// The logged-in member's family chore chart: every (non-archived) job with its
// computed schedule (due/done/overdue), plus the family name + members + the
// caller's role. Invite-gated: a user with no family gets 403 so the UI can
// show "ask a parent to add you."
//
// ?user= override allowed only for the family's parents / admin (to preview a
// member's view) — handled by the parent section instead; this route is the
// member's own chart.

import { NextResponse } from 'next/server';
import { memberContext } from '@/lib/family/auth';
import { getFamilyView, isFamilyParent } from '@/lib/family/family';
import { readJobs } from '@/lib/family/jobs';
import { scheduleFor } from '@/lib/family/schedule';
import { familyToday } from '@/lib/family/today';

export async function GET() {
  const ctx = await memberContext();
  if (!ctx) {
    return NextResponse.json(
      { error: 'You’re not in a family yet — ask a parent to add you.' },
      { status: 403 },
    );
  }

  const [view, jobs, isParent] = await Promise.all([
    getFamilyView(ctx.familyId),
    readJobs(ctx.familyId),
    isFamilyParent(ctx.user, ctx.familyId),
  ]);

  const today = familyToday();
  const withSchedule = jobs
    .filter((j) => !j.archived)
    .map((j) => ({ job: j, schedule: scheduleFor(j, today) }));

  return NextResponse.json({
    ok: true,
    today,
    user: ctx.user,
    isParent,
    family: view ? { id: view.id, name: view.name } : null,
    members: view?.members ?? [],
    jobs: withSchedule,
  });
}
