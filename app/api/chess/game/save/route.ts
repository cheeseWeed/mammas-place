// POST /api/chess/game/save
//
// Persist the current in-progress game (auto-save or save+quit).
//
// Body: { game: SavedChessGame }
// Auth: dl_user cookie required; __anon__ and missing are 401.
// No MP movement.

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isValidUser, normalizeUser } from '@/lib/drive-progress';
import { saveCurrentChessGame } from '@/lib/chess/store';
import type { SavedChessGame } from '@/lib/chess/game-state';

const COOKIE_NAME = 'dl_user';

function authedUser(cookieUser: string | undefined): string | null {
  if (!cookieUser || cookieUser === '__anon__') return null;
  if (!isValidUser(cookieUser)) return null;
  return normalizeUser(cookieUser);
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}
function asNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
function asPlainObject(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

// Light shape validation — server stores trusted blob, but reject
// obviously broken inputs so the JSON column doesn't accumulate garbage.
function validateGame(raw: unknown): SavedChessGame | string {
  const obj = asPlainObject(raw);
  if (!obj) return 'game must be an object';
  const id = asString(obj.id);
  const startedAt = asNumber(obj.startedAt);
  const updatedAt = asNumber(obj.updatedAt);
  const mode = asString(obj.mode);
  const fen = asString(obj.fen);
  const theme = asString(obj.theme);
  const players = asPlainObject(obj.players);
  const moveHistory = obj.moveHistory;

  if (!id) return 'game.id required';
  if (id.length > 100) return 'game.id too long';
  if (startedAt === null || updatedAt === null) return 'game timestamps required';
  if (mode !== 'local' && mode !== 'ai') return 'game.mode must be local|ai';
  if (!fen) return 'game.fen required';
  if (fen.length > 200) return 'game.fen too long';
  if (!theme) return 'game.theme required';
  if (!players) return 'game.players required';
  if (!asString(players.white) || !asString(players.black)) return 'game.players.{white,black} required';
  if (!Array.isArray(moveHistory)) return 'game.moveHistory must be an array';
  if (moveHistory.length > 1000) return 'game.moveHistory too long';
  for (const m of moveHistory) {
    if (typeof m !== 'string' || m.length < 4 || m.length > 5) {
      return 'game.moveHistory items must be UCI strings';
    }
  }

  if (mode === 'ai') {
    const aiLevel = asString(obj.aiLevel);
    const aiColor = asString(obj.aiColor);
    if (aiLevel !== 'cub' && aiLevel !== 'knight' && aiLevel !== 'wizard') {
      return 'ai game requires aiLevel cub|knight|wizard';
    }
    if (aiColor !== 'w' && aiColor !== 'b') {
      return 'ai game requires aiColor w|b';
    }
  }

  // Trust the rest (result, aiLevel, aiColor) — they round-trip through the
  // engine on resume so a malformed result will be caught at replay time.
  return raw as SavedChessGame;
}

export async function POST(req: NextRequest) {
  const jar = await cookies();
  const userKey = authedUser(jar.get(COOKIE_NAME)?.value);
  if (!userKey) {
    return NextResponse.json({ error: 'Log in to save chess games' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const validated = validateGame(body.game);
  if (typeof validated === 'string') {
    return NextResponse.json({ error: validated }, { status: 400 });
  }

  try {
    const progress = await saveCurrentChessGame(userKey, validated);
    return NextResponse.json({ progress });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'User not found') {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
