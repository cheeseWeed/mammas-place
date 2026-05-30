// Fact families engine — Math Phase 2.
//
// A "fact family" is the set of equations that connect three numbers via
// inverse operations:
//
//   add/sub: 3, 5, 8  →  3+5=8, 5+3=8, 8-3=5, 8-5=3
//   mul/div: 4, 6, 24 →  4×6=24, 6×4=24, 24÷4=6, 24÷6=4
//
// The drill shows ONE equation at a time with a blank where one operand
// (or the sum/product) is missing. Round = N independent prompts pulled
// from N freshly-generated families. Single-equation-at-a-time keeps the
// UI tight and the cognitive load right for a 6-9 year old.
//
// No timer. Fact families are about pattern recognition, not speed.

export type FactFamilyOp = 'addsub' | 'muldiv' | 'mix';
export type FactFamilyDifficulty = 'easy' | 'medium' | 'hard';

// Three numbers + which operation family. For addsub: a + b = c.
// For muldiv: a × b = c.
export type FactFamily = {
  op: 'addsub' | 'muldiv';
  a: number;
  b: number;
  c: number; // a+b or a×b
};

// One equation with exactly one blank. The kid types `answer`.
export type FactEquation = {
  // Pretty display: "3 + ? = 8" or "24 ÷ 6 = ?"
  prompt: string;
  answer: number;
  // Which family this came from — handy for debugging / future review UIs.
  family: FactFamily;
  // Which of the four positions this is (so the UI can vary phrasing later
  // if we want; today it just renders prompt as-is).
  variant: 'sum-missing' | 'a-missing' | 'b-missing' | 'product-missing'
         | 'difference-missing' | 'minuend-missing' | 'subtrahend-missing'
         | 'quotient-missing' | 'dividend-missing' | 'divisor-missing';
};

// Number ranges per difficulty. For mul/div the values are the two
// FACTORS (a, b); the product c = a*b is derived.
const RANGES_ADDSUB: Record<FactFamilyDifficulty, [number, number]> = {
  easy:   [1, 10],
  medium: [5, 25],
  hard:   [10, 50],
};

const RANGES_MULDIV: Record<FactFamilyDifficulty, { a: [number, number]; b: [number, number] }> = {
  easy:   { a: [2, 5],  b: [2, 5] },
  medium: { a: [2, 10], b: [2, 10] },
  hard:   { a: [2, 12], b: [2, 12] },
};

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Generate ONE fact family. For addsub we keep a <= b (purely cosmetic,
// keeps the small-then-big shape kids see in workbooks).
export function generateFamily(
  op: 'addsub' | 'muldiv',
  difficulty: FactFamilyDifficulty,
): FactFamily {
  if (op === 'addsub') {
    const [lo, hi] = RANGES_ADDSUB[difficulty];
    let a = randInt(lo, hi);
    let b = randInt(lo, hi);
    if (a > b) [a, b] = [b, a];
    return { op, a, b, c: a + b };
  }
  // muldiv
  const r = RANGES_MULDIV[difficulty];
  let a = randInt(r.a[0], r.a[1]);
  let b = randInt(r.b[0], r.b[1]);
  if (a > b) [a, b] = [b, a];
  return { op, a, b, c: a * b };
}

// Pull ONE equation prompt from a family. We randomize which slot is blank
// so the kid sees all four variants over a round, not just "fill in c".
export function equationFromFamily(family: FactFamily): FactEquation {
  if (family.op === 'addsub') {
    // Four valid prompts:
    //   1) a + b = ?      (sum missing)        → answer c
    //   2) ? + b = c      (a missing)          → answer a
    //   3) a + ? = c      (b missing)          → answer b
    //   4) c - a = ?      (difference missing) → answer b
    //   5) c - b = ?      (difference missing) → answer a
    //   6) ? - a = b      (minuend missing)    → answer c
    //   7) ? - b = a      (minuend missing)    → answer c
    //   8) c - ? = a      (subtrahend missing) → answer b
    //   9) c - ? = b      (subtrahend missing) → answer a
    //
    // We pick from a balanced set covering all 4 fundamental equations.
    const choice = randInt(1, 4);
    const { a, b, c } = family;
    switch (choice) {
      case 1: // a + b = ?
        return {
          prompt: `${a} + ${b} = ?`,
          answer: c,
          family,
          variant: 'sum-missing',
        };
      case 2: // a + ? = c  (b missing)
        return {
          prompt: `${a} + ? = ${c}`,
          answer: b,
          family,
          variant: 'b-missing',
        };
      case 3: // c - a = ?  (difference = b)
        return {
          prompt: `${c} - ${a} = ?`,
          answer: b,
          family,
          variant: 'difference-missing',
        };
      case 4: // c - ? = a  (subtrahend = b)
      default:
        return {
          prompt: `${c} - ? = ${a}`,
          answer: b,
          family,
          variant: 'subtrahend-missing',
        };
    }
  }

  // muldiv family. a × b = c.
  const choice = randInt(1, 4);
  const { a, b, c } = family;
  switch (choice) {
    case 1: // a × b = ?
      return {
        prompt: `${a} × ${b} = ?`,
        answer: c,
        family,
        variant: 'product-missing',
      };
    case 2: // a × ? = c  (b missing)
      return {
        prompt: `${a} × ? = ${c}`,
        answer: b,
        family,
        variant: 'b-missing',
      };
    case 3: // c ÷ a = ?  (quotient = b)
      return {
        prompt: `${c} ÷ ${a} = ?`,
        answer: b,
        family,
        variant: 'quotient-missing',
      };
    case 4: // c ÷ ? = a  (divisor = b)
    default:
      return {
        prompt: `${c} ÷ ? = ${a}`,
        answer: b,
        family,
        variant: 'divisor-missing',
      };
  }
}

// Build a round of N equations. For 'mix' we alternate addsub / muldiv
// fresh per equation. Each equation comes from its own freshly-generated
// family — we don't reuse a family across multiple prompts in one round.
export function generateFactRound(
  op: FactFamilyOp,
  difficulty: FactFamilyDifficulty,
  count: number,
): FactEquation[] {
  const out: FactEquation[] = [];
  for (let i = 0; i < count; i++) {
    const familyOp: 'addsub' | 'muldiv' =
      op === 'mix' ? pickOne(['addsub', 'muldiv'] as const) : op;
    const family = generateFamily(familyOp, difficulty);
    out.push(equationFromFamily(family));
  }
  return out;
}

// Pretty label for headers / chips.
export function factFamilyOpLabel(op: FactFamilyOp): string {
  switch (op) {
    case 'addsub': return 'Add / Subtract';
    case 'muldiv': return 'Multiply / Divide';
    case 'mix':    return 'Mix';
  }
}

// Config the kid picks before pressing Start.
export type FactFamilyConfig = {
  op: FactFamilyOp;
  difficulty: FactFamilyDifficulty;
  questions: number;
};

export const DEFAULT_FACT_FAMILY_CONFIG: FactFamilyConfig = {
  op: 'addsub',
  difficulty: 'easy',
  questions: 10,
};

export const FACT_FAMILY_ROUND_SIZES = [5, 10, 15, 20] as const;
