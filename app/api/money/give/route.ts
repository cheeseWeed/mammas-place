// POST /api/money/give
// Public deposit endpoint — Phase 6b.
//
// A grandparent / family friend sends MP to a kid by entering the kid's
// 4-digit MP card number + an amount. NO auth required: card numbers are
// receive-only identifiers (see PLAN-Phase6-Cards.md). Abuse controls:
//   - per-IP rate limit (5 calls / hour, in-memory)
//   - per-call cap (5000 cents = 50.00 MP) so a griefer can't dump huge
//     amounts of ledger noise into a kid's history
//
// Body: { cardNumber: string, cents: number, giverName?: string }
// Returns: { ok: true, deposited: cents, kidDisplay: string }
//   (we deliberately don't echo the kid's username — only the display name
//    they'd recognize, so this endpoint can't be used as an identity oracle.)
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { credit } from '@/lib/money/balance';

// ---- Validation knobs ---------------------------------------------------
const MAX_CENTS_PER_CALL = 5000;   // 50.00 MP
const MAX_GIVER_NAME_LEN = 30;
const CARD_NUMBER_RE = /^\d{4}$/;

// ---- Rate limit (in-memory, per IP) -------------------------------------
// Map<ip, timestamps[]>. Each request appends now() and we keep only
// timestamps within the trailing window. Resets on server restart — fine
// for grandparent-traffic use case (db-backed would be YAGNI; see spec).
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const ipHits = new Map<string, number[]>();

function checkRateLimit(ip: string): { ok: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const prior = (ipHits.get(ip) ?? []).filter((t) => t > cutoff);
  if (prior.length >= RATE_LIMIT_MAX) {
    // How long until the oldest still-counted hit expires?
    const retryAfterSec = Math.max(
      1,
      Math.ceil((prior[0] + RATE_LIMIT_WINDOW_MS - now) / 1000),
    );
    ipHits.set(ip, prior); // prune even on reject so it stays bounded
    return { ok: false, retryAfterSec };
  }
  prior.push(now);
  ipHits.set(ip, prior);
  return { ok: true };
}

// Best-effort IP extraction. Vercel sets x-forwarded-for; fall back to a
// constant key so the limit still bites in local dev / when headers strip.
function getIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    // x-forwarded-for can be a comma list; first is the client.
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}

export async function POST(req: NextRequest) {
  // ---- Rate limit FIRST (cheapest gate) --------------------------------
  const ip = getIp(req);
  const limit = checkRateLimit(ip);
  if (!limit.ok) {
    return NextResponse.json(
      {
        error: 'Too many gifts from this address; try again later.',
        retryAfterSec: limit.retryAfterSec,
      },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec ?? 60) } },
    );
  }

  // ---- Parse + validate body ------------------------------------------
  let body: { cardNumber?: unknown; cents?: unknown; giverName?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const cardNumber =
    typeof body.cardNumber === 'string' ? body.cardNumber.trim() : '';
  if (!CARD_NUMBER_RE.test(cardNumber)) {
    return NextResponse.json({ error: 'Card number must be 4 digits' }, { status: 400 });
  }

  const cents = Number(body.cents);
  if (!Number.isInteger(cents) || cents <= 0) {
    return NextResponse.json({ error: 'Amount must be a positive whole number of cents' }, { status: 400 });
  }
  if (cents > MAX_CENTS_PER_CALL) {
    return NextResponse.json(
      { error: `Single gift cap is ${MAX_CENTS_PER_CALL / 100} MP` },
      { status: 400 },
    );
  }

  const giverNameRaw =
    typeof body.giverName === 'string' ? body.giverName.trim() : '';
  const giverName = giverNameRaw.slice(0, MAX_GIVER_NAME_LEN);

  // ---- Look up the kid by card number ---------------------------------
  const kid = await prisma.driveUser.findUnique({
    where: { mpCardNumber: cardNumber },
    select: { name: true, displayName: true },
  });
  if (!kid) {
    return NextResponse.json({ error: 'No card with that number' }, { status: 404 });
  }

  // ---- Credit (existing helper wraps in $transaction + writes ledger) -
  try {
    const reason = `Gift from ${giverName || 'a friend'} via /give`;
    await credit(kid.name, cents, 'gift', reason);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'User not found') {
      // Race: card existed at lookup, kid deleted before credit. Treat as 404.
      return NextResponse.json({ error: 'No card with that number' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Could not send the gift; please try again' }, { status: 500 });
  }

  // ---- Friendly success — only return the display-y name --------------
  const kidDisplay = (kid.displayName?.trim() || kid.name).trim();
  return NextResponse.json({ ok: true, deposited: cents, kidDisplay });
}
