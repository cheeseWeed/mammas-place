// POST /api/chess/match/[code]/move
//
// Submit one move in a two-device match. The SERVER is the only arbiter of
// legality and turn order — it loads the match, maps the caller's dl_user to
// white/black, checks it's their turn, re-validates the UCI through the engine
// (applyMatchMove), then persists the new move list + re-derived fen/turn and,
// on a terminal position, the result + status='finished'. version bumps so
// pollers can detect the change.
//
// We guard the write with an optimistic-concurrency check on `version` so two
// rapid POSTs (or a poll racing a move) can't both append — the second one
// re-reads and gets rejected as out-of-date.
//
// Body: { uci: string, version?: number }
// Auth: dl_user cookie required; __anon__ and missing are 401.
//
// TODO(MP): two-device games do NOT credit MP today. Adding it later needs a
// per-side attribution scheme (credit each player's own win exactly once,
// idempotent on match id + color) so we never double-credit across two devices.
// Skipped intentionally for v1.

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isValidUser, normalizeUser } from '@/lib/drive-progress';
import { prisma } from '@/lib/prisma';
import {
  applyMatchMove,
  coerceMoveHistory,
  colorForUser,
  normalizeCode,
} from '@/lib/chess/match';

const COOKIE_NAME = 'dl_user';

function authedUser(cookieUser: string | undefined): string | null {
  if (!cookieUser || cookieUser === '__anon__') return null;
  if (!isValidUser(cookieUser)) return null;
  return normalizeUser(cookieUser);
}

const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

export async function POST(
  req: NextRequest,
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

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const uci = typeof body.uci === 'string' ? body.uci : '';
  if (!UCI_RE.test(uci)) {
    return NextResponse.json({ error: 'Invalid UCI move' }, { status: 400 });
  }

  try {
    const match = await prisma.chessMatch.findUnique({ where: { code } });
    if (!match) {
      return NextResponse.json({ error: 'No game with that code' }, { status: 404 });
    }
    if (match.status === 'finished') {
      return NextResponse.json({ error: 'Game is already over' }, { status: 409 });
    }
    if (match.status !== 'active' || !match.blackUser) {
      return NextResponse.json(
        { error: 'Waiting for the other player to join' },
        { status: 409 },
      );
    }

    const color = colorForUser(userKey, match.whiteUser, match.blackUser);
    if (!color) {
      return NextResponse.json(
        { error: "You're not a player in this game" },
        { status: 403 },
      );
    }
    if (color !== match.turn) {
      return NextResponse.json({ error: "It's not your turn" }, { status: 409 });
    }

    const history = coerceMoveHistory(match.moveHistory);

    // Re-validate the move with the engine. Throws on illegal.
    let applied;
    try {
      applied = applyMatchMove(history, uci);
    } catch {
      return NextResponse.json({ error: 'Illegal move' }, { status: 400 });
    }

    // Optimistic concurrency: only write if version is unchanged since we read.
    const updated = await prisma.chessMatch.updateMany({
      where: { code, version: match.version },
      data: {
        moveHistory: applied.moveHistory,
        fen: applied.fen,
        turn: applied.turn,
        version: match.version + 1,
        status: applied.result ? 'finished' : match.status,
        result: applied.result ?? undefined,
      },
    });
    if (updated.count === 0) {
      // A concurrent move landed first — tell the client to re-poll.
      return NextResponse.json(
        { error: 'Game state changed — refresh and try again' },
        { status: 409 },
      );
    }

    return NextResponse.json({
      moveHistory: applied.moveHistory,
      turn: applied.turn,
      status: applied.result ? 'finished' : match.status,
      result: applied.result ?? null,
      version: match.version + 1,
      whiteUser: match.whiteUser,
      blackUser: match.blackUser,
      fen: applied.fen,
      theme: match.theme,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
