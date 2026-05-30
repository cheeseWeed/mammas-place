// Chess MP reward formula (Phase 4).
//
// Per app/chess/PLAN.md:
//
//   cents = 150 × resultMult × difficultyMult × efficiencyMult
//
// - resultMult:     win=1.0, draw=0.25, loss=0
//                   (spec-advisor recalibration: 0.4 incentivized stalling
//                   for threefold against Cub; 0.25 still rewards a real
//                   Wizard draw at 0.25 × 1.8 = 45% of baseline.)
// - difficultyMult: human=0.5 (per-side, sibling games pay less than AI),
//                   cub=0.8, knight=1.2, wizard=1.8
// - efficiencyMult: 1.0 at 50+ moves, scaling linearly to 1.4 at ≤25 moves.
//                   No penalty for slow wins (just no bonus).
//
// Cents are quantized to multiples of 25¢. Anything raw < 25¢ rounds to 0
// (so a tiny technical earn doesn't show up as "0.07 MP" in the wallet).
//
// Pure function. Server is authoritative — the chess HTTP route ignores
// any client-supplied cents and re-derives via this function.

export type ChessResult = 'win' | 'loss' | 'draw';
export type ChessOpponent = 'human' | 'cub' | 'knight' | 'wizard';

export type ChessRewardInput = {
  result: ChessResult;
  opponent: ChessOpponent;
  moveCount: number;
};

export type ChessRewardOutput = {
  cents: number;
  reason: string;
};

const BASE_CENTS = 150;

function resultMult(r: ChessResult): number {
  if (r === 'win') return 1.0;
  if (r === 'draw') return 0.25;
  return 0;
}

function difficultyMult(o: ChessOpponent): number {
  switch (o) {
    case 'human': return 0.5;
    case 'cub': return 0.8;
    case 'knight': return 1.2;
    case 'wizard': return 1.8;
  }
}

// Linear ramp from 1.0 at 50 moves to 1.4 at 25 moves; <=25 caps at 1.4;
// >=50 stays at 1.0.
function efficiencyMult(moveCount: number): number {
  if (!Number.isFinite(moveCount) || moveCount <= 0) return 1.0;
  if (moveCount >= 50) return 1.0;
  if (moveCount <= 25) return 1.4;
  // 25..50 → 1.4..1.0 (linear).
  const t = (50 - moveCount) / (50 - 25); // 0 at 50, 1 at 25
  return 1.0 + 0.4 * t;
}

function quantize(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  const floored = Math.floor(raw / 25) * 25;
  if (floored < 25) return 0;
  return Math.max(25, floored);
}

function opponentLabel(o: ChessOpponent): string {
  switch (o) {
    case 'human': return 'sibling';
    case 'cub': return 'Cub';
    case 'knight': return 'Knight';
    case 'wizard': return 'Wizard';
  }
}

export function computeChessReward(input: ChessRewardInput): ChessRewardOutput {
  const { result, opponent, moveCount } = input;
  if (result === 'loss') {
    return { cents: 0, reason: 'No MP for losses, but great game!' };
  }
  const rMult = resultMult(result);
  if (rMult === 0) {
    return { cents: 0, reason: 'No MP for losses, but great game!' };
  }
  const dMult = difficultyMult(opponent);
  const eMult = efficiencyMult(moveCount);
  const raw = BASE_CENTS * rMult * dMult * eMult;
  const cents = quantize(raw);

  if (cents === 0) {
    return {
      cents: 0,
      reason: `${result === 'draw' ? 'Draw' : 'Win'} vs ${opponentLabel(opponent)} (${moveCount} moves)`,
    };
  }

  const verb = result === 'win' ? 'win' : 'draw';
  return {
    cents,
    reason: `Chess ${verb} vs ${opponentLabel(opponent)} in ${moveCount} moves`,
  };
}
