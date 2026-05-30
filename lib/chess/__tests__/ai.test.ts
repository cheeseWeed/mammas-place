// Tests for the chess AI (Cub / Knight / Wizard).
//
// These tests run against the real engine at `lib/chess/engine.ts`. They will
// fail with import errors if the engine hasn't been built yet.
//
// NOTE: This file lives at `lib/chess/__tests__/ai.test.ts`. The repo's
// `vitest.config.ts` currently only includes `tests/**/*.test.ts` — to run
// these you'll either need to:
//   (a) update vitest.config.ts `include` to add 'lib/**/__tests__/**/*.test.ts'
//   (b) run with `npx vitest run lib/chess/__tests__/ai.test.ts` explicitly
//
// The PLAN.md file layout puts engine tests here too (`lib/chess/__tests__/
// engine.test.ts`), so the config update is needed anyway.

import { describe, expect, it } from 'vitest';

import { chooseMove, makeRng } from '@/lib/chess/ai';
import type { Move, Position, Square } from '@/lib/chess/engine';
import { isCheck, legalMoves, makeMove } from '@/lib/chess/engine';
import { parseFEN } from '@/lib/chess/fen';

// === Helpers ==================================================================

// Standard chess start position FEN.
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function startPosition(): Position {
  return parseFEN(START_FEN);
}

function isLegal(pos: Position, move: Move): boolean {
  const all = legalMoves(pos);
  return all.some(m =>
    m.from === move.from &&
    m.to === move.to &&
    m.promotion === move.promotion,
  );
}

// === Cub ======================================================================

describe('Cub', () => {
  it('always returns a legal move from the initial position (20 runs)', () => {
    for (let i = 0; i < 20; i++) {
      const pos = startPosition();
      const rng = makeRng(0xC0FFEE + i);
      const move = chooseMove(pos, 'cub', rng);
      expect(isLegal(pos, move)).toBe(true);
    }
  });

  it('completes quickly (<100ms per move on average)', () => {
    const pos = startPosition();
    const start = Date.now();
    const iterations = 10;
    for (let i = 0; i < iterations; i++) {
      chooseMove(pos, 'cub', makeRng(i));
    }
    const elapsed = Date.now() - start;
    // Average per move should be well under 100ms.
    expect(elapsed / iterations).toBeLessThan(100);
  });
});

// === Knight ===================================================================

describe('Knight', () => {
  it('finds a mate-in-1 in under 500ms', () => {
    // Back-rank mate position. White to play and mate in one with Ra8#.
    // FEN: 6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1
    const pos = parseFEN('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1');
    const start = Date.now();
    const move = chooseMove(pos, 'knight');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(500);
    // Apply the move and verify it's checkmate.
    const next = makeMove(pos, move);
    const blackLegal = legalMoves(next);
    expect(blackLegal.length).toBe(0);
  });

  it('captures the queen when offered for free', () => {
    // White rook on a1, Black queen hanging on a8 with nothing defending it.
    // White to move. Knight should grab the queen.
    // FEN: q5k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1
    const pos = parseFEN('q5k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1');
    const move = chooseMove(pos, 'knight');
    // Expect the move to capture the queen at a8 (file a = 0, rank 8 = index 0).
    const A8: Square = 0;
    expect(move.to).toBe(A8);
    const captured = pos.board[A8];
    expect(captured).toBeTruthy();
    expect(captured?.type).toBe('Q');
  });
});

// === Wizard ===================================================================

describe('Wizard', () => {
  it('finds a mate-in-1 in under 2 seconds', () => {
    const pos = parseFEN('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1');
    const start = Date.now();
    const move = chooseMove(pos, 'wizard');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(2000);
    const next = makeMove(pos, move);
    expect(legalMoves(next).length).toBe(0);
  });

  it('does not blunder its queen for nothing', () => {
    // White queen on d1, opportunity to move to a square attacked by a pawn for
    // no compensation. Wizard should NOT take that move.
    // FEN: 4k3/8/8/4p3/8/8/8/3QK3 w - - 0 1 — queen on d1, black pawn on e5.
    // A naive 1-ply search might suggest Qd5 (attacked by e5 pawn), losing the queen.
    const pos = parseFEN('4k3/8/8/4p3/8/8/8/3QK3 w - - 0 1');
    const move = chooseMove(pos, 'wizard');
    // The move shouldn't land the queen on a square attacked by the pawn (d6 or f6
    // are e5-pawn's attack squares, but the queen reaches d6 by going up the d-file).
    // d6 = file 3, rank 6 from white pov -> index = (8-6)*8 + 3 = 19.
    // Just verify queen is alive after the opponent's best reply.
    const next = makeMove(pos, move);
    // Find white queen.
    let queenSquare = -1;
    for (let i = 0; i < 64; i++) {
      const piece = next.board[i];
      if (piece && piece.color === 'w' && piece.type === 'Q') {
        queenSquare = i;
        break;
      }
    }
    expect(queenSquare).toBeGreaterThanOrEqual(0);
    // Now make the worst-for-white black reply (the one that captures the queen if available).
    const blackMoves = legalMoves(next);
    let queenLost = false;
    for (const reply of blackMoves) {
      if (reply.to === queenSquare) {
        queenLost = true;
        break;
      }
    }
    expect(queenLost).toBe(false);
  });

  it('avoids stalemate when winning (K+Q vs K endgame)', () => {
    // Classic near-stalemate trap. White: Kc6, Qb6. Black: Ka8 (cornered).
    // FEN: k7/8/1QK5/8/8/8/8/8 w - - 0 1
    // A bad move is Qb7+ → Ka7 with no stalemate but Qa6 stalemates the king.
    // Actually with K on c6 and Q on b6, Qb7 stalemates Black king on a8?
    // Let's pick a setup where stalemate is a real risk: K c6, Q g7, k a8.
    // FEN: k7/6Q1/2K5/8/8/8/8/8 w - - 0 1 — Qa7 stalemates (Black king on a8, no legal move).
    const pos = parseFEN('k7/6Q1/2K5/8/8/8/8/8 w - - 0 1');
    const move = chooseMove(pos, 'wizard');
    const next = makeMove(pos, move);
    // After the AI's move, it's Black's turn. If Black has no legal moves and is
    // not in check, that's stalemate — bad for us if we were winning.
    const blackMoves = legalMoves(next);
    if (blackMoves.length === 0) {
      // No moves — must be checkmate (good) not stalemate (bad).
      const wasMate = isCheck(next, 'b');
      expect(wasMate).toBe(true);
    }
  });
});

// === All levels: random mid-game positions ===================================

describe('All levels return legal moves from random mid-game positions', () => {
  // Build 10 reproducible mid-game positions by playing N random moves from
  // start, using a seeded RNG. We use the engine's own legalMoves to walk.
  function midGamePositions(count: number, seed: number): Position[] {
    const rng = makeRng(seed);
    const positions: Position[] = [];
    for (let i = 0; i < count; i++) {
      let pos = startPosition();
      const plyTarget = 10 + Math.floor(rng() * 20); // 10..29 plies in
      for (let p = 0; p < plyTarget; p++) {
        const moves = legalMoves(pos);
        if (moves.length === 0) break;
        const move = moves[Math.floor(rng() * moves.length)];
        pos = makeMove(pos, move);
      }
      positions.push(pos);
    }
    return positions;
  }

  const positions = midGamePositions(10, 0xBADF00D);

  it('Cub returns a legal move from each', () => {
    for (const pos of positions) {
      if (legalMoves(pos).length === 0) continue; // skip terminal
      const move = chooseMove(pos, 'cub', makeRng(1));
      expect(isLegal(pos, move)).toBe(true);
    }
  });

  it('Knight returns a legal move from each', () => {
    for (const pos of positions) {
      if (legalMoves(pos).length === 0) continue;
      const move = chooseMove(pos, 'knight');
      expect(isLegal(pos, move)).toBe(true);
    }
  });

  it('Wizard returns a legal move from each', () => {
    for (const pos of positions) {
      if (legalMoves(pos).length === 0) continue;
      const move = chooseMove(pos, 'wizard');
      expect(isLegal(pos, move)).toBe(true);
    }
  }, 60000);
});
