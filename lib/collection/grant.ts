// Granting archive artwork for a shop purchase.
//
// "I want everything I buy in my collection." When a kid buys the tire, the
// tire's archive original becomes theirs — no extra charge, no second checkout.
//
// ---------------------------------------------------------------------------
// WHY THIS RUNS *AFTER* placeOrder AND NOT INSIDE IT
// ---------------------------------------------------------------------------
//
// placeOrder (lib/money/balance.ts) is the money guard: the MpOrder row, the
// guarded `updateMany` with `balanceCents: { gte: total }`, the `count === 1`
// check, and the ledger row, all in ONE $transaction. That transaction is
// correct as written and this feature does not get to touch it.
//
// Granting artwork is NOT a money operation — it charges nothing, moves no
// balance, and writes no ledger row. Folding it into the money transaction would
// mean an edition-number collision (P2002 on [imageId, editionNumber], a routine
// and expected event under concurrency) could roll back a SUCCESSFUL, FULLY PAID
// order. Free artwork must never be able to un-buy a tire the kid paid for.
//
// So the grant runs after the order commits, and is allowed to fail: a failed
// grant leaves the purchase intact and is recoverable, because
// scripts/backfill-collection-grants.ts re-derives the exact same keys and can
// grant it later. That is precisely why grantKey is derived from the order
// rather than randomly — see lib/collection/grant-key.ts.
//
// ---------------------------------------------------------------------------
// IDEMPOTENCY
// ---------------------------------------------------------------------------
//
// Every copy carries `grantKey @unique`, derived from (orderId, imageId,
// ordinal). Re-running this for the same order proposes the same keys and every
// one collides, so nothing duplicates. There is NO findFirst-then-create here —
// that is the check-then-act race this codebase refuses everywhere else. The DB
// constraint is the gate.

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { artworkForProduct } from './artwork-match';
import { grantKeyForOrderItem } from './grant-key';
import { effectiveEditionSize } from '@/lib/image-store/editions';

/** Same duck-typed P2002 detection as lib/image-store/purchase.ts. */
function isUniqueViolation(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) return err.code === 'P2002';
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'P2002';
}

/** Did we lose the edition-number race (retry) or hit a duplicate grant (skip)? */
function isEditionCollision(err: unknown): boolean {
  const target = (err as { meta?: { target?: unknown } })?.meta?.target;
  const fields = Array.isArray(target)
    ? target.map(String)
    : typeof target === 'string'
      ? [target]
      : [];
  const joined = fields.join(',').toLowerCase();
  return joined.includes('editionnumber') || joined.includes('edition_number');
}

/** Bounded like purchase.ts — comfortably above any real edition run. */
const EDITION_ASSIGN_MAX_ATTEMPTS = 12;

export interface GrantedCopy {
  imageId: string;
  editionNumber: number;
}

export interface GrantResult {
  granted: GrantedCopy[];
  /** Keys that already existed — a replay, not an error. */
  skipped: number;
  /** Lines whose edition run was fully claimed; nothing to give. */
  soldOut: string[];
}

export interface GrantLine {
  productId: string;
  qty: number;
}

/**
 * Grant the archive artwork for one order's lines.
 *
 * Never throws for an ordinary outcome — a sold-out run, a product with no
 * artwork, and an already-granted replay are all VALUES, because this runs on a
 * checkout path that has already taken the kid's money and must not 500 after a
 * successful purchase.
 */
export async function grantArtworkForOrder(
  rawUser: string,
  orderId: string,
  lines: readonly GrantLine[],
  now: Date = new Date(),
): Promise<GrantResult> {
  const result: GrantResult = { granted: [], skipped: 0, soldOut: [] };
  if (!rawUser || !orderId) return result;

  for (const line of lines) {
    const entry = artworkForProduct(line.productId);
    // No companion artwork — a perfectly normal shop item. It still shows in the
    // collection (buildCollection reads the order line directly); there is just
    // nothing to download.
    if (!entry) continue;

    const qty = Number.isInteger(line.qty) && line.qty > 0 ? line.qty : 1;

    for (let ordinal = 1; ordinal <= qty; ordinal += 1) {
      const grantKey = grantKeyForOrderItem(orderId, entry.id, ordinal);
      let attempt = 0;
      let placed = false;

      while (attempt < EDITION_ASSIGN_MAX_ATTEMPTS && !placed) {
        attempt += 1;
        try {
          // Count is for PRICING/SOLD-OUT only and is explicitly NOT the source
          // of the edition number — same contract as purchase.ts step 2. The
          // number is proposed here and ARBITRATED by the unique index below.
          const sold = await prisma.imagePurchase.count({ where: { imageId: entry.id } });
          const editionSize = effectiveEditionSize(entry, sold, now);
          if (sold >= editionSize) {
            result.soldOut.push(entry.id);
            break;
          }

          await prisma.imagePurchase.create({
            data: {
              userName: rawUser,
              imageId: entry.id,
              // A grant is FREE. The kid paid for the shop product, not for the
              // artwork, and recording a fake price here would be a lie the
              // collection page would then have to display.
              pricePaidCents: 0,
              editionNumber: sold + 1,
              source: 'grant',
              grantOrderId: orderId,
              grantKey,
            },
          });
          result.granted.push({ imageId: entry.id, editionNumber: sold + 1 });
          placed = true;
        } catch (err) {
          if (!isUniqueViolation(err)) throw err;
          if (isEditionCollision(err)) {
            // Somebody claimed that serial in the microseconds we were writing.
            // Retry proposes the next number. Nothing was charged — a grant is
            // free — so a retry is pure upside.
            continue;
          }
          // grantKey collision: this exact copy was already granted. A replay,
          // not a failure.
          result.skipped += 1;
          placed = true;
        }
      }
    }
  }

  return result;
}
