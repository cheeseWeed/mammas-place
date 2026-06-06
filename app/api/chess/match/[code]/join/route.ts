// POST /api/chess/match/[code]/join
//
// Join an existing two-device match as black. Flips status waiting -> active.
//
// Auth: dl_user cookie required; __anon__ and missing are 401.
// Rules:
//   - If the caller is ALREADY a player in this match (creator re-opening, or
//     the joiner re-hitting), just return the match (idempotent).
//   - Reject joining your own match as the same dl_user (a second player must
//     be a DIFFERENT logged-in kid — that's the whole point of two devices).
//   - Reject if the black seat is already taken by someone else (match full).
// No MP movement.

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isValidUser, normalizeUser } from '@/lib/drive-progress';
import { prisma } from '@/lib/prisma';
import { coerceMoveHistory, normalizeCode } from '@/lib/chess/match';

const COOKIE_NAME = 'dl_user';

function authedUser(cookieUser: string | undefined): string | null {
  if (!cookieUser || cookieUser === '__anon__') return null;
  if (!isValidUser(cookieUser)) return null;
  return normalizeUser(cookieUser);
}

function matchPayload(match: {
  moveHistory: unknown;
  turn: string;
  status: string;
  result: unknown;
  version: number;
  whiteUser: string | null;
  blackUser: string | null;
  fen: string;
  theme: string;
}) {
  return {
    moveHistory: coerceMoveHistory(match.moveHistory),
    turn: match.turn,
    status: match.status,
    result: match.result ?? null,
    version: match.version,
    whiteUser: match.whiteUser,
    blackUser: match.blackUser,
    fen: match.fen,
    theme: match.theme,
  };
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const jar = await cookies();
  const userKey = authedUser(jar.get(COOKIE_NAME)?.value);
  if (!userKey) {
    return NextResponse.json({ error: 'Log in to join a game' }, { status: 401 });
  }

  const { code: rawCode } = await params;
  const code = normalizeCode(rawCode ?? '');
  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 });
  }

  try {
    const match = await prisma.chessMatch.findUnique({ where: { code } });
    if (!match) {
      return NextResponse.json({ error: 'No game with that code' }, { status: 404 });
    }

    // Already a player? Idempotent — just hand back current state.
    if (match.whiteUser === userKey || match.blackUser === userKey) {
      return NextResponse.json(matchPayload(match));
    }

    // Creator's own match, no second player yet, same dl_user trying to join:
    // that's not a real second device. Require a different user.
    if (match.whiteUser === userKey) {
      return NextResponse.json(
        { error: "That's your own game — the other player joins from THEIR device" },
        { status: 409 },
      );
    }

    // Black seat already taken by someone else → full.
    if (match.blackUser) {
      return NextResponse.json({ error: 'This game is already full' }, { status: 409 });
    }

    // Take the black seat and activate. Use updateMany with a guard on
    // blackUser=null so two simultaneous joiners can't both win the seat.
    const updated = await prisma.chessMatch.updateMany({
      where: { code, blackUser: null },
      data: { blackUser: userKey, status: 'active' },
    });
    if (updated.count === 0) {
      // Someone else grabbed it between our read and write.
      const fresh = await prisma.chessMatch.findUnique({ where: { code } });
      if (fresh && (fresh.whiteUser === userKey || fresh.blackUser === userKey)) {
        return NextResponse.json(matchPayload(fresh));
      }
      return NextResponse.json({ error: 'This game is already full' }, { status: 409 });
    }

    const result = await prisma.chessMatch.findUnique({ where: { code } });
    if (!result) {
      return NextResponse.json({ error: 'No game with that code' }, { status: 404 });
    }
    return NextResponse.json(matchPayload(result));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
