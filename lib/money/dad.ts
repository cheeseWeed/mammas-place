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
  | 'bad_luck'
  | 'greedy'; // "I see what you did there" — kid asked for way more than the cart

export type DadContext = 'portal' | 'checkout';

export interface DadDecision {
  outcome: DadOutcome;
  centsGranted: number;
  dadReply: string;
}

export interface DadDecisionInput {
  userName: string;        // normalized
  centsAsked: number;      // 100..100_000 (1..1000 MP) — kid can ask anything
  reason: string;          // 1..200 chars
  context: DadContext;
  shortfallCents?: number; // amount needed to complete the order
  cartTotalCents?: number; // total cart value — Dad uses this to spot greed
}

// ---------- Reply bank ----------
//
// 25+ per category for variety so the kid doesn't see the same line twice
// in a session. `{amount}` placeholder is replaced with the actual MP
// amount granted at render time. Replies without {amount} just render as-is.

const REPLIES: Record<DadOutcome, readonly string[]> = {
  yes_full: [
    "Sure, here you go.",
    "Anything for you.",
    "Anytime, kiddo.",
    "Done. Don't spend it all in one place.",
    "Sure thing, kiddo! 💰",
    "You earned this one. Sent.",
    "Why not. ✓",
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
    "Alright. But this is the last one. (It's not.)",
    "You got it, boss.",
    "Pay attention in school and there's more where that came from.",
    "Sure. Tell Mom I love her.",
    "Done. Now scoot.",
    "Yes. Because you said please. Did you say please? Close enough.",
    "Alright, alright, alright. Done.",
    "Granted. Now go change the world.",
    "Sent. Pop's got you.",
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
    "I'll give you {amount}. Don't push it.",
    "{amount}. Take the win.",
    "I can swing {amount}. That's it.",
    "{amount} MP. Mom's not looking.",
    "Sending {amount}. Save up for the rest yourself.",
    "Here's {amount}. Show me you can be smart with it.",
    "{amount}. Tell me thank you. Out loud.",
    "Alright, {amount}. Final answer.",
    "{amount} now, the rest after dishes.",
    "{amount}. Don't tell the others I bargained down.",
    "I'll go {amount}. That's my best offer.",
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
    "Pop's got it. Don't make this a regular thing.",
    "Tab's mine. You're welcome.",
    "Order covered. Enjoy your treasure.",
    "I got the rest. Now hug me.",
    "On me — just this cart.",
    "Spotted. Mom doesn't need to know.",
    "Yeah, I'll get the rest. Quick — before I change my mind.",
    "Covered. Send me a thank-you card.",
    "Order's funded. Now go.",
    "Done. Pop pays this time.",
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
    "Mom's making dinner — try after.",
    "Hmm… ask again later. I'll think about it.",
    "Not now. The score's tied.",
    "On the phone. Try later.",
    "After your brother goes to bed. Maybe.",
    "Let it marinate. Ask later.",
    "Get me a glass of water and ask again.",
    "Try me when the sun's down.",
    "Catch me when my back doesn't hurt.",
    "Ask Mom. If she says no, ask me again later.",
    "Not in this mood. Try later.",
  ],
  no: [
    "What, do you think money grows on trees?",
    "Does it look like I'm made of money?",
    "Do you want a tile to the house, too?",
    "Do you want my dog, too?",
    "Do you want the shirt off my back, too?",
    "Do you want my truck, too?",
    "Do you want my left arm, too?",
    "Do you want my last cup of coffee, too?",
    "Do you want my Sunday paper, too?",
    "Do you want the remote, too?",
    "Do you want my recliner, too?",
    "Do you want the lawnmower, too?",
    "I'm a dad, not an ATM.",
    "Back in MY day, we walked uphill BOTH ways.",
    "When I was your age, MP didn't even exist.",
    "No, but nice try.",
    "Nope. Go play a math round and earn it.",
    "Save your asks for when you really need it.",
    "No can do, partner.",
    "I just paid you yesterday. Cool it.",
    "You don't need it. Trust me.",
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
    "Money doesn't fall out of the sky, you know.",
    "Talk to my lawyer. (I don't have a lawyer.)",
    "Ask me again and the answer gets worse.",
    "Computer says no.",
    "Have you considered eating cheaper snacks?",
    "Have you tried being independently wealthy?",
    "What part of NO is confusing?",
    "Not happening, sport.",
    "Big swing, big miss. No.",
  ],
  greedy: [
    "Whoa whoa whoa. Do you want my truck, too?",
    "Do you want a tile to the house, too?",
    "What's next, the lawnmower?",
    "Did you also want my left arm, kiddo?",
    "I see what you did there. Try a smaller number.",
    "Nice try. Cut that ask in half. Then in half again.",
    "Buddy. Read the room.",
    "That's a lot of MP for one ask. Try again with a smaller number.",
    "Hahahaha. No.",
    "I am NOT made of money. Lower the ask.",
    "Bold strategy. Did not work.",
    "Do you also want my Sunday paper?",
    "Were you planning on buying a small island?",
    "{ask} MP?! For real?",
    "I admire the confidence. The answer is still no.",
    "What do you think this is, the lottery?",
    "Asking for {ask} MP is a bold move, Cotton.",
    "If I had {ask} MP I'd retire.",
    "I'd give you {ask} MP if I had {ask} MP.",
    "{ask} MP is more than the cart. You're trying to pocket the rest, aren't you?",
    "Negative, ghost rider. That's way too much.",
    "Sneaky kid. I see you.",
    "Nice try. The skim is denied.",
    "I wasn't born yesterday. Ask for what you need.",
    "Asking for change AND the deposit, eh?",
    "Pad the ask much? Try again.",
    "Caught red-handed. Ask smaller.",
    "Dad math: that's WAY too much.",
    "Sure, and a pony. And a yacht. The answer is no.",
    "I see your hustle. Respectfully — no.",
    "Trying to fund a side project, kiddo?",
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
    "My back hurts. Ask tomorrow.",
    "Mom's giving me a look. Sorry.",
    "Wallet's at home, kiddo.",
    "Just paid the bills. Try later.",
    "Caught me right before the game. Bad timing.",
    "Tomorrow I'll be in a better mood. Probably.",
    "Wrong day, kiddo. Try again.",
    "Asked while I was thinking about taxes. Try later.",
    "Bad luck this time. The dice are cruel.",
    "Catch me on a Saturday.",
    "Not the day for it. Try again.",
    "Stars are weird today.",
    "Today the answer machine says no.",
  ],
};

// ---------- Prompt bank (kid-side form labels) ----------
//
// Rotates the form's primary prompt + button text so opening "Ask Dad"
// 10 times doesn't look identical. Deterministic per page-load (picks
// once, sticks for that session) — caller is the React component.
// Exported so the AskDadPanel can pick fresh strings per mount.

export const DAD_GREETINGS: readonly string[] = [
  "What do you need?",
  "Oh, you're back.",
  "How much this time?",
  "What's the ask?",
  "Lay it on me.",
  "What did you break?",
  "What's the damage?",
  "Yes, sweetheart?",
  "What now?",
  "Talk to me.",
  "Out with it.",
  "What is it, kiddo?",
  "I'm listening.",
  "Hit me.",
  "Make it good.",
  "What are we asking for?",
  "How can I help? (Famous last words.)",
  "Better be a good one.",
  "Alright, let's hear it.",
  "You again?",
  "Long time no see. Two minutes, I think.",
  "What's the pitch?",
  "Spit it out.",
  "Ok, go.",
  "I've got 30 seconds. Go.",
];

export const DAD_PROMPT_LABELS: readonly string[] = [
  "What do you need it for?",
  "Why?",
  "What's the reason?",
  "Tell me why.",
  "Sell it to me.",
  "Convince me.",
  "What's it for, kiddo?",
  "Make your case.",
  "What's the story?",
  "Give me a reason.",
  "I'm all ears — why?",
  "What are we funding?",
  "What's the cause?",
  "What's it for?",
  "Lay out the why.",
  "Pitch it.",
  "Justify the ask.",
  "Run it by me.",
  "What's the angle?",
  "Tell me a good story.",
];

export const DAD_AMOUNT_LABELS: readonly string[] = [
  "How much?",
  "How much this time?",
  "What's the number?",
  "Name a price.",
  "How big are we going?",
  "Damage?",
  "How much do you need?",
  "What's the ask?",
  "How much MP?",
  "Drop a number on me.",
  "How many MP we talking?",
  "Number, please.",
  "Quote me.",
  "How much we asking for?",
  "MP amount?",
  "What's the figure?",
  "How much (be honest)?",
  "How much would do it?",
  "Talk numbers.",
  "How much MP do you want?",
];

export const DAD_SUBMIT_LABELS: readonly string[] = [
  "Ask Dad",
  "Send it",
  "Ask away",
  "Make the ask",
  "Float it past Dad",
  "Roll the dice",
  "Pitch Dad",
  "Send to Dad",
  "Plead the case",
  "Submit ask",
  "Make my case",
  "Try Dad",
  "Lay it on Dad",
  "Send the ask",
  "Throw it at Dad",
];

// Pick a random element from a tuple. Used by the UI for rotating labels.
export function pickPrompt<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

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

// Amount-asked signal — graduated penalty for big asks (not a hard cap).
// User explicitly removed the kid-side cap; kids can ask whatever they want.
// The decision engine takes care of saying no to absurd asks via this delta
// AND the dedicated `greedy` outcome.
function scoreAmount(centsAsked: number): number {
  const mp = centsAsked / 100;
  if (mp <= 10) return 0;
  if (mp <= 25) return -5;
  if (mp <= 50) return -12;
  if (mp <= 100) return -25; // way over — but might still get yes_partial
  return -40;                // 100+ MP — dad math says lol no
}

// "Greedy" detector — kid asked for more than the cart can possibly cost.
// At checkout: anything > cart * 1.5 is suspicious (they're trying to pocket
// the extra). At portal: anything > 100 MP is just yikes.
function isGreedyAsk(args: {
  centsAsked: number;
  context: DadContext;
  cartTotalCents?: number;
}): boolean {
  if (args.context === 'checkout' && (args.cartTotalCents ?? 0) > 0) {
    return args.centsAsked > Math.max(args.cartTotalCents! * 1.5, 1000);
  }
  // Portal: no cart context. 100+ MP is the threshold.
  return args.centsAsked > 10_000;
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
  greedy: number;
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
    greedy: 0,        // only enabled when isGreedyAsk() returns true
  };
}

function clampWeights(w: WeightBag): WeightBag {
  return {
    yes_full: Math.max(1, w.yes_full),
    yes_partial: Math.max(1, w.yes_partial),
    pickup_tab: Math.max(0, w.pickup_tab),
    maybe_later: Math.max(1, w.maybe_later),
    no: Math.max(1, w.no),
    bad_luck: Math.max(1, w.bad_luck),
    greedy: Math.max(0, w.greedy),
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
  cartTotalCents?: number;
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

  // Greedy ask: Dad notices. The greedy outcome dominates but doesn't fully
  // kill the others — sometimes Dad is in a good mood and gives them a
  // partial-yes even on a sketchy ask.
  if (isGreedyAsk({
    centsAsked: args.centsAsked,
    context: args.context,
    cartTotalCents: args.cartTotalCents,
  })) {
    weights.greedy = 60; // dominates roll
    weights.yes_full = 1; // basically gone
    weights.pickup_tab = 0;
    weights.yes_partial = Math.max(2, Math.round(weights.yes_partial * 0.3));
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

function pickReply(outcome: DadOutcome, centsGranted: number, centsAsked: number): string {
  const bank = REPLIES[outcome];
  const template = bank[Math.floor(Math.random() * bank.length)];
  // Render the {amount} (granted) and {ask} (originally asked) placeholders.
  // Inline format to avoid a server/client export tangle on centsToMP.
  let out = template;
  if (out.includes('{amount}')) {
    out = out.replace(/\{amount\}/g, formatCentsInline(centsGranted));
  }
  if (out.includes('{ask}')) {
    out = out.replace(/\{ask\}/g, formatCentsInline(centsAsked));
  }
  return out;
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
    cartTotalCents: input.cartTotalCents,
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
      // Cover the full shortfall — Dad's covering the cart, not a windfall.
      // No cap; if the cart is 30 MP and the kid has 0, Dad covers 30 MP.
      const need = Math.max(0, input.shortfallCents ?? 0);
      centsGranted = need;
      break;
    }
    case 'maybe_later':
    case 'no':
    case 'bad_luck':
    case 'greedy':
      centsGranted = 0;
      break;
  }

  // Templates that include {ask} get the original ask value, not the granted.
  const dadReply = pickReply(outcome, centsGranted, input.centsAsked);
  return { outcome, centsGranted, dadReply };
}
