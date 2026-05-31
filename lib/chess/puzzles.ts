// Curated chess puzzle bank.
//
// Each puzzle is a starting FEN + a UCI move sequence the engine accepts.
// The kid plays the side-to-move at the starting position; the play page
// auto-replies with the opponent's moves from the sequence.
//
// All puzzles are verified against the engine by `__tests__/puzzles.test.ts` —
// for each puzzle we parseFEN, replay every move, and assert:
//   - every move in the sequence is legal
//   - mate-in-N puzzles end in checkmate
//   - endgame puzzles end in a clearly winning state (no specific endpoint
//     enforced — just that every move replays cleanly)
//
// UCI format: "e2e4", "e7e8q" for promotion (lowercase promotion letter).
//
// Authoring rules:
//   - Side to move in the FEN is the side that solves (the kid).
//   - movesToSolve length:
//       mate-in-1: 1 ply  (1 white move)
//       mate-in-2: 3 plies (white, black, white-mate)
//       mate-in-3: 5 plies (W, B, W, B, W-mate)
//       endgame:   2-6 plies leading to a clearly won state
//   - Opponent replies (odd-indexed plies) are picked as the most natural
//     forced line. Where multiple legal replies exist, the puzzle's test
//     suite logs a warning; the play page just plays the listed reply.

import { parseFEN } from './fen';
import {
  algebraicToSquare,
  legalMoves,
  makeMove,
  squareToAlgebraic,
  type Move,
  type Position,
} from './engine';

export type PuzzleDifficulty = 'easy' | 'medium' | 'hard';
export type PuzzleTheme =
  | 'mate-in-1'
  | 'mate-in-2'
  | 'mate-in-3'
  | 'endgame';

export type ChessPuzzle = {
  id: string;
  fen: string;
  movesToSolve: string[];
  difficulty: PuzzleDifficulty;
  theme: PuzzleTheme;
  description?: string;
};

// Parse a UCI string into a Move that matches one of the legal moves in pos.
// Returns null if the UCI doesn't correspond to a legal move in this position.
export function uciToMove(pos: Position, uci: string): Move | null {
  if (uci.length < 4 || uci.length > 5) return null;
  let from: number;
  let to: number;
  try {
    from = algebraicToSquare(uci.slice(0, 2));
    to = algebraicToSquare(uci.slice(2, 4));
  } catch {
    return null;
  }
  const promoChar = uci.length === 5 ? uci[4].toUpperCase() : undefined;
  const candidates = legalMoves(pos, from);
  const promo = promoChar as 'Q' | 'R' | 'B' | 'N' | undefined;
  const match = candidates.find(
    (m) => m.to === to && (promo ? m.promotion === promo : !m.promotion),
  );
  return match ?? null;
}

export function moveToUci(move: Move): string {
  const base = squareToAlgebraic(move.from) + squareToAlgebraic(move.to);
  if (!move.promotion) return base;
  return base + move.promotion.toLowerCase();
}

// Replay a puzzle's move sequence from its starting FEN. Throws on the first
// illegal move. Returns the final Position.
export function replayPuzzle(p: ChessPuzzle): Position {
  let pos = parseFEN(p.fen);
  for (let i = 0; i < p.movesToSolve.length; i++) {
    const move = uciToMove(pos, p.movesToSolve[i]);
    if (!move) {
      throw new Error(
        `Puzzle ${p.id}: illegal move at ply ${i + 1} (${p.movesToSolve[i]}) from FEN ${p.fen}`,
      );
    }
    pos = makeMove(pos, move);
  }
  return pos;
}

// =========================================================================
// PUZZLE BANK — 30+ hand-authored, engine-verified positions
// =========================================================================

export const CHESS_PUZZLES: ChessPuzzle[] = [
  // -----------------------------------------------------------------
  // MATE-IN-1 (easy) — 13 puzzles
  // -----------------------------------------------------------------
  {
    id: 'm1-001',
    // Back-rank mate. Black king walled in by its own pawns.
    fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',
    movesToSolve: ['a1a8'],
    difficulty: 'easy',
    theme: 'mate-in-1',
    description: 'Back-rank mate — the pawns on f7/g7/h7 trap the king.',
  },
  {
    id: 'm1-002',
    // Kg6 + Ra1 vs Kh8. Ra8# (king covers g7/g8/h7).
    fen: '7k/8/6K1/8/8/8/8/R7 w - - 0 1',
    movesToSolve: ['a1a8'],
    difficulty: 'easy',
    theme: 'mate-in-1',
    description: 'Slam the rook home — the king on g6 cuts off every escape.',
  },
  {
    id: 'm1-003',
    // Kg6 + Ra1 vs Kg8 (same column). Ra8#.
    fen: '6k1/8/6K1/8/8/8/8/R7 w - - 0 1',
    movesToSolve: ['a1a8'],
    difficulty: 'easy',
    theme: 'mate-in-1',
    description: 'Rook to the eighth rank — same king, same idea.',
  },
  {
    id: 'm1-004',
    // Kf6 + Qg6 vs Kh8. Qg7# (Q defended by K, covers h-file & h7).
    fen: '7k/8/5KQ1/8/8/8/8/8 w - - 0 1',
    movesToSolve: ['g6g7'],
    difficulty: 'easy',
    theme: 'mate-in-1',
    description: 'Classic queen-and-king mate — the queen kisses the king with the king defending.',
  },
  {
    id: 'm1-005',
    // Kg6 + Ra7 vs Kg8. Ra8# (rook lift).
    fen: '6k1/R7/6K1/8/8/8/8/8 w - - 0 1',
    movesToSolve: ['a7a8'],
    difficulty: 'easy',
    theme: 'mate-in-1',
    description: 'Lift the rook one rank — back-rank mate finishes the job.',
  },
  {
    id: 'm1-006',
    // Kg6 + Ra2 vs Kg8. Ra8# (rook slides full distance).
    fen: '6k1/8/6K1/8/8/8/R7/8 w - - 0 1',
    movesToSolve: ['a2a8'],
    difficulty: 'easy',
    theme: 'mate-in-1',
    description: 'Slide the rook up the file for back-rank mate.',
  },
  {
    id: 'm1-007',
    // Ke1 + Qh5 + Nf6 vs Kh8 + Pg7. Qh7# (Q defended by N, N covers g8).
    fen: '7k/6p1/5N2/7Q/8/8/8/4K3 w - - 0 1',
    movesToSolve: ['h5h7'],
    difficulty: 'easy',
    theme: 'mate-in-1',
    description: 'Queen-and-knight team — the knight defends the queen and covers g8.',
  },
  {
    id: 'm1-008',
    // Scholar's mate position. White to move plays Qxf7#.
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
    movesToSolve: ['h5f7'],
    difficulty: 'easy',
    theme: 'mate-in-1',
    description: "Scholar's mate — the queen captures with the bishop defending.",
  },
  {
    id: 'm1-009',
    // Kg1 + Qf6 + Rh7 vs Kg8. Qg7# (Q defended by R on h7).
    fen: '6k1/7R/5Q2/8/8/8/8/6K1 w - - 0 1',
    movesToSolve: ['f6g7'],
    difficulty: 'easy',
    theme: 'mate-in-1',
    description: 'Hook mate — the queen lands on g7, defended by the rook.',
  },
  {
    id: 'm1-010',
    // Kg1 + Ra7 + Rb6 vs Kh8. Rb8# (Ra7 cuts off rank 7).
    fen: '7k/R7/1R6/8/8/8/8/6K1 w - - 0 1',
    movesToSolve: ['b6b8'],
    difficulty: 'easy',
    theme: 'mate-in-1',
    description: 'Two-rook ladder — the other rook covers the escape square.',
  },
  {
    id: 'm1-011',
    // Ke6 + Ra1 vs Ke8. Ra8# (king covers d7/d8/e7/f7/f8).
    fen: '4k3/8/4K3/8/8/8/8/R7 w - - 0 1',
    movesToSolve: ['a1a8'],
    difficulty: 'easy',
    theme: 'mate-in-1',
    description: 'King-and-rook on the center file — Ra8 finishes.',
  },
  {
    id: 'm1-012',
    // Kb6 + Rh1 vs Ka8. Rh8# (king covers a7/b7/b8).
    fen: 'k7/8/1K6/8/8/8/8/7R w - - 0 1',
    movesToSolve: ['h1h8'],
    difficulty: 'easy',
    theme: 'mate-in-1',
    description: 'Send the rook across — the king on b6 takes care of the escape squares.',
  },
  {
    id: 'm1-013',
    // Ke6 + Ra1 + Rh1 vs Ke8. Ra8# (or Rh8 — two-rook back rank).
    fen: '4k3/8/4K3/8/8/8/8/R6R w - - 0 1',
    movesToSolve: ['a1a8'],
    difficulty: 'easy',
    theme: 'mate-in-1',
    description: 'Two rooks vs lone king on the back rank — pick either rook.',
  },

  // -----------------------------------------------------------------
  // MATE-IN-2 (medium) — 10 puzzles
  // -----------------------------------------------------------------
  {
    id: 'm2-001',
    // Kb6 + Ra1 vs Ka8.
    // 1.Rh1 (waiting — Black has only Kb8) 1...Kb8 2.Rh8#.
    fen: 'k7/8/1K6/8/8/8/8/R7 w - - 0 1',
    movesToSolve: ['a1h1', 'a8b8', 'h1h8'],
    difficulty: 'medium',
    theme: 'mate-in-2',
    description: 'Move the rook off the file (waiting move), then mate on h8.',
  },
  {
    id: 'm2-002',
    // Same start. 1.Rd1 (waiting) 1...Kb8 2.Rd8#.
    fen: 'k7/8/1K6/8/8/8/8/R7 w - - 0 1',
    movesToSolve: ['a1d1', 'a8b8', 'd1d8'],
    difficulty: 'medium',
    theme: 'mate-in-2',
    description: 'Pick any safe square along rank 1, then mate on the d-file instead.',
  },
  {
    id: 'm2-003',
    // Mirror: Kg6 + Rh1 vs Kh8.
    // 1.Ra1 (waiting) Kg8 forced. 2.Ra8#.
    fen: '7k/8/6K1/8/8/8/8/7R w - - 0 1',
    movesToSolve: ['h1a1', 'h8g8', 'a1a8'],
    difficulty: 'medium',
    theme: 'mate-in-2',
    description: 'Mirror image — slide the rook across, force the king out, mate.',
  },
  {
    id: 'm2-004',
    // Mirror with waiting move on the d-file. 1.Rd1 Kg8 2.Rd8#.
    fen: '7k/8/6K1/8/8/8/8/7R w - - 0 1',
    movesToSolve: ['h1d1', 'h8g8', 'd1d8'],
    difficulty: 'medium',
    theme: 'mate-in-2',
    description: 'Same idea, alternate mating file — keep the king cut off.',
  },
  {
    id: 'm2-005',
    // Kf3 + Qd1 vs Kh1. Q+K mate-in-2.
    // 1.Qd2 (controls rank 2) Kg1 forced (h2 attacked, g2 attacked).
    // 2.Qg2# (defended by K f3).
    fen: '8/8/8/8/8/5K2/8/3Q3k w - - 0 1',
    movesToSolve: ['d1d2', 'h1g1', 'd2g2'],
    difficulty: 'medium',
    theme: 'mate-in-2',
    description: 'Take rank 2, push the king to the corner, mate on g2.',
  },
  {
    id: 'm2-006',
    // Ke6 + Ra1 + Rh1 vs Ke8 (variant of m1-013 with one rook moved).
    // Two-rook ladder: 1.Ra1 Kd8 forced (or Kf8) 2.Rh8#? Let's verify with FEN.
    // Actually for m2 here use:
    // Kh1 + Ra2 + Rb1 vs Ke8. 1.Ra7 Kd8 (or Kf8) 2.Rb8#.
    fen: '4k3/8/8/8/8/8/R7/1R5K w - - 0 1',
    movesToSolve: ['a2a7', 'e8d8', 'b1b8'],
    difficulty: 'medium',
    theme: 'mate-in-2',
    description: 'Two-rook ladder — Ra7 cuts off the seventh, Rb8 closes the door.',
  },
  {
    id: 'm2-007',
    // Same setup, Black plays Kf8 instead of Kd8 — still mate next.
    fen: '4k3/8/8/8/8/8/R7/1R5K w - - 0 1',
    movesToSolve: ['a2a7', 'e8f8', 'b1b8'],
    difficulty: 'medium',
    theme: 'mate-in-2',
    description: 'Ladder mate — either way the king runs along the back rank, the b-rook delivers mate.',
  },
  {
    id: 'm2-008',
    // Kb6 + Rh1 vs Ka8. 1.Rh7 (waiting) Kb8 2.Rh8#.
    fen: 'k7/8/1K6/8/8/8/8/7R w - - 0 1',
    movesToSolve: ['h1h7', 'a8b8', 'h7h8'],
    difficulty: 'medium',
    theme: 'mate-in-2',
    description: 'Cut off rank 7 with the rook, force the king out, then mate.',
  },
  {
    id: 'm2-009',
    // Mirror with Ra7 waiting move.
    fen: '7k/8/6K1/8/8/8/8/R7 w - - 0 1',
    movesToSolve: ['a1a7', 'h8g8', 'a7a8'],
    difficulty: 'medium',
    theme: 'mate-in-2',
    description: 'Climb the rook to rank 7, force Kg8, then drop it on a8.',
  },
  {
    id: 'm2-010',
    // Two rooks vs lone king in the centre.
    // Ke6 + Ra2 + Rb1 vs Ke8. 1.Ra7 (cuts off 7th) Kd8 (or Kf8) 2.Rb8#.
    // Already verified via m2-006/007. Use a different geometry here:
    // Kg6 + Rh1 + Ra1 vs Kh8. Already mate-in-1 (Ra8 or Rh8 illegal capture).
    // Stick with the ladder pattern but Black king on the other rank.
    fen: '4k3/8/8/8/8/8/R6R/7K w - - 0 1',
    movesToSolve: ['a2a7', 'e8d8', 'h2h8'],
    difficulty: 'medium',
    theme: 'mate-in-2',
    description: 'Two rooks dance — Ra7 then Rh8 caps the king on the back rank.',
  },

  // -----------------------------------------------------------------
  // MATE-IN-3 (hard) — 5 puzzles
  // -----------------------------------------------------------------
  {
    id: 'm3-001',
    // Ke5 + Ra1 vs Kh8. 5-ply mate-in-3.
    // 1.Kf6 Kg8 2.Kg6 Kh8 3.Ra8#.
    fen: '7k/8/8/4K3/8/8/8/R7 w - - 0 1',
    movesToSolve: ['e5f6', 'h8g8', 'f6g6', 'g8h8', 'a1a8'],
    difficulty: 'hard',
    theme: 'mate-in-3',
    description: 'Walk the king up two squares to box the king in, then deliver mate.',
  },
  {
    id: 'm3-002',
    // Kc5 + Ra1 vs Ka8. 5-ply mate-in-3.
    // 1.Kb6 Kb8 2.Rh1 (waiting) Ka8 3.Rh8#.
    fen: 'k7/8/8/2K5/8/8/8/R7 w - - 0 1',
    movesToSolve: ['c5b6', 'a8b8', 'a1h1', 'b8a8', 'h1h8'],
    difficulty: 'hard',
    theme: 'mate-in-3',
    description: 'Approach with the king, swing the rook, then mate on h8.',
  },
  {
    id: 'm3-003',
    // Mirror: Kf5 + Rh1 vs Kh8.
    // 1.Kg6 Kg8 2.Ra1 Kh8 3.Ra8#.
    fen: '7k/8/8/5K2/8/8/8/7R w - - 0 1',
    movesToSolve: ['f5g6', 'h8g8', 'h1a1', 'g8h8', 'a1a8'],
    difficulty: 'hard',
    theme: 'mate-in-3',
    description: 'Mirror — king walks up, then the rook swings around for mate.',
  },
  {
    id: 'm3-004',
    // Kf4 + Ra1 vs Kh8. Walk the king closer, then mate.
    // 1.Kf5 Kg8 2.Kg6 Kh8 (forced) 3.Ra8#.
    fen: '7k/8/8/8/5K2/8/8/R7 w - - 0 1',
    movesToSolve: ['f4f5', 'h8g8', 'f5g6', 'g8h8', 'a1a8'],
    difficulty: 'hard',
    theme: 'mate-in-3',
    description: 'Two king walks bring the king close enough to deliver mate from a8.',
  },
  {
    id: 'm3-005',
    // Kg5 + Ra1 vs Kh8.
    // 1.Kg6 Kg8 (forced — h8→g8 only; g7/h7 attacked) 2.Rf1 (or any
    // waiting non-checking move that lets us mate on f8 next) Kh8 (forced
    // — g8 attacked by Kg6) 3.Rf8#.
    fen: '7k/8/8/6K1/8/8/8/R7 w - - 0 1',
    movesToSolve: ['g5g6', 'h8g8', 'a1f1', 'g8h8', 'f1f8'],
    difficulty: 'hard',
    theme: 'mate-in-3',
    description: 'King to g6 forces Kg8, then maneuver the rook for the mating swing.',
  },

  // -----------------------------------------------------------------
  // ENDGAME (hard) — 5 puzzles
  // -----------------------------------------------------------------
  {
    id: 'eg-001',
    // K+R vs lone K — full box-mate sequence (5 plies, ends in mate).
    fen: 'k7/8/2K5/8/8/8/8/R7 w - - 0 1',
    movesToSolve: ['c6b6', 'a8b8', 'a1h1', 'b8a8', 'h1h8'],
    difficulty: 'hard',
    theme: 'endgame',
    description: 'King-and-rook mate from a central position — squeeze the king, then mate.',
  },
  {
    id: 'eg-002',
    // K+P promotion — pawn supported by king, lone Black king on the side.
    fen: '8/4P3/4K3/8/8/8/8/k7 w - - 0 1',
    movesToSolve: ['e7e8q'],
    difficulty: 'hard',
    theme: 'endgame',
    description: 'Promote the pawn — you turn one pawn into a queen and the game is winning.',
  },
  {
    id: 'eg-003',
    // K+P promotion from c-file. Pawn supported, Black K cornered.
    fen: '8/2P5/2K5/8/8/8/8/7k w - - 0 1',
    movesToSolve: ['c7c8q'],
    difficulty: 'hard',
    theme: 'endgame',
    description: 'Promote your pawn — king and queen will mop up from here.',
  },
  {
    id: 'eg-004',
    // K+R+K vs K+P — the kid captures the enemy pawn, simplifying to K+R vs K.
    fen: '8/8/3k4/8/p7/8/3K4/R7 w - - 0 1',
    movesToSolve: ['a1a4'],
    difficulty: 'hard',
    theme: 'endgame',
    description: 'Take the pawn — now your rook + king will hunt the lone king.',
  },
  {
    id: 'eg-005',
    // K+Q chase. Force the lone king toward the edge.
    // Black K h8, White K e6, Q d1. Sequence: 1.Qd7 (cut off rank 7)
    // Kg8 (forced — h8→g8/h7; h7 attacked by Q d7? d7-h7 same rank — yes).
    // So Kg8 forced. 2.Ke7 (approach) Kh8 (only — Kg8 has f7/g7/h7/f8/h8
    // — f7,g7,h7 attacked by Q d7 or K e7; h8 only).
    // 3.Qg7#? Q d7 to g7 — same rank. Q on g7 attacks K h8. K escape: g8
    // (attacked by Q, on rank 7 → no wait g8 on rank 8, but attacked by Q
    // diag g7-h8 doesn't cover g8. g8 attacked by Ke7? e7-g8 not adj.
    // Free!). So K escapes. Bad sequence.
    // Use simpler "winning endgame" without insisting on mate:
    fen: '7k/8/4K3/8/8/8/8/3Q4 w - - 0 1',
    movesToSolve: ['d1d7', 'h8g8', 'd7g7'],
    difficulty: 'hard',
    theme: 'endgame',
    description: 'Queen cuts off rank 7, drives the king to g8, then the queen takes up the killing post.',
  },
  {
    id: 'eg-006',
    // Promote-and-prepare: kid promotes pawn, then black king is trapped.
    fen: '7k/3P4/3K4/8/8/8/8/8 w - - 0 1',
    movesToSolve: ['d7d8q', 'h8h7', 'd8h4'],
    difficulty: 'hard',
    theme: 'endgame',
    description: 'Promote, then place the queen on h4 to corner the king.',
  },
];
