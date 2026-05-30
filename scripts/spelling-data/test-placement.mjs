#!/usr/bin/env node
/**
 * Placement-test scoring harness for the spelling engine.
 *
 * Re-implements buildPlacementWords + scorePlacement in pure JS, mirroring
 * lib/spelling/engine.ts exactly (see comments in that file). Runs six
 * personas and reports actual vs expected starting level for each.
 *
 * Run:  node scripts/spelling-data/test-placement.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORDS_PATH = resolve(__dirname, '..', '..', 'data', 'spelling', 'words.json');

// ===== Engine re-implementation (mirrors lib/spelling/engine.ts) =====

const MIN_LEVEL = 1;

function buildPlacementWords(allWords) {
  const out = [];
  for (let lvl = 1; lvl <= 6; lvl += 1) {
    const atLevel = allWords.filter((w) => w.level === lvl);
    out.push(...atLevel.slice(0, 2));
  }
  return out;
}

function scorePlacement(outcomes) {
  if (outcomes.length === 0) return MIN_LEVEL;

  const consideredCorrectByLevel = new Map();
  let stopped = false;
  let lastLevel = null;
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

  let highest = MIN_LEVEL;
  for (const [lvl, gotOne] of consideredCorrectByLevel) {
    if (gotOne && lvl > highest) highest = lvl;
  }
  return highest;
}

// ===== Helpers =====

/**
 * Build outcomes from a "results matrix" — an array of [level, correctBool]
 * pairs, in the order the words were presented. Word strings come from the
 * actual placement words at the matching index.
 */
function buildOutcomes(placementWords, resultsMatrix) {
  return resultsMatrix.map(([level, correct], i) => {
    const w = placementWords[i];
    return {
      word: w ? w.word : `(missing@${i})`,
      level,
      correct,
      ts: i + 1,
    };
  });
}

function pad(s, n) {
  s = String(s);
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

// ===== Load data =====

const allWords = JSON.parse(readFileSync(WORDS_PATH, 'utf8'));
const placement = buildPlacementWords(allWords);

console.log('='.repeat(72));
console.log('PLACEMENT WORDS (buildPlacementWords output)');
console.log('='.repeat(72));
placement.forEach((w, i) => {
  console.log(`  [${i}] L${w.level}  ${pad(w.word, 14)}  syll=${w.syllables}  "${w.sentence}"`);
});
console.log(`  total: ${placement.length} words\n`);

// ===== Personas =====
//
// Each persona is an array of [level, correctBool], one entry per placement
// word (12 entries to cover L1×2, L2×2, L3×2, L4×2, L5×2, L6×2).

const PERSONAS = [
  {
    name: 'A: Preschooler (knows letters, can\'t read)',
    expected: 1,
    matrix: [
      [1, true],  [1, true],
      [2, false], [2, false],
      [3, false], [3, false],
      [4, false], [4, false],
      [5, false], [5, false],
      [6, false], [6, false],
    ],
  },
  {
    name: 'B: 2nd grader (solid sight words, simple spelling)',
    expected: 4,
    matrix: [
      [1, true],  [1, true],
      [2, true],  [2, true],
      [3, true],  [3, true],
      [4, true],  [4, false],
      [5, false], [5, false],
      [6, false], [6, false],
    ],
  },
  {
    name: 'C: 6th grader (advanced speller)',
    expected: 6,
    matrix: [
      [1, true],  [1, true],
      [2, true],  [2, true],
      [3, true],  [3, true],
      [4, true],  [4, true],
      [5, true],  [5, true],
      [6, true],  [6, true],
    ],
  },
  {
    name: 'D: 3rd grader, careful (misses 1 in L4)',
    expected: 4,
    matrix: [
      [1, true],  [1, true],
      [2, true],  [2, true],
      [3, true],  [3, true],
      [4, true],  [4, false],
      [5, false], [5, false],
      [6, false], [6, false],
    ],
  },
  {
    name: 'E: Edge — only first question right, then bombs',
    expected: 1,
    matrix: [
      [1, true],  [1, false],
      [2, false], [2, false],
      [3, false], [3, false],
      [4, false], [4, false],
      [5, false], [5, false],
      [6, false], [6, false],
    ],
  },
  {
    name: 'F: Misses everything',
    expected: 1,
    matrix: [
      [1, false], [1, false],
      [2, false], [2, false],
      [3, false], [3, false],
      [4, false], [4, false],
      [5, false], [5, false],
      [6, false], [6, false],
    ],
  },
];

// ===== Run =====

console.log('='.repeat(72));
console.log('PERSONA RESULTS');
console.log('='.repeat(72));

let passes = 0;
let fails = 0;

for (const p of PERSONAS) {
  const outcomes = buildOutcomes(placement, p.matrix);
  const actual = scorePlacement(outcomes);
  const ok = actual === p.expected;
  if (ok) passes += 1; else fails += 1;

  const status = ok ? 'PASS' : 'FAIL';
  console.log(`\n[${status}] ${p.name}`);
  console.log(`       expected=L${p.expected}  actual=L${actual}`);

  // Show outcome trace
  const trace = outcomes
    .map((o) => `L${o.level}:${o.correct ? 'Y' : 'N'}`)
    .join(' ');
  console.log(`       trace: ${trace}`);
}

console.log('\n' + '='.repeat(72));
console.log(`SUMMARY: ${passes} passed, ${fails} failed (of ${PERSONAS.length})`);
console.log('='.repeat(72));

process.exit(fails === 0 ? 0 : 1);
