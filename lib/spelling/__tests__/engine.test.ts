import { describe, expect, it } from 'vitest';

import wordsData from '@/data/spelling/words.json';
import {
  applyAttempt,
  buildPlacementWords,
  initLevelState,
  scorePlacement,
  type AttemptOutcome,
  type SpellingLevel,
  type Word,
} from '@/lib/spelling/engine';

// words.json carries extra fields (`audioSpelling`, `homophones`) the engine
// doesn't model — same cast the placement page uses.
const ALL_WORDS = wordsData as unknown as Word[];

describe('buildPlacementWords (against the real word bank)', () => {
  const placement = buildPlacementWords(ALL_WORDS);

  it('returns 12 words — 2 per level, L1 through L6', () => {
    expect(placement).toHaveLength(12);
    expect(placement.map((w) => w.level)).toEqual([
      1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6,
    ]);
  });

  // The regression: L2 was pinned to 'ship'/'frog', which exist in the bank
  // only at L4. Both slots silently fell back to the first L2 word, so the
  // placement test asked "back" twice.
  it('never asks the same word twice', () => {
    const words = placement.map((w) => w.word.toLowerCase());
    expect(new Set(words).size).toBe(words.length);
  });

  it('gives the two L2 slots two distinct real level-2 words', () => {
    const l2 = placement.filter((w) => w.level === 2);
    expect(l2).toHaveLength(2);
    expect(l2[0].word).not.toBe(l2[1].word);
    for (const w of l2) {
      expect(
        ALL_WORDS.some((x) => x.word === w.word && x.level === 2),
      ).toBe(true);
    }
    expect(l2.map((w) => w.word)).toEqual(['shop', 'truck']);
  });

  // Guards the curated list against future word-bank drift: every pinned word
  // must resolve at its OWN level, not via the fallback.
  it('resolves every curated word at its pinned level (no silent fallback)', () => {
    for (const w of placement) {
      const inBankAtLevel = ALL_WORDS.filter(
        (x) => x.word.toLowerCase() === w.word.toLowerCase() && x.level === w.level,
      );
      expect(inBankAtLevel).toHaveLength(1);
    }
  });

  it('carries a real sentence for every placement word (used by "hear it in a sentence")', () => {
    for (const w of placement) {
      expect(w.sentence.trim().length).toBeGreaterThan(0);
      expect(w.sentence.toLowerCase()).toContain(w.word.toLowerCase());
    }
  });

  it('still dedupes when the curated list drifts off-level', () => {
    // Two L1 pins that don't exist at L1 → both must fall back, to DIFFERENT words.
    const tiny: Word[] = [
      { word: 'aaa', level: 1, patterns: [], syllables: 1, sentence: 'aaa.' },
      { word: 'bbb', level: 1, patterns: [], syllables: 1, sentence: 'bbb.' },
    ];
    const out = buildPlacementWords(tiny);
    expect(new Set(out.map((w) => w.word)).size).toBe(out.length);
  });
});

describe('scorePlacement', () => {
  it('returns the floor (L1) with no outcomes', () => {
    expect(scorePlacement([])).toBe(1);
  });

  it('stops promoting after 2 wrong in a row at the same level', () => {
    const outcomes: AttemptOutcome[] = [
      { word: 'cat', level: 1, correct: true, ts: 1 },
      { word: 'dog', level: 1, correct: true, ts: 2 },
      { word: 'shop', level: 2, correct: true, ts: 3 },
      { word: 'truck', level: 2, correct: true, ts: 4 },
      { word: 'said', level: 3, correct: true, ts: 5 },
      { word: 'were', level: 3, correct: false, ts: 6 },
      { word: 'beach', level: 4, correct: false, ts: 7 },
      { word: 'snake', level: 4, correct: false, ts: 8 },
      { word: 'rabbit', level: 5, correct: true, ts: 9 }, // past the cutoff
    ];
    expect(scorePlacement(outcomes)).toBe(3);
  });
});

describe('applyAttempt', () => {
  const right = (level: SpellingLevel, ts: number): AttemptOutcome => ({
    word: 'x',
    level,
    correct: true,
    ts,
  });
  const wrong = (level: SpellingLevel, ts: number): AttemptOutcome => ({
    word: 'x',
    level,
    correct: false,
    ts,
  });

  it('bumps up a level after 3 right in a row and resets the streak', () => {
    let s = initLevelState(3);
    s = applyAttempt(s, right(3, 1));
    s = applyAttempt(s, right(3, 2));
    s = applyAttempt(s, right(3, 3));
    expect(s.current).toBe(4);
    expect(s.consecutiveRight).toBe(0);
  });

  it('drops a level after 3 wrong in a row but never below L1', () => {
    let s = initLevelState(1);
    s = applyAttempt(s, wrong(1, 1));
    s = applyAttempt(s, wrong(1, 2));
    s = applyAttempt(s, wrong(1, 3));
    expect(s.current).toBe(1);
  });
});
