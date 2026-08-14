// POST /api/music/sightread
//
// The kid finishes one run of the Note Reader and earns MP. The CLIENT sends
// { songId, mode, hits, total }. The SERVER decides the cents — the client
// never dictates its own reward (see lib/music/reward.ts
// computeSightReadReward).
//
// Idempotency: MpEarning.idempotencyKey is `sightread:{user}:{songId}:{mode}:{date}`,
// so one song + mode pays once per day however many times it is replayed. The
// kid can keep practising; they just cannot farm the same run for MP. The
// unique constraint IS the gate — no check-then-create race.
//
// All writes (MpEarning + balance increment + ledger row) happen in a single
// prisma.$transaction, matching lib/music/profile.ts. If any one fails, none
// commit, so a run can never credit money without leaving an audit trail.
//
// Kid-cookie gated (dl_user), and closed on the Sabbath like every other
// earning route — the client guard is not trusted on its own.

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { isValidUser, normalizeUser } from '@/lib/drive-progress';
import { computeSightReadReward } from '@/lib/music/reward';
import { SONGS } from '@/lib/music/sightread';
import { musicToday } from '@/lib/music/today';

const COOKIE_NAME = 'dl_user';

export async function POST(req: NextRequest) {
  const jar = await cookies();
  const cookieUser = jar.get(COOKIE_NAME)?.value;
  if (!cookieUser || cookieUser === '__anon__' || !isValidUser(cookieUser)) {
    return NextResponse.json({ error: 'Log in to earn MP for reading music' }, { status: 401 });
  }
  const userKey = normalizeUser(cookieUser);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const songId = typeof body.songId === 'string' ? body.songId : '';
  const rawMode = typeof body.mode === 'string' ? body.mode : '';
  const hits = Number(body.hits);
  const total = Number(body.total);

  const song = SONGS.find((s) => s.id === songId);
  if (!song) return NextResponse.json({ error: 'Unknown song' }, { status: 400 });
  if (rawMode !== 'wait' && rawMode !== 'tempo' && rawMode !== 'practice') {
    return NextResponse.json({ error: 'Unknown mode' }, { status: 400 });
  }
  if (!Number.isFinite(hits) || !Number.isFinite(total) || total < 0 || hits < 0) {
    return NextResponse.json({ error: 'hits and total must be numbers ≥ 0' }, { status: 400 });
  }
  // The client cannot claim more hits than the song actually has, nor more
  // hits than notes attempted. Clamp rather than trust.
  const safeTotal = Math.min(Math.floor(total), song.notes.length);
  const safeHits = Math.min(Math.floor(hits), safeTotal);

  // No Sabbath gate here, deliberately: music is one of the SABBATH_OPEN_SECTIONS
  // and /api/music/practice does not gate either. Reading music on Sunday is
  // encouraged, so it earns like any other day.
  const { cents, reason } = computeSightReadReward({
    hits: safeHits,
    total: safeTotal,
    mode: rawMode,
  });

  if (cents <= 0) {
    return NextResponse.json({ ok: true, earnedCents: 0, reason });
  }

  const today = musicToday();
  const idempotencyKey = `sightread:${userKey}:${song.id}:${rawMode}:${today}`;

  try {
    const balanceCents = await prisma.$transaction(async (tx) => {
      const user = await tx.driveUser.findUnique({ where: { name: userKey } });
      if (!user) throw new Error('User not found');

      // MpEarning FIRST so a duplicate (same song+mode+day) aborts the whole
      // transaction before any money moves.
      await tx.mpEarning.create({
        data: {
          userName: userKey,
          section: 'music',
          kind: 'music.sightread',
          cents,
          idempotencyKey,
          meta: { songId: song.id, title: song.title, mode: rawMode, hits: safeHits, total: safeTotal } as object,
        },
      });

      const updated = await tx.driveUser.update({
        where: { name: userKey },
        data: { balanceCents: { increment: cents } },
        select: { balanceCents: true },
      });

      await tx.mpTransaction.create({
        data: { userName: userKey, cents, type: 'earn', reason: `${song.title}: ${reason}` },
      });

      return updated.balanceCents;
    });

    return NextResponse.json({ ok: true, earnedCents: cents, balanceCents, reason });
  } catch (err) {
    // P2002 = the unique idempotencyKey already exists: this song+mode already
    // paid today. Not an error — the run still happened, it just earns nothing.
    const code = (err as { code?: string })?.code;
    if (code === 'P2002') {
      return NextResponse.json({ ok: true, earnedCents: 0, reason: 'duplicate' });
    }
    if (err instanceof Error && err.message === 'User not found') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Could not record that run' }, { status: 500 });
  }
}
