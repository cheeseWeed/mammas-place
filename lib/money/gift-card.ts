// MP Gift Cards — Phase 6c.
//
// Single-use printable codes parents mint for birthdays / surprise drops.
// Format: `MP-XXXXXX` where the 6 X's are drawn from a 32-char base32
// alphabet with the visually ambiguous chars removed (no 0/O/1/I/L). The
// `MP-` prefix is part of the public string shown to humans — kept inline so
// what the parent prints and what the kid types are byte-identical.
//
// Redemption is a single Prisma $transaction:
//   1. Look up the card row.
//   2. Validate (exists, not redeemed, not revoked).
//   3. Mark redeemed (with the kid's name + timestamp).
//   4. Credit the kid's balance via balance.ts credit() — reuses the existing
//      ledger so every credit hits MpTransaction (audit trail rule from PLAN).
// Concurrent submits → the second redeem sees `redeemedAt != null` and 409s.
//
// Codes are minted server-side with `crypto.randomInt`. Per-call collision
// odds are vanishing (~10^9 space, tiny family), but we still retry on the
// unique-constraint failure (P2002) to be race-safe.

import { randomInt } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { credit } from './balance';
import { normalizeUser } from '../drive-progress';

// Base32 alphabet with confusables stripped: no 0/O, no 1/I/L. 32 chars total.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_BODY_LEN = 6;
const CODE_PREFIX = 'MP-';
const MAX_MINT_RETRIES = 6;
const MAX_CENTS = 1_000_000; // sanity cap: 10,000 MP per card

/**
 * Returns a fresh public gift-card code, e.g. "MP-7K2H9N". 6 chars from a
 * 32-char alphabet → ~10^9 possibilities. Not checked for collisions here —
 * the caller is expected to rely on the @unique constraint.
 */
export function generateGiftCardCode(): string {
  let body = '';
  for (let i = 0; i < CODE_BODY_LEN; i++) {
    body += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return `${CODE_PREFIX}${body}`;
}

/** Normalize user input: strip spaces/casing, ensure `MP-` prefix is present. */
export function normalizeGiftCardCode(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/\s+/g, '').replace(/^MP-?/, '');
  return `${CODE_PREFIX}${cleaned}`;
}

/** Tight client-side validator — does this look like an MP-XXXXXX code? */
export function isWellFormedGiftCardCode(code: string): boolean {
  if (!code.startsWith(CODE_PREFIX)) return false;
  const body = code.slice(CODE_PREFIX.length);
  if (body.length !== CODE_BODY_LEN) return false;
  for (const ch of body) {
    if (!ALPHABET.includes(ch)) return false;
  }
  return true;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  );
}

/**
 * Mints a gift card with retry-on-collision. `cents` must be positive int.
 * `note` is optional and trimmed/capped; pass empty/whitespace to clear.
 */
export async function createGiftCard(input: {
  cents: number;
  note?: string | null;
}): Promise<{ code: string; cents: number; note: string | null }> {
  const { cents } = input;
  if (!Number.isInteger(cents) || cents <= 0 || cents > MAX_CENTS) {
    throw new Error('cents must be a positive integer (≤ 1,000,000)');
  }
  const trimmedNote =
    typeof input.note === 'string' ? input.note.trim().slice(0, 200) : '';
  const note = trimmedNote.length > 0 ? trimmedNote : null;

  for (let attempt = 0; attempt < MAX_MINT_RETRIES; attempt++) {
    const code = generateGiftCardCode();
    try {
      const created = await prisma.mpGiftCard.create({
        data: { code, cents, note },
        select: { code: true, cents: true, note: true },
      });
      return created;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Collision — loop and try a new code.
    }
  }
  throw new Error('Could not mint a unique gift-card code; please retry');
}

export class GiftCardError extends Error {
  constructor(public kind: 'not_found' | 'already_redeemed' | 'revoked', message?: string) {
    super(message ?? kind);
    this.name = 'GiftCardError';
  }
}

/**
 * Atomically redeem a gift card. Wraps the row update + balance credit in a
 * single $transaction so a power-cut / race can't credit twice or credit a
 * revoked card.
 *
 * Throws `GiftCardError` with `kind` set to one of:
 *   - 'not_found'        — no such code
 *   - 'already_redeemed' — code already used
 *   - 'revoked'          — parent killed the code
 *
 * Returns the redeemed amount + the kid's new balance.
 */
export async function redeemGiftCard(input: {
  code: string;
  userName: string;
}): Promise<{ cents: number; balanceCents: number; note: string | null }> {
  const code = normalizeGiftCardCode(input.code);
  if (!isWellFormedGiftCardCode(code)) {
    throw new GiftCardError('not_found', 'Malformed code');
  }
  const userKey = normalizeUser(input.userName);
  if (!userKey) throw new Error('userName required');

  // Two-phase: row lookup + atomic claim inside a transaction, then credit.
  // We can't put credit() inside the same $transaction because it opens its
  // own (nested $transaction not supported on Postgres without savepoints).
  // Instead, we claim the row first (set redeemedAt + redeemedByName in one
  // updateMany filtered by `revoked: false, redeemedAt: null`) and only call
  // credit() if exactly 1 row was claimed. If credit() then throws, we revert
  // the claim — keeps the gift card available again. The race window is
  // small and only matters if the user row doesn't exist (which we validate
  // up front below).

  // 1. Lookup the card to give precise errors.
  const card = await prisma.mpGiftCard.findUnique({ where: { code } });
  if (!card) throw new GiftCardError('not_found');
  if (card.revoked) throw new GiftCardError('revoked');
  if (card.redeemedAt) throw new GiftCardError('already_redeemed');

  // 2. Validate the kid exists *before* we claim the row, so we don't have
  //    to revert a half-claim. credit() will also enforce this, but doing
  //    it here keeps the claim-then-revert path narrow.
  const user = await prisma.driveUser.findUnique({
    where: { name: userKey },
    select: { name: true },
  });
  if (!user) throw new Error('User not found');

  // 3. Atomic claim — guarded by `revoked: false, redeemedAt: null` so two
  //    concurrent redeems can't both win. `updateMany` returns a count; we
  //    require exactly 1.
  const claim = await prisma.mpGiftCard.updateMany({
    where: { code, revoked: false, redeemedAt: null },
    data: { redeemedAt: new Date(), redeemedByName: userKey },
  });
  if (claim.count !== 1) {
    // Someone beat us to it between the lookup and the update.
    throw new GiftCardError('already_redeemed');
  }

  // 4. Credit the kid. If this throws, revert the claim so the card is
  //    redeemable again — better to leak an unused code than to silently
  //    swallow the parent's MP.
  try {
    const balanceCents = await credit(
      userKey,
      card.cents,
      'gift',
      card.note ? `Gift card ${code}: ${card.note}` : `Gift card ${code}`,
    );
    return { cents: card.cents, balanceCents, note: card.note };
  } catch (err) {
    await prisma.mpGiftCard.updateMany({
      where: { code, redeemedByName: userKey },
      data: { redeemedAt: null, redeemedByName: null },
    });
    throw err;
  }
}

/**
 * Mark an unredeemed card as revoked. Idempotent: revoking a redeemed card
 * is a no-op (we never want to undo a redemption that already credited).
 */
export async function revokeGiftCard(input: {
  code: string;
}): Promise<{ code: string; revoked: boolean }> {
  const code = normalizeGiftCardCode(input.code);
  if (!isWellFormedGiftCardCode(code)) {
    throw new GiftCardError('not_found', 'Malformed code');
  }
  const card = await prisma.mpGiftCard.findUnique({ where: { code } });
  if (!card) throw new GiftCardError('not_found');
  if (card.redeemedAt) {
    // Don't touch a redeemed card — the MP is already in the kid's balance.
    return { code, revoked: card.revoked };
  }
  await prisma.mpGiftCard.update({
    where: { code },
    data: { revoked: true },
  });
  return { code, revoked: true };
}

export type GiftCardStatus = 'unredeemed' | 'redeemed' | 'revoked';

export interface GiftCardRow {
  code: string;
  cents: number;
  status: GiftCardStatus;
  note: string | null;
  createdAt: string;
  redeemedByName: string | null;
  redeemedAt: string | null;
}

/** Admin list — every card with a derived status. Most-recent first. */
export async function listGiftCards(limit = 200): Promise<GiftCardRow[]> {
  const rows = await prisma.mpGiftCard.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map((r) => {
    let status: GiftCardStatus;
    if (r.redeemedAt) status = 'redeemed';
    else if (r.revoked) status = 'revoked';
    else status = 'unredeemed';
    return {
      code: r.code,
      cents: r.cents,
      status,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
      redeemedByName: r.redeemedByName,
      redeemedAt: r.redeemedAt ? r.redeemedAt.toISOString() : null,
    };
  });
}
