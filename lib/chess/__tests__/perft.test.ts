import { describe, it, expect } from 'vitest';
import { initialPosition, legalMoves, makeMove, type Position } from '../engine';

// PERFT — the standard chess engine correctness check. Count leaf nodes at
// depth N from a given position. Match exactly against published numbers
// from https://www.chessprogramming.org/Perft_Results.
//
// Initial position:
//   depth 1 =       20
//   depth 2 =      400
//   depth 3 =     8902
//   depth 4 =   197281
//   depth 5 =  4865609  (skipped by default; flip to .it to verify deeply)

function perft(pos: Position, depth: number): number {
  if (depth === 0) return 1;
  const moves = legalMoves(pos);
  if (depth === 1) return moves.length;
  let total = 0;
  for (const m of moves) {
    total += perft(makeMove(pos, m), depth - 1);
  }
  return total;
}

describe('perft — initial position', () => {
  it('depth 1 = 20', () => {
    expect(perft(initialPosition(), 1)).toBe(20);
  });
  it('depth 2 = 400', () => {
    expect(perft(initialPosition(), 2)).toBe(400);
  });
  it('depth 3 = 8902', () => {
    expect(perft(initialPosition(), 3)).toBe(8902);
  });
  it('depth 4 = 197281', () => {
    expect(perft(initialPosition(), 4)).toBe(197281);
  }, 30_000);
  // Enable to run the depth-5 check. Slow (~minute) but proves the engine
  // hard. Numbers from chessprogramming.org.
  it.skip('depth 5 = 4865609', () => {
    expect(perft(initialPosition(), 5)).toBe(4865609);
  }, 600_000);
});
