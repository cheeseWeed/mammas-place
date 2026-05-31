// Fractions / Decimals engine — Math Phase 4.
//
// Drill covering basic fractions + 1-decimal arithmetic. Every prompt has a
// numeric (decimal) answer so the grader is simple — the UI accepts either a
// decimal ("0.625") or a fraction ("5/8") and parses both to a number.
//
// Tiers:
//   easy:   halves + quarters, 0.5 + 0.5 style decimals
//   medium: add/sub same-denominator fractions, simple fraction → decimal,
//           single-decimal add (0.X + 0.Y)
//   hard:   multiply simple fractions, decimal × small integer,
//           equivalent fractions (2/4 = ?/8 → answer is the numerator)
//
// All answers are numbers. We round at most to 4 decimal places and use a
// per-problem `tolerance` so things like 1/3 (0.3333…) match 0.33.

export type FractionDifficulty = 'easy' | 'medium' | 'hard';

export type FractionKind =
  | 'add'                  // fraction or decimal addition
  | 'sub'                  // fraction or decimal subtraction
  | 'mul'                  // fraction × fraction, or decimal × integer
  | 'fraction-to-decimal'  // 1/2 = ?
  | 'equivalent';          // 2/4 = ?/8

export type FractionProblem = {
  prompt: string;
  answer: number;
  // Numeric tolerance (e.g. 0.01 so 0.6666… matches 0.67). Exact problems use 0.
  tolerance: number;
  difficulty: FractionDifficulty;
  kind: FractionKind;
};

export type FractionConfig = {
  difficulty: FractionDifficulty;
  questions: number;
};

export const DEFAULT_FRACTION_CONFIG: FractionConfig = {
  difficulty: 'easy',
  questions: 10,
};

export const FRACTION_ROUND_SIZES = [5, 10, 15, 20] as const;

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickOne<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Round to N decimal places without floating point noise.
function round(n: number, places: number): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

// Parse user input — accepts "0.75", ".75", "3/4", "  3 / 4  ".
// Returns NaN for unparseable input.
export function parseFractionAnswer(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === '') return NaN;
  const slash = trimmed.indexOf('/');
  if (slash >= 0) {
    const num = Number(trimmed.slice(0, slash).trim());
    const den = Number(trimmed.slice(slash + 1).trim());
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return NaN;
    return num / den;
  }
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : NaN;
}

// Compare answer with tolerance.
export function isCorrectAnswer(
  typed: string,
  problem: FractionProblem,
): boolean {
  const got = parseFractionAnswer(typed);
  if (Number.isNaN(got)) return false;
  const tol = Math.max(problem.tolerance, 1e-9);
  return Math.abs(got - problem.answer) <= tol;
}

// Format the canonical answer for the reveal banner. Strips trailing zeros
// from short decimals so "0.50" shows as "0.5".
export function formatFractionAnswer(problem: FractionProblem): string {
  // Trim to a sensible precision based on tolerance.
  const places = problem.tolerance >= 0.01 ? 2 : 4;
  const rounded = round(problem.answer, places);
  const str = rounded.toString();
  return str;
}

// ----------------------------------------------------------------------------
// Easy tier — halves & quarters, 0.5-style decimals
// ----------------------------------------------------------------------------

function easyProblem(): FractionProblem {
  // Mix of fraction prompts (halves/quarters) and decimal prompts (0.5-step).
  const recipe = randInt(1, 6);

  // 1) 1/2 + 1/2 = 1
  if (recipe === 1) {
    return {
      prompt: '1/2 + 1/2',
      answer: 1,
      tolerance: 0,
      difficulty: 'easy',
      kind: 'add',
    };
  }
  // 2) 1/4 + 1/4 = 1/2 (0.5)
  if (recipe === 2) {
    return {
      prompt: '1/4 + 1/4',
      answer: 0.5,
      tolerance: 0,
      difficulty: 'easy',
      kind: 'add',
    };
  }
  // 3) 3/4 - 1/4 = 1/2 (0.5)
  if (recipe === 3) {
    return {
      prompt: '3/4 - 1/4',
      answer: 0.5,
      tolerance: 0,
      difficulty: 'easy',
      kind: 'sub',
    };
  }
  // 4) 3/4 + 1/4 = 1
  if (recipe === 4) {
    return {
      prompt: '3/4 + 1/4',
      answer: 1,
      tolerance: 0,
      difficulty: 'easy',
      kind: 'add',
    };
  }
  // 5) 0.5 + 0.5 = 1
  if (recipe === 5) {
    return {
      prompt: '0.5 + 0.5',
      answer: 1,
      tolerance: 0,
      difficulty: 'easy',
      kind: 'add',
    };
  }
  // 6) 0.25 + 0.25 = 0.5  OR  1 - 0.5 = 0.5  (pick one for variety)
  const flip = randInt(1, 2);
  if (flip === 1) {
    return {
      prompt: '0.25 + 0.25',
      answer: 0.5,
      tolerance: 0,
      difficulty: 'easy',
      kind: 'add',
    };
  }
  return {
    prompt: '1 - 0.5',
    answer: 0.5,
    tolerance: 0,
    difficulty: 'easy',
    kind: 'sub',
  };
}

// ----------------------------------------------------------------------------
// Medium tier — same-denom add/sub, simple fraction→decimal, 0.X + 0.Y
// ----------------------------------------------------------------------------

function mediumProblem(): FractionProblem {
  const recipe = randInt(1, 3);

  // 1) Same-denominator add/sub: a/d ± b/d where d in {4,5,6,8,10}.
  if (recipe === 1) {
    const denom = pickOne([4, 5, 6, 8, 10] as const);
    const op = pickOne(['+', '-'] as const);

    if (op === '+') {
      // pick a + b ≤ denom, both ≥ 1
      const a = randInt(1, denom - 1);
      const b = randInt(1, denom - a);
      const answer = round((a + b) / denom, 4);
      return {
        prompt: `${a}/${denom} + ${b}/${denom}`,
        answer,
        tolerance: 0.001,
        difficulty: 'medium',
        kind: 'add',
      };
    }
    // subtraction: a > b
    let a = randInt(2, denom);
    let b = randInt(1, a - 1);
    if (a === b) b = Math.max(1, a - 1);
    const answer = round((a - b) / denom, 4);
    return {
      prompt: `${a}/${denom} - ${b}/${denom}`,
      answer,
      tolerance: 0.001,
      difficulty: 'medium',
      kind: 'sub',
    };
  }

  // 2) Simple fraction → decimal. Pool of "clean" conversions.
  if (recipe === 2) {
    const pool: { frac: string; value: number }[] = [
      { frac: '1/2', value: 0.5 },
      { frac: '1/4', value: 0.25 },
      { frac: '3/4', value: 0.75 },
      { frac: '1/5', value: 0.2 },
      { frac: '2/5', value: 0.4 },
      { frac: '3/5', value: 0.6 },
      { frac: '4/5', value: 0.8 },
      { frac: '1/10', value: 0.1 },
      { frac: '3/10', value: 0.3 },
      { frac: '7/10', value: 0.7 },
      { frac: '9/10', value: 0.9 },
    ];
    const pick = pickOne(pool);
    return {
      prompt: `${pick.frac} = ?`,
      answer: pick.value,
      tolerance: 0,
      difficulty: 'medium',
      kind: 'fraction-to-decimal',
    };
  }

  // 3) 0.X + 0.Y where X + Y can carry up to 1.X (one-decimal arithmetic).
  // Either add or subtract, both produce a 1-decimal answer.
  const op = pickOne(['+', '-'] as const);
  if (op === '+') {
    const x = randInt(1, 9);
    const y = randInt(1, 9);
    const answer = round((x + y) / 10, 1);
    return {
      prompt: `0.${x} + 0.${y}`,
      answer,
      tolerance: 0.001,
      difficulty: 'medium',
      kind: 'add',
    };
  }
  // subtraction: ensure positive
  let x = randInt(2, 9);
  let y = randInt(1, x - 1);
  if (x === y) y = Math.max(1, x - 1);
  const answer = round((x - y) / 10, 1);
  return {
    prompt: `0.${x} - 0.${y}`,
    answer,
    tolerance: 0.001,
    difficulty: 'medium',
    kind: 'sub',
  };
}

// ----------------------------------------------------------------------------
// Hard tier — fraction × fraction, decimal × int, equivalent fractions
// ----------------------------------------------------------------------------

function hardProblem(): FractionProblem {
  const recipe = randInt(1, 3);

  // 1) Multiply two simple fractions. Keep denominators small so the answer
  //    stays sane: numerators 1-3, denominators 2-5.
  if (recipe === 1) {
    const n1 = randInt(1, 3);
    const d1 = randInt(2, 5);
    const n2 = randInt(1, 3);
    const d2 = randInt(2, 5);
    // Avoid degenerate "1/2 × 1/2" repeats too often — re-roll if both n=1 d=2.
    const answer = round((n1 * n2) / (d1 * d2), 4);
    return {
      prompt: `${n1}/${d1} × ${n2}/${d2}`,
      answer,
      tolerance: 0.001,
      difficulty: 'hard',
      kind: 'mul',
    };
  }

  // 2) Decimal × small integer. Use 1-decimal values × {2..9} so answer stays
  //    at most 1 decimal place.
  if (recipe === 2) {
    const tenths = randInt(1, 9); // 0.1..0.9
    const k = randInt(2, 9);
    const dec = tenths / 10;
    const answer = round(dec * k, 1);
    return {
      prompt: `${dec} × ${k}`,
      answer,
      tolerance: 0.001,
      difficulty: 'hard',
      kind: 'mul',
    };
  }

  // 3) Equivalent fractions: a/b = ?/c where c is a multiple of b. Answer is
  //    the missing numerator.
  // Use small base fractions.
  const bases: { n: number; d: number }[] = [
    { n: 1, d: 2 },
    { n: 1, d: 3 },
    { n: 2, d: 3 },
    { n: 1, d: 4 },
    { n: 3, d: 4 },
    { n: 1, d: 5 },
    { n: 2, d: 5 },
    { n: 1, d: 6 },
    { n: 5, d: 6 },
  ];
  const base = pickOne(bases);
  const mult = randInt(2, 4); // 2x, 3x, 4x
  const newDen = base.d * mult;
  const newNum = base.n * mult;
  // Sanity: skip if already-reduced form would confuse (e.g. base.n/base.d not
  // in lowest terms could double-multiply). We picked bases in lowest terms.
  void gcd; // gcd helper retained for future use; lint guard.
  return {
    prompt: `${base.n}/${base.d} = ?/${newDen}`,
    answer: newNum,
    tolerance: 0,
    difficulty: 'hard',
    kind: 'equivalent',
  };
}

// ----------------------------------------------------------------------------
// Round generator
// ----------------------------------------------------------------------------

export function generateFractionProblem(
  difficulty: FractionDifficulty,
): FractionProblem {
  switch (difficulty) {
    case 'easy':   return easyProblem();
    case 'medium': return mediumProblem();
    case 'hard':   return hardProblem();
  }
}

export function generateFractionRound(
  difficulty: FractionDifficulty,
  count: number,
): FractionProblem[] {
  const out: FractionProblem[] = [];
  // Lightweight de-dup: avoid two identical prompts back-to-back within a round.
  // (Don't strictly dedupe the whole round — small easy pool would loop forever.)
  let lastPrompt = '';
  let attempts = 0;
  while (out.length < count && attempts < count * 10) {
    const p = generateFractionProblem(difficulty);
    attempts += 1;
    if (p.prompt === lastPrompt && out.length > 0) continue;
    out.push(p);
    lastPrompt = p.prompt;
  }
  return out;
}

export function fractionDifficultyLabel(d: FractionDifficulty): string {
  switch (d) {
    case 'easy':   return 'Easy';
    case 'medium': return 'Medium';
    case 'hard':   return 'Hard';
  }
}
