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

// Round any cents to a value the UI can display cleanly (whole MP or .50 MP).
// We don't issue fractional cents; smallest grain is 25 cents (.25 MP).
function quantizeCents(c: number): number {
  if (c <= 0) return 0;
  // round down to nearest 25 cents — feels generous-enough without odd .07 MP
  return Math.max(25, Math.floor(c / 25) * 25);
}

function pct(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, correct / total));
}

// Math: base 100c × accuracyCurve × difficultyMult × speedMult × streakMult
// - accuracyCurve: pct^1.5 so 100% earns much more than 80%
// - difficultyMult: 1.0 / 1.5 / 2.25
// - speedMult: 0.75..1.25 (slow answers = 0.75; ~half-timer = 1.0; very fast = 1.25)
// - streakMult: 1 + min(streak,10)/20 → up to 1.5×
export function computeMathReward(p: MathRoundPayload): { cents: number; reason: string } {
  const acc = pct(p.correct, p.total);
  if (acc <= 0) return { cents: 0, reason: 'No correct answers — no MP earned.' };
  const accuracyCurve = Math.pow(acc, 1.5);
  const diffMult = p.difficulty === 'hard' ? 2.25 : p.difficulty === 'medium' ? 1.5 : 1.0;

  const timerMs = Math.max(1, p.perQuestionSeconds) * 1000;
  // Faster answers earn more; clamp to [0.75, 1.25].
  const speedRatio = p.avgAnswerMs > 0 ? Math.min(1, p.avgAnswerMs / timerMs) : 1;
  const speedMult = 1.25 - 0.5 * speedRatio;

  const streakMult = 1 + Math.min(10, Math.max(0, p.bestStreak)) / 20;

  const raw = 100 * accuracyCurve * diffMult * speedMult * streakMult;
  const cents = quantizeCents(raw);

  const pctText = `${Math.round(acc * 100)}%`;
  const streakText = p.bestStreak >= 5 ? ` · streak ${p.bestStreak}` : '';
  return {
    cents,
    reason: `Math ${p.difficulty}: ${p.correct}/${p.total} (${pctText})${streakText}`,
  };
}

// Spelling quiz: base 80c × accuracy^1.5 × levelMult (1 + (level-1) × 0.15)
export function computeSpellingReward(p: SpellingQuizPayload): { cents: number; reason: string } {
  const acc = pct(p.correct, p.total);
  if (acc <= 0) return { cents: 0, reason: 'No correct answers — no MP earned.' };
  const levelMult = 1 + Math.max(0, p.level - 1) * 0.15;
  const raw = 80 * Math.pow(acc, 1.5) * levelMult;
  const cents = quantizeCents(raw);
  return {
    cents,
    reason: `Spelling L${p.level}: ${p.correct}/${p.total} (${Math.round(acc * 100)}%)`,
  };
}

// Language Arts drill: base 70c × accuracy^1.5 × tierMult
export function computeLangArtsReward(p: LangArtsDrillPayload): { cents: number; reason: string } {
  const acc = pct(p.correct, p.total);
  if (acc <= 0) return { cents: 0, reason: 'No correct answers — no MP earned.' };
  const tierMult = p.tier === 'hard' ? 1.75 : p.tier === 'medium' ? 1.3 : 1.0;
  const raw = 70 * Math.pow(acc, 1.5) * tierMult;
  const cents = quantizeCents(raw);
  return {
    cents,
    reason: `Language Arts (${p.tier}): ${p.correct}/${p.total} (${Math.round(acc * 100)}%)`,
  };
}

// Geography quiz: base scales with round size: 50c (small) → 200c (50-state).
// Then × accuracy^1.5.
export function computeGeographyReward(p: GeographyQuizPayload): { cents: number; reason: string } {
  const acc = pct(p.correct, p.total);
  if (acc <= 0) return { cents: 0, reason: 'No correct answers — no MP earned.' };
  // Size scale: 5 → 50, 10 → 80, 20 → 120, 50 → 200 (cents, before accuracy)
  const sizeBase = p.total >= 50 ? 200 : p.total >= 20 ? 120 : p.total >= 10 ? 80 : 50;
  const raw = sizeBase * Math.pow(acc, 1.5);
  const cents = quantizeCents(raw);
  const qLabel = p.quiz ? ` ${p.quiz}` : '';
  return {
    cents,
    reason: `Geography${qLabel}: ${p.correct}/${p.total} (${Math.round(acc * 100)}%)`,
  };
}

// Drive deck completion: flat 25c (decks are study material; quizzes pay more).
export function computeDriveDeckReward(p: DriveDeckPayload): { cents: number; reason: string } {
  return { cents: 25, reason: `Drive deck complete: ${p.deck}` };
}

// Drive quiz/exam: base 75c (or 250c on final/sim) × accuracy^1.5. Must hit
// >= 80% to earn at all (matches the existing "pass" threshold).
export function computeDriveQuizReward(p: DriveQuizPayload): { cents: number; reason: string } {
  const acc = pct(p.correct, p.total);
  if (acc < 0.8) return { cents: 0, reason: `Drive ${p.quiz}: below pass threshold.` };
  const base = p.isFinalOrSim ? 250 : 75;
  const raw = base * Math.pow(acc, 1.5);
  const cents = quantizeCents(raw);
  return {
    cents,
    reason: `Drive ${p.isFinalOrSim ? 'exam' : 'quiz'} ${p.quiz}: ${p.correct}/${p.total} (${Math.round(acc * 100)}%)`,
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
