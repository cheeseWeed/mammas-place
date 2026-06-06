// MP Gifts — kid-to-kid (and admin) MP transfers, a NEW flow distinct from the
// printable single-use MpGiftCard codes (lib/money/gift-card.ts).
//
// Flows:
//   - A kid sends MP to another kid. The MP is debited from the SENDER's
//     balance immediately (balance.ts debit; rejects on insufficient funds).
//   - An admin sends MP. Admin is a FREE top-up source — no one is debited.
//   - Delivery is IMMEDIATE (recipient credited now) or SCHEDULED for a future
//     `deliverAt` (held until that date, then credited to the recipient).
//
// No cron on this stack, so delivery is LAZY. deliverDueGifts() runs on the
// recipient's balance/portal read path and credits any due-but-undelivered
// gifts. The delivered flag is flipped with an updateMany guarded on
// `delivered: false` so a gift can never double-credit even under concurrent
// reads — exactly like gift-card.ts claims a card with updateMany.

import { prisma } from '../prisma';
import { credit, debit, InsufficientFundsError } from './balance';
import { normalizeUser } from '../drive-progress';

const MAX_CENTS = 1_000_000; // sanity cap: 10,000 MP per gift (mirrors gift-card.ts)
const MAX_NOTE_LEN = 200;

export class GiftError extends Error {
  constructor(
    public kind:
      | 'bad_amount'
      | 'bad_recipient'
      | 'recipient_not_found'
      | 'self_gift'
      | 'insufficient_funds',
    message?: string,
  ) {
    super(message ?? kind);
    this.name = 'GiftError';
  }
}

export interface GiftRow {
  id: string;
  senderUser: string | null;
  recipientUser: string;
  cents: number;
  note: string | null;
  deliverAt: string;
  delivered: boolean;
  deliveredAt: string | null;
  createdAt: string;
}

function toRow(r: {
  id: string;
  senderUser: string | null;
  recipientUser: string;
  cents: number;
  note: string | null;
  deliverAt: Date;
  delivered: boolean;
  deliveredAt: Date | null;
  createdAt: Date;
}): GiftRow {
  return {
    id: r.id,
    senderUser: r.senderUser,
    recipientUser: r.recipientUser,
    cents: r.cents,
    note: r.note,
    deliverAt: r.deliverAt.toISOString(),
    delivered: r.delivered,
    deliveredAt: r.deliveredAt ? r.deliveredAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  };
}

/**
 * Lazy delivery. Finds the recipient's undelivered gifts whose deliverAt has
 * passed and credits each one. The credit is guarded by an updateMany filtered
 * on `delivered: false` so two concurrent reads can't both win — only the call
 * that flips the row from false→true proceeds to credit(). Returns the gifts
 * that THIS call actually delivered (so callers can show a "you got a gift!"
 * surprise on first arrival).
 */
export async function deliverDueGifts(rawUser: string): Promise<GiftRow[]> {
  const userKey = normalizeUser(rawUser);
  if (!userKey) return [];

  const now = new Date();
  const due = await prisma.mpGift.findMany({
    where: { recipientUser: userKey, delivered: false, deliverAt: { lte: now } },
    orderBy: { deliverAt: 'asc' },
  });
  if (!due.length) return [];

  const delivered: GiftRow[] = [];
  for (const gift of due) {
    // Atomic claim: flip delivered false→true. Only one caller can win this
    // for a given row, so credit() runs at most once per gift.
    const claim = await prisma.mpGift.updateMany({
      where: { id: gift.id, delivered: false },
      data: { delivered: true, deliveredAt: now },
    });
    if (claim.count !== 1) continue; // someone else delivered it concurrently

    try {
      const fromLabel = gift.senderUser ?? 'Mamma';
      const reason = gift.note
        ? `Gift from ${fromLabel}: ${gift.note}`
        : `Gift from ${fromLabel}`;
      await credit(userKey, gift.cents, 'gift', reason);
      delivered.push(toRow({ ...gift, delivered: true, deliveredAt: now }));
    } catch (err) {
      // Credit failed (e.g. recipient deleted between claim and credit) —
      // revert the claim so it can be retried on the next read rather than
      // silently swallowing the MP.
      await prisma.mpGift.updateMany({
        where: { id: gift.id, delivered: true, deliveredAt: now },
        data: { delivered: false, deliveredAt: null },
      });
      throw err;
    }
  }
  return delivered;
}

/**
 * Send a gift. `senderUser` null = admin (free top-up; no debit). A non-null
 * sender is debited immediately (the points leave them at SEND time, even for
 * scheduled gifts). If deliverAt is omitted / now / in the past, the gift is
 * delivered (recipient credited) right away.
 *
 * Throws GiftError on validation failures. Returns the created gift + whether
 * it was scheduled for the future.
 */
export async function sendGift(input: {
  senderUser: string | null; // null = admin
  toUser: string;
  cents: number;
  note?: string | null;
  deliverAt?: Date | null;
}): Promise<{ gift: GiftRow; scheduled: boolean }> {
  const { cents } = input;
  if (!Number.isInteger(cents) || cents <= 0 || cents > MAX_CENTS) {
    throw new GiftError('bad_amount', 'Amount must be a positive whole number (≤ 10,000 MP)');
  }

  const recipientKey = normalizeUser(input.toUser);
  if (!recipientKey) {
    throw new GiftError('bad_recipient', 'Pick someone to send to');
  }

  const senderKey = input.senderUser ? normalizeUser(input.senderUser) : null;
  if (senderKey && senderKey === recipientKey) {
    throw new GiftError('self_gift', "You can't send a gift to yourself");
  }

  // Recipient must exist.
  const recipient = await prisma.driveUser.findUnique({
    where: { name: recipientKey },
    select: { name: true },
  });
  if (!recipient) {
    throw new GiftError('recipient_not_found', "We couldn't find that person");
  }

  const trimmedNote =
    typeof input.note === 'string' ? input.note.trim().slice(0, MAX_NOTE_LEN) : '';
  const note = trimmedNote.length > 0 ? trimmedNote : null;

  const now = new Date();
  const requested = input.deliverAt instanceof Date && !Number.isNaN(input.deliverAt.getTime())
    ? input.deliverAt
    : now;
  // A past/now date means "deliver immediately" — clamp to now so deliverAt
  // <= now and the lazy/eager delivery path picks it up.
  const scheduled = requested.getTime() > now.getTime();
  const deliverAt = scheduled ? requested : now;

  // 1. Debit the sender FIRST (the MP leaves them at send time). Admin sends
  //    skip this — admin is a free top-up source. If the debit fails the gift
  //    is never created, so we never leak points.
  if (senderKey) {
    try {
      await debit(
        senderKey,
        cents,
        'gift',
        note
          ? `Gift to ${recipientKey}: ${note}`
          : `Gift to ${recipientKey}`,
      );
    } catch (err) {
      if (err instanceof InsufficientFundsError) {
        throw new GiftError('insufficient_funds', "You don't have enough MP for that gift");
      }
      throw err;
    }
  }

  // 2. Create the gift row. If this throws after a debit, refund the sender so
  //    their MP isn't lost.
  let created;
  try {
    created = await prisma.mpGift.create({
      data: {
        senderUser: senderKey,
        recipientUser: recipientKey,
        cents,
        note,
        deliverAt,
        delivered: false,
      },
    });
  } catch (err) {
    if (senderKey) {
      await credit(
        senderKey,
        cents,
        'refund',
        `Refund: gift to ${recipientKey} could not be sent`,
      ).catch(() => {});
    }
    throw err;
  }

  // 3. Immediate gifts deliver-on-send (eager credit). Scheduled gifts wait
  //    for the recipient's read path to pick them up via deliverDueGifts().
  if (!scheduled) {
    await deliverDueGifts(recipientKey);
    const fresh = await prisma.mpGift.findUnique({ where: { id: created.id } });
    return { gift: toRow(fresh ?? created), scheduled: false };
  }

  return { gift: toRow(created), scheduled: true };
}

/**
 * For the logged-in user's gift page:
 *   - received: gifts delivered TO me (newest delivered first).
 *   - sentPending: my scheduled gifts not yet delivered (soonest first).
 * Callers should run deliverDueGifts(me) first so newly-due gifts move from
 * the recipient's "pending" into "received" before this reads.
 */
export async function getMyGifts(rawUser: string): Promise<{
  received: GiftRow[];
  sentPending: GiftRow[];
}> {
  const userKey = normalizeUser(rawUser);
  if (!userKey) return { received: [], sentPending: [] };

  const [received, sentPending] = await Promise.all([
    prisma.mpGift.findMany({
      where: { recipientUser: userKey, delivered: true },
      orderBy: { deliveredAt: 'desc' },
      take: 50,
    }),
    prisma.mpGift.findMany({
      where: { senderUser: userKey, delivered: false },
      orderBy: { deliverAt: 'asc' },
      take: 50,
    }),
  ]);

  return {
    received: received.map(toRow),
    sentPending: sentPending.map(toRow),
  };
}
