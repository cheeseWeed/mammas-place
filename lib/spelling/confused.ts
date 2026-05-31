/**
 * Commonly confused / misspelled words drill content.
 *
 * Pure data + type layer over data/spelling/confused.json — gives the drill
 * page a typed entry point and keeps category labels in one place. The
 * spelling engine (lib/spelling/engine.ts) is unchanged; this is a sibling
 * data set the dedicated drill page consumes.
 *
 * Each entry has:
 *   - `wrong`  : the common misspelling (shown as the "trap" answer)
 *   - `right`  : the correct spelling (what the kid should type)
 *   - `tip`    : memorable mnemonic / explanation
 *   - `sentence`: fill-in-the-blank context — uses `___` placeholder
 *   - `category`: groups entries (double-letter, silent-vowel, …)
 *   - `level`  : roughly matches the spelling engine's L1-L7 difficulty
 */

import confusedData from '@/data/spelling/confused.json';

import type { SpellingLevel } from './engine';

export type ConfusedCategory =
  | 'vowel-swap'
  | 'double-letter'
  | 'i-before-e'
  | 'letter-order'
  | 'silent-vowel'
  | 'silent-letter'
  | 'homophone'
  | 'two-words'
  | 'ending-swap';

export type ConfusedWord = {
  id: string;
  wrong: string;
  right: string;
  category: ConfusedCategory;
  level: SpellingLevel;
  tip: string;
  sentence: string;
};

// Cast through unknown — JSON is hand-curated to match the type and we want a
// compile-time guarantee at every consumer rather than a parse step.
export const CONFUSED_WORDS: ConfusedWord[] = confusedData as unknown as ConfusedWord[];

// ---- Category presentation ----

export const CATEGORY_LABEL: Record<ConfusedCategory, string> = {
  'vowel-swap': 'Vowel swap',
  'double-letter': 'Double letters',
  'i-before-e': 'I before E',
  'letter-order': 'Letter order',
  'silent-vowel': 'Silent vowels',
  'silent-letter': 'Silent letters',
  homophone: 'Sounds the same',
  'two-words': 'Two words, not one',
  'ending-swap': 'Tricky endings',
};

export const CATEGORY_EMOJI: Record<ConfusedCategory, string> = {
  'vowel-swap': '🔁',
  'double-letter': '✌️',
  'i-before-e': '📜',
  'letter-order': '🔀',
  'silent-vowel': '🤫',
  'silent-letter': '🤐',
  homophone: '👯',
  'two-words': '✂️',
  'ending-swap': '🪄',
};

/**
 * All distinct categories present in the data, in a stable display order.
 * Returned as a fresh array so callers can sort/filter without mutating.
 */
export function listCategories(): ConfusedCategory[] {
  const present = new Set<ConfusedCategory>();
  for (const w of CONFUSED_WORDS) present.add(w.category);
  const ORDER: ConfusedCategory[] = [
    'double-letter',
    'silent-vowel',
    'silent-letter',
    'i-before-e',
    'vowel-swap',
    'letter-order',
    'ending-swap',
    'homophone',
    'two-words',
  ];
  return ORDER.filter((c) => present.has(c));
}

// ---- Filtering / picking ----

export type ConfusedFilter = {
  level?: SpellingLevel | 'all';
  category?: ConfusedCategory | 'all';
};

export function filterConfused(filter: ConfusedFilter = {}): ConfusedWord[] {
  const { level = 'all', category = 'all' } = filter;
  return CONFUSED_WORDS.filter((w) => {
    if (level !== 'all' && w.level !== level) return false;
    if (category !== 'all' && w.category !== category) return false;
    return true;
  });
}

/**
 * Pick the next drill word, biased away from the just-shown one so the same
 * card doesn't reappear back-to-back when the pool is small.
 */
export function pickNextConfused(
  pool: ConfusedWord[],
  lastId: string | null,
): ConfusedWord | null {
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0] ?? null;
  // Try up to 6 times to dodge a back-to-back repeat; give up after.
  for (let i = 0; i < 6; i += 1) {
    const idx = Math.floor(Math.random() * pool.length);
    const candidate = pool[idx];
    if (candidate && candidate.id !== lastId) return candidate;
  }
  return pool[0] ?? null;
}

/**
 * Render the sentence with the blank replaced by a visible placeholder. The
 * `___` token in the JSON is exactly three underscores by convention.
 */
export function renderSentenceWithBlank(sentence: string, blank = '_____'): string {
  return sentence.replace(/_+/g, blank);
}

/**
 * Loose answer comparison — trim + lowercase + collapse whitespace, so
 * `"It's"` and `"it's"` both match the stored `right` value.
 */
export function isAnswerCorrect(typed: string, right: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  return norm(typed) === norm(right);
}
