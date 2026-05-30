// Merit-based MP rewards across all learning sections.
//
// Single rule the kid hears: "the better you do, the more you earn."
//
// The CLIENT submits {section, kind, payload}. The SERVER decides cents.
// Kids never get to dictate their own reward. Every earn writes an
// MpEarning row + balance increment + ledger row in a SINGLE Prisma
// transaction — partial-success cannot strand money. Idempotency key on
// MpEarning makes replays safe.
//
// No daily cap (per user 2026-05-30). The merit curve does the work of
// making grind-low-EV vs hard-rounds-high-EV obvious.

import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { normalizeUser } from '../drive-progress';

// Cents per MP unit (1 MP = 100 cents internally). Kept here so reward
// math reads in "MP" units even though we store cents.
const MP = 100;

// No daily cap. Per user (2026-05-30): kids can earn as much as their
// effort + accuracy support. The merit curve already makes grinding the
// same easy round low-EV (accuracy^1.5 + difficulty + speed + streak
// multipliers all reward harder/faster/better work, not raw volume).
//
// Constant kept (effectively infinite) so any caller importing it still
// compiles and the "capped" response shape stays valid for future use.
export const DAILY_EARN_CAP_CENTS = Number.MAX_SAFE_INTEGER;

// Section-recognized payload shapes the server uses to compute reward.
//
// Math round:  10 questions, scored on % correct + avg-speed multiplier +
//              difficulty multiplier. Perfect easy round earns less than
//              perfect hard round. A 50% round still earns a little (don't
//              shame the learner — but reward truth: less is less).
export type MathRoundPayload = {
  correct: number;          // 0..total
  total: number;            // questions in the round (>=1)
  difficulty: 'easy' | 'medium' | 'hard';
  perQuestionSeconds: number; // chosen timer length per question
  avgAnswerMs: number;        // average ms taken on correct answers (0 if none)
  bestStreak: number;         // longest correct-in-a-row streak in this round
  operations: string;         // 'add'|'sub'|'mul'|'div'|'mix' — logged only
};

// Spelling quiz finish: reward scales with pct + level.
export type SpellingQuizPayload = {
  correct: number;
  total: number;
  level: number; // 1..7
};

// Language Arts drill (Phase L1+): reward scales with pct + difficulty tier.
export type LangArtsDrillPayload = {
  correct: number;
  total: number;
  tier: 'easy' | 'medium' | 'hard';
};

// Geography quiz finish: reward scales with pct + round size (50-state round > 5).
export type GeographyQuizPayload = {
  correct: number;
  total: number;
  // optional: a tag the section sends ('name-quiz' | 'capital-quiz' | ...) — logged.
  quiz?: string;
};

// Drive deck completion: tiny earn (decks are study, not drills). Real
// money kicks in for quizzes/exams.
export type DriveDeckPayload = {
  deck: string; // deck id
};

// Drive quiz/exam pass: scales with pct, with a bonus for the simulator.
export type DriveQuizPayload = {
  quiz: string; // quiz id
  correct: number;
  total: number;
  isFinalOrSim?: boolean;
};

export type EarnSection =
  | 'math'
  | 'languageArts'
  | 'spelling'
  | 'geography'
  | 'drive';

export type EarnRequest =
  | { section: 'math'; kind: 'round'; payload: MathRoundPayload; idempotencyKey: string }
  | { section: 'spelling'; kind: 'quiz'; payload: SpellingQuizPayload; idempotencyKey: string }
  | { section: 'languageArts'; kind: 'drill'; payload: LangArtsDrillPayload; idempotencyKey: string }
  | { section: 'geography'; kind: 'quiz'; payload: GeographyQuizPayload; idempotencyKey: string }
  | { section: 'drive'; kind: 'deck'; payload: DriveDeckPayload; idempotencyKey: string }
  | { section: 'drive'; kind: 'quiz'; payload: DriveQuizPayload; idempotencyKey: string };

export type EarnResult =
  | { ok: true; centsEarned: number; balanceCents: number; reason: string; capped?: false }
  | { ok: true; centsEarned: 0; balanceCents: number; reason: string; capped: true; capCents: number }
  | { ok: true; centsEarned: 0; balanceCents: number; reason: 'duplicate' };

// ---------- Reward formulas (pure functions, easy to unit-test later) ----------
//
// Single rule (2026-05-30 lock-in):
//
//   reward = 0.25 MP per question attempted
//          + 1.00 MP per correct answer × difficultyMult
//          + accuracyBonus (Fibonacci) × sizeBonusMult × difficultyMult
//
// Per-question pieces are flat. The Fibonacci bonus kicks in at 80% and
// grows steeply (5/8/13/21/34 at 80/85/90/95/100%) so chasing perfection
// is meaningfully more rewarding than coasting at 80%.
//
// Round-size multiplier on the bonus: bonusMult = min(2.0, total / 25).
// 25Q quiz = 1.0×, 50Q = 1.5×, 100Q = 2.0× (capped). 10Q = 0.4×.
//
// Per-question math is in WHOLE cents (no quantization, no 25c floor) so
// "0.10 MP for trying with 0 right" actually works.

const ATTEMPT_CENTS = 25;          // 0.25 MP per question, just for showing up
const RIGHT_CENTS = 100;           // 1.00 MP per correct answer (× difficultyMult)

// Difficulty multipliers (apply to right-answer pay AND bonus, not attempts).
const DIFF_EASY = 1.0;
const DIFF_MEDIUM = 1.5;
const DIFF_HARD = 2.0;

// Fibonacci accuracy bonus rungs. Indexed by integer percent above 80.
// Anything < 80 returns 0. Above 100% just stays 34.
function fibAccuracyBonusCents(accuracyFraction: number): number {
  const pct100 = Math.round(accuracyFraction * 100);
  if (pct100 >= 100) return 3400;
  if (pct100 >= 95) return 2100;
  if (pct100 >= 90) return 1300;
  if (pct100 >= 85) return 800;
  if (pct100 >= 80) return 500;
  return 0;
}

// Round size scales the Fibonacci bonus. 25Q = baseline (1.0×).
// total = 25 → 1.0, total = 50 → 2.0, total = 100 → 4.0… so cap at 2.0
// so 100Q exam tops out at 2× the 25Q bonus (matches user spec).
function sizeBonusMultiplier(total: number): number {
  if (total <= 0) return 0;
  return Math.min(2.0, total / 25);
}

function pct(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, correct / total));
}

// The shared backbone every section uses. Returns whole cents.
function scoreCents(opts: {
  correct: number;
  total: number;
  difficultyMult: number;
}): number {
  const { correct, total, difficultyMult } = opts;
  if (total <= 0) return 0;
  const attempts = ATTEMPT_CENTS * total;
  const right = RIGHT_CENTS * correct * difficultyMult;
  const bonus = fibAccuracyBonusCents(pct(correct, total))
    * sizeBonusMultiplier(total)
    * difficultyMult;
  // Round to nearest whole cent so the displayed MP is always two-decimal-clean.
  return Math.round(attempts + right + bonus);
}

// Math: difficulty drives the multiplier.
export function computeMathReward(p: MathRoundPayload): { cents: number; reason: string } {
  const difficultyMult =
    p.difficulty === 'hard' ? DIFF_HARD :
    p.difficulty === 'medium' ? DIFF_MEDIUM :
    DIFF_EASY;
  const cents = scoreCents({ correct: p.correct, total: p.total, difficultyMult });
  return {
    cents,
    reason: `Math ${p.difficulty}: ${p.correct}/${p.total} (${Math.round(pct(p.correct, p.total) * 100)}%)`,
  };
}

// Spelling: levels 1-7 map to three difficulty bands.
// L1-L2 = easy, L3-L5 = medium, L6-L7 = hard.
export function computeSpellingReward(p: SpellingQuizPayload): { cents: number; reason: string } {
  const difficultyMult =
    p.level >= 6 ? DIFF_HARD :
    p.level >= 3 ? DIFF_MEDIUM :
    DIFF_EASY;
  const cents = scoreCents({ correct: p.correct, total: p.total, difficultyMult });
  return {
    cents,
    reason: `Spelling L${p.level}: ${p.correct}/${p.total} (${Math.round(pct(p.correct, p.total) * 100)}%)`,
  };
}

// Language Arts: tier maps directly.
export function computeLangArtsReward(p: LangArtsDrillPayload): { cents: number; reason: string } {
  const difficultyMult =
    p.tier === 'hard' ? DIFF_HARD :
    p.tier === 'medium' ? DIFF_MEDIUM :
    DIFF_EASY;
  const cents = scoreCents({ correct: p.correct, total: p.total, difficultyMult });
  return {
    cents,
    reason: `Language Arts (${p.tier}): ${p.correct}/${p.total} (${Math.round(pct(p.correct, p.total) * 100)}%)`,
  };
}

// Geography: no difficulty tier. All quizzes use easy (1.0×). Round size
// already drives reward via attempts + the size bonus multiplier on the
// Fibonacci tier.
export function computeGeographyReward(p: GeographyQuizPayload): { cents: number; reason: string } {
  const cents = scoreCents({ correct: p.correct, total: p.total, difficultyMult: DIFF_EASY });
  const qLabel = p.quiz ? ` ${p.quiz}` : '';
  return {
    cents,
    reason: `Geography${qLabel}: ${p.correct}/${p.total} (${Math.round(pct(p.correct, p.total) * 100)}%)`,
  };
}

// Drive deck completion: flat 50c (study time deserves something but not
// as much as a quiz). Idempotency-keyed per (user, deck) upstream.
export function computeDriveDeckReward(p: DriveDeckPayload): { cents: number; reason: string } {
  return { cents: 50, reason: `Drive deck complete: ${p.deck}` };
}

// Drive quiz/exam: finals & 50-Q simulator pay at "hard" rate; regular
// practice quizzes at "easy". No pass-gate — partial credit pays partially
// (consistent with the rest of the app).
export function computeDriveQuizReward(p: DriveQuizPayload): { cents: number; reason: string } {
  const difficultyMult = p.isFinalOrSim ? DIFF_HARD : DIFF_EASY;
  const cents = scoreCents({ correct: p.correct, total: p.total, difficultyMult });
  return {
    cents,
    reason: `Drive ${p.isFinalOrSim ? 'exam' : 'quiz'} ${p.quiz}: ${p.correct}/${p.total} (${Math.round(pct(p.correct, p.total) * 100)}%)`,
  };
}

// ---------- Orchestrator ----------

function computeReward(req: EarnRequest): { cents: number; reason: string } {
  switch (req.section) {
    case 'math':
      return computeMathReward(req.payload);
    case 'spelling':
      return computeSpellingReward(req.payload);
    case 'languageArts':
      return computeLangArtsReward(req.payload);
    case 'geography':
      return computeGeographyReward(req.payload);
    case 'drive':
      if (req.kind === 'deck') return computeDriveDeckReward(req.payload);
      return computeDriveQuizReward(req.payload);
  }
}

// Main entry. Server-authoritative reward, idempotency, ledger.
//
// ALL writes for one earn — MpEarning row + balanceCents increment +
// MpTransaction ledger row — happen inside a single prisma.$transaction.
// If any one of them fails, none of them commit. This closes the race
// where a successful MpEarning write followed by a failed credit() left
// the kid permanently out of money and replays no-op'd as 'duplicate'.
//
// Idempotency: MpEarning.idempotencyKey is @unique. Re-running the same
// request lands in the catch below as a unique-constraint violation
// (Prisma P2002), and we return centsEarned: 0 with reason: 'duplicate'.
// We deliberately do NOT pre-check with findUnique then create — that
// pattern has a window between check and create where two concurrent
// requests can both pass the check. Letting the DB unique constraint be
// the gate is race-safe.
export async function awardEarn(rawUser: string, req: EarnRequest): Promise<EarnResult> {
  const userKey = normalizeUser(rawUser);
  if (!userKey) throw new Error('Bad user');

  const { cents, reason } = computeReward(req);

  // No earn → just return the current balance so the UI can render "you
  // didn't earn this round" without a confusing reason mismatch.
  if (cents <= 0) {
    const row = await prisma.driveUser.findUnique({
      where: { name: userKey },
      select: { balanceCents: true },
    });
    if (!row) throw new Error('User not found');
    return {
      ok: true,
      centsEarned: 0,
      balanceCents: row.balanceCents,
      reason,
    };
  }

  try {
    const balanceCents = await prisma.$transaction(async (tx) => {
      // 1. User must exist — bail before touching anything else.
      const user = await tx.driveUser.findUnique({ where: { name: userKey } });
      if (!user) throw new Error('User not found');

      // 2. Increment balance.
      const updated = await tx.driveUser.update({
        where: { name: userKey },
        data: { balanceCents: { increment: cents } },
        select: { balanceCents: true },
      });

      // 3. Write the ledger row.
      await tx.mpTransaction.create({
        data: { userName: userKey, cents, type: 'earn', reason },
      });

      // 4. Write the MpEarning row LAST so a duplicate idempotency key
      //    aborts the whole transaction before any money moves.
      await tx.mpEarning.create({
        data: {
          userName: userKey,
          section: req.section,
          kind: `${req.section}.${req.kind}`,
          cents,
          idempotencyKey: req.idempotencyKey,
          meta: req.payload as unknown as object,
        },
      });

      return updated.balanceCents;
    });

    return { ok: true, centsEarned: cents, balanceCents, reason };
  } catch (err) {
    // Duplicate idempotency key → no-op replay. Return the current balance.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const row = await prisma.driveUser.findUnique({
        where: { name: userKey },
        select: { balanceCents: true },
      });
      return {
        ok: true,
        centsEarned: 0,
        balanceCents: row?.balanceCents ?? 0,
        reason: 'duplicate',
      };
    }
    throw err;
  }
}
