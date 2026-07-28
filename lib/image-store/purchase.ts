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
//
// Ownership is FOREVER: re-downloads are free and never re-charged, so there is
// no consume/expire path here by design.

import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { normalizeUser } from '../drive-progress';
import { InsufficientFundsError } from '../money/balance';
import { getImageById, type ImageStoreEntry } from './catalog';

// ---------------------------------------------------------------------------
// Result shapes — every failure is a VALUE, not an exception, so the route can
// turn each one into a kid-readable sentence instead of a 500.
// ---------------------------------------------------------------------------

export type PurchaseStatus =
  | 'purchased'
  | 'already-owned'
  | 'insufficient-funds'
  | 'unknown-image'
  | 'unknown-user';

export type PurchaseResult =
  | {
      ok: true;
      status: 'purchased';
      imageId: string;
      title: string;
      pricePaidCents: number;
      balanceCents: number;
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
  | { ok: false; status: 'unknown-user'; imageId: string };

class UserNotFoundError extends Error {
  constructor() {
    super('User not found');
    this.name = 'UserNotFoundError';
  }
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
export async function purchaseImage(rawUser: string, imageId: unknown): Promise<PurchaseResult> {
  const userKey = normalizeUser(rawUser);
  const entry: ImageStoreEntry | null = getImageById(imageId);
  const requestedId = typeof imageId === 'string' ? imageId.trim() : '';

  if (!entry) return { ok: false, status: 'unknown-image', imageId: requestedId };
  if (!userKey) return { ok: false, status: 'unknown-user', imageId: entry.id };

  // Price NEVER comes from the caller. This is the whole point of the module.
  const priceCents = entry.priceCents;

  try {
    const balanceCents = await prisma.$transaction(async (tx) => {
      // 1. The kid must exist before anything moves.
      const user = await tx.driveUser.findUnique({
        where: { name: userKey },
        select: { balanceCents: true },
      });
      if (!user) throw new UserNotFoundError();

      // 2. Funds check inside the transaction, against the row we just read.
      if (user.balanceCents < priceCents) {
        throw new InsufficientFundsError(user.balanceCents, priceCents);
      }

      // 3. Debit.
      const updated = await tx.driveUser.update({
        where: { name: userKey },
        data: { balanceCents: { decrement: priceCents } },
        select: { balanceCents: true },
      });

      // 4. Ledger row — same transaction as the debit, always.
      await tx.mpTransaction.create({
        data: {
          userName: userKey,
          cents: -priceCents,
          type: 'spend',
          reason: `Image store: ${entry.title}`,
        },
      });

      // 5. Entitlement LAST, so a duplicate (P2002 on the composite unique)
      //    aborts the transaction before any money is allowed to stick.
      await tx.imagePurchase.create({
        data: { userName: userKey, imageId: entry.id, pricePaidCents: priceCents },
      });

      return updated.balanceCents;
    });

    return {
      ok: true,
      status: 'purchased',
      imageId: entry.id,
      title: entry.title,
      pricePaidCents: priceCents,
      balanceCents,
    };
  } catch (err) {
    if (isUniqueViolation(err)) {
      // Safe to read a P2002 from THIS transaction as "already owned": the only
      // unique-constrained write inside it is the ImagePurchase create. The
      // driveUser update is keyed by primary key and touches balanceCents only
      // (no unique column), and MpTransaction has no unique at all — so there
      // is no other constraint this catch could be swallowing.
      //
      // Nothing was charged: the transaction rolled back, so report the
      // untouched balance.
      return {
        ok: false,
        status: 'already-owned',
        imageId: entry.id,
        title: entry.title,
        balanceCents: await currentBalance(userKey),
      };
    }
    if (err instanceof InsufficientFundsError) {
      return {
        ok: false,
        status: 'insufficient-funds',
        imageId: entry.id,
        title: entry.title,
        priceCents,
        balanceCents: err.balanceCents,
        shortfallCents: Math.max(0, priceCents - err.balanceCents),
      };
    }
    if (err instanceof UserNotFoundError) {
      return { ok: false, status: 'unknown-user', imageId: entry.id };
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Entitlement reads
// ---------------------------------------------------------------------------

/**
 * THE security boundary for downloads. A missing row means "not owned" — there
 * is no admin bypass and no "it's only a picture" shortcut here.
 */
export async function ownsImage(rawUser: string, imageId: unknown): Promise<boolean> {
  const userKey = normalizeUser(rawUser);
  const id = typeof imageId === 'string' ? imageId.trim() : '';
  if (!userKey || !id) return false;
  const row = await prisma.imagePurchase.findUnique({
    where: { userName_imageId: { userName: userKey, imageId: id } },
    select: { id: true },
  });
  return row !== null;
}

export interface OwnedImage {
  imageId: string;
  pricePaidCents: number;
  createdAt: Date;
}

/** Everything this kid owns, newest first. */
export async function listPurchases(rawUser: string): Promise<OwnedImage[]> {
  const userKey = normalizeUser(rawUser);
  if (!userKey) return [];
  const rows = await prisma.imagePurchase.findMany({
    where: { userName: userKey },
    orderBy: { createdAt: 'desc' },
    select: { imageId: true, pricePaidCents: true, createdAt: true },
  });
  return rows.map((r) => ({
    imageId: r.imageId,
    pricePaidCents: r.pricePaidCents,
    createdAt: r.createdAt,
  }));
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
