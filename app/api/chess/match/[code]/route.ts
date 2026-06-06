// GET /api/chess/match/[code]
//
// Poll the current state of a two-device match. Each device hits this every
// ~1.8s to pick up the opponent's moves. Returns the move list + derived
// metadata; the client re-derives the board by replaying moveHistory through
// the same engine the server uses.
//
// Returns: { moveHistory, turn, status, result, version, whiteUser, blackUser, fen }
// Auth: dl_user cookie required (identity), but ANY logged-in kid may read a
// match by code (so the joiner can look before committing to join). __anon__
// and missing are 401.

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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const jar = await cookies();
  const userKey = authedUser(jar.get(COOKIE_NAME)?.value);
  if (!userKey) {
    return NextResponse.json({ error: 'Log in to play' }, { status: 401 });
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
    return NextResponse.json({
      moveHistory: coerceMoveHistory(match.moveHistory),
      turn: match.turn,
      status: match.status,
      result: match.result ?? null,
      version: match.version,
      whiteUser: match.whiteUser,
      blackUser: match.blackUser,
      fen: match.fen,
      theme: match.theme,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
