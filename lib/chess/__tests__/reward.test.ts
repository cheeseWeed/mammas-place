// Reward formula tests. Pure math, no DB.

import { describe, it, expect } from 'vitest';
import { computeChessReward, computePuzzleReward } from '../reward';

describe('computeChessReward', () => {
  it('Win vs Wizard in 30 moves earns ~350¢', () => {
    // 150 × 1.0 × 1.8 × 1.32 = 356.4 → quantize to 350.
    const { cents } = computeChessReward({
      result: 'win',
      opponent: 'wizard',
      moveCount: 30,
    });
    expect(cents).toBe(350);
  });

  it('Win vs Cub in 50 moves earns 100¢ (raw 120 quantized down)', () => {
    // 150 × 1.0 × 0.8 × 1.0 = 120 → floor(120/25)*25 = 100.
    const { cents } = computeChessReward({
      result: 'win',
      opponent: 'cub',
      moveCount: 50,
    });
    expect(cents).toBe(100);
  });

  it('Draw vs Wizard earns 50¢ (raw 67.5 quantized down)', () => {
    // 0.25 × 150 × 1.8 × 1.0 = 67.5 → 50.
    const { cents } = computeChessReward({
      result: 'draw',
      opponent: 'wizard',
      moveCount: 60,
    });
    expect(cents).toBe(50);
  });

  it('Loss vs anyone earns 0¢', () => {
    for (const opponent of ['human', 'cub', 'knight', 'wizard'] as const) {
      const out = computeChessReward({
        result: 'loss',
        opponent,
        moveCount: 30,
      });
      expect(out.cents).toBe(0);
      expect(out.reason).toMatch(/loss/i);
    }
  });

  it('Win vs Human in 50 moves earns 75¢ (per-side rate)', () => {
    // 150 × 1.0 × 0.5 × 1.0 = 75 → 75.
    const { cents } = computeChessReward({
      result: 'win',
      opponent: 'human',
      moveCount: 50,
    });
    expect(cents).toBe(75);
  });

  it('quantization: 25¢ floor — small raw values round to 0', () => {
    // No real input naturally produces these, but we verify the quantize
    // boundary by inducing them through the formula. Easiest direct way
    // is via the difficultyMult math.
    //
    // Draw vs Human at moveCount=60: 150 × 0.25 × 0.5 × 1.0 = 18.75 → 0.
    // (Spec advisor: this is the right answer — siblings agreeing on a
    // mid-length draw shouldn't earn anything; combats the stalling vector.)
    const drawHuman = computeChessReward({
      result: 'draw',
      opponent: 'human',
      moveCount: 60,
    });
    expect(drawHuman.cents).toBe(0);
  });

  it('quantization: floor(raw/25)*25 with min 25 when >=25', () => {
    // We can confirm internal quantization indirectly by picking inputs
    // whose product is around 25/26/49/50¢ — but since the formula's
    // input space is bounded by our enums, easier to assert the floor
    // behavior at specific known-good points.
    //
    // Draw vs Wizard at moveCount=25 → 0.25 × 150 × 1.8 × 1.4 = 94.5 → 75.
    const drawWizardFast = computeChessReward({
      result: 'draw',
      opponent: 'wizard',
      moveCount: 25,
    });
    expect(drawWizardFast.cents).toBe(75);

    // Draw vs Knight at moveCount=60 → 0.25 × 150 × 1.2 × 1.0 = 45 → 25.
    const drawKnight = computeChessReward({
      result: 'draw',
      opponent: 'knight',
      moveCount: 60,
    });
    expect(drawKnight.cents).toBe(25);
  });

  it('efficiency: 25-move win has 1.4× bonus', () => {
    // Win vs Wizard, 25 moves: 150 × 1.0 × 1.8 × 1.4 = 378 → 375.
    const { cents } = computeChessReward({
      result: 'win',
      opponent: 'wizard',
      moveCount: 25,
    });
    expect(cents).toBe(375);
  });

  it('efficiency: 30-move win is between 25 and 50 (linear)', () => {
    // At 30: efficiency = 1.0 + 0.4 × (50-30)/25 = 1.32.
    // Win vs Wizard: 150 × 1.0 × 1.8 × 1.32 = 356.4 → 350.
    const { cents } = computeChessReward({
      result: 'win',
      opponent: 'wizard',
      moveCount: 30,
    });
    expect(cents).toBe(350);
  });

  it('efficiency: 50-move win has 1.0 bonus (no penalty for slow wins)', () => {
    // Win vs Wizard, 50 moves: 150 × 1.0 × 1.8 × 1.0 = 270 → 250.
    const { cents } = computeChessReward({
      result: 'win',
      opponent: 'wizard',
      moveCount: 50,
    });
    expect(cents).toBe(250);
  });

  it('efficiency: very slow win (100 moves) still earns base rate', () => {
    // Win vs Wizard, 100 moves: 150 × 1.0 × 1.8 × 1.0 = 270 → 250.
    const { cents } = computeChessReward({
      result: 'win',
      opponent: 'wizard',
      moveCount: 100,
    });
    expect(cents).toBe(250);
  });

  it('reasons are human-readable on non-zero earnings', () => {
    const winWiz = computeChessReward({
      result: 'win',
      opponent: 'wizard',
      moveCount: 25,
    });
    expect(winWiz.reason).toMatch(/win/i);
    expect(winWiz.reason).toMatch(/wizard/i);
    expect(winWiz.reason).toMatch(/25/);
  });

  it('Win vs Knight in 40 moves quantizes correctly', () => {
    // efficiency at 40: 1.0 + 0.4 × (50-40)/25 = 1.16
    // 150 × 1.0 × 1.2 × 1.16 = 208.8 → 200.
    const { cents } = computeChessReward({
      result: 'win',
      opponent: 'knight',
      moveCount: 40,
    });
    expect(cents).toBe(200);
  });

  it('zero/negative move count treated as 1.0 efficiency', () => {
    // Defensive: an "instant" finish shouldn't go infinite. Treat as 1.0.
    const { cents } = computeChessReward({
      result: 'win',
      opponent: 'wizard',
      moveCount: 0,
    });
    // 150 × 1.0 × 1.8 × 1.0 = 270 → 250.
    expect(cents).toBe(250);
  });
});

describe('computePuzzleReward', () => {
  it('gave-up earns 0¢ for every theme', () => {
    for (const theme of ['mate-in-1', 'mate-in-2', 'mate-in-3', 'endgame'] as const) {
      const out = computePuzzleReward({ result: 'gave-up', theme, movesTaken: 0 });
      expect(out.cents).toBe(0);
      expect(out.reason).toMatch(/skip/i);
    }
  });

  it('mate-in-1 solved in 1 move earns 75¢ (50 base + 25 bonus)', () => {
    const out = computePuzzleReward({ result: 'solved', theme: 'mate-in-1', movesTaken: 1 });
    expect(out.cents).toBe(75);
    expect(out.reason).toMatch(/no wrong moves/);
  });

  it('mate-in-1 solved in 2 moves (one wrong try) earns base 50¢ only', () => {
    const out = computePuzzleReward({ result: 'solved', theme: 'mate-in-1', movesTaken: 2 });
    expect(out.cents).toBe(50);
    expect(out.reason).not.toMatch(/no wrong moves/);
  });

  it('mate-in-2 solved in 2 moves earns 125¢ (100 base + 25 bonus)', () => {
    const out = computePuzzleReward({ result: 'solved', theme: 'mate-in-2', movesTaken: 2 });
    expect(out.cents).toBe(125);
    expect(out.reason).toMatch(/mate-in-2/);
    expect(out.reason).toMatch(/no wrong moves/);
  });

  it('mate-in-2 solved in 3 moves (one wrong try) earns base 100¢', () => {
    const out = computePuzzleReward({ result: 'solved', theme: 'mate-in-2', movesTaken: 3 });
    expect(out.cents).toBe(100);
  });

  it('mate-in-3 solved in 3 moves earns 175¢ (150 base + 25 bonus)', () => {
    const out = computePuzzleReward({ result: 'solved', theme: 'mate-in-3', movesTaken: 3 });
    expect(out.cents).toBe(175);
  });

  it('mate-in-3 solved in 4 moves earns base 150¢', () => {
    const out = computePuzzleReward({ result: 'solved', theme: 'mate-in-3', movesTaken: 4 });
    expect(out.cents).toBe(150);
  });

  it('endgame solved always earns base 100¢ (no efficiency bonus in v2)', () => {
    // Endgame puzzles vary in length, so we don't bake an expected count in.
    for (const moves of [1, 2, 3, 4, 5, 6]) {
      const out = computePuzzleReward({ result: 'solved', theme: 'endgame', movesTaken: moves });
      expect(out.cents).toBe(100);
      expect(out.reason).toMatch(/endgame/);
    }
  });

  it('reason contains theme label when solved', () => {
    const m1 = computePuzzleReward({ result: 'solved', theme: 'mate-in-1', movesTaken: 1 });
    expect(m1.reason).toMatch(/mate-in-1/);
    const eg = computePuzzleReward({ result: 'solved', theme: 'endgame', movesTaken: 2 });
    expect(eg.reason).toMatch(/endgame/);
  });
});
