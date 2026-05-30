// POST /api/chess/game/finish
//
// Finalize a game and credit MP. Server is authoritative on cents (any
// client-supplied cents value is silently ignored — the server re-derives
// the reward via computeChessReward()).
//
// Body: { game: SavedChessGame, result: { winner, reason, finalFen } }
// Auth: dl_user cookie required; __anon__ and missing are 401.
// Idempotent on game.id: replaying a finish for a game already in
// recentGames returns the current progress without re-crediting.

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isValidUser, normalizeUser } from '@/lib/drive-progress';
import { finishChessGame } from '@/lib/chess/store';
import type { ChessGameResult, SavedChessGame } from '@/lib/chess/game-state';

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

const REASON_VALUES = new Set([
  'checkmate', 'stalemate', '50-move', 'threefold', 'insufficient', 'resignation',
]);

function validateGame(raw: unknown): SavedChessGame | string {
  const obj = asPlainObject(raw);
  if (!obj) return 'game must be an object';
  const id = asString(obj.id);
  if (!id) return 'game.id required';
  if (id.length > 100) return 'game.id too long';
  const startedAt = asNumber(obj.startedAt);
  const updatedAt = asNumber(obj.updatedAt);
  const mode = asString(obj.mode);
  const fen = asString(obj.fen);
  const theme = asString(obj.theme);
  const players = asPlainObject(obj.players);
  const moveHistory = obj.moveHistory;
  if (startedAt === null || updatedAt === null) return 'game timestamps required';
  if (mode !== 'local' && mode !== 'ai') return 'game.mode must be local|ai';
  if (!fen || !theme || !players) return 'game.fen/theme/players required';
  if (!asString(players.white) || !asString(players.black)) return 'game.players.{white,black} required';
  if (!Array.isArray(moveHistory)) return 'game.moveHistory must be an array';
  if (moveHistory.length > 1000) return 'game.moveHistory too long';
  if (mode === 'ai') {
    const aiLevel = asString(obj.aiLevel);
    const aiColor = asString(obj.aiColor);
    if (aiLevel !== 'cub' && aiLevel !== 'knight' && aiLevel !== 'wizard') {
      return 'ai game requires aiLevel';
    }
    if (aiColor !== 'w' && aiColor !== 'b') {
      return 'ai game requires aiColor';
    }
  }
  return raw as SavedChessGame;
}

function validateResult(raw: unknown): ChessGameResult | string {
  const obj = asPlainObject(raw);
  if (!obj) return 'result must be an object';
  const winner = asString(obj.winner);
  const reason = asString(obj.reason);
  const finalFen = asString(obj.finalFen);
  if (winner !== 'w' && winner !== 'b' && winner !== 'draw') {
    return 'result.winner must be w|b|draw';
  }
  if (!reason || !REASON_VALUES.has(reason)) {
    return 'result.reason invalid';
  }
  if (!finalFen) return 'result.finalFen required';
  return { winner, reason: reason as ChessGameResult['reason'], finalFen };
}

export async function POST(req: NextRequest) {
  const jar = await cookies();
  const userKey = authedUser(jar.get(COOKIE_NAME)?.value);
  if (!userKey) {
    return NextResponse.json({ error: 'Log in to finish chess games' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const validatedGame = validateGame(body.game);
  if (typeof validatedGame === 'string') {
    return NextResponse.json({ error: validatedGame }, { status: 400 });
  }
  const validatedResult = validateResult(body.result);
  if (typeof validatedResult === 'string') {
    return NextResponse.json({ error: validatedResult }, { status: 400 });
  }

  try {
    const out = await finishChessGame(userKey, validatedGame, validatedResult);
    return NextResponse.json({
      progress: out.progress,
      centsEarned: out.centsEarned,
      balanceCents: out.balanceCents,
      reason: out.reason,
      duplicate: out.duplicate,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'User not found') {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
