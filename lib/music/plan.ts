// Daily / weekly practice plan generator — pure functions, no DB.
//
// Turns a kid's pieces (each with an estimated number of lines and a target
// pass-off date) into a concrete "do this many lines today" plan.
//
// The driving model (from the user): a kid has N total lines to learn across
// all pieces, M weeks to learn them, practicing D days/week (weekends are for
// performing, not new learning). So:
//
//   linesPerWeek = ceil(totalNewLines / learnWeeks)
//   linesPerDay  = ceil(linesPerWeek  / practiceDaysPerWeek)
//
// Learning is front-loaded so the back half of the window + any slack (e.g.
// "all of July") is left for polishing and performing.
//
// Everything here is deterministic given (pieces, today, config). No
// Date.now() inside — callers pass `today` (the app already threads a server
// timestamp; tests pass a fixed date).

import type { MusicPiece } from './types';

export interface PlanConfig {
  practiceDaysPerWeek: number; // default 5 (Mon-Fri); weekends = perform
  // Days of week reserved for performing (0=Sun..6=Sat). Default Sat+Sun.
  performDays: number[];
}

export const DEFAULT_PLAN_CONFIG: PlanConfig = {
  practiceDaysPerWeek: 5,
  performDays: [0, 6],
};

// How far along a piece is, in lines, based on the best single-day
// linesPracticed peak (a kid who has cleanly played 12 of 18 lines is "12
// learned"). We use the max rather than the sum so re-practicing the same
// lines doesn't inflate progress.
export function linesLearned(piece: MusicPiece): number {
  let max = 0;
  for (const e of piece.log) {
    if (e.linesPracticed > max) max = e.linesPracticed;
  }
  return Math.min(max, piece.estLines);
}

// Best (highest) quality score the kid has reached on a piece so far.
export function bestScore(piece: MusicPiece): number {
  let best = 0;
  for (const e of piece.log) if (e.qualityScore > best) best = e.qualityScore;
  return best;
}

// Whether the kid practiced this piece on a given local date.
export function practicedOn(piece: MusicPiece, dateStr: string): boolean {
  return piece.log.some((e) => e.date === dateStr);
}

function ymd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysBetween(aStr: string, bStr: string): number {
  const a = new Date(aStr + 'T00:00:00Z').getTime();
  const b = new Date(bStr + 'T00:00:00Z').getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

export interface PiecePlan {
  pieceId: string;
  title: string;
  estLines: number;
  learned: number;          // lines learned so far
  remaining: number;        // estLines - learned
  targetDate?: string;
  daysUntilTarget?: number; // calendar days from `today` to targetDate
  practiceDaysLeft?: number; // weekday count until target (excludes perform days)
  linesPerDayTarget: number; // how many NEW lines to add today to stay on pace
  todaysFocus: string;       // human sentence
  practicedToday: boolean;
  bestScore: number;
  passedOff: boolean;
  onTrack: boolean;
}

// Count practice days (non-perform days) strictly between today and target
// (inclusive of today, exclusive of target — you want it learned BY target).
function practiceDaysUntil(todayStr: string, targetStr: string, performDays: number[]): number {
  const total = daysBetween(todayStr, targetStr);
  if (total <= 0) return 0;
  let count = 0;
  const cursor = new Date(todayStr + 'T00:00:00Z');
  for (let i = 0; i < total; i++) {
    if (!performDays.includes(cursor.getUTCDay())) count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

// Build today's plan for one piece.
export function planForPiece(
  piece: MusicPiece,
  todayStr: string,
  config: PlanConfig = DEFAULT_PLAN_CONFIG,
): PiecePlan {
  const learned = linesLearned(piece);
  const remaining = Math.max(0, piece.estLines - learned);
  const passedOff = !!piece.passedOffAt;
  const practicedToday = practicedOn(piece, todayStr);
  const best = bestScore(piece);

  let daysUntilTarget: number | undefined;
  let practiceDaysLeft: number | undefined;
  let linesPerDayTarget = 0;
  let onTrack = true;

  // A passed-off (or fully-learned) piece needs no new lines — it's polish
  // only. Short-circuit before any pacing math so it never asks for "4 more
  // lines" on a piece that's done.
  if (passedOff || remaining === 0) {
    if (piece.targetDate) {
      daysUntilTarget = daysBetween(todayStr, piece.targetDate);
      practiceDaysLeft = practiceDaysUntil(todayStr, piece.targetDate, config.performDays);
    }
    linesPerDayTarget = 0;
    onTrack = true;
  } else if (piece.targetDate) {
    daysUntilTarget = daysBetween(todayStr, piece.targetDate);
    practiceDaysLeft = practiceDaysUntil(todayStr, piece.targetDate, config.performDays);
    if (practiceDaysLeft >= 1) {
      // Pace the remaining lines over the practice days, but RESERVE polish
      // time: aim to finish learning with ~1/4 of the practice days left over
      // to polish (min 1 day). So we divide by the "learning days" budget, not
      // every remaining day.
      const polishDays = Math.max(1, Math.floor(practiceDaysLeft / 4));
      const learnDays = Math.max(1, practiceDaysLeft - polishDays);
      linesPerDayTarget = Math.ceil(remaining / learnDays);
      // "On track" = the per-day load is gentle enough that we'd finish
      // learning with polish days still in hand (not cramming the last day).
      const daysToLearn = Math.ceil(remaining / Math.max(1, linesPerDayTarget));
      onTrack = practiceDaysLeft - daysToLearn >= polishDays;
    } else {
      // No practice days left before the target — it's now-or-never.
      linesPerDayTarget = remaining;
      onTrack = false;
    }
  } else {
    // No target — pace at the default per-day from a 4-week / 5-day cadence.
    linesPerDayTarget = Math.min(remaining, 4);
  }

  let todaysFocus: string;
  if (passedOff) {
    todaysFocus = `Passed off! Keep it polished for performances. 🎉`;
  } else if (remaining === 0) {
    todaysFocus = `All ${piece.estLines} lines learned — polish for a great-sounding run-through (aim 9-10/10).`;
  } else {
    todaysFocus = `Learn ${linesPerDayTarget} new line${linesPerDayTarget === 1 ? '' : 's'} (line ${learned + 1}–${Math.min(piece.estLines, learned + linesPerDayTarget)}), then play it through.`;
  }

  return {
    pieceId: piece.id,
    title: piece.title,
    estLines: piece.estLines,
    learned,
    remaining,
    targetDate: piece.targetDate,
    daysUntilTarget,
    practiceDaysLeft,
    linesPerDayTarget,
    todaysFocus,
    practicedToday,
    bestScore: best,
    passedOff,
    onTrack,
  };
}

export type GoalMode = 'spread' | 'one-at-a-time';

export interface DayPlan {
  date: string;
  isPerformDay: boolean;
  pieces: PiecePlan[];
  totalNewLinesToday: number;
  allPracticedToday: boolean;
  dailyLineGoal?: number;     // the explicit goal in effect (if set)
  goalSource: 'set' | 'auto'; // did the kid/parent set it, or is it computed?
  goalMode: GoalMode;         // spread across all, or focus one at a time
  focusPieceId?: string;      // in one-at-a-time mode, the piece to work today
}

// Build the whole plan for today across all of a kid's pieces.
//
// `dailyLineGoal` (optional): NEW lines to learn today. How it's applied
// depends on `goalMode`:
//   'spread'        → split the goal across all active pieces (proportional to
//                     each piece's remaining lines) — work a bit of everything.
//   'one-at-a-time' → apply the WHOLE goal to a single focus piece (the first
//                     active one, in list order); the rest wait their turn.
// When no goal is set, each piece keeps its own auto-computed spread-to-target
// pace (goalMode is ignored).
export function planForToday(
  pieces: MusicPiece[],
  todayStr: string,
  config: PlanConfig = DEFAULT_PLAN_CONFIG,
  dailyLineGoal?: number,
  goalMode: GoalMode = 'spread',
): DayPlan {
  const dow = new Date(todayStr + 'T00:00:00Z').getUTCDay();
  const isPerformDay = config.performDays.includes(dow);
  // Archived pieces are retired — they don't appear in today's plan at all.
  const livePieces = pieces.filter((p) => !p.archived);
  const piecePlans = livePieces.map((p) => planForPiece(p, todayStr, config));
  const active = piecePlans.filter((p) => !p.passedOff && p.remaining > 0);

  const hasGoal = typeof dailyLineGoal === 'number' && dailyLineGoal > 0 && active.length > 0;
  let focusPieceId: string | undefined;

  if (hasGoal && goalMode === 'one-at-a-time') {
    // Focus the first active piece; the whole goal goes to it. Everything else
    // is parked as "up next."
    const focus = active[0];
    focusPieceId = focus.pieceId;
    const target = Math.min(focus.remaining, Math.round(dailyLineGoal!));
    focus.linesPerDayTarget = target;
    focus.todaysFocus = target > 0
      ? `This week's piece. Learn ${target} new line${target === 1 ? '' : 's'} (line ${focus.learned + 1}–${Math.min(focus.estLines, focus.learned + target)}), then play it through.`
      : `This week's piece — polish it (aim 9-10/10).`;
    // Park the rest.
    for (const p of active.slice(1)) {
      p.linesPerDayTarget = 0;
      p.todaysFocus = `Up next — start this once the current piece is passed off.`;
    }
  } else if (hasGoal) {
    distributeGoal(active, dailyLineGoal!);
  }

  // In one-at-a-time mode, "total new lines today" is just the focus piece's.
  const totalNewLinesToday =
    hasGoal && goalMode === 'one-at-a-time'
      ? (active[0]?.linesPerDayTarget ?? 0)
      : piecePlans.filter((p) => !p.passedOff).reduce((sum, p) => sum + p.linesPerDayTarget, 0);

  // "Practiced today" only requires the FOCUS piece in one-at-a-time mode.
  const allPracticedToday =
    hasGoal && goalMode === 'one-at-a-time'
      ? !!active[0]?.practicedToday
      : (() => {
          const a = piecePlans.filter((p) => !p.passedOff);
          return a.length > 0 && a.every((p) => p.practicedToday);
        })();

  return {
    date: todayStr,
    isPerformDay,
    pieces: piecePlans,
    totalNewLinesToday,
    allPracticedToday,
    dailyLineGoal: hasGoal ? dailyLineGoal : undefined,
    goalSource: hasGoal ? 'set' : 'auto',
    goalMode,
    focusPieceId,
  };
}

// Split a total daily line goal across the active pieces, weighted by each
// piece's remaining lines, and rewrite each piece's linesPerDayTarget + focus
// sentence. Uses a largest-remainder pass so the integer per-piece targets sum
// to (the rounded) goal without drift. A piece never gets assigned more than
// its remaining lines.
function distributeGoal(active: PiecePlan[], goal: number): void {
  const totalRemaining = active.reduce((s, p) => s + p.remaining, 0);
  if (totalRemaining <= 0) return;

  // Effective goal can't exceed what's actually left to learn.
  const effGoal = Math.min(Math.round(goal), totalRemaining);

  // Proportional raw shares.
  const raw = active.map((p) => (effGoal * p.remaining) / totalRemaining);
  const floors = raw.map((r) => Math.floor(r));
  let assigned = floors.reduce((s, f) => s + f, 0);
  let leftover = effGoal - assigned;

  // Hand out the leftover to the largest fractional remainders first.
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  const add = new Array(active.length).fill(0);
  for (const { i } of order) {
    if (leftover <= 0) break;
    if (floors[i] + add[i] < active[i].remaining) {
      add[i] += 1;
      leftover -= 1;
    }
  }

  active.forEach((p, i) => {
    const target = Math.min(p.remaining, floors[i] + add[i]);
    p.linesPerDayTarget = target;
    if (target > 0) {
      p.todaysFocus = `Learn ${target} new line${target === 1 ? '' : 's'} (line ${p.learned + 1}–${Math.min(p.estLines, p.learned + target)}), then play it through.`;
    } else {
      p.todaysFocus = `Polish today — keep it sounding great (aim 9-10/10).`;
    }
  });
}

export { ymd };
