// /api/chess/game
//
// GET    → { progress: ChessProgress } for the logged-in kid.
// DELETE → wipe the current saved game (no MP refund; quitting != finish).
//
// Auth: dl_user cookie. __anon__ and missing are 401.

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isValidUser, normalizeUser } from '@/lib/drive-progress';
import {
  clearCurrentChessGame,
  readChessProgress,
} from '@/lib/chess/store';

const COOKIE_NAME = 'dl_user';

function authedUser(cookieUser: string | undefined): string | null {
  if (!cookieUser || cookieUser === '__anon__') return null;
  if (!isValidUser(cookieUser)) return null;
  return normalizeUser(cookieUser);
}

export async function GET() {
  const jar = await cookies();
  const userKey = authedUser(jar.get(COOKIE_NAME)?.value);
  if (!userKey) {
    return NextResponse.json({ error: 'Log in to use chess save' }, { status: 401 });
  }
  try {
    const progress = await readChessProgress(userKey);
    return NextResponse.json({ progress });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'User not found') {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  const jar = await cookies();
  const userKey = authedUser(jar.get(COOKIE_NAME)?.value);
  if (!userKey) {
    return NextResponse.json({ error: 'Log in to use chess save' }, { status: 401 });
  }
  try {
    const progress = await clearCurrentChessGame(userKey);
    return NextResponse.json({ progress });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'User not found') {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
