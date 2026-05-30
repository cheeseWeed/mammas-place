// Performance budgets for the chess AI.
//
// SKIPPED BY DEFAULT — CI shouldn't pay this cost on every commit. To run:
//
//   npx vitest run lib/chess/__tests__/ai-perf.test.ts --no-skip
//   OR remove the `.skip` below.
//
// Budgets are p95 (95th-percentile latency over the sample) so a single noisy
// run won't fail the suite. Sample sizes are intentionally large enough to be
// representative — the test takes ~30s when run.

import { describe, expect, it } from 'vitest';

import { chooseMove, makeRng } from '@/lib/chess/ai';
import type { Position } from '@/lib/chess/engine';
import { legalMoves, makeMove } from '@/lib/chess/engine';
import { parseFEN } from '@/lib/chess/fen';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function p95(samples: number[]): number {
  const sorted = samples.slice().sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(0.95 * sorted.length));
  return sorted[idx];
}

// Generate a fixed list of mid-game positions for benchmarking.
function midGamePositions(count: number, seed: number): Position[] {
  const rng = makeRng(seed);
  const positions: Position[] = [];
  while (positions.length < count) {
    let pos = parseFEN(START_FEN);
    const plyTarget = 10 + Math.floor(rng() * 20);
    let valid = true;
    for (let p = 0; p < plyTarget; p++) {
      const moves = legalMoves(pos);
      if (moves.length === 0) { valid = false; break; }
      const move = moves[Math.floor(rng() * moves.length)];
      pos = makeMove(pos, move);
    }
    if (valid && legalMoves(pos).length > 0) positions.push(pos);
  }
  return positions;
}

describe.skip('AI performance budgets', () => {
  it('Cub: p95 <100ms over 50 positions', () => {
    const positions = midGamePositions(50, 0xCAFE01);
    const samples: number[] = [];
    for (let i = 0; i < positions.length; i++) {
      const t0 = Date.now();
      chooseMove(positions[i], 'cub', makeRng(i));
      samples.push(Date.now() - t0);
    }
    const p = p95(samples);
    // eslint-disable-next-line no-console
    console.log(`Cub p95: ${p}ms (min ${Math.min(...samples)}, max ${Math.max(...samples)})`);
    expect(p).toBeLessThan(100);
  }, 30000);

  it('Knight: p95 <1500ms over 20 positions', () => {
    const positions = midGamePositions(20, 0xCAFE02);
    const samples: number[] = [];
    for (const pos of positions) {
      const t0 = Date.now();
      chooseMove(pos, 'knight');
      samples.push(Date.now() - t0);
    }
    const p = p95(samples);
    // eslint-disable-next-line no-console
    console.log(`Knight p95: ${p}ms (min ${Math.min(...samples)}, max ${Math.max(...samples)})`);
    expect(p).toBeLessThan(1500);
  }, 60000);

  it('Wizard: p95 <4000ms over 10 positions', () => {
    const positions = midGamePositions(10, 0xCAFE03);
    const samples: number[] = [];
    for (const pos of positions) {
      const t0 = Date.now();
      chooseMove(pos, 'wizard');
      samples.push(Date.now() - t0);
    }
    const p = p95(samples);
    // eslint-disable-next-line no-console
    console.log(`Wizard p95: ${p}ms (min ${Math.min(...samples)}, max ${Math.max(...samples)})`);
    expect(p).toBeLessThan(4000);
  }, 90000);
});
