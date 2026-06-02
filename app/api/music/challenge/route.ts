// /api/music/challenge  (parent-gated)
//
// Create / update / clear a kid's challenge. A challenge is the REUSABLE
// competition wrapper (see lib/music/types.ts) — not Shepherd-specific. Any
// kid with a recital / camp / competition gets one.
//
// POST  { user, challenge }  → set/replace the challenge (challenge:null clears)
//
// `challenge` shape (all bonus fields optional; omit/zero to disable):
//   { name, startDate, endDate, pieceIds[],
//     passOffRewardCents,
//     finishAllBy?, finishAllBonusCents?,
//     playAllInOneDayBy?, playAllInOneDayMinScore?, playAllInOneDayBonusCents? }
//
// We deliberately do NOT let the client send the *AwardedAt bookkeeping flags —
// those are server-managed so a parent edit can't accidentally re-arm a bonus
// that was already paid. We preserve existing award flags across edits.

import { NextRequest, NextResponse } from 'next/server';
import { isParentAuthenticated } from '@/lib/money/parent';
import { normalizeUser } from '@/lib/drive-progress';
import { readMusicProfile, setChallenge } from '@/lib/music/profile';
import type { MusicChallenge } from '@/lib/music/types';

function isISODate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function posCents(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

export async function POST(req: NextRequest) {
  if (!(await isParentAuthenticated())) {
    return NextResponse.json({ error: 'Parent login required' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const user = typeof body.user === 'string' ? normalizeUser(body.user) : '';
  if (!user) return NextResponse.json({ error: 'user required' }, { status: 400 });

  // Clear.
  if (body.challenge === null) {
    await setChallenge(user, null);
    return NextResponse.json({ ok: true, cleared: true });
  }

  const c = body.challenge;
  if (!c || typeof c !== 'object') {
    return NextResponse.json({ error: 'challenge object required' }, { status: 400 });
  }
  const ch = c as Record<string, unknown>;

  const name = typeof ch.name === 'string' ? ch.name.trim().slice(0, 120) : '';
  if (!name) return NextResponse.json({ error: 'challenge.name required' }, { status: 400 });
  if (!isISODate(ch.startDate) || !isISODate(ch.endDate)) {
    return NextResponse.json({ error: 'startDate / endDate must be YYYY-MM-DD' }, { status: 400 });
  }
  const pieceIds = Array.isArray(ch.pieceIds)
    ? (ch.pieceIds.filter((x) => typeof x === 'string') as string[])
    : [];

  // Preserve existing award bookkeeping + id so an edit doesn't re-arm bonuses.
  const existing = (await readMusicProfile(user))?.challenge;

  const challenge: MusicChallenge = {
    id: existing?.id ?? Math.random().toString(36).slice(2, 10),
    name,
    startDate: ch.startDate,
    endDate: ch.endDate,
    pieceIds,
    passOffRewardCents: posCents(ch.passOffRewardCents) || 200 * 100,
    finishAllBy: isISODate(ch.finishAllBy) ? ch.finishAllBy : undefined,
    finishAllBonusCents: posCents(ch.finishAllBonusCents) || undefined,
    playAllInOneDayBy: isISODate(ch.playAllInOneDayBy) ? ch.playAllInOneDayBy : undefined,
    playAllInOneDayMinScore:
      Number.isFinite(Number(ch.playAllInOneDayMinScore)) && Number(ch.playAllInOneDayMinScore) > 0
        ? Math.min(10, Math.round(Number(ch.playAllInOneDayMinScore)))
        : undefined,
    playAllInOneDayBonusCents: posCents(ch.playAllInOneDayBonusCents) || undefined,
    // Carry forward award flags so paid bonuses stay paid.
    finishAllAwardedAt: existing?.finishAllAwardedAt,
    playAllInOneDayAwardedAt: existing?.playAllInOneDayAwardedAt,
  };

  await setChallenge(user, challenge);
  return NextResponse.json({ ok: true, challenge });
}
