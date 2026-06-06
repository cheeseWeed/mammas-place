// POST /api/chess/match
//
// Create a new two-device chess match. The caller becomes white (the creator).
// Returns { code } — the short join code the creator reads aloud to the other
// kid, who joins from their own device via /api/chess/match/[code]/join.
//
// Body: { theme?: string }   (optional piece-set theme; defaults to "classic")
// Auth: dl_user cookie required; __anon__ and missing are 401.
// No MP movement.

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isValidUser, normalizeUser } from '@/lib/drive-progress';
import { prisma } from '@/lib/prisma';
import { generateMatchCode, STARTING_FEN } from '@/lib/chess/match';

const COOKIE_NAME = 'dl_user';

function authedUser(cookieUser: string | undefined): string | null {
  if (!cookieUser || cookieUser === '__anon__') return null;
  if (!isValidUser(cookieUser)) return null;
  return normalizeUser(cookieUser);
}

export async function POST(req: NextRequest) {
  const jar = await cookies();
  const userKey = authedUser(jar.get(COOKIE_NAME)?.value);
  if (!userKey) {
    return NextResponse.json(
      { error: 'Log in to start a two-device game' },
      { status: 401 },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    // Body is optional — tolerate a missing/empty body.
    body = {};
  }
  const theme =
    typeof body.theme === 'string' && body.theme.length > 0 && body.theme.length <= 40
      ? body.theme
      : 'classic';

  // Generate a unique code. Retry a handful of times on collision, widening to
  // 5 chars after the first couple of attempts.
  try {
    for (let attempt = 0; attempt < 6; attempt++) {
      const code = generateMatchCode(attempt < 3 ? 4 : 5);
      const existing = await prisma.chessMatch.findUnique({ where: { code } });
      if (existing) continue;
      const match = await prisma.chessMatch.create({
        data: {
          code,
          whiteUser: userKey,
          theme,
          fen: STARTING_FEN,
          status: 'waiting',
          turn: 'w',
          version: 0,
          moveHistory: [],
        },
      });
      return NextResponse.json({ code: match.code });
    }
    return NextResponse.json(
      { error: 'Could not allocate a join code — try again' },
      { status: 503 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
