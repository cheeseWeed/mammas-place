// PEMDAS engine — Math Phase 5.
//
// Drill order-of-operations: P → E → MD → AS (no E in v1, so really PMDAS).
// Generate expression trees, render to a string, and compute the integer answer.
//
// Tiers:
//   easy:   2 operations, exactly one "tricky" precedence case
//           (e.g. 3 + 4 × 2 = 11, not 14; or 10 - 6 / 2 = 7, not 2)
//   medium: 3 operations OR parentheses (e.g. (3 + 4) × 2, 12 / 3 + 1)
//   hard:   3-4 operations + parentheses + integer division kept clean
//           (e.g. (8 - 2) × 3 + 4, 20 / (4 + 1) - 2)
//
// Constraints:
//   - Integer arithmetic only.
//   - Division must produce a whole-number result (clean).
//   - Negatives ARE allowed (subtraction can go below zero on the hard tier).
//   - No exponents.
//   - Parentheses count: 0 (easy), 0-1 (medium), 1-2 (hard).
//
// The grader matches an exact integer; the page parses the typed answer as
// `Number(...)` and compares with `current.answer`.

export type PemdasDifficulty = 'easy' | 'medium' | 'hard';

export type PemdasProblem = {
  prompt: string;       // e.g. "3 + 4 × 2"
  answer: number;       // 11
  difficulty: PemdasDifficulty;
};

export type PemdasConfig = {
  difficulty: PemdasDifficulty;
  questions: number;
};

export const DEFAULT_PEMDAS_CONFIG: PemdasConfig = {
  difficulty: 'easy',
  questions: 10,
};

export const PEMDAS_ROUND_SIZES = [5, 10, 15, 20] as const;

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

type Op = '+' | '-' | '×' | '÷';

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickOne<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Evaluate a single op on integers. Returns NaN if division isn't clean.
function applyOp(a: number, op: Op, b: number): number {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '×': return a * b;
    case '÷':
      if (b === 0) return NaN;
      if (a % b !== 0) return NaN;
      return a / b;
  }
}

// Pretty render symbol (already the unicode glyph).
function sym(op: Op): string { return op; }

// ----------------------------------------------------------------------------
// Tier 1 — Easy: 2 operations, exactly one precedence "trap"
// ----------------------------------------------------------------------------
//
// We want shapes like:
//   a + b × c   → not (a+b)×c
//   a - b × c
//   a × b + c   (no trap, but valid; we bias toward trap shapes)
//   a + b ÷ c   (clean div)
//   a - b ÷ c   (clean div)
//
// Strategy: pick the "high-precedence" pair (× or ÷) first so we know it's
// clean, then prepend a low-precedence op (+ or -) with a fresh operand.
//
// We always put the high-precedence op on the right (a LOW b HIGH c) since
// that's the classic "PEMDAS trap" kids miss most often.

function easyProblem(): PemdasProblem {
  const lowOp: Op = pickOne(['+', '-'] as const);
  const highOp: Op = pickOne(['×', '÷'] as const);

  let b: number;
  let c: number;
  let right: number; // b highOp c

  if (highOp === '×') {
    b = randInt(2, 9);
    c = randInt(2, 9);
    right = b * c;
  } else {
    // Clean division: pick quotient + divisor, derive dividend.
    const quot = randInt(2, 6);
    const div = randInt(2, 6);
    b = quot * div;
    c = div;
    right = quot;
  }

  const a = randInt(2, 12);
  const answer = applyOp(a, lowOp, right);

  return {
    prompt: `${a} ${sym(lowOp)} ${b} ${sym(highOp)} ${c}`,
    answer,
    difficulty: 'easy',
  };
}

// ----------------------------------------------------------------------------
// Tier 2 — Medium: 3 ops OR parentheses
// ----------------------------------------------------------------------------
//
// Recipes:
//   1) (a OP b) OP c            — parens force a usually-wrong order
//   2) a OP b OP c OP d         — three ops, mixed precedence
//   3) a HIGH b LOW c HIGH d    — two high-precedence groups around one low op
//                                 (e.g. 2 × 3 + 4 × 5)

function mediumProblem(): PemdasProblem {
  const recipe = randInt(1, 3);

  // Recipe 1: (a OP b) OP c — parentheses
  if (recipe === 1) {
    // Inner op: any of the four. Outer op: any of the four.
    // Build inner first with clean integers, then outer with clean result.
    for (let attempt = 0; attempt < 30; attempt++) {
      const innerOp: Op = pickOne(['+', '-', '×', '÷'] as const);
      const outerOp: Op = pickOne(['+', '-', '×', '÷'] as const);

      const { a, b, val: inner } = pickCleanPair(innerOp, 2, 12);
      if (Number.isNaN(inner)) continue;

      const { c, val: result } = pickCleanRight(inner, outerOp, 2, 12);
      if (Number.isNaN(result)) continue;

      return {
        prompt: `(${a} ${sym(innerOp)} ${b}) ${sym(outerOp)} ${c}`,
        answer: result,
        difficulty: 'medium',
      };
    }
    // Fallback if we couldn't find a clean one quickly.
    return easyProblem();
  }

  // Recipe 2: a OP b OP c OP d — three ops, no parens
  if (recipe === 2) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const ops: Op[] = [pickOpMild(), pickOpMild(), pickOpMild()];
      const a = randInt(2, 12);
      const b = randInt(2, 9);
      const c = randInt(2, 9);
      const d = randInt(2, 9);
      const ans = evaluateFlat([a, b, c, d], ops);
      if (Number.isNaN(ans)) continue;
      return {
        prompt: `${a} ${sym(ops[0])} ${b} ${sym(ops[1])} ${c} ${sym(ops[2])} ${d}`,
        answer: ans,
        difficulty: 'medium',
      };
    }
    return easyProblem();
  }

  // Recipe 3: a HIGH b LOW c HIGH d
  for (let attempt = 0; attempt < 30; attempt++) {
    const lowOp: Op = pickOne(['+', '-'] as const);
    const highL: Op = pickOne(['×', '÷'] as const);
    const highR: Op = pickOne(['×', '÷'] as const);

    const left = pickCleanPair(highL, 2, 9);
    const right = pickCleanPair(highR, 2, 9);
    if (Number.isNaN(left.val) || Number.isNaN(right.val)) continue;

    const ans = applyOp(left.val, lowOp, right.val);
    return {
      prompt: `${left.a} ${sym(highL)} ${left.b} ${sym(lowOp)} ${right.a} ${sym(highR)} ${right.b}`,
      answer: ans,
      difficulty: 'medium',
    };
  }
  return easyProblem();
}

// ----------------------------------------------------------------------------
// Tier 3 — Hard: 3-4 ops + parentheses
// ----------------------------------------------------------------------------
//
// Recipes:
//   1) (a OP b) OP c OP d
//   2) a OP (b OP c) OP d
//   3) (a OP b) OP (c OP d)
//   4) e OP (a OP b) OP c    (4 numbers, 3 ops, paren in the middle)

function hardProblem(): PemdasProblem {
  const recipe = randInt(1, 4);

  // Recipe 1: (a OP b) OP c OP d
  if (recipe === 1) {
    for (let attempt = 0; attempt < 50; attempt++) {
      const innerOp: Op = pickOne(['+', '-', '×', '÷'] as const);
      const op2: Op = pickOpMild();
      const op3: Op = pickOpMild();
      const inner = pickCleanPair(innerOp, 2, 12);
      if (Number.isNaN(inner.val)) continue;
      const c = randInt(2, 9);
      const d = randInt(2, 9);
      // Evaluate as: inner.val op2 c op3 d using precedence.
      const ans = evaluateFlat([inner.val, c, d], [op2, op3]);
      if (Number.isNaN(ans)) continue;
      return {
        prompt: `(${inner.a} ${sym(innerOp)} ${inner.b}) ${sym(op2)} ${c} ${sym(op3)} ${d}`,
        answer: ans,
        difficulty: 'hard',
      };
    }
    return mediumProblem();
  }

  // Recipe 2: a OP (b OP c) OP d
  if (recipe === 2) {
    for (let attempt = 0; attempt < 50; attempt++) {
      const op1: Op = pickOpMild();
      const innerOp: Op = pickOne(['+', '-', '×', '÷'] as const);
      const op3: Op = pickOpMild();
      const a = randInt(2, 12);
      const inner = pickCleanPair(innerOp, 2, 9);
      if (Number.isNaN(inner.val)) continue;
      const d = randInt(2, 9);
      // Evaluate as: a op1 inner.val op3 d
      const ans = evaluateFlat([a, inner.val, d], [op1, op3]);
      if (Number.isNaN(ans)) continue;
      return {
        prompt: `${a} ${sym(op1)} (${inner.a} ${sym(innerOp)} ${inner.b}) ${sym(op3)} ${d}`,
        answer: ans,
        difficulty: 'hard',
      };
    }
    return mediumProblem();
  }

  // Recipe 3: (a OP b) OP (c OP d)
  if (recipe === 3) {
    for (let attempt = 0; attempt < 50; attempt++) {
      const innerL: Op = pickOne(['+', '-', '×', '÷'] as const);
      const innerR: Op = pickOne(['+', '-', '×', '÷'] as const);
      const outer: Op = pickOne(['+', '-', '×', '÷'] as const);
      const L = pickCleanPair(innerL, 2, 10);
      const R = pickCleanPair(innerR, 2, 10);
      if (Number.isNaN(L.val) || Number.isNaN(R.val)) continue;
      const ans = applyOp(L.val, outer, R.val);
      if (Number.isNaN(ans)) continue;
      return {
        prompt: `(${L.a} ${sym(innerL)} ${L.b}) ${sym(outer)} (${R.a} ${sym(innerR)} ${R.b})`,
        answer: ans,
        difficulty: 'hard',
      };
    }
    return mediumProblem();
  }

  // Recipe 4: e OP (a OP b) OP c
  for (let attempt = 0; attempt < 50; attempt++) {
    const op1: Op = pickOpMild();
    const innerOp: Op = pickOne(['+', '-', '×', '÷'] as const);
    const op3: Op = pickOpMild();
    const e = randInt(2, 12);
    const inner = pickCleanPair(innerOp, 2, 9);
    if (Number.isNaN(inner.val)) continue;
    const c = randInt(2, 9);
    const ans = evaluateFlat([e, inner.val, c], [op1, op3]);
    if (Number.isNaN(ans)) continue;
    return {
      prompt: `${e} ${sym(op1)} (${inner.a} ${sym(innerOp)} ${inner.b}) ${sym(op3)} ${c}`,
      answer: ans,
      difficulty: 'hard',
    };
  }
  return mediumProblem();
}

// ----------------------------------------------------------------------------
// Helpers for clean-division operand picking + flat-expression eval
// ----------------------------------------------------------------------------

// Pick two operands (a, b) for `a op b` so that the result is a clean integer.
// For ÷, ensures b > 0 and a % b === 0. For other ops, just samples randInt.
function pickCleanPair(op: Op, lo: number, hi: number): { a: number; b: number; val: number } {
  if (op === '÷') {
    // pick quotient + divisor in [2, ~min(6, hi)], dividend = q*d.
    const dHi = Math.min(6, hi);
    const div = randInt(2, dHi);
    const quot = randInt(1, dHi);
    const a = div * quot;
    if (a > hi * 2) {
      // out of range — caller will retry
      return { a, b: div, val: NaN };
    }
    return { a, b: div, val: quot };
  }
  const a = randInt(lo, hi);
  const b = randInt(lo, hi);
  // subtraction can go negative — that's allowed (hard tier negatives).
  const val = applyOp(a, op, b);
  return { a, b, val };
}

// Given an already-known left value `left`, pick a clean `right` so that
// `left op right` is integer/clean.
function pickCleanRight(left: number, op: Op, lo: number, hi: number): { c: number; val: number } {
  if (op === '÷') {
    // Need left % c === 0. Try a handful of divisors that divide `left`.
    const candidates: number[] = [];
    for (let c = 2; c <= Math.max(hi, Math.abs(left)); c++) {
      if (c > 12) break;
      if (left !== 0 && left % c === 0) candidates.push(c);
    }
    if (candidates.length === 0) {
      return { c: 0, val: NaN };
    }
    const c = pickOne(candidates);
    return { c, val: left / c };
  }
  const c = randInt(lo, hi);
  return { c, val: applyOp(left, op, c) };
}

// Bias toward + and - for the non-paren ops in larger expressions, but keep
// some ×/÷ in the mix so PEMDAS still bites. ~60% low / 40% high.
function pickOpMild(): Op {
  return Math.random() < 0.6
    ? pickOne(['+', '-'] as const)
    : pickOne(['×', '÷'] as const);
}

// Evaluate a flat list of operands + operators with proper precedence
// (no parens — those are baked into operands by caller). Returns NaN if any
// division is not clean.
//
//   nums = [a, b, c, d];  ops = [op1, op2, op3]
//   → evaluates a op1 b op2 c op3 d with × ÷ binding tighter than + −.
function evaluateFlat(nums: number[], ops: Op[]): number {
  if (nums.length !== ops.length + 1) return NaN;

  // First pass: collapse × and ÷ left-to-right.
  const n = [...nums];
  const o = [...ops];
  let i = 0;
  while (i < o.length) {
    if (o[i] === '×' || o[i] === '÷') {
      const v = applyOp(n[i], o[i], n[i + 1]);
      if (Number.isNaN(v)) return NaN;
      n.splice(i, 2, v);
      o.splice(i, 1);
    } else {
      i++;
    }
  }

  // Second pass: collapse + and - left-to-right.
  let acc = n[0];
  for (let j = 0; j < o.length; j++) {
    acc = applyOp(acc, o[j], n[j + 1]);
    if (Number.isNaN(acc)) return NaN;
  }
  return acc;
}

// ----------------------------------------------------------------------------
// Round generator
// ----------------------------------------------------------------------------

export function generatePemdasProblem(difficulty: PemdasDifficulty): PemdasProblem {
  switch (difficulty) {
    case 'easy':   return easyProblem();
    case 'medium': return mediumProblem();
    case 'hard':   return hardProblem();
  }
}

export function generatePemdasRound(
  difficulty: PemdasDifficulty,
  count: number,
): PemdasProblem[] {
  const out: PemdasProblem[] = [];
  let lastPrompt = '';
  let attempts = 0;
  while (out.length < count && attempts < count * 10) {
    const p = generatePemdasProblem(difficulty);
    attempts += 1;
    if (p.prompt === lastPrompt && out.length > 0) continue;
    out.push(p);
    lastPrompt = p.prompt;
  }
  return out;
}

export function pemdasDifficultyLabel(d: PemdasDifficulty): string {
  switch (d) {
    case 'easy':   return 'Easy';
    case 'medium': return 'Medium';
    case 'hard':   return 'Hard';
  }
}
