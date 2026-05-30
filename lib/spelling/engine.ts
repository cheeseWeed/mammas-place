/**
 * Adaptive spelling-bee engine: placement test scoring, level state machine,
 * and weighted word picker. Pure functions only — no React, no I/O.
 */

export type SpellingLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type Word = {
  word: string;
  level: SpellingLevel;
  patterns: string[];
  syllables: number;
  sentence: string;
};

export type AttemptOutcome = {
  word: string;
  level: SpellingLevel;
  correct: boolean;
  ts: number;
};

const MIN_LEVEL: SpellingLevel = 1;
const MAX_LEVEL: SpellingLevel = 7;
const RECENT_WINDOW = 6;
const SHIFT_THRESHOLD = 3;

// ===== Level labels =====

const LEVEL_LABELS: Record<SpellingLevel, string> = {
  0: 'Level 0 — Letters & Sounds',
  1: 'Level 1 — Short Vowels (CVC)',
  2: 'Level 2 — Digraphs & Blends',
  3: 'Level 3 — Sight Words',
  4: 'Level 4 — Long Vowels & Silent E',
  5: 'Level 5 — Two-Syllable Words',
  6: 'Level 6 — Suffixes & Prefixes',
  7: 'Level 7 — Tricky Words',
};

export function levelLabel(level: SpellingLevel): string {
  return LEVEL_LABELS[level];
}

// ===== Placement test =====

/**
 * Returns 12 words for placement: 2 per level from L1-L6, ramped easy → hard.
 * If a level has fewer than 2 words available, takes what's there. If a level
 * has none, the placement is silently shorter (caller still scores it sanely).
 */
export function buildPlacementWords(allWords: Word[]): Word[] {
  const out: Word[] = [];
  for (let lvl = 1; lvl <= 6; lvl += 1) {
    const atLevel = allWords.filter((w) => w.level === lvl);
    out.push(...atLevel.slice(0, 2));
  }
  return out;
}

/**
 * Score placement attempts and recommend a starting level.
 *
 * Rules:
 *  - Walk the outcomes in order. Once the kid misses 2 in a row at the same
 *    level, stop "promoting" — don't credit any higher level after that point.
 *  - Among the levels reached before that cutoff, return the highest one where
 *    they got at least 1 right.
 *  - If they got nothing right (or no outcomes), return L1 (floor).
 */
export function scorePlacement(outcomes: AttemptOutcome[]): SpellingLevel {
  if (outcomes.length === 0) return MIN_LEVEL;

  const consideredCorrectByLevel = new Map<SpellingLevel, boolean>();
  let stopped = false;
  let lastLevel: SpellingLevel | null = null;
  let wrongStreakAtLevel = 0;

  for (const o of outcomes) {
    if (stopped) break;

    if (lastLevel !== o.level) {
      lastLevel = o.level;
      wrongStreakAtLevel = 0;
    }

    if (o.correct) {
      consideredCorrectByLevel.set(o.level, true);
      wrongStreakAtLevel = 0;
    } else {
      wrongStreakAtLevel += 1;
      if (wrongStreakAtLevel >= 2) {
        stopped = true;
      }
    }
  }

  let highest: SpellingLevel = MIN_LEVEL;
  for (const [lvl, gotOne] of consideredCorrectByLevel) {
    if (gotOne && lvl > highest) highest = lvl;
  }
  return highest;
}

// ===== Adaptive driver =====

export type LevelState = {
  current: SpellingLevel;
  recentOutcomes: AttemptOutcome[];
  consecutiveRight: number;
  consecutiveWrong: number;
  totalAttempts: number;
  totalCorrect: number;
};

export function initLevelState(level: SpellingLevel): LevelState {
  return {
    current: level,
    recentOutcomes: [],
    consecutiveRight: 0,
    consecutiveWrong: 0,
    totalAttempts: 0,
    totalCorrect: 0,
  };
}

function clampLevel(n: number): SpellingLevel {
  if (n < MIN_LEVEL) return MIN_LEVEL;
  if (n > MAX_LEVEL) return MAX_LEVEL;
  // n is already an integer in our callers, but be defensive.
  const rounded = Math.round(n);
  return rounded as SpellingLevel;
}

/**
 * Apply an attempt and return updated state.
 *
 * Level-shift rules (whole-level for v1, per the spec's "Keep it whole-level"):
 *   - 3 right in a row → bump up one level (capped at L7)
 *   - 3 wrong in a row → drop one level (floored at L1, never to L0)
 *   - On a shift, the streak counters reset so the kid gets a fresh window.
 */
export function applyAttempt(state: LevelState, outcome: AttemptOutcome): LevelState {
  const nextRecent = [...state.recentOutcomes, outcome].slice(-RECENT_WINDOW);

  let consecutiveRight = outcome.correct ? state.consecutiveRight + 1 : 0;
  let consecutiveWrong = outcome.correct ? 0 : state.consecutiveWrong + 1;
  let current: SpellingLevel = state.current;

  if (consecutiveRight >= SHIFT_THRESHOLD && current < MAX_LEVEL) {
    current = clampLevel(current + 1);
    consecutiveRight = 0;
    consecutiveWrong = 0;
  } else if (consecutiveWrong >= SHIFT_THRESHOLD && current > MIN_LEVEL) {
    current = clampLevel(current - 1);
    consecutiveRight = 0;
    consecutiveWrong = 0;
  }

  return {
    current,
    recentOutcomes: nextRecent,
    consecutiveRight,
    consecutiveWrong,
    totalAttempts: state.totalAttempts + 1,
    totalCorrect: state.totalCorrect + (outcome.correct ? 1 : 0),
  };
}

// ===== Word picker =====

type Bucket = 'level' | 'review' | 'stretch';

function pickRandom<T>(arr: T[]): T | null {
  if (arr.length === 0) return null;
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx] ?? null;
}

/**
 * Pick the next word using the mix policy:
 *   70% target level, 20% review (missed words), 10% stretch (level + 1).
 *
 * Redistribution:
 *   - No missed words available → 80% level / 20% stretch.
 *   - At max level (L7) → 80% level / 20% review.
 *   - At max level with no missed words → 100% level.
 *
 * Fallback: if a randomly chosen bucket is empty (e.g. stretch picks but pool
 * has no L+1 words), fall back to the level bucket; if that's also empty,
 * try review; finally return null.
 */
export function pickNextWord(
  state: LevelState,
  pool: Word[],
  missedWords: string[]
): Word | null {
  if (pool.length === 0) return null;

  const target = state.current;
  const stretchTarget = target < MAX_LEVEL ? ((target + 1) as SpellingLevel) : null;

  const levelPool = pool.filter((w) => w.level === target);
  const stretchPool =
    stretchTarget === null ? [] : pool.filter((w) => w.level === stretchTarget);
  const missedSet = new Set(missedWords);
  const reviewPool = pool.filter((w) => missedSet.has(w.word));

  const hasReview = reviewPool.length > 0;
  const hasStretch = stretchPool.length > 0 && stretchTarget !== null;

  // Build weights based on what's actually available.
  let wLevel: number;
  let wReview: number;
  let wStretch: number;

  if (target >= MAX_LEVEL) {
    // No stretch above L7.
    if (hasReview) {
      wLevel = 0.8;
      wReview = 0.2;
      wStretch = 0;
    } else {
      wLevel = 1.0;
      wReview = 0;
      wStretch = 0;
    }
  } else if (!hasReview) {
    wLevel = 0.8;
    wReview = 0;
    wStretch = hasStretch ? 0.2 : 0;
    if (!hasStretch) wLevel = 1.0;
  } else if (!hasStretch) {
    wLevel = 0.8;
    wReview = 0.2;
    wStretch = 0;
  } else {
    wLevel = 0.7;
    wReview = 0.2;
    wStretch = 0.1;
  }

  const roll = Math.random();
  let bucket: Bucket;
  if (roll < wLevel) bucket = 'level';
  else if (roll < wLevel + wReview) bucket = 'review';
  else bucket = 'stretch';

  // Try the chosen bucket, then fall back through level → review → anything.
  const buckets: Record<Bucket, Word[]> = {
    level: levelPool,
    review: reviewPool,
    stretch: stretchPool,
  };
  const order: Bucket[] = [bucket, 'level', 'review', 'stretch'];
  for (const b of order) {
    const picked = pickRandom(buckets[b]);
    if (picked) return picked;
  }
  // Last resort: pool isn't empty but nothing matched our filters.
  return pickRandom(pool);
}

/* ============================================================
 * Self-test scenario (commented expected behavior, not executed)
 * ============================================================
 *
 *  Placement scenario — kid does well through L3, then stumbles on L4:
 *
 *    const outcomes: AttemptOutcome[] = [
 *      { word: 'cat',   level: 1, correct: true,  ts: 1 },
 *      { word: 'dog',   level: 1, correct: true,  ts: 2 },
 *      { word: 'ship',  level: 2, correct: true,  ts: 3 },
 *      { word: 'flag',  level: 2, correct: true,  ts: 4 },
 *      { word: 'said',  level: 3, correct: true,  ts: 5 },
 *      { word: 'were',  level: 3, correct: false, ts: 6 },
 *      { word: 'cake',  level: 4, correct: false, ts: 7 },
 *      { word: 'shine', level: 4, correct: false, ts: 8 },  // 2 wrong in a row at L4 → stop
 *      { word: 'happy', level: 5, correct: true,  ts: 9 },  // ignored (past cutoff)
 *    ];
 *    scorePlacement(outcomes) === 3
 *
 *  Why: L1, L2, L3 all had at least 1 correct. L4 had zero correct AND
 *  triggered the 2-wrong-in-a-row cutoff, so L5 (even though correct) is
 *  ignored. Highest qualifying level = 3.
 *
 * ============================================================ */
