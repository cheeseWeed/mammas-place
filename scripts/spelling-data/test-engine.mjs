#!/usr/bin/env node
/**
 * Test script for the adaptive spelling engine.
 *
 * Re-implements engine.ts in plain JS (matching the spec) and runs 12 scenarios:
 *   - Level state machine: promotion, demotion, floor, ceiling, mixed, oscillation
 *   - pickNextWord weights: mix, no-misses, max-level, max-no-misses, empty pool, weird state
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORDS_PATH = path.resolve(__dirname, '..', '..', 'data', 'spelling', 'words.json');

// ===== Engine re-implementation (mirrors lib/spelling/engine.ts) =====

const MIN_LEVEL = 1;
const MAX_LEVEL = 7;
const RECENT_WINDOW = 6;
const SHIFT_THRESHOLD = 3;

function clampLevel(n) {
  if (n < MIN_LEVEL) return MIN_LEVEL;
  if (n > MAX_LEVEL) return MAX_LEVEL;
  return Math.round(n);
}

function initLevelState(level) {
  return {
    current: level,
    recentOutcomes: [],
    consecutiveRight: 0,
    consecutiveWrong: 0,
    totalAttempts: 0,
    totalCorrect: 0,
  };
}

function applyAttempt(state, outcome) {
  const nextRecent = [...state.recentOutcomes, outcome].slice(-RECENT_WINDOW);
  let consecutiveRight = outcome.correct ? state.consecutiveRight + 1 : 0;
  let consecutiveWrong = outcome.correct ? 0 : state.consecutiveWrong + 1;
  let current = state.current;

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

function pickRandom(arr) {
  if (arr.length === 0) return null;
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx] ?? null;
}

function pickNextWord(state, pool, missedWords) {
  if (pool.length === 0) return null;

  const target = state.current;
  const stretchTarget = target < MAX_LEVEL ? target + 1 : null;

  const levelPool = pool.filter((w) => w.level === target);
  const stretchPool = stretchTarget === null ? [] : pool.filter((w) => w.level === stretchTarget);
  const missedSet = new Set(missedWords);
  const reviewPool = pool.filter((w) => missedSet.has(w.word));

  const hasReview = reviewPool.length > 0;
  const hasStretch = stretchPool.length > 0 && stretchTarget !== null;

  let wLevel, wReview, wStretch;
  if (target >= MAX_LEVEL) {
    if (hasReview) { wLevel = 0.8; wReview = 0.2; wStretch = 0; }
    else { wLevel = 1.0; wReview = 0; wStretch = 0; }
  } else if (!hasReview) {
    wLevel = 0.8; wReview = 0; wStretch = hasStretch ? 0.2 : 0;
    if (!hasStretch) wLevel = 1.0;
  } else if (!hasStretch) {
    wLevel = 0.8; wReview = 0.2; wStretch = 0;
  } else {
    wLevel = 0.7; wReview = 0.2; wStretch = 0.1;
  }

  const roll = Math.random();
  let bucket;
  if (roll < wLevel) bucket = 'level';
  else if (roll < wLevel + wReview) bucket = 'review';
  else bucket = 'stretch';

  const buckets = { level: levelPool, review: reviewPool, stretch: stretchPool };
  const order = [bucket, 'level', 'review', 'stretch'];
  for (const b of order) {
    const picked = pickRandom(buckets[b]);
    if (picked) return { word: picked, bucket: b };
  }
  const fallback = pickRandom(pool);
  return fallback ? { word: fallback, bucket: 'fallback' } : null;
}

// ===== Test harness =====

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  const tag = pass ? 'PASS' : 'FAIL';
  console.log(`[${tag}] ${name}${detail ? ' — ' + detail : ''}`);
}

function mkOutcome(correct, level = 1, word = 'x') {
  return { word, level, correct, ts: Date.now() };
}

function applySeq(start, correctSeq) {
  let s = initLevelState(start);
  for (const r of correctSeq) s = applyAttempt(s, mkOutcome(r, s.current));
  return s;
}

// ----- Scenario 1: Promotion L3 -> L4 after 3R -----
{
  const s = applySeq(3, [true, true, true]);
  const ok = s.current === 4 && s.consecutiveRight === 0 && s.consecutiveWrong === 0;
  record('1. Promotion L3→L4 on 3R', ok,
    ok ? '' : `got current=${s.current} cR=${s.consecutiveRight} cW=${s.consecutiveWrong}`);
}

// ----- Scenario 2: Demotion L5 -> L4 after 3W -----
{
  const s = applySeq(5, [false, false, false]);
  const ok = s.current === 4 && s.consecutiveRight === 0 && s.consecutiveWrong === 0;
  record('2. Demotion L5→L4 on 3W', ok,
    ok ? '' : `got current=${s.current} cR=${s.consecutiveRight} cW=${s.consecutiveWrong}`);
}

// ----- Scenario 3: Floor at L1 -----
{
  const s = applySeq(1, [false, false, false, false, false]);
  const ok = s.current === 1;
  record('3. Floor at L1 (5W)', ok, ok ? `cW=${s.consecutiveWrong}` : `got current=${s.current}`);
}

// ----- Scenario 4: Ceiling at L7 -----
{
  const s = applySeq(7, [true, true, true, true, true]);
  const ok = s.current === 7;
  record('4. Ceiling at L7 (5R)', ok, ok ? `cR=${s.consecutiveRight}` : `got current=${s.current}`);
}

// ----- Scenario 5: Mixed RWRWRWR — no streak of 3 -----
{
  const s = applySeq(3, [true, false, true, false, true, false, true]);
  const ok = s.current === 3;
  record('5. Mixed RWRWRWR stays L3', ok, ok ? '' : `got current=${s.current}`);
}

// ----- Scenario 6: Promotion then demotion -----
{
  let s = initLevelState(3);
  s = applyAttempt(s, mkOutcome(true, 3));
  s = applyAttempt(s, mkOutcome(true, 3));
  s = applyAttempt(s, mkOutcome(true, 3));
  const afterPromote = s.current;
  s = applyAttempt(s, mkOutcome(false, 4));
  s = applyAttempt(s, mkOutcome(false, 4));
  s = applyAttempt(s, mkOutcome(false, 4));
  const afterDemote = s.current;
  const ok = afterPromote === 4 && afterDemote === 3 && s.consecutiveWrong === 0;
  record('6. Promote L3→L4 then demote L4→L3', ok,
    ok ? '' : `promoted=${afterPromote} demoted=${afterDemote}`);
}

// ----- Load pool for picker scenarios -----
const rawPool = JSON.parse(fs.readFileSync(WORDS_PATH, 'utf8'));
// Engine treats `pool` as full list — it filters by level itself.
const pool = rawPool;

function countBuckets(state, missed, pool, n) {
  const counts = { level: 0, review: 0, stretch: 0, fallback: 0, null: 0 };
  for (let i = 0; i < n; i++) {
    const res = pickNextWord(state, pool, missed);
    if (!res) counts.null++;
    else counts[res.bucket]++;
  }
  return counts;
}

function pct(n, total) {
  return ((n / total) * 100).toFixed(1) + '%';
}

const N = 1000;
const tol = 5; // percentage-point tolerance

function within(actual, expected, total) {
  const actualPct = (actual / total) * 100;
  return Math.abs(actualPct - expected) <= tol;
}

// ----- Scenario 7: mix at L4 with 3 misses -----
{
  const s = initLevelState(4);
  const c = countBuckets(s, ['cat', 'dog', 'sit'], pool, N);
  const ok = within(c.level, 70, N) && within(c.review, 20, N) && within(c.stretch, 10, N);
  record('7. L4 mix 70/20/10', ok,
    `level=${pct(c.level, N)} review=${pct(c.review, N)} stretch=${pct(c.stretch, N)}`);
}

// ----- Scenario 8: empty misses at L4 -----
{
  const s = initLevelState(4);
  const c = countBuckets(s, [], pool, N);
  const ok = within(c.level, 80, N) && within(c.stretch, 20, N) && c.review === 0;
  record('8. L4 no-misses 80/20', ok,
    `level=${pct(c.level, N)} review=${pct(c.review, N)} stretch=${pct(c.stretch, N)}`);
}

// ----- Scenario 9: L7 with 1 miss -----
{
  const s = initLevelState(7);
  const c = countBuckets(s, ['cat'], pool, N);
  const ok = within(c.level, 80, N) && within(c.review, 20, N) && c.stretch === 0;
  record('9. L7 with miss 80/20', ok,
    `level=${pct(c.level, N)} review=${pct(c.review, N)} stretch=${pct(c.stretch, N)}`);
}

// ----- Scenario 10: L7 no misses -----
{
  const s = initLevelState(7);
  const c = countBuckets(s, [], pool, N);
  const ok = c.level === N && c.review === 0 && c.stretch === 0;
  record('10. L7 no-misses 100% level', ok,
    `level=${pct(c.level, N)} review=${pct(c.review, N)} stretch=${pct(c.stretch, N)}`);
}

// ----- Scenario 11: Empty pool -----
{
  const s = initLevelState(4);
  const res = pickNextWord(s, [], ['cat']);
  const ok = res === null;
  record('11. Empty pool → null', ok, ok ? '' : `got ${JSON.stringify(res)}`);
}

// ----- Scenario 12: Weird state — L4 but pool only has L1 words -----
{
  const s = initLevelState(4);
  const l1Only = pool.filter((w) => w.level === 1).slice(0, 20);
  const res = pickNextWord(s, l1Only, []);
  const ok = res !== null;
  record('12. L4 state + L1-only pool → returns something', ok,
    ok ? `picked "${res.word.word}" L${res.word.level} via ${res.bucket}` : 'got null');
}

// ===== Summary =====
const passCount = results.filter((r) => r.pass).length;
console.log(`\n${passCount}/${results.length} scenarios passed.`);
process.exit(passCount === results.length ? 0 : 1);
