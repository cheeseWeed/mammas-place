// Image-store purchases — money-touching half of the digital store.
//
// MONEY RULES THIS FILE EXISTS TO ENFORCE (CLAUDE.md "MP Money — correctness is
// sacred"):
//   1. Integer cents only. Never a float, never a client-supplied price — the
//      price is read from the CATALOG by id (lib/image-store/catalog.ts).
//   2. Balance decrement + MpTransaction ledger row + ImagePurchase entitlement
//      all commit in ONE prisma.$transaction. Partial success can never strand
//      money or hand out an unpaid entitlement.
//   3. Duplicate buys are stopped by the DB, not by a read. We do NOT
//      findFirst-then-create: two taps on the Buy button race through that
//      window and double-charge. `ImagePurchase @@unique([userName, imageId])`
//      is the gate — a second buy raises Prisma P2002 and the whole
//      transaction (including the debit) rolls back. Exact same reasoning as
//      MpEarning.idempotencyKey in lib/money/earn.ts.
//   4. OVERDRAFT is stopped by the DB too, for the same reason. The funds check
//      is written INTO the debit statement (`updateMany` with
//      `balanceCents: { gte: price }`), never left as a read-then-write pair —
//      see the long note on step 3 of purchaseImage(). Same guarded-updateMany
//      shape as the `delivered: false` claim in lib/money/gift.ts.
//   5. THE EDITION NUMBER is assigned by the DB, not by a count. Every piece is
//      a limited run (lib/image-store/editions.ts); the first buyer gets #1.
//      `@@unique([imageId, editionNumber])` is the gate — see the long note on
//      step 6. A count-then-write would hand two simultaneous buyers the same
//      #1, which is exactly the class of bug rule 3 exists to prevent.
//   6. THE PRICE MOVES with scarcity, and the DISPLAYED price and the CHARGED
//      price are the SAME server-side function (`currentPriceCents`) fed the
//      same inputs. The client still sends only an id.
//
// Ownership is FOREVER: re-downloads are free and never re-charged, so there is
// no consume/expire path here by design.

import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { normalizeUser } from '../drive-progress';
import { InsufficientFundsError } from '../money/balance';
import { getImageById, type ImageStoreEntry } from './catalog';
import { grantKeyForStorePurchase } from '../collection/grant-key';
import {
  currentPriceCents,
  editionStateFor,
  effectiveEditionSize,
  resolvedEditionSize,
} from './editions';

// ---------------------------------------------------------------------------
// Result shapes — every failure is a VALUE, not an exception, so the route can
// turn each one into a kid-readable sentence instead of a 500.
// ---------------------------------------------------------------------------

export type PurchaseStatus =
  | 'purchased'
  | 'already-owned'
  | 'insufficient-funds'
  | 'unknown-image'
  | 'unknown-user'
  | 'sold-out';

export type PurchaseResult =
  | {
      ok: true;
      status: 'purchased';
      imageId: string;
      title: string;
      pricePaidCents: number;
      balanceCents: number;
      /** The rookie number this kid just claimed. 1 = first ever sold. */
      editionNumber: number;
      /** How many copies exist in total, for "#1 of 6" copy. */
      editionSize: number;
    }
  | {
      ok: false;
      status: 'already-owned';
      imageId: string;
      title: string;
      balanceCents: number;
    }
  | {
      ok: false;
      status: 'insufficient-funds';
      imageId: string;
      title: string;
      priceCents: number;
      balanceCents: number;
      /** Exactly how much more MP the kid needs — drives the "you need 2.50MP more" copy. */
      shortfallCents: number;
    }
  | { ok: false; status: 'unknown-image'; imageId: string }
  | { ok: false; status: 'unknown-user'; imageId: string }
  | {
      ok: false;
      status: 'sold-out';
      imageId: string;
      title: string;
      editionSize: number;
      /** Whole weeks until this piece MIGHT come back. Infinity = never. */
      weeksUntilRestock: number;
      /** True for a misprint — it is gone for good, and we say so plainly. */
      oneOfOne: boolean;
      balanceCents: number;
    };

class UserNotFoundError extends Error {
  constructor() {
    super('User not found');
    this.name = 'UserNotFoundError';
  }
}

/** The whole edition has been claimed. Thrown to roll the transaction back. */
class SoldOutError extends Error {
  constructor(readonly editionSize: number) {
    super('Edition sold out');
    this.name = 'SoldOutError';
  }
}

/**
 * How many times we will retry after losing an edition-number race before
 * giving up. Each retry means another kid committed a purchase of the SAME
 * picture in the microseconds we were mid-transaction, so in a family-sized app
 * this loop realistically runs once. The bound exists so a pathological case
 * cannot spin forever; it is comfortably larger than the biggest edition run
 * (MAX_EDITION_SIZE), so a retry budget can never be the thing that sells out
 * a run.
 */
const EDITION_ASSIGN_MAX_ATTEMPTS = 12;

/**
 * Did this P2002 come from the [imageId, editionNumber] unique (we lost the
 * rookie-number race and should RETRY), or from [userName, imageId] (a genuine
 * duplicate buy that must NOT retry)?
 *
 * Prisma reports the violated fields in `meta.target`. We must not treat the
 * two the same: retrying a duplicate buy would loop pointlessly, and treating a
 * lost number race as "already owned" would tell a kid they own something they
 * were never charged for.
 *
 * When `meta.target` is unreadable (a driver that does not populate it), we
 * fall back to "not the edition race" — i.e. the SAFE direction. Reporting
 * "you already own this" costs nothing and charges nothing, whereas guessing
 * "retry" on a real duplicate would spin the loop.
 */
function isEditionNumberCollision(err: unknown): boolean {
  const target = (err as { meta?: { target?: unknown } })?.meta?.target;
  const fields = Array.isArray(target)
    ? target.map(String)
    : typeof target === 'string'
      ? [target]
      : [];
  if (fields.length === 0) return false;
  const joined = fields.join(',').toLowerCase();
  return joined.includes('editionnumber') || joined.includes('edition_number');
}

/**
 * Unique-constraint violation? `instanceof` is the primary check (matches
 * earn.ts); the duck-typed fallback covers a transaction wrapper that has
 * re-thrown the error and lost the prototype, which would otherwise let a
 * duplicate surface to the kid as a 500 instead of "you already own this".
 */
function isUniqueViolation(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) return err.code === 'P2002';
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'P2002';
}

async function currentBalance(userKey: string): Promise<number> {
  const row = await prisma.driveUser.findUnique({
    where: { name: userKey },
    select: { balanceCents: true },
  });
  return row?.balanceCents ?? 0;
}

// ---------------------------------------------------------------------------
// Buy
// ---------------------------------------------------------------------------

/**
 * Buy one image for one kid.
 *
 * `rawUser` comes from the dl_user cookie at the route layer — never from a
 * request body — so a kid cannot spend someone else's MP. `imageId` is the only
 * thing the client gets to choose; price, title and tier are all looked up
 * server-side.
 *
 * Callers must apply the Sabbath rule BEFORE calling this (see the buy route):
 * buying is shopping and the shop is closed on Sunday. Viewing and downloading
 * something already owned is not shopping, and stays open.
 */
export async function purchaseImage(
  rawUser: string,
  imageId: unknown,
  /**
   * Optional per-CLICK token making this buy idempotent.
   *
   * WHY IT EXISTS NOW. The duplicate-buy gate used to be
   * @@unique([userName, imageId]) — a kid could hold one copy, full stop, so a
   * double-tapped Buy button collided and the second charge rolled back. That
   * constraint is gone (multiples are a feature now: see prisma/schema.prisma),
   * and with it went the accidental protection. Two taps would otherwise be
   * indistinguishable from "I deliberately want a second copy" and would
   * legitimately charge twice.
   *
   * So the gate is re-aimed at the EVENT rather than the pair: same token = same
   * click = one copy. Omitting it preserves the old call shape for existing
   * callers and tests, at the cost of that protection — which is why the buy
   * route always supplies one.
   */
  idempotencyToken?: string,
): Promise<PurchaseResult> {
  const userKey = normalizeUser(rawUser);
  const entry: ImageStoreEntry | null = getImageById(imageId);
  const requestedId = typeof imageId === 'string' ? imageId.trim() : '';

  if (!entry) return { ok: false, status: 'unknown-image', imageId: requestedId };
  if (!userKey) return { ok: false, status: 'unknown-user', imageId: entry.id };

  const now = new Date();
  // Populated inside the transaction, once `sold` is known: the run size
  // depends on it, because a restock only tops up a run that has SOLD OUT
  // (lib/image-store/editions.ts effectiveEditionSize).
  let editionSize = resolvedEditionSize(entry);

  // Attempt loop. We re-enter the whole transaction on a lost edition-number
  // race — a rollback has already undone our debit, so each attempt starts from
  // a clean slate and can never double-charge.
  let attempt = 0;
  // Populated by the winning attempt so the success payload can report it.
  let assignedEdition = 0;
  let chargedCents = 0;

  // eslint-disable-next-line no-constant-condition
  for (;;) {
    attempt += 1;
    try {
      const outcome = await prisma.$transaction(async (tx) => {
        // 1. The kid must exist before anything moves.
        const user = await tx.driveUser.findUnique({
          where: { name: userKey },
          select: { balanceCents: true },
        });
        if (!user) throw new UserNotFoundError();

        // 2. How many copies have already gone. This count is NOT a gate and is
        //    NOT where the edition number comes from — it is only used to
        //    price the piece and to fail fast on an obviously sold-out run.
        //    The authoritative sold-out and numbering decisions are both made
        //    by the DB in step 6.
        const sold = await tx.imagePurchase.count({ where: { imageId: entry.id } });

        // 3. The run size for THIS moment. A restock only tops up a run that
        //    has already sold out, so this depends on `sold` and must be
        //    computed here rather than before the transaction.
        editionSize = effectiveEditionSize(entry, sold, now);

        // Sold out? Refuse before touching any money. A concurrent buy that
        // takes the last copy between this read and our insert is caught by
        // the unique constraint in step 7, and the retry re-runs this check
        // against the fresh count — so this is a fast, friendly path rather
        // than the real gate.
        if (sold >= editionSize) throw new SoldOutError(editionSize);

        // 4. THE PRICE. Computed server-side from the catalog list price and
        //    how much of the run is gone — the SAME function the store page
        //    called to render it (lib/image-store/editions.ts). The client's
        //    body never contained a price and is never consulted.
        const priceCents = currentPriceCents({ ...entry, editionSize }, sold);

        // Read-only pre-check. This is a UX shortcut, NOT the gate: it lets us
        // report the exact shortfall ("you need 2.50MP more") without writing
        // anything, and it distinguishes "no such kid" from "no money". The
        // real gate is step 5.
        if (user.balanceCents < priceCents) {
          throw new InsufficientFundsError(user.balanceCents, priceCents);
        }

        // 5. CONDITIONAL debit — the DATABASE decides affordability, at the
        //    instant of the write.
        //
        //    Why not `update ... { decrement }` against the balance read in
        //    step 1: Prisma interactive transactions run at Postgres READ
        //    COMMITTED and `findUnique` takes NO row lock. Two buys of two
        //    DIFFERENT images therefore both read the same balance, both pass
        //    the pre-check, and both decrement — the wallet goes negative. The
        //    `@@unique([userName, imageId])` constraint cannot save us here the
        //    way it saves us from double-charging: the image ids differ, so
        //    there is no duplicate to collide on.
        //
        //    Folding `balanceCents: { gte: priceCents }` into the WHERE makes the
        //    check and the decrement ONE statement. Postgres takes a row lock for
        //    the UPDATE, so the second writer blocks until the first commits and
        //    then RE-EVALUATES the WHERE against the newly committed balance. The
        //    loser matches 0 rows, `count` comes back 0, nothing is decremented,
        //    and we roll the whole transaction back. Overdraft becomes
        //    unrepresentable rather than unlikely.
        const debited = await tx.driveUser.updateMany({
          where: { name: userKey, balanceCents: { gte: priceCents } },
          data: { balanceCents: { decrement: priceCents } },
        });
        if (debited.count !== 1) {
          // Lost the race: the MP was spent by a concurrent buy between our read
          // and our write. Re-read so the kid is told what they ACTUALLY have,
          // then throw — which rolls back everything. Nothing was charged.
          const fresh = await tx.driveUser.findUnique({
            where: { name: userKey },
            select: { balanceCents: true },
          });
          throw new InsufficientFundsError(fresh?.balanceCents ?? 0, priceCents);
        }

        // updateMany cannot return the row, so read back the balance our own
        // decrement produced. Inside the transaction we see our own write, and
        // the row lock we just held means no one else's debit slipped in first.
        const updated = await tx.driveUser.findUnique({
          where: { name: userKey },
          select: { balanceCents: true },
        });

        // 6. Ledger row — same transaction as the debit, always.
        await tx.mpTransaction.create({
          data: {
            userName: userKey,
            cents: -priceCents,
            type: 'spend',
            reason: `Image store: ${entry.title} (edition #${sold + 1})`,
          },
        });

        // 7. Entitlement LAST, so any unique violation aborts the transaction
        //    before money is allowed to stick.
        //
        //    THE ROOKIE NUMBER IS ASSIGNED HERE, BY THE DATABASE.
        //
        //    `sold + 1` is a PROPOSAL, not a decision. Two kids buying the same
        //    picture at the same instant both counted `sold === 0` in step 2 —
        //    that SELECT takes no lock under READ COMMITTED, so both genuinely
        //    believe they are first, and any scheme that trusts the count hands
        //    both of them #1.
        //
        //    `@@unique([imageId, editionNumber])` makes that outcome physically
        //    unstorable. Both INSERTs race; exactly ONE commits. The loser gets
        //    P2002 naming `editionNumber`, its whole transaction rolls back
        //    (debit included — it is charged NOTHING), and the outer loop
        //    retries from scratch, re-counting and proposing #2. The retry pays
        //    the freshly-recomputed scarcity price too, which is correct: it is
        //    buying a scarcer copy than the one it lost.
        //
        //    This is the same principle as the guarded updateMany above and as
        //    MpEarning.idempotencyKey: the constraint is the gate, never a read.
        await tx.imagePurchase.create({
          data: {
            userName: userKey,
            imageId: entry.id,
            pricePaidCents: priceCents,
            editionNumber: sold + 1,
            // Bought outright, so the price on this row is a REAL price and the
            // collection page may say so. A grant would say 'grant' and 0.
            source: 'store',
            // One key per BUY EVENT. `idempotencyToken` is supplied by the
            // caller (the buy route derives it from the request) so a
            // double-submitted single click collides here and is refused,
            // while a kid deliberately buying a second copy later passes a new
            // token and legitimately gets one.
            grantKey: idempotencyToken
              ? grantKeyForStorePurchase(userKey, entry.id, idempotencyToken)
              : null,
          },
        });

        return {
          balanceCents: updated?.balanceCents ?? user.balanceCents - priceCents,
          editionNumber: sold + 1,
          priceCents,
        };
      });

      assignedEdition = outcome.editionNumber;
      chargedCents = outcome.priceCents;

      return {
        ok: true,
        status: 'purchased',
        imageId: entry.id,
        title: entry.title,
        pricePaidCents: chargedCents,
        balanceCents: outcome.balanceCents,
        editionNumber: assignedEdition,
        editionSize,
      };
    } catch (err) {
      if (isUniqueViolation(err)) {
        // Which unique did we hit? They mean opposite things.
        //
        // [imageId, editionNumber] — we LOST the rookie-number race. Nothing was
        // charged (the transaction rolled back), the kid still does not own the
        // picture, and the right move is to try again for the next number.
        if (isEditionNumberCollision(err) && attempt < EDITION_ASSIGN_MAX_ATTEMPTS) {
          continue;
        }

        // Not the edition race, so it is the `grantKey` unique — THE SAME CLICK
        // ARRIVING TWICE. (It cannot be anything else: the driveUser debit is
        // filtered by primary key and writes balanceCents only, and
        // MpTransaction carries no unique at all.)
        //
        // Reported as 'already-owned' because that is the honest, kid-readable
        // outcome of a double-tap: the copy from the first tap exists and is
        // theirs. It no longer means "you may only ever hold one" — a fresh
        // click with a fresh token buys a genuine second copy.
        //
        // Nothing was charged for THIS attempt: the transaction rolled back, so
        // report the untouched balance.
        return {
          ok: false,
          status: 'already-owned',
          imageId: entry.id,
          title: entry.title,
          balanceCents: await currentBalance(userKey),
        };
      }
      if (err instanceof SoldOutError) {
        const restock = editionStateFor(entry, err.editionSize, now).restock;
        return {
          ok: false,
          status: 'sold-out',
          imageId: entry.id,
          title: entry.title,
          editionSize: err.editionSize,
          weeksUntilRestock: restock.weeksUntilRestock,
          oneOfOne: err.editionSize <= 1,
          balanceCents: await currentBalance(userKey),
        };
      }
      if (err instanceof InsufficientFundsError) {
        return {
          ok: false,
          status: 'insufficient-funds',
          imageId: entry.id,
          title: entry.title,
          priceCents: err.neededCents,
          balanceCents: err.balanceCents,
          shortfallCents: Math.max(0, err.neededCents - err.balanceCents),
        };
      }
      if (err instanceof UserNotFoundError) {
        return { ok: false, status: 'unknown-user', imageId: entry.id };
      }
      throw err;
    }
  }
}

// ---------------------------------------------------------------------------
// Entitlement reads
// ---------------------------------------------------------------------------

/**
 * THE security boundary for downloads. NO rows means "not owned" — there is no
 * admin bypass and no "it's only a picture" shortcut here.
 *
 * `findFirst`, not `findUnique`: a kid may now hold SEVERAL copies of one
 * picture (the @@unique([userName, imageId]) that made it at most one is gone —
 * see prisma/schema.prisma). The download right is unchanged by that. It asks
 * "do you hold AT LEAST ONE copy?", so owning three grants exactly the same
 * access as owning one, and the boundary neither loosens nor tightens.
 */
export async function ownsImage(rawUser: string, imageId: unknown): Promise<boolean> {
  const userKey = normalizeUser(rawUser);
  const id = typeof imageId === 'string' ? imageId.trim() : '';
  if (!userKey || !id) return false;
  const row = await prisma.imagePurchase.findFirst({
    where: { userName: userKey, imageId: id },
    select: { id: true },
  });
  return row !== null;
}

export interface OwnedImage {
  imageId: string;
  pricePaidCents: number;
  createdAt: Date;
  /** The rookie number on this copy. 1 = the first ever sold. */
  editionNumber: number;
  /**
   * 'store' | 'grant' | 'trade'. Carried so the collection can tell an honest
   * provenance story instead of rendering a granted piece as "bought for 0MP".
   */
  source: string;
  grantOrderId: string | null;
}

/**
 * Every COPY this kid owns, newest first.
 *
 * Returns one element per copy, so a kid holding three tires gets three entries
 * with three different edition numbers — that is the whole point of the
 * multiples model. Callers that want "distinct pictures" must group.
 */
export async function listPurchases(rawUser: string): Promise<OwnedImage[]> {
  const userKey = normalizeUser(rawUser);
  if (!userKey) return [];
  const rows = await prisma.imagePurchase.findMany({
    where: { userName: userKey },
    orderBy: { createdAt: 'desc' },
    select: {
      imageId: true,
      pricePaidCents: true,
      createdAt: true,
      editionNumber: true,
      source: true,
      grantOrderId: true,
    },
  });
  return rows.map((r) => ({
    imageId: r.imageId,
    pricePaidCents: r.pricePaidCents,
    createdAt: r.createdAt,
    source: typeof r.source === 'string' && r.source ? r.source : 'store',
    grantOrderId: r.grantOrderId ?? null,
    // Rows written before editionNumber existed default to 1 in the schema; a
    // null from a driver that has not backfilled still reads as the rookie
    // rather than as 0 (which would render "Edition #0").
    editionNumber: Number.isInteger(r.editionNumber) && r.editionNumber > 0 ? r.editionNumber : 1,
  }));
}

// ---------------------------------------------------------------------------
// Edition reads — how many copies of each piece have gone
// ---------------------------------------------------------------------------

/**
 * How many copies of ONE image have sold. Feeds `editionStateFor` on the detail
 * page, which is what turns it into a price and a "3 of 6 left".
 */
export async function soldCountFor(imageId: unknown): Promise<number> {
  const id = typeof imageId === 'string' ? imageId.trim() : '';
  if (!id) return 0;
  return prisma.imagePurchase.count({ where: { imageId: id } });
}

/**
 * Sold counts for MANY images in ONE query — the store grid renders ~8 cards
 * and must not fire a count per card.
 *
 * Ids absent from the result have sold ZERO copies, which is the correct
 * reading of an empty table (the state this feature ships into: the
 * image_purchases table has no rows yet). Callers should use
 * `map.get(id) ?? 0`, and `soldCountMap` guarantees a 0 for every id asked
 * about so that fallback is never actually needed.
 */
export async function soldCountMap(
  imageIds: readonly string[],
): Promise<Map<string, number>> {
  const ids = Array.from(
    new Set(imageIds.filter((i): i is string => typeof i === 'string' && i.trim().length > 0)),
  ).map((i) => i.trim());

  // Seed every requested id at 0 so an empty table yields a complete, correct
  // map rather than a sparse one.
  const out = new Map<string, number>(ids.map((id) => [id, 0]));
  if (ids.length === 0) return out;

  const rows = await prisma.imagePurchase.groupBy({
    by: ['imageId'],
    where: { imageId: { in: ids } },
    _count: { imageId: true },
  });

  for (const row of rows) {
    out.set(row.imageId, row._count.imageId);
  }
  return out;
}

/** Owned ids as a Set — for "Owned" badges on a grid without N queries. */
export async function ownedImageIds(rawUser: string): Promise<Set<string>> {
  const userKey = normalizeUser(rawUser);
  if (!userKey) return new Set();
  const rows = await prisma.imagePurchase.findMany({
    where: { userName: userKey },
    select: { imageId: true },
  });
  return new Set(rows.map((r) => r.imageId));
}
