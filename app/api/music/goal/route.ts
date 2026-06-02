// POST /api/music/goal
//
// Set (or clear) the kid's explicit daily line goal — the total NEW lines to
// learn across all pieces each practice day. The kid can set their own; a
// parent (mp_parent cookie) can set any kid's via body.user.
//
// Body: { goal: number | null, user？ }
//   goal > 0  → set (fractional ok, e.g. 3.5; clamped to 0.5..100 in 0.5 steps)
//   goal null → clear (revert to the auto-computed pace)

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isValidUser, normalizeUser } from '@/lib/drive-progress';
import { isParentAuthenticated } from '@/lib/money/parent';
import { setDailyLineGoal } from '@/lib/music/profile';

const COOKIE_NAME = 'dl_user';

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const bodyUser = typeof body.user === 'string' ? body.user : null;
  const jar = await cookies();
  const cookieUser = jar.get(COOKIE_NAME)?.value;
  const isParent = await isParentAuthenticated();

  let userKey: string;
  if (bodyUser && isParent) {
    const k = normalizeUser(bodyUser);
    if (!k) return NextResponse.json({ error: 'Bad user' }, { status: 400 });
    userKey = k;
  } else if (cookieUser && cookieUser !== '__anon__' && isValidUser(cookieUser)) {
    const self = normalizeUser(cookieUser);
    if (bodyUser && normalizeUser(bodyUser) !== self) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }
    userKey = self;
  } else {
    return NextResponse.json({ error: 'Log in first' }, { status: 401 });
  }

  const goal = body.goal === null ? null : Number(body.goal);
  if (goal !== null && (!Number.isFinite(goal) || goal <= 0)) {
    return NextResponse.json({ error: 'goal must be a positive number or null' }, { status: 400 });
  }
  const mode = body.mode === 'one-at-a-time' || body.mode === 'spread' ? body.mode : undefined;

  const result = await setDailyLineGoal(userKey, goal, mode);
  return NextResponse.json({ ok: true, dailyLineGoal: result.dailyLineGoal ?? null, goalMode: result.goalMode });
}
