// Static evaluation function for the chess AI.
//
// All scores are in centipawns (1 pawn = 100). Returned from the perspective
// of `side` — positive = good for `side`, negative = good for the opponent.
//
// Components:
//   - Material:      sum of piece values
//   - PST:           piece-square table — small positional bonus per piece per square
//   - Mobility:      count of legal moves (small bonus per move)
//   - King safety:   penalty for missing pawn shield in the castled-king area
//   - Pawn structure: penalty for doubled and isolated pawns
//
// Piece-square tables are Tomasz Michniewski's "Simplified Evaluation Function"
// tables (chessprogramming.org/Simplified_Evaluation_Function), oriented from
// White's perspective with a8 = index 0 and h1 = index 63. For Black pieces we
// mirror vertically (index 0 maps to index 56, etc).

import type { Color, PieceType, Position } from './engine';
import { isCheck, legalMoves } from './engine';

export const PIECE_VALUE: Record<PieceType, number> = {
  P: 100,
  N: 320,
  B: 330,
  R: 500,
  Q: 900,
  K: 20000,
};

// PSTs — from White's perspective, index 0 = a8 (top-left), 63 = h1 (bottom-right).
// Standard Simplified Evaluation tables.

// Pawn — encourage advancement, central pawns, but penalise blocked centre pawns on rank 2.
const PST_PAWN: number[] = [
  0,   0,   0,   0,   0,   0,   0,   0,
  50,  50,  50,  50,  50,  50,  50,  50,
  10,  10,  20,  30,  30,  20,  10,  10,
  5,   5,   10,  25,  25,  10,  5,   5,
  0,   0,   0,   20,  20,  0,   0,   0,
  5,   -5,  -10, 0,   0,   -10, -5,  5,
  5,   10,  10,  -20, -20, 10,  10,  5,
  0,   0,   0,   0,   0,   0,   0,   0,
];

const PST_KNIGHT: number[] = [
  -50, -40, -30, -30, -30, -30, -40, -50,
  -40, -20, 0,   0,   0,   0,   -20, -40,
  -30, 0,   10,  15,  15,  10,  0,   -30,
  -30, 5,   15,  20,  20,  15,  5,   -30,
  -30, 0,   15,  20,  20,  15,  0,   -30,
  -30, 5,   10,  15,  15,  10,  5,   -30,
  -40, -20, 0,   5,   5,   0,   -20, -40,
  -50, -40, -30, -30, -30, -30, -40, -50,
];

const PST_BISHOP: number[] = [
  -20, -10, -10, -10, -10, -10, -10, -20,
  -10, 0,   0,   0,   0,   0,   0,   -10,
  -10, 0,   5,   10,  10,  5,   0,   -10,
  -10, 5,   5,   10,  10,  5,   5,   -10,
  -10, 0,   10,  10,  10,  10,  0,   -10,
  -10, 10,  10,  10,  10,  10,  10,  -10,
  -10, 5,   0,   0,   0,   0,   5,   -10,
  -20, -10, -10, -10, -10, -10, -10, -20,
];

const PST_ROOK: number[] = [
  0,  0,  0,  0,  0,  0,  0,  0,
  5,  10, 10, 10, 10, 10, 10, 5,
  -5, 0,  0,  0,  0,  0,  0,  -5,
  -5, 0,  0,  0,  0,  0,  0,  -5,
  -5, 0,  0,  0,  0,  0,  0,  -5,
  -5, 0,  0,  0,  0,  0,  0,  -5,
  -5, 0,  0,  0,  0,  0,  0,  -5,
  0,  0,  0,  5,  5,  0,  0,  0,
];

const PST_QUEEN: number[] = [
  -20, -10, -10, -5, -5, -10, -10, -20,
  -10, 0,   0,   0,  0,  0,   0,   -10,
  -10, 0,   5,   5,  5,  5,   0,   -10,
  -5,  0,   5,   5,  5,  5,   0,   -5,
  0,   0,   5,   5,  5,  5,   0,   -5,
  -10, 5,   5,   5,  5,  5,   0,   -10,
  -10, 0,   5,   0,  0,  0,   0,   -10,
  -20, -10, -10, -5, -5, -10, -10, -20,
];

// King — middlegame table (encourage castled position, hide in corner).
const PST_KING: number[] = [
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -20, -30, -30, -40, -40, -30, -30, -20,
  -10, -20, -20, -20, -20, -20, -20, -10,
  20,  20,  0,   0,   0,   0,   20,  20,
  20,  30,  10,  0,   0,   10,  30,  20,
];

export const PST: Record<PieceType, number[]> = {
  P: PST_PAWN,
  N: PST_KNIGHT,
  B: PST_BISHOP,
  R: PST_ROOK,
  Q: PST_QUEEN,
  K: PST_KING,
};

// Mirror a White-relative square index to its Black-relative counterpart.
// Index 0 (a8) becomes 56 (a1), index 8 (a7) becomes 48 (a2), etc.
function mirrorIndex(idx: number): number {
  const rank = Math.floor(idx / 8);
  const file = idx % 8;
  return (7 - rank) * 8 + file;
}

// Sum material + PST for one side, in centipawns.
function staticTerms(pos: Position, color: Color): number {
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const piece = pos.board[i];
    if (!piece || piece.color !== color) continue;
    score += PIECE_VALUE[piece.type];
    const pstIdx = color === 'w' ? i : mirrorIndex(i);
    score += PST[piece.type][pstIdx];
  }
  return score;
}

// Count doubled and isolated pawns for one side. Returns a penalty (positive
// number; subtracted from the side's score).
function pawnStructurePenalty(pos: Position, color: Color): number {
  const filePawnCount = [0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 64; i++) {
    const piece = pos.board[i];
    if (piece && piece.color === color && piece.type === 'P') {
      filePawnCount[i % 8]++;
    }
  }
  let penalty = 0;
  for (let f = 0; f < 8; f++) {
    const n = filePawnCount[f];
    if (n > 1) penalty += 20 * (n - 1); // doubled
    if (n > 0) {
      const leftEmpty = f === 0 || filePawnCount[f - 1] === 0;
      const rightEmpty = f === 7 || filePawnCount[f + 1] === 0;
      if (leftEmpty && rightEmpty) penalty += 15 * n; // isolated
    }
  }
  return penalty;
}

// King safety — for each pawn on the 3 files adjacent to (and including) the
// king's file in the two ranks in front of the king, give a small shield bonus.
// Missing shield pawns are implicit penalty (no bonus). Only meaningful in the
// middlegame; in the endgame, an active king is good — but we evaluate the same
// way here for simplicity. Returns the side's shield bonus.
function kingShieldBonus(pos: Position, color: Color): number {
  let kingIdx = -1;
  for (let i = 0; i < 64; i++) {
    const piece = pos.board[i];
    if (piece && piece.color === color && piece.type === 'K') {
      kingIdx = i;
      break;
    }
  }
  if (kingIdx < 0) return 0;
  const kRank = Math.floor(kingIdx / 8);
  const kFile = kingIdx % 8;
  // Only check shield if king is on its back two ranks (castled-ish).
  if (color === 'w' && kRank < 6) return 0;
  if (color === 'b' && kRank > 1) return 0;
  let bonus = 0;
  const forward = color === 'w' ? -1 : 1;
  for (let df = -1; df <= 1; df++) {
    const f = kFile + df;
    if (f < 0 || f > 7) continue;
    for (let dr = 1; dr <= 2; dr++) {
      const r = kRank + forward * dr;
      if (r < 0 || r > 7) continue;
      const piece = pos.board[r * 8 + f];
      if (piece && piece.color === color && piece.type === 'P') {
        bonus += dr === 1 ? 10 : 5;
      }
    }
  }
  return bonus;
}

// Mobility — count of pseudo-legal moves available to `color` from the current
// position. We do this cheaply: temporarily set turn to `color` and call
// legalMoves(). If it's already that side's turn, no copy needed.
function mobility(pos: Position, color: Color): number {
  if (pos.turn === color) {
    return legalMoves(pos).length;
  }
  // Swap turn for the count. We rebuild a shallow position object — the engine
  // is supposed to be pure so this is safe.
  const swapped: Position = { ...pos, turn: color };
  return legalMoves(swapped).length;
}

// Returns evaluation in centipawns from `side`'s perspective.
export function evaluate(pos: Position, side: Color): number {
  const opp: Color = side === 'w' ? 'b' : 'w';
  const myStatic = staticTerms(pos, side);
  const oppStatic = staticTerms(pos, opp);
  const myPawn = pawnStructurePenalty(pos, side);
  const oppPawn = pawnStructurePenalty(pos, opp);
  const myShield = kingShieldBonus(pos, side);
  const oppShield = kingShieldBonus(pos, opp);
  const myMobility = mobility(pos, side);
  const oppMobility = mobility(pos, opp);
  const mobilityTerm = 2 * (myMobility - oppMobility);
  return (myStatic - oppStatic)
    - (myPawn - oppPawn)
    + (myShield - oppShield)
    + mobilityTerm;
}

// If the position is terminal (mate, stalemate, draw), return its score from
// `side`'s perspective. Otherwise null. Used as a quick check before evaluate().
//
// Mate is reported as ±(very large finite number) not Infinity so we can adjust
// by ply distance in search and still compare cleanly. We use 100000 — well
// above any real material swing but representable as int.
export const MATE_SCORE = 100000;

export function terminalScore(pos: Position, side: Color): number | null {
  const moves = legalMoves(pos);
  if (moves.length > 0) {
    // Also check draws by 50-move / threefold / insufficient material.
    if (pos.halfmoveClock >= 100) return 0;
    return null;
  }
  // No moves — check or stalemate.
  // Stalemate (no moves, not in check) = draw.
  // Checkmate (no moves, in check) = the side to move has lost.
  const sideToMove = pos.turn;
  const inCheck = isCheck(pos, sideToMove);
  if (!inCheck) return 0;
  // sideToMove is checkmated.
  return sideToMove === side ? -MATE_SCORE : MATE_SCORE;
}
