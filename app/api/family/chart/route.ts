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
import { memberContext, isAdmin } from '@/lib/family/auth';
import { getFamilyView, isFamilyParent } from '@/lib/family/family';
import { readJobs } from '@/lib/family/jobs';
import { scheduleFor } from '@/lib/family/schedule';
import { familyToday } from '@/lib/family/today';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const ctx = await memberContext();
  const admin = await isAdmin();

  // Admin is godmode: never bounced. If admin isn't in a family of their own,
  // fall back to the first family so the parent area has something to show.
  let familyId = ctx?.familyId ?? null;
  if (!familyId && admin) {
    const first = await prisma.family.findFirst({ select: { id: true }, orderBy: { name: 'asc' } });
    familyId = first?.id ?? null;
  }

  if (!familyId) {
    // Not in a family and not admin → the only real "no access" case.
    if (!admin) {
      return NextResponse.json(
        { error: 'You’re not in a family yet — ask a parent to add you.' },
        { status: 403 },
      );
    }
    // Admin with no families at all yet — let them in with an empty chart.
    return NextResponse.json({
      ok: true,
      today: familyToday(),
      user: 'admin',
      isParent: true,
      isAdmin: true,
      family: null,
      members: [],
      jobs: [],
    });
  }

  const [view, jobs, isParent] = await Promise.all([
    getFamilyView(familyId),
    readJobs(familyId),
    ctx ? isFamilyParent(ctx.user, familyId) : Promise.resolve(false),
  ]);

  const today = familyToday();
  const withSchedule = jobs
    .filter((j) => !j.archived)
    .map((j) => ({ job: j, schedule: scheduleFor(j, today) }));

  return NextResponse.json({
    ok: true,
    today,
    user: ctx?.user ?? 'admin',
    // Admin always manages; otherwise the family-parent check decides.
    isParent: admin || isParent,
    isAdmin: admin,
    family: view ? { id: view.id, name: view.name } : null,
    members: view?.members ?? [],
    jobs: withSchedule,
  });
}
