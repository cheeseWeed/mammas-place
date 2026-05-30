// Math drill engine — pure problem generation.
//
// Difficulty controls the number ranges per operation. Division is integer-only
// (no remainders); we synthesize quotient first, then build the dividend, so
// every division problem has a clean whole-number answer.
//
// All ranges are inclusive.

export type Operation = 'add' | 'sub' | 'mul' | 'div';
export type Difficulty = 'easy' | 'medium' | 'hard';

export type MathProblem = {
  // Human-readable: "7 × 8"
  prompt: string;
  // The expected answer (integer).
  answer: number;
  // What operator was used (so the round logger knows the mix).
  op: Operation;
  // The two operands AFTER any swap for subtraction non-negativity / division.
  a: number;
  b: number;
};

// Range table — chosen so easy is appropriate for early elementary, medium
// for ~3rd grade, hard for 4-5th. Tweak freely; this is content not contract.
const RANGES: Record<Operation, Record<Difficulty, { a: [number, number]; b: [number, number] }>> = {
  add: {
    easy:   { a: [1, 10],   b: [1, 10] },
    medium: { a: [10, 50],  b: [10, 50] },
    hard:   { a: [50, 250], b: [50, 250] },
  },
  sub: {
    // For subtraction, we generate (a >= b) so answers stay >= 0.
    easy:   { a: [1, 10],   b: [1, 10] },
    medium: { a: [10, 50],  b: [1, 50] },
    hard:   { a: [50, 250], b: [1, 250] },
  },
  mul: {
    easy:   { a: [1, 5],    b: [1, 5] },
    medium: { a: [2, 12],   b: [2, 12] },
    hard:   { a: [2, 25],   b: [2, 12] },
  },
  div: {
    // For division, we generate (quotient, divisor) then dividend = q*d.
    // 'a' here is the quotient range, 'b' the divisor range.
    easy:   { a: [1, 5],    b: [2, 5] },
    medium: { a: [1, 10],   b: [2, 10] },
    hard:   { a: [1, 12],   b: [2, 12] },
  },
};

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function symbolFor(op: Operation): string {
  switch (op) {
    case 'add': return '+';
    case 'sub': return '−';
    case 'mul': return '×';
    case 'div': return '÷';
  }
}

export function operationLabel(op: Operation): string {
  switch (op) {
    case 'add': return 'Addition';
    case 'sub': return 'Subtraction';
    case 'mul': return 'Multiplication';
    case 'div': return 'Division';
  }
}

// Generate one problem for the given op + difficulty.
export function generateProblem(op: Operation, difficulty: Difficulty): MathProblem {
  const r = RANGES[op][difficulty];

  if (op === 'div') {
    // q*d = dividend (no remainder). 'a' carries quotient, 'b' the divisor.
    const quotient = randInt(r.a[0], r.a[1]);
    const divisor = randInt(r.b[0], r.b[1]);
    const dividend = quotient * divisor;
    return {
      prompt: `${dividend} ${symbolFor('div')} ${divisor}`,
      answer: quotient,
      op,
      a: dividend,
      b: divisor,
    };
  }

  if (op === 'sub') {
    // Ensure a >= b so answer >= 0. Pick freely then swap if needed.
    let a = randInt(r.a[0], r.a[1]);
    let b = randInt(r.b[0], r.b[1]);
    if (b > a) [a, b] = [b, a];
    return { prompt: `${a} ${symbolFor('sub')} ${b}`, answer: a - b, op, a, b };
  }

  // add / mul: order doesn't matter for the answer.
  const a = randInt(r.a[0], r.a[1]);
  const b = randInt(r.b[0], r.b[1]);
  const answer = op === 'add' ? a + b : a * b;
  return { prompt: `${a} ${symbolFor(op)} ${b}`, answer, op, a, b };
}

// Generate a list of problems, drawing the op from `ops` each time. If `ops`
// contains more than one entry, every problem rolls its op fresh ("mix").
export function generateRound(
  ops: Operation[],
  difficulty: Difficulty,
  count: number,
): MathProblem[] {
  if (ops.length === 0) ops = ['add'];
  const problems: MathProblem[] = [];
  for (let i = 0; i < count; i++) {
    const op = ops[Math.floor(Math.random() * ops.length)];
    problems.push(generateProblem(op, difficulty));
  }
  return problems;
}

// Round configuration the kid picks before pressing Start.
export type RoundConfig = {
  ops: Operation[];                  // 1+ ops; >1 = "mix"
  difficulty: Difficulty;
  questions: number;                 // total questions in the round
  perQuestionSeconds: number;        // timer per problem (kid-chosen)
};

export const DEFAULT_ROUND: RoundConfig = {
  ops: ['add'],
  difficulty: 'easy',
  questions: 10,
  perQuestionSeconds: 10,
};

// Allowed timer choices in the UI (seconds).
export const TIMER_CHOICES = [5, 10, 15, 20, 30, 45, 60] as const;

// Allowed round sizes.
export const ROUND_SIZES = [5, 10, 15, 20] as const;
