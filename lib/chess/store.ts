// Server-only chess save store + finish-with-earn orchestrator.
//
// This is the chess analog of lib/money/earn.ts, but ONLY for chess. We
// deliberately don't share their code path because (a) save+resume is a
// chess-specific concern with no analog in math/spelling, (b) finish
// idempotency keys are game IDs (not random UUIDs from the client), and
// (c) the cross-section daily MP cap that the other session's earn
// endpoint enforces is intentionally NOT applied here — see comment on
// `finishChessGame`.

import { prisma } from '../prisma';
import { normalizeUser } from '../drive-progress';
import { credit } from '../money/balance';
import {
  type ChessProgress,
  type SavedChessGame,
  type ChessGameResult,
  commitFinishedGame,
  finishGame,
  normalizeProgress,
} from './game-state';
import {
  type ChessOpponent,
  computeChessReward,
} from './reward';

// Map a saved game's mode + AI level to the reward formula's opponent.
function opponentFor(game: SavedChessGame): ChessOpponent {
  if (game.mode === 'local') return 'human';
  return game.aiLevel ?? 'cub';
}

// Map a finished game to the result tag this player got. In local mode
// we treat any non-draw as a "win" for whichever side won (a single MP
// credit per finished sibling game). In AI mode, the human side is what
// matters.
function resultFor(game: SavedChessGame): 'win' | 'loss' | 'draw' {
  const r = game.result;
  if (!r) throw new Error('resultFor called on unfinished game');
  if (r.winner === 'draw') return 'draw';
  if (game.mode === 'local') return 'win'; // someone (a kid) won.
  // AI mode: human won iff the winner is NOT the AI's color.
  return r.winner !== game.aiColor ? 'win' : 'loss';
}

// Read chess progress for a user. Throws if user not registered.
export async function readChessProgress(rawUser: string): Promise<ChessProgress> {
  const userKey = normalizeUser(rawUser);
  if (!userKey) throw new Error('Bad user');
  const row = await prisma.driveUser.findUnique({
    where: { name: userKey },
    select: { chess: true },
  });
  if (!row) throw new Error('User not found');
  return normalizeProgress(row.chess);
}

// Persist a (possibly in-progress) game as `current`. Replaces any
// previous `current`. No MP movement. Used for "save & quit" + autosave.
export async function saveCurrentChessGame(
  rawUser: string,
  game: SavedChessGame,
): Promise<ChessProgress> {
  const userKey = normalizeUser(rawUser);
  if (!userKey) throw new Error('Bad user');
  return prisma.$transaction(async (tx) => {
    const row = await tx.driveUser.findUnique({
      where: { name: userKey },
      select: { chess: true },
    });
    if (!row) throw new Error('User not found');
    const progress = normalizeProgress(row.chess);
    const next: ChessProgress = { ...progress, current: game };
    await tx.driveUser.update({
      where: { name: userKey },
      data: { chess: next as unknown as object },
    });
    return next;
  });
}

// Clear the current saved game (no MP refund — quitting is not a win/draw).
export async function clearCurrentChessGame(
  rawUser: string,
): Promise<ChessProgress> {
  const userKey = normalizeUser(rawUser);
  if (!userKey) throw new Error('Bad user');
  return prisma.$transaction(async (tx) => {
    const row = await tx.driveUser.findUnique({
      where: { name: userKey },
      select: { chess: true },
    });
    if (!row) throw new Error('User not found');
    const progress = normalizeProgress(row.chess);
    const next: ChessProgress = { ...progress, current: undefined };
    await tx.driveUser.update({
      where: { name: userKey },
      data: { chess: next as unknown as object },
    });
    return next;
  });
}

export type FinishChessResult = {
  progress: ChessProgress;
  centsEarned: number;
  balanceCents: number | null;
  reason: string;
  duplicate: boolean;
};

// Finalize a game: move it from `current` → `recentGames`, credit MP if
// applicable. Idempotent on game.id — replaying the same finish leaves
// totals + balance untouched and returns the existing progress.
//
// NOTE on the daily cap: the unified earn endpoint at
// app/api/money/earn/route.ts enforces a cross-section daily MP cap by
// going through `awardEarn()`. Chess deliberately credits directly via
// `credit()` and is OUTSIDE that cap. The trade-off is intentional —
// finishing a chess game takes effort and time (especially vs Wizard),
// so the reward shouldn't be capped by a math grind earlier in the day.
// If we ever want chess to count against the daily cap, route this
// through `awardEarn()` with a new EarnSection 'chess'.
export async function finishChessGame(
  rawUser: string,
  game: SavedChessGame,
  result: ChessGameResult,
): Promise<FinishChessResult> {
  const userKey = normalizeUser(rawUser);
  if (!userKey) throw new Error('Bad user');

  // First: read current progress + check idempotency before doing any
  // mutation or credit.
  const progress = await readChessProgress(userKey);
  const alreadyFinished = progress.recentGames.find((g) => g.id === game.id);
  if (alreadyFinished) {
    const row = await prisma.driveUser.findUnique({
      where: { name: userKey },
      select: { balanceCents: true },
    });
    return {
      progress,
      centsEarned: 0,
      balanceCents: row?.balanceCents ?? null,
      reason: 'duplicate',
      duplicate: true,
    };
  }

  // Apply result + commit to history (so totals reflect this finish).
  const finished = finishGame(game, result);
  const opponent = opponentFor(finished);
  const reward = computeChessReward({
    result: resultFor(finished),
    opponent,
    moveCount: finished.moveHistory.length,
  });

  // Save progress changes first (own transaction), then credit MP
  // (own transaction inside credit()). This means a credit() failure
  // could leave the game in recentGames with no MP credited. Acceptable
  // trade-off: kid sees the game finished + can ask parent to fix MP
  // (rare), whereas if we crashed mid-credit and lost the game from the
  // save, the kid would have to replay or lose the result entirely.
  // The alternative — splice credit() into the same prisma transaction —
  // would require re-implementing credit() inline; not worth the
  // duplication for a rare failure case.
  const nextProgressBase = commitFinishedGame(progress, finished);
  const nextProgress: ChessProgress = {
    ...nextProgressBase,
    totalEarnedCents: nextProgressBase.totalEarnedCents + reward.cents,
  };

  await prisma.driveUser.update({
    where: { name: userKey },
    data: { chess: nextProgress as unknown as object },
  });

  let balanceCents: number | null = null;
  if (reward.cents > 0) {
    balanceCents = await credit(userKey, reward.cents, 'earn', `Chess: ${reward.reason}`);
  } else {
    const row = await prisma.driveUser.findUnique({
      where: { name: userKey },
      select: { balanceCents: true },
    });
    balanceCents = row?.balanceCents ?? null;
  }

  return {
    progress: nextProgress,
    centsEarned: reward.cents,
    balanceCents,
    reason: reward.reason,
    duplicate: false,
  };
}

