// "Ask Dad" — automated server-side Dad persona.
//
// Kid hits POST /api/money/dad/ask with a reason + amount. We score the ask
// (cadence, frequency, reason quality, amount), roll weighted dice to pick an
// outcome bucket, pick a random reply from the per-bucket bank, and credit
// the kid's MP if the outcome warrants it.
//
// **Not a real human. No parent approval queue.** The user explicitly rejected
// the queue-based version — Dad is automated, full stop. If you find yourself
// wanting to add admin/queue UI here, stop and re-read app/money/PLAN.md and
// the conversation history first.
//
// Reply bank: 15+ per outcome category — variety is the whole point.

import { prisma } from '../prisma';

// ---------- Public types ----------

export type DadOutcome =
  | 'yes_full'
  | 'yes_partial'
  | 'pickup_tab'
  | 'maybe_later'
  | 'no'
  | 'bad_luck';

export type DadContext = 'portal' | 'checkout';

export interface DadDecision {
  outcome: DadOutcome;
  centsGranted: number;
  dadReply: string;
}

export interface DadDecisionInput {
  userName: string;        // normalized
  centsAsked: number;      // 100..5000 (1..50 MP)
  reason: string;          // 1..200 chars
  context: DadContext;
  shortfallCents?: number; // only used when context === 'checkout'
}

// ---------- Reply bank ----------
//
// 15+ per category. `{amount}` placeholder is replaced with the actual MP
// amount granted at render time. Replies without {amount} just render as-is.

const REPLIES: Record<DadOutcome, readonly string[]> = {
  yes_full: [
    "Sure thing, kiddo! 💰",
    "You earned this one. Sent.",
    "Why not. ✓",
    "Done. Don't spend it all in one place.",
    "Yes, but you owe me a high five.",
    "Approved. Now go be awesome.",
    "Money's yours. Make me proud.",
    "Done deal. Hugs are free though.",
    "Yep. I had a good day at work too.",
    "Granted. Today is your lucky day.",
    "Easy yes. Have fun.",
    "Sure — I trust you on this one.",
    "Mom said it's fine. So I say yes.",
    "Take it. Make good choices.",
    "Sent. (Don't tell your siblings.)",
    "You drive a hard bargain. Fine, yes.",
    "Approved. Go be a kid.",
    "Yes. And I'm proud of you for asking nicely.",
  ],
  yes_partial: [
    "Half. Meet me in the middle.",
    "I'll give you {amount}. That's plenty.",
    "Tell you what — {amount} MP. Take it or leave it.",
    "Not the full ask, but here's {amount}.",
    "{amount} MP. Earn the rest.",
    "Compromise: {amount}. Good?",
    "I love you, but not THAT much. {amount} it is.",
    "Fair enough. {amount} MP coming your way.",
    "Just {amount}. Save up for the rest.",
    "Splitting the difference. {amount} sent.",
    "Dad math says {amount}. Don't argue.",
    "Half today, half if you ask nicely tomorrow. Sending {amount}.",
    "{amount}. Now scram, I'm watching the game.",
    "Reasonable ask gets a reasonable yes. {amount}.",
    "I'll do {amount}. Negotiation closed.",
    "Counter-offer: {amount}. Deal?",
    "{amount} MP. That's the offer.",
  ],
  pickup_tab: [
    "I'll cover the rest of this order. Just this once.",
    "On me. Don't make a habit of it.",
    "Picking up the tab. Enjoy.",
    "I got this one. You owe me.",
    "Cart's covered. Hugs accepted as thanks.",
    "Done — I'll cover what you're short. Go be merry.",
    "On the house. Mom approved, I think.",
    "I'll spot you the difference. This time.",
    "Order's mine. Treat yourself.",
    "Consider it a gift. Don't say I never did anything.",
    "I'll handle the rest. You're welcome.",
    "Order's funded. Hide it from your brother.",
    "Tab picked up. Smile for the camera.",
    "Covered. Now go enjoy your loot.",
    "Done. Tell your mother I said no.",
    "I'll eat the difference. Don't tell anyone.",
    "Cart's on Dad. Smile.",
  ],
  maybe_later: [
    "Try me again tomorrow.",
    "Maybe after dinner.",
    "Ask me in a few hours.",
    "Catch me when I'm in a better mood.",
    "Not right now. Later, maybe.",
    "Come back when I've had coffee.",
    "Sleep on it. Ask me tomorrow.",
    "After your chores. Then we'll see.",
    "Let me think about it. Ask later.",
    "I'm watching the game. Try again.",
    "Ask your mother first.",
    "Tomorrow. Different answer maybe.",
    "Not now, kiddo. Soon though.",
    "Bug me again later.",
    "Sun's still up. Try again at dinner.",
    "Give it a beat. Ask me later.",
    "Not this hour. Maybe the next.",
  ],
  no: [
    "No, but nice try.",
    "Nope. Go play a math round and earn it.",
    "Save your asks for when you really need it.",
    "No can do, partner.",
    "I just paid you yesterday. Cool it.",
    "You don't need it. Trust me.",
    "I'm a dad, not an ATM.",
    "Hard pass.",
    "Earn it. You can do it.",
    "No. I love you though.",
    "Not for that. Try a better reason.",
    "Have you tried doing chores?",
    "No. Mom would say no too.",
    "Negative, ghost rider.",
    "Denied. Go outside.",
    "Not today. Maybe never. Probably never.",
    "Nope. Read a book instead.",
  ],
  bad_luck: [
    "Tough crowd today. Better luck next time.",
    "Asked at the wrong moment. Try later.",
    "Dad's grumpy. Sorry kiddo.",
    "Bad timing. Maybe tomorrow.",
    "Today's a no day. Sorry.",
    "Stars not aligned. Maybe later.",
    "Caught me at a bad time.",
    "Wrong moment. Try again.",
    "Dad's tired. No today.",
    "Whiff. Better luck later.",
    "Missed the window. Try later.",
    "Tough break. Try again sometime.",
    "Coin flip went the wrong way.",
    "Not this round. Try later.",
    "Better luck next time. Really.",
    "Swing and a miss. Try again.",
    "Universe says no. I'm just the messenger.",
  ],
};

// ---------- Heuristics ----------

const POSITIVE_WORDS = [
  'save', 'birthday', 'goal', 'earn', 'worked', 'helped',
  'study', 'practice', 'finish', 'complete',
] as const;

const NEGATIVE_WORDS = [
  'want', 'gimme', 'plz', 'idk', 'whatever', 'just',
] as const;

// Word-boundary regex per term, case-insensitive. Built once at module load
// so we don't recompile on every ask.
const POSITIVE_RE = POSITIVE_WORDS.map((w) => new RegExp(`\\b${w}\\b`, 'i'));
const NEGATIVE_RE = NEGATIVE_WORDS.map((w) => new RegExp(`\\b${w}\\b`, 'i'));

interface ReasonScore {
  delta: number;     // total weight delta (+ favors yes, − favors no)
  spammy: boolean;   // hard signal — flips toward bad_luck
}

export function scoreReason(rawReason: string): ReasonScore {
  const reason = rawReason.trim();
  let delta = 0;

  // Length signal.
  if (reason.length <= 10) delta -= 8;
  else if (reason.length >= 30) delta += 6;

  // Positive / negative vocab.
  for (const re of POSITIVE_RE) if (re.test(reason)) delta += 5;
  for (const re of NEGATIVE_RE) if (re.test(reason)) delta -= 5;

  // Spammy: 4+ of the same character in a row → "aaaa", "!!!!", "9999".
  const spammy = /(.)\1{3,}/.test(reason);
  if (spammy) delta -= 15;

  // ALL CAPS only counts if the message has enough letters and is mostly upper.
  const letters = reason.replace(/[^A-Za-z]/g, '');
  if (letters.length >= 6 && letters === letters.toUpperCase()) {
    delta -= 4; // mild — kid yelling
  }

  return { delta, spammy };
}

interface CadenceScore {
  delta: number;
  lastAskMs: number | null;
  asksToday: number;
}

// History-derived modifiers. Cheap query — index on (userName, createdAt).
async function loadCadence(userName: string): Promise<CadenceScore> {
  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000);

  const recent = await prisma.dadAsk.findMany({
    where: { userName, createdAt: { gte: new Date(now - 7 * 24 * 60 * 60 * 1000) } },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { createdAt: true },
  });

  const lastAskMs = recent.length ? now - recent[0].createdAt.getTime() : null;
  const asksToday = recent.filter((r) => r.createdAt >= dayAgo).length;

  let delta = 0;

  // Time since last ask.
  if (lastAskMs !== null) {
    const min = lastAskMs / 60_000;
    if (min < 30) delta -= 25;       // hammering Dad — almost certain no
    else if (min < 120) delta -= 12; // medium penalty (<2h)
    else if (min < 24 * 60) delta -= 5;
    else if (min > 3 * 24 * 60) delta += 12; // Dad missed them
    else if (min > 24 * 60) delta += 4;
  } else {
    delta += 4; // never asked — small bonus
  }

  // Asks today.
  if (asksToday === 1) delta -= 0;       // 1st today already counted, baseline
  else if (asksToday === 2) delta -= 12; // 2nd: -30% range
  else if (asksToday === 3) delta -= 20; // 3rd: -50%
  else if (asksToday >= 4) delta -= 30;  // 4th+: -70%

  return { delta, lastAskMs, asksToday };
}

// Amount-asked signal (greed check).
function scoreAmount(centsAsked: number): number {
  const mp = centsAsked / 100;
  if (mp <= 10) return 0;
  if (mp <= 25) return -5;
  return -12; // 26..50 MP — greedy
}

// ---------- Outcome roll ----------

// Base outcome weights, then we mutate them with all the signals.
// Higher number = more likely to be picked when rolling. These get clamped
// to >= 1 so every outcome stays minimally reachable.
interface WeightBag {
  yes_full: number;
  yes_partial: number;
  pickup_tab: number;
  maybe_later: number;
  no: number;
  bad_luck: number;
}

function baseWeights(): WeightBag {
  // Sums to 100 — easy to reason about in percentage terms.
  return {
    yes_full: 30,
    yes_partial: 25,
    pickup_tab: 0,    // only enabled in checkout context
    maybe_later: 15,
    no: 20,
    bad_luck: 10,
  };
}

function clampWeights(w: WeightBag): WeightBag {
  return {
    yes_full: Math.max(1, w.yes_full),
    yes_partial: Math.max(1, w.yes_partial),
    pickup_tab: Math.max(0, w.pickup_tab), // can stay at 0 (portal context)
    maybe_later: Math.max(1, w.maybe_later),
    no: Math.max(1, w.no),
    bad_luck: Math.max(1, w.bad_luck),
  };
}

function rollWeighted(w: WeightBag): DadOutcome {
  const entries = Object.entries(w) as [DadOutcome, number][];
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  if (total <= 0) return 'no';
  let r = Math.random() * total;
  for (const [k, v] of entries) {
    r -= v;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
}

// Apply a single delta to all yes-leaning outcomes.
function applyDelta(w: WeightBag, delta: number): void {
  // Yes-leaning buckets get the delta directly. No-leaning buckets get a
  // proportional inverse nudge so the totals stay roughly comparable.
  w.yes_full += delta;
  w.yes_partial += Math.round(delta * 0.5);
  w.pickup_tab += Math.round(delta * 0.4);
  w.no -= Math.round(delta * 0.4);
  w.bad_luck -= Math.round(delta * 0.2);
}

// ---------- Pure decision (no DB write) — exported for tests/debug ----------

export function decideOutcome(args: {
  context: DadContext;
  reasonScore: ReasonScore;
  cadence: CadenceScore;
  amountDelta: number;
  shortfallCents?: number;
  centsAsked: number;
}): { outcome: DadOutcome; weights: WeightBag } {
  const weights = baseWeights();

  // pickup_tab only available in checkout AND only if there's a shortfall.
  if (args.context === 'checkout' && (args.shortfallCents ?? 0) > 0) {
    weights.pickup_tab = 18;
  }

  applyDelta(weights, args.reasonScore.delta);
  applyDelta(weights, args.cadence.delta);
  applyDelta(weights, args.amountDelta);

  // Spammy reason: bias hard toward bad_luck/no, kill the yes paths.
  if (args.reasonScore.spammy) {
    weights.yes_full = 1;
    weights.yes_partial = 1;
    weights.pickup_tab = Math.min(weights.pickup_tab, 1);
    weights.bad_luck += 20;
    weights.no += 10;
  }

  const clamped = clampWeights(weights);
  const outcome = rollWeighted(clamped);
  return { outcome, weights: clamped };
}

// Round to nearest 25¢ (i.e. nearest quarter-MP). Keeps partial-yes amounts
// looking like the kind of round number a dad would offer.
function roundToQuarterMP(cents: number): number {
  return Math.max(25, Math.round(cents / 25) * 25);
}

function pickReply(outcome: DadOutcome, centsGranted: number): string {
  const bank = REPLIES[outcome];
  const template = bank[Math.floor(Math.random() * bank.length)];
  // Render the {amount} placeholder using the same centsToMP-style formatting
  // we use elsewhere. Inline here to avoid pulling in the format module just
  // for this string substitution (and to avoid a server/client export tangle).
  if (template.includes('{amount}')) {
    return template.replace(/\{amount\}/g, formatCentsInline(centsGranted));
  }
  return template;
}

function formatCentsInline(cents: number): string {
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const remainder = abs % 100;
  if (remainder === 0) return `${whole}MP`;
  return `${whole}.${remainder.toString().padStart(2, '0')}MP`;
}

// ---------- Public entry point ----------

export interface DadAskResult extends DadDecision {
  centsAsked: number;
  reason: string;
  context: DadContext;
}

// Pure computation — no DB write, no MP credit. The API route writes the row
// and credits the balance after this returns. Exposed for tests.
export async function computeDecision(input: DadDecisionInput): Promise<{
  outcome: DadOutcome;
  centsGranted: number;
  dadReply: string;
}> {
  const cadence = await loadCadence(input.userName);
  const reasonScore = scoreReason(input.reason);
  const amountDelta = scoreAmount(input.centsAsked);

  const { outcome } = decideOutcome({
    context: input.context,
    reasonScore,
    cadence,
    amountDelta,
    shortfallCents: input.shortfallCents,
    centsAsked: input.centsAsked,
  });

  let centsGranted = 0;
  switch (outcome) {
    case 'yes_full':
      centsGranted = input.centsAsked;
      break;
    case 'yes_partial': {
      // 30..70% of ask, rounded to nearest 25¢. Never exceed ask, never < 25¢.
      const ratio = 0.3 + Math.random() * 0.4;
      const raw = Math.round(input.centsAsked * ratio);
      centsGranted = Math.min(input.centsAsked, roundToQuarterMP(raw));
      break;
    }
    case 'pickup_tab': {
      // Cover the full shortfall, capped at 50 MP. Only available in checkout.
      const need = Math.max(0, input.shortfallCents ?? 0);
      centsGranted = Math.min(5000, need);
      break;
    }
    case 'maybe_later':
    case 'no':
    case 'bad_luck':
      centsGranted = 0;
      break;
  }

  const dadReply = pickReply(outcome, centsGranted);
  return { outcome, centsGranted, dadReply };
}
