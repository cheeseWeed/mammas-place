// Music daily-practice reward — pure functions, no DB.
//
// One rule the kid hears: "the better it sounds, the more you earn."
//
// A daily session is scored 1-10 (reviewed by a parent / ChatGPT before the
// kid enters it). MP scales STEEPLY with the score — a Fibonacci-style curve
// (per the user's pick) so chasing a great-sounding run-through feels special,
// while showing up at all still pays a base. Capped at 100 MP / day / piece.
//
// All math in whole cents (1 MP = 100 cents).

const MP = 100;

// Hard daily cap per piece: 100 MP.
export const DAILY_PIECE_CAP_CENTS = 100 * MP;

// Base "you showed up and practiced" pay. A rough day still earns this much
// (don't shame the learner). Quality bonus stacks on top.
const SHOW_UP_CENTS = 15 * MP; // 15 MP just for practicing

// Fibonacci-style quality bonus by score (1..10). Steep at the top so a 9 or
// 10 is worth dramatically more than a 6. Tuned so SHOW_UP + bonus(10) == cap.
//   score:  1   2   3   4   5    6    7    8    9    10
//   bonus:  0   0   3   5   8   13   21   34   55   85   (in MP)
// 15 (show-up) + 85 (score 10) = 100 MP cap. A solid "8" day = 15+34 = 49 MP.
const QUALITY_BONUS_MP: Record<number, number> = {
  1: 0,
  2: 0,
  3: 3,
  4: 5,
  5: 8,
  6: 13,
  7: 21,
  8: 34,
  9: 55,
  10: 85,
};

export interface PracticeRewardInput {
  qualityScore: number;   // 1..10
  linesPracticed: number; // logged; not part of the formula (effort = show-up)
}

export interface PracticeReward {
  cents: number;
  reason: string;
}

/** Clamp a raw score to an integer 1..10. */
export function clampScore(raw: number): number {
  if (!Number.isFinite(raw)) return 1;
  return Math.max(1, Math.min(10, Math.round(raw)));
}

// Pure reward computation for one daily session on one piece.
export function computePracticeReward(input: PracticeRewardInput): PracticeReward {
  const score = clampScore(input.qualityScore);
  const bonusMp = QUALITY_BONUS_MP[score] ?? 0;
  const cents = Math.min(DAILY_PIECE_CAP_CENTS, SHOW_UP_CENTS + bonusMp * MP);
  return {
    cents,
    reason: `Practice — quality ${score}/10 (${input.linesPracticed} line${input.linesPracticed === 1 ? '' : 's'})`,
  };
}

// Preview table for the UI ("here's what each score earns") so the kid can see
// the curve and aim high.
export function rewardCurve(): { score: number; mp: number }[] {
  const out: { score: number; mp: number }[] = [];
  for (let s = 1; s <= 10; s++) {
    const { cents } = computePracticeReward({ qualityScore: s, linesPracticed: 0 });
    out.push({ score: s, mp: cents / MP });
  }
  return out;
}
