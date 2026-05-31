// Time & Money engine — Math Phase 6.
//
// Real-world math: reading a clock + counting money. Two skills bundled into
// one route because they share the same shape (kid sees a real-world prompt,
// types/picks an answer, advances). Each problem carries its own input mode
// (typed vs multiple-choice) and its own normalizer for typed answers.
//
// Tiers (per skill):
//
//   TIME
//     easy:   hour + half-hour ("🕒 3:00", "🕞 3:30")
//     medium: quarter + 5-min increments, often as multiple choice
//             ("Which time is half past 2?")
//     hard:   time-elapsed word problems
//             ("It's 2:15 now. What time will it be in 45 minutes?")
//
//   MONEY
//     easy:   count coins ("3 dimes + 2 nickels")
//     medium: multiple-choice coin-set matching ("Which set equals $1.30?")
//     hard:   make-change ("Toy cost $3.75. Paid $5. Change?")
//
// Answer parsing:
//   - Time: accept "3:30", "3 30", "3:30 PM", "330" → normalize to "H:MM" 12-hr.
//   - Money: accept "$1.25", "1.25", "125 cents", ".25", "25 cents" → "$X.XX".
//   - Multiple-choice problems compare against the choice string directly.

export type TimeMoneyDifficulty = 'easy' | 'medium' | 'hard';
export type TimeMoneySkill = 'time' | 'money';
export type TimeMoneyMode = 'typed' | 'choice';

export type TimeMoneyProblem = {
  prompt: string;
  // The canonical answer string (already normalized for typed problems, or
  // the exact choice label for multiple-choice problems).
  answer: string;
  difficulty: TimeMoneyDifficulty;
  skill: TimeMoneySkill;
  mode: TimeMoneyMode;
  // For multiple-choice problems only. 3-4 options including `answer`.
  choices?: string[];
};

export type TimeMoneyConfig = {
  skill: TimeMoneySkill | 'mix';
  difficulty: TimeMoneyDifficulty;
  questions: number;
};

export const DEFAULT_TIME_MONEY_CONFIG: TimeMoneyConfig = {
  skill: 'mix',
  difficulty: 'easy',
  questions: 10,
};

export const TIME_MONEY_ROUND_SIZES = [5, 10, 15] as const;

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickOne<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ----------------------------------------------------------------------------
// Time formatting / normalizing
// ----------------------------------------------------------------------------

// Canonical "H:MM" 12-hour format. Hour has NO leading zero (e.g. "3:05"),
// minute always has two digits.
export function formatTime12(hour24: number, minute: number): string {
  let h = hour24 % 12;
  if (h === 0) h = 12;
  const mm = minute.toString().padStart(2, '0');
  return `${h}:${mm}`;
}

// Normalize a kid-typed time answer to canonical "H:MM" 12-hr. Returns ''
// when input doesn't look like a time at all.
//
// Accepts: "3:30", "3 30", "3:30 PM", "3:30am", "330" (3 digits),
//          "1230" (4 digits), "3.30".
export function normalizeTime(raw: string): string {
  let s = raw.trim().toLowerCase();
  if (s === '') return '';
  // Strip AM/PM suffix — we don't enforce it.
  s = s.replace(/\s*(a\.?m\.?|p\.?m\.?)$/i, '').trim();

  // Try "H:MM" or "H MM" or "H.MM".
  const sep = s.match(/^(\d{1,2})\s*[:.\s]\s*(\d{1,2})$/);
  if (sep) {
    const h = parseInt(sep[1], 10);
    const m = parseInt(sep[2], 10);
    if (!validHM(h, m)) return '';
    return canonHM(h, m);
  }

  // Try "HMM" or "HHMM" (no separator) — only when length is 3 or 4.
  if (/^\d{3,4}$/.test(s)) {
    const m = parseInt(s.slice(-2), 10);
    const h = parseInt(s.slice(0, -2), 10);
    if (!validHM(h, m)) return '';
    return canonHM(h, m);
  }

  return '';
}

function validHM(h: number, m: number): boolean {
  if (!Number.isFinite(h) || !Number.isFinite(m)) return false;
  if (m < 0 || m > 59) return false;
  // Accept both 12-hr and 24-hr hour inputs.
  if (h < 0 || h > 23) return false;
  return true;
}

function canonHM(h: number, m: number): string {
  let hh = h % 12;
  if (hh === 0) hh = 12;
  return `${hh}:${m.toString().padStart(2, '0')}`;
}

// Add `addMinutes` to a (hour24, minute) start. Returns canonical 12-hr
// string for the resulting time (wraps modulo 24).
function addMinutes(hour24: number, minute: number, addMinutes: number): { h: number; m: number } {
  const total = hour24 * 60 + minute + addMinutes;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return { h: Math.floor(wrapped / 60), m: wrapped % 60 };
}

// Pick an emoji clock face for the o'clock and half-hour cases. Falls back
// to a generic clock for anything else.
function clockEmoji(hour12: number, minute: number): string {
  // Twelve hour emojis: 🕐 = 1:00, 🕑 = 2:00 ... 🕛 = 12:00
  // Half-hour: 🕜 = 1:30, 🕝 = 2:30 ... 🕧 = 12:30
  const oclock = ['🕛','🕐','🕑','🕒','🕓','🕔','🕕','🕖','🕗','🕘','🕙','🕚'];
  const halves = ['🕧','🕜','🕝','🕞','🕟','🕠','🕡','🕢','🕣','🕤','🕥','🕦'];
  const idx = hour12 % 12;
  if (minute === 0) return oclock[idx];
  if (minute === 30) return halves[idx];
  return '🕰️';
}

// ----------------------------------------------------------------------------
// Money formatting / normalizing
// ----------------------------------------------------------------------------

const COIN_VALUES: Record<'penny' | 'nickel' | 'dime' | 'quarter', number> = {
  penny: 1,
  nickel: 5,
  dime: 10,
  quarter: 25,
};

const COIN_LABEL_SING: Record<'penny' | 'nickel' | 'dime' | 'quarter', string> = {
  penny: 'penny',
  nickel: 'nickel',
  dime: 'dime',
  quarter: 'quarter',
};

const COIN_LABEL_PLURAL: Record<'penny' | 'nickel' | 'dime' | 'quarter', string> = {
  penny: 'pennies',
  nickel: 'nickels',
  dime: 'dimes',
  quarter: 'quarters',
};

// Canonical "$X.XX" with two decimals always.
export function formatMoney(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const c = abs % 100;
  return `${sign}$${dollars}.${c.toString().padStart(2, '0')}`;
}

// Normalize a kid-typed money answer to canonical "$X.XX". Accepts:
//   "$1.25", "1.25", ".25", "1", "$.50",
//   "125 cents", "125c", "125¢", "40 cents", "40¢"
// Returns '' for unparseable input.
export function normalizeMoney(raw: string): string {
  let s = raw.trim().toLowerCase();
  if (s === '') return '';

  // "X cents" / "Xc" / "X¢" → cents number.
  const centsMatch = s.match(/^(\d+)\s*(cents?|c|¢)$/);
  if (centsMatch) {
    const cents = parseInt(centsMatch[1], 10);
    if (!Number.isFinite(cents)) return '';
    return formatMoney(cents);
  }

  // Strip leading $.
  s = s.replace(/^\$/, '').trim();

  // Dollar.cents form, possibly missing one side.
  // Accept "1.25", ".25", "1.", "1".
  if (/^\d*\.?\d{0,2}$/.test(s) && s !== '' && s !== '.') {
    const num = Number(s);
    if (!Number.isFinite(num)) return '';
    const cents = Math.round(num * 100);
    return formatMoney(cents);
  }

  return '';
}

// ----------------------------------------------------------------------------
// Public answer-check helper
// ----------------------------------------------------------------------------

// Returns true if `typed` matches the canonical answer of `problem`. For
// multiple-choice problems we expect the page to pass the selected choice
// string verbatim, so exact-match works.
export function isCorrectAnswer(typed: string, problem: TimeMoneyProblem): boolean {
  if (problem.mode === 'choice') {
    return typed === problem.answer;
  }
  if (problem.skill === 'time') {
    const norm = normalizeTime(typed);
    return norm !== '' && norm === problem.answer;
  }
  // money — typed
  const norm = normalizeMoney(typed);
  return norm !== '' && norm === problem.answer;
}

// ----------------------------------------------------------------------------
// TIME — generators
// ----------------------------------------------------------------------------

// Easy: o'clock + half-hour. Single typed answer; we show a clock emoji.
function easyTime(): TimeMoneyProblem {
  const h12 = randInt(1, 12);
  const halfHour = Math.random() < 0.5;
  const minute = halfHour ? 30 : 0;
  const emoji = clockEmoji(h12, minute);
  const ans = formatTime12(h12, minute);
  return {
    prompt: `${emoji}  The clock shows this time. What is it?`,
    answer: ans,
    difficulty: 'easy',
    skill: 'time',
    mode: 'typed',
  };
}

// Medium: quarter-hour + 5-min increments. Multiple choice — the prompt is
// a phrase like "Which time is half past 2?" or "Which is quarter to 4?"
function mediumTime(): TimeMoneyProblem {
  // Three flavours: half past, quarter past, quarter to, "5 minutes after",
  // "10 minutes before".
  const flavour = randInt(1, 5);
  const h = randInt(1, 12);

  let prompt: string;
  let ans: string;

  if (flavour === 1) {
    // half past H
    ans = formatTime12(h, 30);
    prompt = `Which time is half past ${h}?`;
  } else if (flavour === 2) {
    // quarter past H
    ans = formatTime12(h, 15);
    prompt = `Which time is quarter past ${h}?`;
  } else if (flavour === 3) {
    // quarter to H  (i.e. H-1 at :45)
    const prev = h === 1 ? 12 : h - 1;
    ans = formatTime12(prev, 45);
    prompt = `Which time is quarter to ${h}?`;
  } else if (flavour === 4) {
    // 5 minutes after H:NN where NN ∈ {0, 15, 30, 45}
    const startMin = pickOne([0, 15, 30, 45] as const);
    const startStr = formatTime12(h, startMin);
    const end = addMinutes(h, startMin, 5);
    ans = formatTime12(end.h, end.m);
    prompt = `It's ${startStr}. What time is it 5 minutes later?`;
  } else {
    // 10 minutes before
    const startMin = pickOne([15, 30, 45] as const);
    const startStr = formatTime12(h, startMin);
    const end = addMinutes(h, startMin, -10);
    ans = formatTime12(end.h, end.m);
    prompt = `It's ${startStr}. What time was it 10 minutes ago?`;
  }

  // Generate 3 distractors that are plausible: same hour ± 15min, or different
  // half/quarter slots. We just shift the canonical answer by a few minute
  // amounts and reformat.
  const [ansH, ansM] = ans.split(':').map((x) => parseInt(x, 10));
  // ansH is 12-hr — convert to 24 for math via "treat as ansH".
  const distractorPool = new Set<string>();
  const shifts = [-30, -15, -10, -5, 5, 10, 15, 30, 45, 60, -45];
  for (const s of shuffle(shifts)) {
    const t = addMinutes(ansH, ansM, s);
    const cand = formatTime12(t.h, t.m);
    if (cand !== ans) distractorPool.add(cand);
    if (distractorPool.size >= 3) break;
  }
  const choices = shuffle([ans, ...Array.from(distractorPool).slice(0, 3)]);

  return {
    prompt,
    answer: ans,
    difficulty: 'medium',
    skill: 'time',
    mode: 'choice',
    choices,
  };
}

// Hard: time-elapsed text problem. Typed answer in "H:MM".
function hardTime(): TimeMoneyProblem {
  // Start time on a 5-min boundary; add a 5-min-multiple gap between 10 and
  // 90 minutes. Keep the hour in 1-12 range (no AM/PM expected).
  const startH = randInt(1, 12);
  const startM = pickOne([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55] as const);
  const gap = pickOne([15, 20, 25, 30, 40, 45, 50, 55, 75, 90, 20, 35] as const);
  const startStr = formatTime12(startH, startM);
  const end = addMinutes(startH, startM, gap);
  const ans = formatTime12(end.h, end.m);

  // Half the time, ask "what time will it be" — half "what time was it" with
  // a subtracted version.
  if (Math.random() < 0.5) {
    return {
      prompt: `It's ${startStr} now. What time will it be in ${gap} minutes?`,
      answer: ans,
      difficulty: 'hard',
      skill: 'time',
      mode: 'typed',
    };
  }
  // "what time was it `gap` minutes ago" — recompute using endTime as the
  // "now" and the start as the answer, so wording matches.
  const nowStr = formatTime12(end.h, end.m);
  return {
    prompt: `It's ${nowStr} now. What time was it ${gap} minutes ago?`,
    answer: formatTime12(startH, startM),
    difficulty: 'hard',
    skill: 'time',
    mode: 'typed',
  };
}

// ----------------------------------------------------------------------------
// MONEY — generators
// ----------------------------------------------------------------------------

// Easy: count coins. Mix of 2-3 different coin types, totals under $1.00 so
// the kid stays in cents. Typed answer; "$0.40" or "40 cents" both accepted.
function easyMoney(): TimeMoneyProblem {
  // Choose 2-3 different coin types. Cap each coin count low so totals stay
  // friendly.
  const coinTypes = shuffle(['penny', 'nickel', 'dime', 'quarter'] as const).slice(
    0,
    randInt(2, 3),
  );
  const counts: { type: typeof coinTypes[number]; n: number }[] = coinTypes.map((t) => ({
    type: t,
    // Cap quarters at 3 so totals stay under a dollar most of the time.
    n: t === 'quarter' ? randInt(1, 3) : randInt(1, 4),
  }));
  const totalCents = counts.reduce((acc, c) => acc + c.n * COIN_VALUES[c.type], 0);

  // Render "3 dimes and 2 nickels" or "1 quarter, 2 dimes, and 1 penny".
  const parts = counts.map(({ type, n }) => {
    const label = n === 1 ? COIN_LABEL_SING[type] : COIN_LABEL_PLURAL[type];
    return `${n} ${label}`;
  });
  let phrase: string;
  if (parts.length === 2) {
    phrase = `${parts[0]} and ${parts[1]}`;
  } else {
    phrase = `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
  }

  return {
    prompt: `How much money is ${phrase}?`,
    answer: formatMoney(totalCents),
    difficulty: 'easy',
    skill: 'money',
    mode: 'typed',
  };
}

// Medium: multiple-choice — pick the coin set that equals the named amount.
// Includes dollars + coins. Distractors are valid coin sets at the wrong total.
function mediumMoney(): TimeMoneyProblem {
  // Target amount: 25¢ - $2.50, on a 5-cent boundary.
  // To keep it interesting, prefer mixed-coin-and-bill amounts.
  const dollars = randInt(0, 2);
  const fivers = randInt(1, 19); // multiples of 5 cents in 5..95 (avoid 0 so coins always present)
  const targetCents = dollars * 100 + fivers * 5;

  const correctSet = renderCoinSet(targetCents);

  // Distractors: render 3 other "close but wrong" totals.
  const distractors = new Set<string>();
  const shifts = [-25, -15, -10, 10, 15, 25, 30, -30, 5, -5];
  for (const s of shuffle(shifts)) {
    const cand = targetCents + s;
    if (cand <= 0) continue;
    const r = renderCoinSet(cand);
    if (r !== correctSet) distractors.add(r);
    if (distractors.size >= 3) break;
  }

  const choices = shuffle([correctSet, ...Array.from(distractors).slice(0, 3)]);
  return {
    prompt: `Which coin set equals ${formatMoney(targetCents)}?`,
    answer: correctSet,
    difficulty: 'medium',
    skill: 'money',
    mode: 'choice',
    choices,
  };
}

// Convert a cent amount to a "1 dollar, 2 quarters, 1 nickel" phrase using a
// greedy decomposition (quarters → dimes → nickels → pennies, with dollars
// for amounts ≥ $1).
function renderCoinSet(cents: number): string {
  let remaining = cents;
  const parts: string[] = [];

  const dollars = Math.floor(remaining / 100);
  if (dollars > 0) {
    parts.push(`${dollars} ${dollars === 1 ? 'dollar' : 'dollars'}`);
    remaining -= dollars * 100;
  }

  const quarters = Math.floor(remaining / 25);
  if (quarters > 0) {
    parts.push(`${quarters} ${quarters === 1 ? 'quarter' : 'quarters'}`);
    remaining -= quarters * 25;
  }

  const dimes = Math.floor(remaining / 10);
  if (dimes > 0) {
    parts.push(`${dimes} ${dimes === 1 ? 'dime' : 'dimes'}`);
    remaining -= dimes * 10;
  }

  const nickels = Math.floor(remaining / 5);
  if (nickels > 0) {
    parts.push(`${nickels} ${nickels === 1 ? 'nickel' : 'nickels'}`);
    remaining -= nickels * 5;
  }

  if (remaining > 0) {
    parts.push(`${remaining} ${remaining === 1 ? 'penny' : 'pennies'}`);
  }

  if (parts.length === 0) return '0 pennies';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} + ${parts[1]}`;
  return parts.join(' + ');
}

// Hard: make-change problem. Price under what kid paid. Typed answer.
function hardMoney(): TimeMoneyProblem {
  // Item price between $0.50 and $9.50 on a 5-cent boundary.
  const priceCents = randInt(2, 19 * 10) * 5; // 10c .. $9.50 in 5-cent steps
  // Kid pays with a "round" bill that's at least 50 cents more than price.
  const billCandidates = [100, 200, 500, 1000, 2000];
  const validBills = billCandidates.filter((b) => b - priceCents >= 50);
  const paid = pickOne(validBills);
  const changeCents = paid - priceCents;

  const names = ['Sam', 'Mia', 'Alex', 'Jules', 'Maya', 'Theo', 'Nora', 'Eli'];
  const items = ['toy', 'book', 'snack', 'pencil set', 'puzzle', 'sticker pack', 'drink'];

  const name = pickOne(names);
  const item = pickOne(items);

  return {
    prompt: `${name} bought a ${item} for ${formatMoney(priceCents)} and paid with ${formatMoney(paid)}. How much change?`,
    answer: formatMoney(changeCents),
    difficulty: 'hard',
    skill: 'money',
    mode: 'typed',
  };
}

// ----------------------------------------------------------------------------
// Dispatch
// ----------------------------------------------------------------------------

export function generateTimeMoneyProblem(
  skill: TimeMoneySkill,
  difficulty: TimeMoneyDifficulty,
): TimeMoneyProblem {
  if (skill === 'time') {
    switch (difficulty) {
      case 'easy':   return easyTime();
      case 'medium': return mediumTime();
      case 'hard':   return hardTime();
    }
  }
  switch (difficulty) {
    case 'easy':   return easyMoney();
    case 'medium': return mediumMoney();
    case 'hard':   return hardMoney();
  }
}

export function generateTimeMoneyRound(
  config: TimeMoneyConfig,
): TimeMoneyProblem[] {
  const out: TimeMoneyProblem[] = [];
  let lastPrompt = '';
  let attempts = 0;
  const target = config.questions;
  while (out.length < target && attempts < target * 10) {
    attempts += 1;
    const skill: TimeMoneySkill =
      config.skill === 'mix'
        ? (Math.random() < 0.5 ? 'time' : 'money')
        : config.skill;
    const p = generateTimeMoneyProblem(skill, config.difficulty);
    if (p.prompt === lastPrompt && out.length > 0) continue;
    out.push(p);
    lastPrompt = p.prompt;
  }
  return out;
}

// ----------------------------------------------------------------------------
// Labels
// ----------------------------------------------------------------------------

export function timeMoneyDifficultyLabel(d: TimeMoneyDifficulty): string {
  switch (d) {
    case 'easy':   return 'Easy';
    case 'medium': return 'Medium';
    case 'hard':   return 'Hard';
  }
}

export function timeMoneySkillLabel(s: TimeMoneySkill | 'mix'): string {
  switch (s) {
    case 'time':  return 'Time';
    case 'money': return 'Money';
    case 'mix':   return 'Mix';
  }
}
