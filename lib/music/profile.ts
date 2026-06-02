// Music profile — server-only read/write of the `music` JSON blob on
// DriveUser, plus the daily-practice earn writer and challenge evaluator.
//
// Mirrors the discipline in lib/money/earn.ts: every money-moving action runs
// inside a single prisma.$transaction so balance, ledger, MpEarning, and the
// music blob stay consistent. Idempotency is enforced by a unique
// MpEarning.idempotencyKey of `music:{user}:{pieceId}:{date}` — re-submitting
// the same day's score is a no-op replay, not a double-pay.

import 'server-only';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { normalizeUser } from '../drive-progress';
import { createGiftCard } from '../money/gift-card';
import {
  coerceMusicProfile,
  type MusicProfile,
  type MusicPiece,
  type MusicChallenge,
  type Instrument,
  type MusicLogEntry,
  type PassOffBy,
} from './types';
import { computePracticeReward, clampScore } from './reward';
import { bestScore } from './plan';

// ----- low-level blob I/O -----

export async function readMusicProfile(rawUser: string): Promise<MusicProfile | null> {
  const userKey = normalizeUser(rawUser);
  if (!userKey) return null;
  const row = await prisma.driveUser.findUnique({
    where: { name: userKey },
    select: { music: true },
  });
  if (!row) return null;
  return coerceMusicProfile(row.music);
}

async function writeMusicProfile(userKey: string, profile: MusicProfile): Promise<void> {
  await prisma.driveUser.update({
    where: { name: userKey },
    data: { music: profile as unknown as object },
  });
}

function newId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 12);
}

// ----- piece CRUD -----

export interface AddPieceInput {
  title: string;
  instrument: Instrument;
  estLines: number;
  difficulty: 'easy' | 'medium' | 'hard';
  targetDate?: string;
  pdfHref?: string;
  addedBy: 'kid' | 'parent';
}

export async function addPiece(rawUser: string, input: AddPieceInput): Promise<MusicPiece> {
  const userKey = normalizeUser(rawUser);
  if (!userKey) throw new Error('Bad user');
  const profile = (await readMusicProfile(userKey)) ?? { pieces: [] };
  const piece: MusicPiece = {
    id: newId(),
    title: input.title.trim().slice(0, 120),
    instrument: input.instrument,
    estLines: Math.max(1, Math.min(500, Math.round(input.estLines))),
    difficulty: input.difficulty,
    targetDate: input.targetDate,
    pdfHref: input.pdfHref?.trim() || undefined,
    addedBy: input.addedBy,
    createdAt: new Date().toISOString(),
    log: [],
  };
  profile.pieces.push(piece);
  await writeMusicProfile(userKey, profile);
  return piece;
}

export async function updatePiece(
  rawUser: string,
  pieceId: string,
  patch: Partial<AddPieceInput>,
): Promise<MusicPiece | null> {
  const userKey = normalizeUser(rawUser);
  if (!userKey) throw new Error('Bad user');
  const profile = await readMusicProfile(userKey);
  if (!profile) return null;
  const piece = profile.pieces.find((p) => p.id === pieceId);
  if (!piece) return null;
  if (patch.title !== undefined) piece.title = patch.title.trim().slice(0, 120);
  if (patch.instrument !== undefined) piece.instrument = patch.instrument;
  if (patch.estLines !== undefined) piece.estLines = Math.max(1, Math.min(500, Math.round(patch.estLines)));
  if (patch.difficulty !== undefined) piece.difficulty = patch.difficulty;
  if (patch.targetDate !== undefined) piece.targetDate = patch.targetDate || undefined;
  if (patch.pdfHref !== undefined) piece.pdfHref = patch.pdfHref?.trim() || undefined;
  await writeMusicProfile(userKey, profile);
  return piece;
}

// Archive / unarchive a piece. Archived pieces drop out of the active plan but
// stay in history + the calendar. No reward (unlike pass-off). Kid-allowed.
export async function setPieceArchived(
  rawUser: string,
  pieceId: string,
  archived: boolean,
): Promise<MusicPiece | null> {
  const userKey = normalizeUser(rawUser);
  if (!userKey) throw new Error('Bad user');
  const profile = await readMusicProfile(userKey);
  if (!profile) return null;
  const piece = profile.pieces.find((p) => p.id === pieceId);
  if (!piece) return null;
  piece.archived = archived;
  piece.archivedAt = archived ? new Date().toISOString() : undefined;
  await writeMusicProfile(userKey, profile);
  return piece;
}

export async function deletePiece(rawUser: string, pieceId: string): Promise<boolean> {
  const userKey = normalizeUser(rawUser);
  if (!userKey) throw new Error('Bad user');
  const profile = await readMusicProfile(userKey);
  if (!profile) return false;
  const before = profile.pieces.length;
  profile.pieces = profile.pieces.filter((p) => p.id !== pieceId);
  // Also drop it from any challenge's piece list.
  if (profile.challenge) {
    profile.challenge.pieceIds = profile.challenge.pieceIds.filter((id) => id !== pieceId);
  }
  if (profile.pieces.length === before) return false;
  await writeMusicProfile(userKey, profile);
  return true;
}

// ----- daily line goal -----

// Set (or clear, with null) the kid's daily line goal + how it applies.
// Settable by the kid or a parent. Fractional goal allowed (e.g. 3.5),
// clamped to [0.5, 100]. `mode` controls spread-across-all vs one-at-a-time.
export async function setDailyLineGoal(
  rawUser: string,
  goal: number | null,
  mode?: 'spread' | 'one-at-a-time',
): Promise<{ dailyLineGoal?: number; goalMode: 'spread' | 'one-at-a-time' }> {
  const userKey = normalizeUser(rawUser);
  if (!userKey) throw new Error('Bad user');
  const profile = (await readMusicProfile(userKey)) ?? { pieces: [] };
  if (goal === null || !Number.isFinite(goal) || goal <= 0) {
    profile.dailyLineGoal = undefined;
  } else {
    profile.dailyLineGoal = Math.min(100, Math.max(0.5, Math.round(goal * 2) / 2)); // 0.5 steps
  }
  if (mode === 'spread' || mode === 'one-at-a-time') {
    profile.goalMode = mode;
  }
  await writeMusicProfile(userKey, profile);
  return { dailyLineGoal: profile.dailyLineGoal, goalMode: profile.goalMode ?? 'spread' };
}

// ----- daily practice (the earn) -----

export type PracticeResult =
  | { ok: true; centsEarned: number; balanceCents: number; reason: string; piece: MusicPiece }
  | { ok: true; centsEarned: 0; balanceCents: number; reason: 'duplicate'; piece: MusicPiece }
  | { ok: false; error: string };

export interface SubmitPracticeInput {
  pieceId: string;
  qualityScore: number;   // 1..10
  linesPracticed: number;
  date: string;           // YYYY-MM-DD (caller passes server-local date)
  note?: string;
  reviewedBy?: string;
}

// Record one day's practice score and credit MP. Atomic + idempotent per
// (user, piece, date). Re-submitting the same day overwrites is NOT allowed —
// the first score of the day is the one that pays (keeps it honest; a parent
// can adjust via the admin if needed).
export async function submitPractice(
  rawUser: string,
  input: SubmitPracticeInput,
): Promise<PracticeResult> {
  const userKey = normalizeUser(rawUser);
  if (!userKey) return { ok: false, error: 'Bad user' };

  const score = clampScore(input.qualityScore);
  const lines = Math.max(0, Math.min(500, Math.round(input.linesPracticed)));
  const { cents, reason } = computePracticeReward({ qualityScore: score, linesPracticed: lines });
  const idempotencyKey = `music:${userKey}:${input.pieceId}:${input.date}`;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.driveUser.findUnique({ where: { name: userKey } });
      if (!user) throw new Error('User not found');
      const profile = coerceMusicProfile(user.music);
      const piece = profile.pieces.find((p) => p.id === input.pieceId);
      if (!piece) throw new PieceNotFound();

      // Append the log entry (one per day enforced by the MpEarning unique key
      // below — if today already logged, the create throws P2002 and we bail).
      const entry: MusicLogEntry = {
        date: input.date,
        qualityScore: score,
        linesPracticed: lines,
        centsEarned: cents,
        note: input.note?.trim().slice(0, 280) || undefined,
        reviewedBy: input.reviewedBy?.trim().slice(0, 40) || undefined,
      };
      piece.log.push(entry);

      // MpEarning row LAST so a duplicate (user, piece, date) aborts the whole
      // tx before any money moves or the blob is written.
      await tx.mpEarning.create({
        data: {
          userName: userKey,
          section: 'music',
          kind: 'music.practice',
          cents,
          idempotencyKey,
          meta: { pieceId: input.pieceId, title: piece.title, score, lines } as object,
        },
      });

      const updated = await tx.driveUser.update({
        where: { name: userKey },
        data: {
          balanceCents: { increment: cents },
          music: profile as unknown as object,
        },
        select: { balanceCents: true },
      });

      await tx.mpTransaction.create({
        data: { userName: userKey, cents, type: 'earn', reason: `${piece.title}: ${reason}` },
      });

      return { balanceCents: updated.balanceCents, piece };
    });

    return { ok: true, centsEarned: cents, balanceCents: result.balanceCents, reason, piece: result.piece };
  } catch (err) {
    if (err instanceof PieceNotFound) return { ok: false, error: 'Piece not found' };
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      // Already practiced this piece today — no-op replay.
      const profile = await readMusicProfile(userKey);
      const piece = profile?.pieces.find((p) => p.id === input.pieceId);
      const row = await prisma.driveUser.findUnique({
        where: { name: userKey },
        select: { balanceCents: true },
      });
      if (!piece) return { ok: false, error: 'Piece not found' };
      return { ok: true, centsEarned: 0, balanceCents: row?.balanceCents ?? 0, reason: 'duplicate', piece };
    }
    throw err;
  }
}

class PieceNotFound extends Error {}

// ----- pass-off (mint the gift card) -----

export interface PassOffResult {
  ok: boolean;
  error?: string;
  giftCode?: string;
  rewardCents?: number;
  piece?: MusicPiece;
  challengeBonuses?: { name: string; cents: number; giftCode: string }[];
}

// Parent confirms a piece is performance-ready. Stamps passedOffAt, mints the
// pass-off gift card (challenge.passOffRewardCents if in a challenge, else the
// default), and then re-evaluates the challenge for any deadline bonuses that
// just became earnable. Idempotent: a piece already passed off won't re-pay.
export async function passOffPiece(
  rawUser: string,
  pieceId: string,
  opts: { defaultRewardCents: number; todayStr: string; by?: PassOffBy },
): Promise<PassOffResult> {
  const userKey = normalizeUser(rawUser);
  if (!userKey) return { ok: false, error: 'Bad user' };
  const profile = await readMusicProfile(userKey);
  if (!profile) return { ok: false, error: 'User not found' };
  const piece = profile.pieces.find((p) => p.id === pieceId);
  if (!piece) return { ok: false, error: 'Piece not found' };
  if (piece.passedOffAt) {
    return { ok: false, error: 'Already passed off' };
  }

  const inChallenge = !!profile.challenge?.pieceIds.includes(pieceId);
  const rewardCents = inChallenge
    ? profile.challenge!.passOffRewardCents
    : opts.defaultRewardCents;

  // Mint the gift card (its own row + the eventual redeem credits the kid).
  const card = await createGiftCard({
    cents: rewardCents,
    note: `Passed off "${piece.title}"! 🎉`,
  });

  piece.passedOffAt = new Date().toISOString();
  piece.passOffGiftCode = card.code;
  if (opts.by) piece.passOffBy = opts.by;
  await writeMusicProfile(userKey, profile);

  // Re-evaluate challenge deadline bonuses now that one more piece is done.
  const challengeBonuses = await evaluateChallengeBonuses(userKey, opts.todayStr);

  return {
    ok: true,
    giftCode: card.code,
    rewardCents,
    piece,
    challengeBonuses,
  };
}

// ----- weekly (teacher) pass-off -----

export interface WeeklyPassOffResult {
  ok: boolean;
  error?: string;
  centsAwarded?: number;
  balanceCents?: number;
  piece?: MusicPiece;
}

// Record a weekly pass-off — teacher / mom / dad confirms the kid played a
// piece for them this week. Recurring (a piece can be passed off many weeks),
// so this is NOT the one-time competition pass-off. Credits the weekly reward
// (default 150 MP) straight to the balance (no gift card — it's a recurring
// reward, not a printable prize). Atomic + idempotent per (user, piece, date):
// you can't pay the same piece twice on the same day.
export async function weeklyPassOff(
  rawUser: string,
  pieceId: string,
  opts: { by: PassOffBy; rewardCents: number; todayStr: string; note?: string },
): Promise<WeeklyPassOffResult> {
  const userKey = normalizeUser(rawUser);
  if (!userKey) return { ok: false, error: 'Bad user' };

  const idempotencyKey = `music-weekly:${userKey}:${pieceId}:${opts.todayStr}`;
  const cents = Math.max(1, Math.round(opts.rewardCents));

  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.driveUser.findUnique({ where: { name: userKey } });
      if (!user) throw new Error('User not found');
      const profile = coerceMusicProfile(user.music);
      const piece = profile.pieces.find((p) => p.id === pieceId);
      if (!piece) throw new PieceNotFound();

      piece.teacherPassOffs = piece.teacherPassOffs ?? [];
      piece.teacherPassOffs.push({
        date: opts.todayStr,
        by: opts.by,
        centsAwarded: cents,
        note: opts.note?.trim().slice(0, 200) || undefined,
      });

      // MpEarning row LAST so a duplicate (piece, date) aborts before any money
      // moves. Section 'music', kind 'music.weeklyPassOff' so it shows in the
      // wallet music total too.
      await tx.mpEarning.create({
        data: {
          userName: userKey,
          section: 'music',
          kind: 'music.weeklyPassOff',
          cents,
          idempotencyKey,
          meta: { pieceId, title: piece.title, by: opts.by } as object,
        },
      });

      const updated = await tx.driveUser.update({
        where: { name: userKey },
        data: { balanceCents: { increment: cents }, music: profile as unknown as object },
        select: { balanceCents: true },
      });

      await tx.mpTransaction.create({
        data: {
          userName: userKey,
          cents,
          type: 'earn',
          reason: `${piece.title}: weekly pass-off (${opts.by})`,
        },
      });

      return { balanceCents: updated.balanceCents, piece };
    });

    return { ok: true, centsAwarded: cents, balanceCents: result.balanceCents, piece: result.piece };
  } catch (err) {
    if (err instanceof PieceNotFound) return { ok: false, error: 'Piece not found' };
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { ok: false, error: 'Already passed off today' };
    }
    throw err;
  }
}

// ----- challenge config + evaluation -----

export async function setChallenge(rawUser: string, challenge: MusicChallenge | null): Promise<void> {
  const userKey = normalizeUser(rawUser);
  if (!userKey) throw new Error('Bad user');
  const profile = (await readMusicProfile(userKey)) ?? { pieces: [] };
  profile.challenge = challenge ?? undefined;
  await writeMusicProfile(userKey, profile);
}

// Did the kid play every challenge piece "well" (>= minScore) on `dateStr`?
function playedAllWellOn(profile: MusicProfile, dateStr: string, minScore: number): boolean {
  const ch = profile.challenge;
  if (!ch || ch.pieceIds.length === 0) return false;
  return ch.pieceIds.every((id) => {
    const piece = profile.pieces.find((p) => p.id === id);
    if (!piece) return false;
    return piece.log.some((e) => e.date === dateStr && e.qualityScore >= minScore);
  });
}

// Check the two deadline bonuses (finish-all, play-all-in-one-day) and award
// any newly-earned ones via gift cards. Bookkeeping flags prevent double-pay.
// Returns the bonuses awarded on THIS call (may be empty).
export async function evaluateChallengeBonuses(
  rawUser: string,
  todayStr: string,
): Promise<{ name: string; cents: number; giftCode: string }[]> {
  const userKey = normalizeUser(rawUser);
  if (!userKey) return [];
  const profile = await readMusicProfile(userKey);
  if (!profile?.challenge) return [];
  const ch = profile.challenge;
  const awarded: { name: string; cents: number; giftCode: string }[] = [];

  // 1. Finish all pieces by `finishAllBy`.
  if (
    ch.finishAllBy &&
    ch.finishAllBonusCents &&
    !ch.finishAllAwardedAt &&
    ch.pieceIds.length > 0
  ) {
    const allPassed = ch.pieceIds.every((id) => {
      const piece = profile.pieces.find((p) => p.id === id);
      return piece?.passedOffAt;
    });
    // Passed off ON OR BEFORE the deadline. We treat "all passed off today and
    // today <= deadline" as earned (we don't store per-piece pass dates vs the
    // deadline beyond passedOffAt, so compare today to the deadline).
    if (allPassed && todayStr <= ch.finishAllBy) {
      const card = await createGiftCard({
        cents: ch.finishAllBonusCents,
        note: `Finished all pieces by ${ch.finishAllBy}! 🏆`,
      });
      ch.finishAllAwardedAt = new Date().toISOString();
      awarded.push({ name: 'Finish-all bonus', cents: ch.finishAllBonusCents, giftCode: card.code });
    }
  }

  // 2. Play all pieces well in a single day by `playAllInOneDayBy`.
  if (
    ch.playAllInOneDayBy &&
    ch.playAllInOneDayBonusCents &&
    ch.playAllInOneDayMinScore &&
    !ch.playAllInOneDayAwardedAt &&
    todayStr <= ch.playAllInOneDayBy &&
    playedAllWellOn(profile, todayStr, ch.playAllInOneDayMinScore)
  ) {
    const card = await createGiftCard({
      cents: ch.playAllInOneDayBonusCents,
      note: `Played every piece well in one day! 🌟`,
    });
    ch.playAllInOneDayAwardedAt = new Date().toISOString();
    awarded.push({ name: 'All-in-one-day bonus', cents: ch.playAllInOneDayBonusCents, giftCode: card.code });
  }

  if (awarded.length > 0) {
    await writeMusicProfile(userKey, profile);
  }
  return awarded;
}
