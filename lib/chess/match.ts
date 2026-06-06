// Two-device chess match — server-side helpers.
//
// A ChessMatch row is the single source of truth for a game two kids play on
// separate devices. This module owns:
//   - the readable join-code generator (no ambiguous chars),
//   - re-deriving FEN / turn / status from a UCI move list via the PURE engine
//     (lib/chess/engine + game-state), so the move endpoint can validate and
//     persist a move without trusting the client for legality.
//
// Nothing here talks to Prisma — the API routes own persistence. These are
// pure functions over the move list so they're trivially testable and reuse
// the exact same engine the single-device game uses.

import {
  initialPosition,
  legalMoves,
  makeMove,
  gameStatus,
  type Position,
} from './engine';
import { parseFEN, toFEN } from './fen';
import { parseUci, STARTING_FEN } from './game-state';
import type { ChessGameResult } from './game-state';

export { STARTING_FEN };

export type MatchColor = 'w' | 'b';
export type MatchStatus = 'waiting' | 'active' | 'finished';

// ---------- Join code ----------

// Crockford-ish alphabet minus ambiguous glyphs (0/O/1/I/L). Kids read these
// aloud to each other across the room, so legibility matters more than entropy.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

// 4-char default code: 31^4 ≈ 923k combos — plenty for a household, short
// enough to read out loud. Caller checks uniqueness against the DB and retries
// (bumping length to 5 on repeated collisions) if needed.
export function generateMatchCode(length = 4): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

// ---------- Move list → derived state ----------

// Replay a UCI move list from the starting position through the engine. Returns
// the final Position. Throws on the first illegal move (callers that store only
// engine-validated moves never hit this; it's a safety net for corrupted rows).
export function replayMoves(moveHistory: string[]): Position {
  let pos = initialPosition();
  for (const uci of moveHistory) {
    const parsed = parseUci(uci);
    const candidates = legalMoves(pos, parsed.from);
    const matched = candidates.find(
      (m) =>
        m.from === parsed.from &&
        m.to === parsed.to &&
        (parsed.promotion ? m.promotion === parsed.promotion : !m.promotion),
    );
    if (!matched) {
      throw new Error(`Illegal UCI move in match history: ${uci}`);
    }
    pos = makeMove(pos, matched);
  }
  return pos;
}

// Map the engine's GameStatus to a finished-game result (or null if the game
// is still in progress). `pos` is the position AFTER the move that may have
// ended the game; its `turn` is the side that would move next, i.e. the loser
// on checkmate.
export function deriveResult(pos: Position): ChessGameResult | null {
  const status = gameStatus(pos);
  switch (status) {
    case 'checkmate':
      // The side to move is checkmated, so the OTHER side won.
      return {
        winner: pos.turn === 'w' ? 'b' : 'w',
        reason: 'checkmate',
        finalFen: toFEN(pos),
      };
    case 'stalemate':
      return { winner: 'draw', reason: 'stalemate', finalFen: toFEN(pos) };
    case 'draw-50-move':
      return { winner: 'draw', reason: '50-move', finalFen: toFEN(pos) };
    case 'draw-threefold':
      return { winner: 'draw', reason: 'threefold', finalFen: toFEN(pos) };
    case 'draw-insufficient':
      return { winner: 'draw', reason: 'insufficient', finalFen: toFEN(pos) };
    default:
      return null;
  }
}

// Apply a single UCI move to the current move list, validating it with the
// engine. Returns the new move list + re-derived fen/turn/result. Throws if the
// move is illegal (caller maps that to a 400). `expectedTurn` guards "not your
// turn" at the engine level too — the FEN's side-to-move must match.
export type AppliedMatchMove = {
  moveHistory: string[];
  fen: string;
  turn: MatchColor;
  result: ChessGameResult | null;
};

export function applyMatchMove(
  moveHistory: string[],
  uci: string,
): AppliedMatchMove {
  const pos = replayMoves(moveHistory);
  const parsed = parseUci(uci);
  const candidates = legalMoves(pos, parsed.from);
  const matched = candidates.find(
    (m) =>
      m.from === parsed.from &&
      m.to === parsed.to &&
      (parsed.promotion ? m.promotion === parsed.promotion : !m.promotion),
  );
  if (!matched) {
    throw new Error(`Illegal move: ${uci}`);
  }
  const next = makeMove(pos, matched);
  return {
    moveHistory: [...moveHistory, uci],
    fen: toFEN(next),
    turn: next.turn,
    result: deriveResult(next),
  };
}

// Parse a stored Json moveHistory column into a typed string[] defensively
// (the column is Json, so Prisma types it as JsonValue).
export function coerceMoveHistory(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((m): m is string => typeof m === 'string');
}

// Whose color is this dl_user in the match? null if they're not a player.
export function colorForUser(
  userKey: string,
  whiteUser: string | null,
  blackUser: string | null,
): MatchColor | null {
  if (whiteUser && userKey === whiteUser) return 'w';
  if (blackUser && userKey === blackUser) return 'b';
  return null;
}

// FEN side-to-move helper (used to cross-check turn against the stored column).
export function turnFromFen(fen: string): MatchColor {
  const pos = parseFEN(fen);
  return pos.turn;
}
