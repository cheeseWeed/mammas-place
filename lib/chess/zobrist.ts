// Zobrist hashing for chess positions.
//
// Used for threefold-repetition detection (positionHistory carries hashes,
// not full board snapshots) and as the right primitive for a future
// transposition table in the AI.
//
// The random tables are seeded with a fixed constant via xorshift32 so hashes
// are deterministic across runs and processes. JS bitwise ops are 32-bit, so
// we build each "64-bit" key as two 32-bit halves and emit them as 16 hex
// chars; XOR is per-half. This is plenty of entropy for repetition detection.

import type { Position, Color, PieceType } from './engine';

// xorshift32 — deterministic PRNG. Same seed → same sequence.
function xorshift32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state;
  };
}

// Piece-type index. Combined with color it gives 0..11.
const TYPE_INDEX: Record<PieceType, number> = { K: 0, Q: 1, R: 2, B: 3, N: 4, P: 5 };
function pieceIndex(color: Color, type: PieceType): number {
  return (color === 'w' ? 0 : 6) + TYPE_INDEX[type];
}

type Key = readonly [number, number];

const rand = xorshift32(0x9E3779B9);
function nextKey(): Key { return [rand(), rand()] as const; }

// 12 pieces × 64 squares, side-to-move (only black contributes), 4 castling
// rights, 8 en-passant files (only the file matters since EP target's rank
// is implied by the side to move).
const PIECE_SQUARE: Key[][] = Array.from({ length: 12 }, () =>
  Array.from({ length: 64 }, () => nextKey()),
);
const BLACK_TO_MOVE: Key = nextKey();
const CASTLE_KEYS: { wK: Key; wQ: Key; bK: Key; bQ: Key } = {
  wK: nextKey(), wQ: nextKey(), bK: nextKey(), bQ: nextKey(),
};
const EP_FILE: Key[] = Array.from({ length: 8 }, () => nextKey());

function xor(a: Key, b: Key): Key { return [(a[0] ^ b[0]) >>> 0, (a[1] ^ b[1]) >>> 0]; }
function toHex(k: Key): string {
  return k[0].toString(16).padStart(8, '0') + k[1].toString(16).padStart(8, '0');
}

export function hashPosition(pos: Position): string {
  let h: Key = [0, 0];
  for (let sq = 0; sq < 64; sq++) {
    const p = pos.board[sq];
    if (!p) continue;
    h = xor(h, PIECE_SQUARE[pieceIndex(p.color, p.type)][sq]);
  }
  if (pos.turn === 'b') h = xor(h, BLACK_TO_MOVE);
  if (pos.castling.wK) h = xor(h, CASTLE_KEYS.wK);
  if (pos.castling.wQ) h = xor(h, CASTLE_KEYS.wQ);
  if (pos.castling.bK) h = xor(h, CASTLE_KEYS.bK);
  if (pos.castling.bQ) h = xor(h, CASTLE_KEYS.bQ);
  if (pos.enPassantTarget !== null) {
    h = xor(h, EP_FILE[pos.enPassantTarget % 8]);
  }
  return toHex(h);
}
