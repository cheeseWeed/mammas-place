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
  minutesPracticed?: number; // learning-day time → graduated multiplier (see minutesMultiplier)
}

export interface PracticeReward {
  cents: number;
  reason: string;
  minutesMultiplier?: number; // the time multiplier applied (0, .25, .5, 1, 1.25, …)
}

// Full-credit threshold: 30 minutes of practice earns 100% of the day's MP.
export const FULL_PRACTICE_MINUTES = 30;

// Graduated time multiplier on a learning-day's MP, by minutes practiced:
//   < 10 min  → 0%   (nothing)
//   10–19     → 25%
//   20–29     → 50%
//   30–39     → 100% (full)
//   40–49     → 125% (extra 25% for each additional 10 min past 30)
//   50–59     → 150% … and so on, uncapped.
export function minutesMultiplier(minutes: number): number {
  const m = Number.isFinite(minutes) ? Math.max(0, minutes) : 0;
  if (m < 10) return 0;
  if (m < 20) return 0.25;
  if (m < 30) return 0.5;
  // 30+ : full, plus 25% per complete extra 10 minutes beyond 30.
  const extraBlocks = Math.floor((m - 30) / 10);
  return 1 + 0.25 * extraBlocks;
}

/** Clamp a raw score to an integer 1..10. */
export function clampScore(raw: number): number {
  if (!Number.isFinite(raw)) return 1;
  return Math.max(1, Math.min(10, Math.round(raw)));
}

// Pure reward computation for one daily learning session on one piece.
// The quality-based MP is scaled by how long the kid practiced (see
// minutesMultiplier). Under 10 min earns nothing; 30 min is full; extra
// 10-min blocks add 25% each.
export function computePracticeReward(input: PracticeRewardInput): PracticeReward {
  const score = clampScore(input.qualityScore);
  const minutes = Math.max(0, Math.round(input.minutesPracticed ?? 0));
  const mult = minutesMultiplier(minutes);
  const bonusMp = QUALITY_BONUS_MP[score] ?? 0;
  const base = Math.min(DAILY_PIECE_CAP_CENTS, SHOW_UP_CENTS + bonusMp * MP);
  const cents = Math.round(base * mult);
  if (mult === 0) {
    return {
      cents: 0,
      minutesMultiplier: 0,
      reason: `Only ${minutes} min — practice at least 10 min to earn MP. Keep going!`,
    };
  }
  return {
    cents,
    minutesMultiplier: mult,
    reason: `Practice ${minutes} min (${Math.round(mult * 100)}%) — quality ${score}/10`,
  };
}

// Preview table for the UI ("here's what each score earns") so the kid can see
// the curve and aim high.
export function rewardCurve(): { score: number; mp: number }[] {
  const out: { score: number; mp: number }[] = [];
  for (let s = 1; s <= 10; s++) {
    // Curve shows FULL-credit values (30 min). The UI scales by the live
    // minutes multiplier on top.
    const { cents } = computePracticeReward({ qualityScore: s, linesPracticed: 0, minutesPracticed: FULL_PRACTICE_MINUTES });
    out.push({ score: s, mp: cents / MP });
  }
  return out;
}

// ---------- Polish / perform-day reward ----------
//
// Once a song is finished (all lines learned) or on Sunday perform days, the
// goal shifts from "learn lines" to "play it through, well." Earning:
//   50 MP per complete play-through (NO cap — play it as many times as you
//   like), PLUS up to 100 MP quality bonus if it sounded good (same Fibonacci
//   curve as practice days). Recommended target: 3–4 play-throughs.

export const PLAY_THROUGH_CENTS = 50 * MP; // 50 MP per run-through
export const RECOMMENDED_PLAYS = 4;        // shown as a 3–4 suggestion

export interface PerformRewardInput {
  playThroughs: number;  // how many times played start-to-finish today (>=1)
  qualityScore: number;  // 1..10 — quality bonus rides on top
}

// Quality bonus alone (no show-up base — the play-throughs ARE the base here).
function qualityBonusCents(score: number): number {
  return (QUALITY_BONUS_MP[clampScore(score)] ?? 0) * MP;
}

export function computePerformReward(input: PerformRewardInput): PracticeReward {
  const plays = Math.max(0, Math.floor(input.playThroughs));
  const playCents = plays * PLAY_THROUGH_CENTS;
  const bonus = plays > 0 ? qualityBonusCents(input.qualityScore) : 0; // no play = no bonus
  const cents = playCents + bonus;
  const score = clampScore(input.qualityScore);
  return {
    cents,
    reason: `Polish — ${plays} play-through${plays === 1 ? '' : 's'} (×50 MP) + quality ${score}/10`,
  };
}
