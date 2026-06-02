// GET /api/music/state
//
// Returns the logged-in kid's full music profile + today's computed practice
// plan + the reward curve, in one shot so the /music page renders without a
// waterfall. Kid-cookie gated (dl_user).
//
// Optional ?user= override is honored ONLY when the parent cookie is present,
// so the admin panel can view any kid's state.

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isValidUser, normalizeUser } from '@/lib/drive-progress';
import { isParentAuthenticated } from '@/lib/money/parent';
import { readMusicProfile } from '@/lib/music/profile';
import { planForToday } from '@/lib/music/plan';
import { rewardCurve } from '@/lib/music/reward';
import { musicToday } from '@/lib/music/today';

const COOKIE_NAME = 'dl_user';

export async function GET(req: NextRequest) {
  const jar = await cookies();
  const cookieUser = jar.get(COOKIE_NAME)?.value;
  const override = req.nextUrl.searchParams.get('user');

  let userKey: string | null = null;
  if (override) {
    // Only the parent admin may view another kid's state.
    if (await isParentAuthenticated()) {
      userKey = normalizeUser(override);
    } else if (cookieUser && isValidUser(cookieUser) && normalizeUser(cookieUser) === normalizeUser(override)) {
      userKey = normalizeUser(cookieUser);
    } else {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }
  } else {
    if (!cookieUser || cookieUser === '__anon__' || !isValidUser(cookieUser)) {
      return NextResponse.json({ error: 'Log in to view your music' }, { status: 401 });
    }
    userKey = normalizeUser(cookieUser);
  }

  if (!userKey) return NextResponse.json({ error: 'Bad user' }, { status: 400 });

  const profile = await readMusicProfile(userKey);
  if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const today = musicToday();
  const plan = planForToday(profile.pieces, today, undefined, profile.dailyLineGoal, profile.goalMode ?? 'spread');

  return NextResponse.json({
    ok: true,
    user: userKey,
    today,
    profile,
    plan,
    rewardCurve: rewardCurve(),
  });
}
