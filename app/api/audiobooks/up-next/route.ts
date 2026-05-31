// GET /api/audiobooks/up-next?user=<name>
// Kid-cookie authed (dl_user must match `user` param). Returns the
// "continue listening" payload:
//   { upNext: Product[] (≤4), recent: Product[] (≤3) }
//
// Anonymous / mismatched cookie → 200 with empty lists (so the homepage can
// just render the anonymous fallback without 401 noise). 400 only on a
// genuinely malformed user param.
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isValidUser, normalizeUser } from '@/lib/drive-progress';
import {
  getRecentlyListened,
  getUpNextPerSeries,
  readAudioState,
} from '@/lib/audiobooks';
import { getAudiobooks } from '@/lib/products';
import { touchSession } from '@/lib/auth-touch';

const COOKIE_NAME = 'dl_user';

export async function GET(req: NextRequest) {
  const userParam = req.nextUrl.searchParams.get('user');
  if (!userParam || !isValidUser(userParam)) {
    return NextResponse.json({ error: 'Bad user param' }, { status: 400 });
  }
  const userKey = normalizeUser(userParam);

  // Lightweight auth — cookie must match the requested user (or anon → empty).
  const jar = await cookies();
  const cookieUser = jar.get(COOKIE_NAME)?.value;
  if (!cookieUser || cookieUser === '__anon__' || normalizeUser(cookieUser) !== userKey) {
    return NextResponse.json({ upNext: [], recent: [] });
  }

  const audiobooks = await getAudiobooks();
  const state = await readAudioState(userKey);
  const upNext = getUpNextPerSeries(state, audiobooks, 4);
  const recent = getRecentlyListened(state, audiobooks, 3);

  await touchSession();
  return NextResponse.json({ upNext, recent });
}
