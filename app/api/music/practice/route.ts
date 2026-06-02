// POST /api/music/practice
//
// The kid logs one day's practice on one piece and earns MP. The CLIENT sends
// { pieceId, qualityScore (1-10), linesPracticed, note?, reviewedBy? }. The
// SERVER decides the cents from the quality score (steep Fibonacci curve,
// capped 100 MP/day/piece) and writes it atomically + idempotently (one score
// per piece per day — see lib/music/profile.ts).
//
// After crediting, we re-evaluate the kid's challenge: the "play every piece
// well in one day" bonus is earned by PRACTICING (not by passing off), so it
// can fire right here. Newly-awarded bonuses come back in `challengeBonuses`.
//
// Kid-cookie gated (dl_user). No anonymous preview — this is a logged-in,
// assignment-driven section (unlike the quiz sections).

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isValidUser, normalizeUser } from '@/lib/drive-progress';
import { submitPractice, evaluateChallengeBonuses } from '@/lib/music/profile';
import { musicToday } from '@/lib/music/today';

const COOKIE_NAME = 'dl_user';

export async function POST(req: NextRequest) {
  const jar = await cookies();
  const cookieUser = jar.get(COOKIE_NAME)?.value;
  if (!cookieUser || cookieUser === '__anon__' || !isValidUser(cookieUser)) {
    return NextResponse.json({ error: 'Log in to log practice' }, { status: 401 });
  }
  const userKey = normalizeUser(cookieUser);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const pieceId = typeof body.pieceId === 'string' ? body.pieceId : '';
  const qualityScore = Number(body.qualityScore);
  const linesPracticed = Number(body.linesPracticed);
  if (!pieceId) return NextResponse.json({ error: 'pieceId required' }, { status: 400 });
  if (!Number.isFinite(qualityScore) || qualityScore < 1 || qualityScore > 10) {
    return NextResponse.json({ error: 'qualityScore must be 1-10' }, { status: 400 });
  }
  if (!Number.isFinite(linesPracticed) || linesPracticed < 0) {
    return NextResponse.json({ error: 'linesPracticed must be ≥ 0' }, { status: 400 });
  }

  const today = musicToday();

  const result = await submitPractice(userKey, {
    pieceId,
    qualityScore,
    linesPracticed,
    date: today,
    note: typeof body.note === 'string' ? body.note : undefined,
    reviewedBy: typeof body.reviewedBy === 'string' ? body.reviewedBy : undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // Re-check the challenge — the "all pieces well in one day" bonus may have
  // just been satisfied by this very session.
  const challengeBonuses = await evaluateChallengeBonuses(userKey, today);

  return NextResponse.json({ ...result, challengeBonuses });
}
