// Kid-to-kid TRADING of store-bought artwork — the money-and-entitlement-moving
// half of the image store. Server-only.
//
// WHAT A TRADE IS
// ---------------
// ONE mechanism, two shapes:
//
//   SWAP  — image for image.  offeredImageId <-> wantedImageId,  askCents = 0
//   SALE  — image for MP.     offeredImageId  -> recipient,      askCents > 0
//
// A sale is a trade with MP on one side. That is why there is exactly ONE
// accept path, ONE transaction, and ONE set of race guards: every extra path is
// another place for a kid to pay and receive nothing.
//
// ONLY STORE-BOUGHT PIECES ARE TRADABLE. Both sides of a swap must be existing
// ImagePurchase rows. There is no upload path in this app and none is added
// here — the thing being moved IS the purchase row.
//
// MONEY RULES THIS FILE ENFORCES (CLAUDE.md "MP Money — correctness is sacred")
// ----------------------------------------------------------------------------
//   1. The whole swap is ATOMIC. Entitlement moves, MP moves, and BOTH ledger
//      rows commit together or not at all, in one prisma.$transaction. A kid
//      can never pay and receive nothing, and can never hold an image nobody
//      paid for.
//   2. Integer cents only. `askCents` is validated to a non-negative integer at
//      propose time and is never re-read from a request body at accept time.
//   3. Every MP movement writes an MpTransaction row IN THE SAME TRANSACTION.
//      Two rows per paid trade: a 'spend' for the payer, a 'gift' for the payee.
//   4. Sufficiency is decided by the DATABASE at the instant of the write —
//      the guarded-updateMany pattern from lib/money/balance.ts. NEVER a
//      read-then-write: Prisma interactive transactions run at Postgres READ
//      COMMITTED and findUnique takes no row lock, so two concurrent spends
//      both read the same balance, both pass a check, and both decrement.
//   5. THE EDITION NUMBER TRAVELS WITH THE IMAGE. The entitlement is MOVED by
//      updating ImagePurchase.userName, not by delete+create, so the row keeps
//      its editionNumber. Trade away Edition #1 and the recipient holds
//      Edition #1. That is the entire point of a rookie card: the number is a
//      property of the copy, not of the kid who happens to hold it.
//   6. The GIVER LOSES the entitlement. Transfer is what makes ownership real.
//      There is no copy, no shared claim, and no shop buy-back.
//
// THE EDGE CASE THAT WOULD OTHERWISE 500 — see canReceive() below.

import 'server-only';
import { prisma } from '../prisma';
import { normalizeUser } from '../drive-progress';
import { getImageById } from './catalog';

// ---------------------------------------------------------------------------
// Tunable policy
// ---------------------------------------------------------------------------

/**
 * ADMIN-APPROVAL THRESHOLD. A trade whose MP leg is this large or larger is
 * created 'blocked' instead of 'pending' and cannot be accepted until a parent
 * approves it (which flips it back to 'pending').
 *
 * TUNE THIS ONE NUMBER. 20MP is roughly "more than a couple of afternoons of
 * math", i.e. big enough that a parent should see it before a seven-year-old
 * talks a five-year-old out of their savings. Set to Infinity to require
 * approval for nothing; set to 0 to require it for everything including swaps.
 *
 * Note this gates the MP leg only. A pure swap (askCents 0) is never blocked by
 * amount — no MP moves, and both parents see it in the ledger either way.
 */
export const TRADE_APPROVAL_THRESHOLD_CENTS = 2000;

/** Longest a kid's note may be. Kept short — it renders on a card. */
export const MAX_TRADE_NOTE_LENGTH = 200;

/**
 * Hard ceiling on the MP leg of a single trade. Not a policy statement so much
 * as an overflow guard: askCents is an Int column, and a kid should never be
 * able to propose a number that cannot be represented. 1,000,000 MP.
 */
export const MAX_ASK_CENTS = 100_000_000;

/** A trade is live (acceptable / declinable) only in this status. */
export const LIVE_STATUS = 'pending' as const;

export type TradeStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'blocked';

// ---------------------------------------------------------------------------
// Result shapes — every failure is a VALUE, not an exception, so a route can
// turn each one into a kid-readable sentence instead of a 500. Same contract as
// lib/image-store/purchase.ts.
// ---------------------------------------------------------------------------

export type ProposeStatus =
  | 'proposed'
  | 'needs-approval'
  | 'unknown-user'
  | 'unknown-image'
  | 'self-trade'
  | 'not-owned'
  | 'recipient-missing-wanted'
  | 'proposer-already-owns-wanted'
  | 'recipient-already-owns-offered'
  | 'bad-ask';

export type ProposeResult =
  | {
      ok: true;
      status: 'proposed' | 'needs-approval';
      tradeId: string;
      /** True when a parent must approve before the recipient may accept. */
      needsApproval: boolean;
      proposerUser: string;
      recipientUser: string;
      offeredImageId: string;
      wantedImageId: string | null;
      askCents: number;
    }
  | { ok: false; status: Exclude<ProposeStatus, 'proposed' | 'needs-approval'>; message: string };

export type AcceptStatus =
  | 'accepted'
  | 'not-found'
  | 'not-yours'
  | 'not-live'
  | 'needs-approval'
  | 'stale-offer'
  | 'stale-wanted'
  | 'insufficient-funds'
  | 'proposer-already-owns-wanted'
  | 'recipient-already-owns-offered'
  | 'unknown-user';

export type AcceptResult =
  | {
      ok: true;
      status: 'accepted';
      tradeId: string;
      offeredImageId: string;
      wantedImageId: string | null;
      askCents: number;
      /** The edition number that came ACROSS to the accepter. */
      offeredEditionNumber: number;
      /** The edition number that went the other way, for a swap. */
      wantedEditionNumber: number | null;
      /** The accepter's balance after the trade. */
      balanceCents: number;
    }
  | {
      ok: false;
      status: 'insufficient-funds';
      tradeId: string;
      askCents: number;
      balanceCents: number;
      shortfallCents: number;
      message: string;
    }
  | { ok: false; status: Exclude<AcceptStatus, 'accepted' | 'insufficient-funds'>; message: string };

// ---------------------------------------------------------------------------
// Internal control-flow errors. Thrown to ROLL THE TRANSACTION BACK, then
// mapped to a result value by the caller. Nothing escapes as a 500.
// ---------------------------------------------------------------------------

class TradeAbort extends Error {
  constructor(
    readonly status: Exclude<AcceptStatus, 'accepted'>,
    readonly detail: { balanceCents?: number } = {},
  ) {
    super(`Trade aborted: ${status}`);
    this.name = 'TradeAbort';
  }
}

// ---------------------------------------------------------------------------
// THE EDGE CASE: the recipient already owns a different edition of that piece
// ---------------------------------------------------------------------------
//
// `ImagePurchase @@unique([userName, imageId])` means a kid may hold AT MOST ONE
// copy of a given picture. So if Hailey already owns Rainbow Pony (say Edition
// #4) and Shepherd tries to trade her his Rainbow Pony Edition #1, moving the
// row would violate that unique and Postgres would raise P2002.
//
// THE DECISION: the trade is REFUSED, and it is refused at BOTH propose time
// and accept time.
//
//   * Refused, not allowed. Letting a kid hold two editions of one piece would
//     require dropping @@unique([userName, imageId]) — the constraint that is
//     the entire duplicate-buy gate in purchase.ts. Trading must not weaken the
//     buying rules. "One copy per kid" also happens to be the honest reading of
//     a collection: you own the pony, and it has a number.
//
//   * Refused, not silently merged. Auto-discarding the loser edition would
//     destroy a rookie card — the one thing in this system a kid is meant to be
//     able to keep forever. Nothing here deletes an entitlement.
//
//   * At PROPOSE time, so the kid gets a plain sentence ("Hailey already has a
//     Rainbow Pony") instead of building an offer that can never work.
//
//   * AND at ACCEPT time, because propose-time is only a read and the world
//     moves: Hailey can buy her own Rainbow Pony in the minutes between the
//     offer and the tap. Accept-time is the REAL gate, it runs inside the
//     transaction, and it turns a would-be P2002 into a friendly refusal
//     instead of a 500. Both parties are checked — for a swap, the collision
//     can land on either side.
//
// This is the same layering as purchase.ts: a friendly pre-check for the
// message, and a hard gate at the write for the truth.

/**
 * Can `userKey` receive `imageId` — i.e. do they NOT already own a copy?
 *
 * `tx` is the transaction client at accept time and the plain client at propose
 * time. The read is the same; only its transactional context differs.
 */
/**
 * The narrow slice of the Prisma client this helper needs. Declared structurally
 * so the SAME function accepts both the top-level client (propose time) and the
 * transaction client (accept time) — they differ in type but not in this shape.
 */
type PurchaseReader = Pick<typeof prisma, 'imagePurchase'>;

async function canReceive(
  tx: PurchaseReader,
  userKey: string,
  imageId: string,
): Promise<boolean> {
  const existing = await tx.imagePurchase.findUnique({
    where: { userName_imageId: { userName: userKey, imageId } },
    select: { id: true },
  });
  return existing === null;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function cleanNote(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().slice(0, MAX_TRADE_NOTE_LENGTH);
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * A valid MP leg: a non-negative integer number of cents inside the ceiling.
 * Returns null for anything else — floats, negatives, NaN, strings, Infinity.
 *
 * NEGATIVE IS REJECTED, not clamped. A negative ask would invert the debit and
 * credit the proposer's wallet from the recipient's, i.e. mint MP by proposing
 * a trade nobody has to accept carefully.
 */
function coerceAskCents(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : NaN;
  if (!Number.isInteger(n)) return null;
  if (n < 0 || n > MAX_ASK_CENTS) return null;
  return n;
}

/** Human label for a piece, falling back to the raw id for retired art. */
export function titleFor(imageId: string | null | undefined): string {
  if (!imageId) return 'MP';
  return getImageById(imageId)?.title ?? imageId;
}

// ---------------------------------------------------------------------------
// Propose
// ---------------------------------------------------------------------------

export interface ProposeInput {
  /** The piece the proposer is giving up. Must be one they own. */
  offeredImageId: unknown;
  /** The piece they want back. Null/omitted = they want MP instead (a SALE). */
  wantedImageId?: unknown;
  /** MP they are asking for, in cents. 0 for a pure swap. */
  askCents?: unknown;
  note?: unknown;
}

/**
 * Propose a trade. `rawProposer` comes from the dl_user cookie at the route
 * layer — NEVER from a request body — so nobody can propose on another kid's
 * behalf or give away someone else's art.
 *
 * Everything checked here is checked AGAIN inside acceptTrade's transaction.
 * These checks exist to give a kid a readable sentence at the moment they build
 * the offer; they are not the gate, because the world moves between propose and
 * accept.
 */
export async function proposeTrade(
  rawProposer: string,
  rawRecipient: unknown,
  input: ProposeInput,
): Promise<ProposeResult> {
  const proposer = normalizeUser(rawProposer);
  const recipient = normalizeUser(typeof rawRecipient === 'string' ? rawRecipient : '');

  if (!proposer || !recipient) {
    return { ok: false, status: 'unknown-user', message: 'We need to know who is trading.' };
  }

  // SELF-TRADE. Refused outright. A kid trading with themselves is at best a
  // no-op and at worst a way to move MP between two of their own ledger rows;
  // the entitlement move would also be a same-row update on both sides.
  if (proposer === recipient) {
    return {
      ok: false,
      status: 'self-trade',
      message: 'You cannot trade with yourself! Pick a brother or sister.',
    };
  }

  const offeredId = typeof input.offeredImageId === 'string' ? input.offeredImageId.trim() : '';
  const wantedRaw = typeof input.wantedImageId === 'string' ? input.wantedImageId.trim() : '';
  const wantedId = wantedRaw.length > 0 ? wantedRaw : null;

  if (!offeredId) {
    return { ok: false, status: 'unknown-image', message: 'Pick a picture to trade away.' };
  }

  const askCents = coerceAskCents(input.askCents ?? 0);
  if (askCents === null) {
    return {
      ok: false,
      status: 'bad-ask',
      message: 'That is not a real amount of MP.',
    };
  }
  // A trade must actually be a trade: something has to come back.
  if (!wantedId && askCents === 0) {
    return {
      ok: false,
      status: 'bad-ask',
      message: 'Ask for a picture or for some MP — a trade needs two sides.',
    };
  }

  // Both users must exist.
  const [proposerRow, recipientRow] = await Promise.all([
    prisma.driveUser.findUnique({ where: { name: proposer }, select: { name: true } }),
    prisma.driveUser.findUnique({ where: { name: recipient }, select: { name: true } }),
  ]);
  if (!proposerRow || !recipientRow) {
    return { ok: false, status: 'unknown-user', message: 'We could not find that person.' };
  }

  // OWNERSHIP: you cannot offer what you do not own. Checked here for the
  // message and again inside the accept transaction for the truth.
  const offeredRow = await prisma.imagePurchase.findUnique({
    where: { userName_imageId: { userName: proposer, imageId: offeredId } },
    select: { id: true },
  });
  if (!offeredRow) {
    return {
      ok: false,
      status: 'not-owned',
      message: 'You can only trade pictures you own.',
    };
  }

  if (wantedId) {
    // The other kid has to actually have the thing being asked for.
    const wantedRow = await prisma.imagePurchase.findUnique({
      where: { userName_imageId: { userName: recipient, imageId: wantedId } },
      select: { id: true },
    });
    if (!wantedRow) {
      return {
        ok: false,
        status: 'recipient-missing-wanted',
        message: `They do not have ${titleFor(wantedId)} to trade.`,
      };
    }
    // EDGE CASE, proposer side — see canReceive().
    if (!(await canReceive(prisma, proposer, wantedId))) {
      return {
        ok: false,
        status: 'proposer-already-owns-wanted',
        message: `You already have a ${titleFor(wantedId)}. You can only have one of each picture.`,
      };
    }
  }

  // EDGE CASE, recipient side — see canReceive().
  if (!(await canReceive(prisma, recipient, offeredId))) {
    return {
      ok: false,
      status: 'recipient-already-owns-offered',
      message: `They already have a ${titleFor(offeredId)}. You can only have one of each picture.`,
    };
  }

  // ADMIN APPROVAL. A big MP leg lands 'blocked' and is NOT acceptable until a
  // parent flips it to 'pending'. Decided by the SERVER from the server's own
  // constant — the client never sends a status.
  const needsApproval = askCents >= TRADE_APPROVAL_THRESHOLD_CENTS;

  const trade = await prisma.imageTrade.create({
    data: {
      proposerUser: proposer,
      recipientUser: recipient,
      offeredImageId: offeredId,
      wantedImageId: wantedId,
      askCents,
      note: cleanNote(input.note),
      status: needsApproval ? 'blocked' : LIVE_STATUS,
    },
    select: { id: true },
  });

  return {
    ok: true,
    status: needsApproval ? 'needs-approval' : 'proposed',
    tradeId: trade.id,
    needsApproval,
    proposerUser: proposer,
    recipientUser: recipient,
    offeredImageId: offeredId,
    wantedImageId: wantedId,
    askCents,
  };
}

// ---------------------------------------------------------------------------
// Accept — the one atomic path
// ---------------------------------------------------------------------------

/**
 * Accept a trade. `rawUser` is the dl_user cookie holder, and they must be the
 * RECIPIENT — the proposer already committed by proposing, so the recipient's
 * tap is the second of the two confirmations.
 *
 * EVERYTHING happens inside ONE prisma.$transaction, in this order:
 *
 *   1. CLAIM the trade with an updateMany guarded on `status: 'pending'`.
 *      This is the double-accept and simultaneous-accept gate. Postgres takes
 *      a row lock for the UPDATE, so a second accepter blocks, then re-evaluates
 *      the WHERE against the newly committed 'accepted' status, matches 0 rows,
 *      and rolls back having moved nothing. A read-then-write here would let
 *      two accepts both pass and move the entitlement twice.
 *   2. Re-check the already-owns edge case for BOTH sides, inside the
 *      transaction, so a purchase made since propose time is a friendly refusal
 *      rather than a P2002 500.
 *   3. MOVE the offered entitlement with an updateMany guarded on
 *      `userName: proposer`. STALE OFFER GATE: if the proposer already traded
 *      that piece away, the row no longer bears their name, 0 rows match, and
 *      we roll back. The row's editionNumber is untouched, so THE EDITION
 *      NUMBER TRAVELS.
 *   4. Move the wanted entitlement the other way, same guard, for a swap.
 *   5. Move MP with the guarded-updateMany sufficiency pattern, and write BOTH
 *      ledger rows.
 *
 * Any throw rolls all of it back. There is no ordering of failures that leaves
 * a kid paid-but-empty-handed, because there is only one commit.
 */
export async function acceptTrade(rawUser: string, rawTradeId: unknown): Promise<AcceptResult> {
  const userKey = normalizeUser(rawUser);
  const tradeId = typeof rawTradeId === 'string' ? rawTradeId.trim() : '';

  if (!userKey) {
    return { ok: false, status: 'unknown-user', message: 'Log in to accept a trade.' };
  }
  if (!tradeId) {
    return { ok: false, status: 'not-found', message: 'We could not find that trade.' };
  }

  // Read-only pre-flight, OUTSIDE the transaction, purely so the refusal
  // messages can name the pieces. None of this is a gate.
  const preview = await prisma.imageTrade.findUnique({ where: { id: tradeId } });
  if (!preview) {
    return { ok: false, status: 'not-found', message: 'We could not find that trade.' };
  }
  // BOTH PARTIES CONFIRM: proposing is the first confirmation, accepting is the
  // second, and only the recipient can give it. A proposer "accepting" their own
  // offer would be a one-party trade.
  if (preview.recipientUser !== userKey) {
    return {
      ok: false,
      status: 'not-yours',
      message: 'That trade was not offered to you.',
    };
  }
  if (preview.status === 'blocked') {
    return {
      ok: false,
      status: 'needs-approval',
      message: 'A grown-up needs to say yes to this trade first.',
    };
  }
  if (preview.status !== LIVE_STATUS) {
    return {
      ok: false,
      status: 'not-live',
      message: 'That trade is already finished.',
    };
  }

  const { proposerUser, offeredImageId, wantedImageId, askCents } = preview;

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      // 1. CLAIM. The guarded flip is the double-accept gate.
      //
      //    `status: LIVE_STATUS` in the WHERE means the check and the write are
      //    ONE statement holding a row lock. Two simultaneous accepts (two taps,
      //    two devices) both reach here; exactly one matches a row. The loser
      //    sees count 0 and throws, rolling back before ANY entitlement or MP
      //    has moved. The 'blocked' status is also excluded by this same WHERE,
      //    so an un-approved trade cannot be accepted even if the pre-flight
      //    above were bypassed.
      const claimed = await tx.imageTrade.updateMany({
        where: { id: tradeId, recipientUser: userKey, status: LIVE_STATUS },
        data: { status: 'accepted', resolvedAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw new TradeAbort('not-live');
      }

      // 2. THE ALREADY-OWNS EDGE CASE, re-checked inside the transaction.
      //    Between propose and accept either kid may have BOUGHT the piece they
      //    are about to be given. Moving the row would then violate
      //    @@unique([userName, imageId]) and surface as a P2002 500. Refuse
      //    instead — and roll the claim in step 1 back with it, so the trade
      //    stays 'pending' and is not silently consumed by a failure.
      if (!(await canReceive(tx, userKey, offeredImageId))) {
        throw new TradeAbort('recipient-already-owns-offered');
      }
      if (wantedImageId && !(await canReceive(tx, proposerUser, wantedImageId))) {
        throw new TradeAbort('proposer-already-owns-wanted');
      }

      // 3. MOVE THE OFFERED ENTITLEMENT — proposer -> recipient.
      //
      //    THE STALE-OFFER GATE. `userName: proposerUser` in the WHERE means
      //    the update only lands if the proposer STILL owns it. If they already
      //    traded that exact piece away to somebody else (two pending offers for
      //    the same picture is legal and expected), the row now bears a
      //    different name, 0 rows match, and the whole transaction rolls back —
      //    including the claim in step 1 and any MP in step 5.
      //
      //    UPDATE, not delete+create: the row keeps its `editionNumber`, so
      //    Edition #1 stays Edition #1 in its new owner's hands. It also keeps
      //    `pricePaidCents` and `createdAt`, which is the honest history of the
      //    copy — the piece was bought once, for that price, and has since
      //    changed hands.
      //
      //    Read the edition number FIRST (inside the transaction, so it is the
      //    number we are actually moving) for the success payload and the
      //    ledger reason.
      const offeredRow = await tx.imagePurchase.findUnique({
        where: { userName_imageId: { userName: proposerUser, imageId: offeredImageId } },
        select: { editionNumber: true },
      });
      const movedOffered = await tx.imagePurchase.updateMany({
        where: { userName: proposerUser, imageId: offeredImageId },
        data: { userName: userKey },
      });
      if (movedOffered.count !== 1) {
        throw new TradeAbort('stale-offer');
      }
      const offeredEditionNumber = offeredRow?.editionNumber ?? 1;

      // 4. MOVE THE WANTED ENTITLEMENT the other way — recipient -> proposer.
      //    Same guard, same reasoning: the recipient may have traded it away
      //    since the offer was made, and that must abort the whole thing rather
      //    than hand the proposer's piece over for free.
      let wantedEditionNumber: number | null = null;
      if (wantedImageId) {
        const wantedRow = await tx.imagePurchase.findUnique({
          where: { userName_imageId: { userName: userKey, imageId: wantedImageId } },
          select: { editionNumber: true },
        });
        const movedWanted = await tx.imagePurchase.updateMany({
          where: { userName: userKey, imageId: wantedImageId },
          data: { userName: proposerUser },
        });
        if (movedWanted.count !== 1) {
          throw new TradeAbort('stale-wanted');
        }
        wantedEditionNumber = wantedRow?.editionNumber ?? 1;
      }

      // 5. MONEY. The recipient (accepter) pays the proposer `askCents`.
      let balanceCents = 0;
      if (askCents > 0) {
        // CONDITIONAL debit — the DATABASE decides affordability at the instant
        // of the write. This is the house pattern (lib/money/balance.ts): the
        // sufficiency test lives in the UPDATE's WHERE clause so check and
        // decrement are ONE row-locked statement.
        //
        // THE RACE THIS BEATS: the accepter's MP is spent in the shop between
        // the moment the offer was made and the moment they tap Accept. A
        // read-then-decrement would read the old balance, pass, and drive the
        // wallet negative. Here the loser matches 0 rows and the entire trade —
        // including the entitlement moves in steps 3 and 4 — rolls back.
        const debited = await tx.driveUser.updateMany({
          where: { name: userKey, balanceCents: { gte: askCents } },
          data: { balanceCents: { decrement: askCents } },
        });
        if (debited.count !== 1) {
          // Report what they ACTUALLY have, not the number the offer was built
          // against, then throw to roll everything back. Nothing was charged and
          // no picture moved.
          const fresh = await tx.driveUser.findUnique({
            where: { name: userKey },
            select: { balanceCents: true },
          });
          throw new TradeAbort('insufficient-funds', {
            balanceCents: fresh?.balanceCents ?? 0,
          });
        }

        // The other half of the money. A plain increment is correct here — a
        // credit has no sufficiency condition to fail, and the row cannot go
        // negative by being paid.
        const credited = await tx.driveUser.updateMany({
          where: { name: proposerUser },
          data: { balanceCents: { increment: askCents } },
        });
        if (credited.count !== 1) {
          // The proposer's account vanished mid-trade. Roll back rather than
          // leave the accepter's MP debited into nowhere.
          throw new TradeAbort('unknown-user');
        }

        // BOTH LEDGER ROWS, same transaction as the balance moves. Never one
        // without the other, and never outside this transaction.
        const label = titleFor(offeredImageId);
        await tx.mpTransaction.create({
          data: {
            userName: userKey,
            cents: -askCents,
            type: 'spend',
            reason: `Trade: bought ${label} (edition #${offeredEditionNumber}) from ${proposerUser}`,
          },
        });
        await tx.mpTransaction.create({
          data: {
            userName: proposerUser,
            cents: askCents,
            type: 'gift',
            reason: `Trade: sold ${label} (edition #${offeredEditionNumber}) to ${userKey}`,
          },
        });

        // updateMany cannot return the row, so read back the balance OUR
        // decrement produced. Inside the transaction we see our own write.
        const updated = await tx.driveUser.findUnique({
          where: { name: userKey },
          select: { balanceCents: true },
        });
        balanceCents = updated?.balanceCents ?? 0;
      } else {
        const row = await tx.driveUser.findUnique({
          where: { name: userKey },
          select: { balanceCents: true },
        });
        balanceCents = row?.balanceCents ?? 0;
      }

      // Snapshot the numbers that moved so history can render without
      // re-deriving from rows that may change hands again.
      await tx.imageTrade.updateMany({
        where: { id: tradeId },
        data: { offeredEditionNumber, wantedEditionNumber },
      });

      return { offeredEditionNumber, wantedEditionNumber, balanceCents };
    });

    return {
      ok: true,
      status: 'accepted',
      tradeId,
      offeredImageId,
      wantedImageId,
      askCents,
      offeredEditionNumber: outcome.offeredEditionNumber,
      wantedEditionNumber: outcome.wantedEditionNumber,
      balanceCents: outcome.balanceCents,
    };
  } catch (err) {
    if (err instanceof TradeAbort) {
      return abortToResult(err, tradeId, askCents, offeredImageId, wantedImageId);
    }
    throw err;
  }
}

function abortToResult(
  err: TradeAbort,
  tradeId: string,
  askCents: number,
  offeredImageId: string,
  wantedImageId: string | null,
): AcceptResult {
  switch (err.status) {
    case 'insufficient-funds': {
      const balanceCents = err.detail.balanceCents ?? 0;
      return {
        ok: false,
        status: 'insufficient-funds',
        tradeId,
        askCents,
        balanceCents,
        shortfallCents: Math.max(0, askCents - balanceCents),
        message: 'You do not have enough MP for this trade any more. Nothing was taken.',
      };
    }
    case 'stale-offer':
      return {
        ok: false,
        status: 'stale-offer',
        message: `They do not have ${titleFor(offeredImageId)} any more — it was traded to somebody else. Nothing was taken.`,
      };
    case 'stale-wanted':
      return {
        ok: false,
        status: 'stale-wanted',
        message: `You do not have ${titleFor(wantedImageId)} any more. Nothing was taken.`,
      };
    case 'recipient-already-owns-offered':
      return {
        ok: false,
        status: 'recipient-already-owns-offered',
        message: `You already have a ${titleFor(offeredImageId)}. You can only have one of each picture, so this trade cannot happen.`,
      };
    case 'proposer-already-owns-wanted':
      return {
        ok: false,
        status: 'proposer-already-owns-wanted',
        message: `They already have a ${titleFor(wantedImageId)}. You can only have one of each picture, so this trade cannot happen.`,
      };
    case 'not-live':
      return {
        ok: false,
        status: 'not-live',
        message: 'That trade was already finished. Nothing was taken.',
      };
    default:
      return { ok: false, status: err.status, message: 'That trade could not be finished.' };
  }
}

// ---------------------------------------------------------------------------
// Decline / cancel — the cheap half
// ---------------------------------------------------------------------------

export type ResolveResult =
  | { ok: true; status: 'declined' | 'cancelled'; tradeId: string }
  | { ok: false; status: 'not-found' | 'not-yours' | 'not-live'; message: string };

/**
 * The recipient says no. Guarded flip on `status: 'pending'` for exactly the
 * same reason accept is: a decline racing an accept must not un-resolve a trade
 * whose art and MP have already moved.
 *
 * A 'blocked' trade is declinable — a kid may say no to something a parent has
 * not looked at yet, and refusing costs nothing.
 */
export async function declineTrade(rawUser: string, rawTradeId: unknown): Promise<ResolveResult> {
  return resolve(rawUser, rawTradeId, 'recipient');
}

/** The proposer takes it back. Same guard, other party. */
export async function cancelTrade(rawUser: string, rawTradeId: unknown): Promise<ResolveResult> {
  return resolve(rawUser, rawTradeId, 'proposer');
}

async function resolve(
  rawUser: string,
  rawTradeId: unknown,
  side: 'recipient' | 'proposer',
): Promise<ResolveResult> {
  const userKey = normalizeUser(rawUser);
  const tradeId = typeof rawTradeId === 'string' ? rawTradeId.trim() : '';
  if (!userKey || !tradeId) {
    return { ok: false, status: 'not-found', message: 'We could not find that trade.' };
  }

  const trade = await prisma.imageTrade.findUnique({ where: { id: tradeId } });
  if (!trade) {
    return { ok: false, status: 'not-found', message: 'We could not find that trade.' };
  }
  const owner = side === 'recipient' ? trade.recipientUser : trade.proposerUser;
  if (owner !== userKey) {
    return { ok: false, status: 'not-yours', message: 'That trade is not yours to change.' };
  }

  const nextStatus = side === 'recipient' ? 'declined' : 'cancelled';
  // Guarded flip — only a live (or awaiting-approval) trade may be resolved,
  // and only once. Racing an accept, exactly one of the two matches a row.
  const updated = await prisma.imageTrade.updateMany({
    where: {
      id: tradeId,
      status: { in: [LIVE_STATUS, 'blocked'] },
      ...(side === 'recipient' ? { recipientUser: userKey } : { proposerUser: userKey }),
    },
    data: { status: nextStatus, resolvedAt: new Date() },
  });
  if (updated.count !== 1) {
    return { ok: false, status: 'not-live', message: 'That trade is already finished.' };
  }
  return { ok: true, status: nextStatus, tradeId };
}

/**
 * Parent approval — flips a 'blocked' trade to 'pending' so the recipient may
 * accept it. Guarded on `status: 'blocked'` so approving twice is a no-op and
 * an already-declined trade cannot be resurrected.
 *
 * The caller (route) is responsible for proving the requester is an admin.
 */
export type ApproveResult =
  | { ok: true; status: 'approved'; tradeId: string }
  | { ok: false; status: 'not-found' | 'not-live'; message: string };

export async function approveTrade(rawTradeId: unknown): Promise<ApproveResult> {
  const tradeId = typeof rawTradeId === 'string' ? rawTradeId.trim() : '';
  if (!tradeId) return { ok: false, status: 'not-found', message: 'We could not find that trade.' };
  const updated = await prisma.imageTrade.updateMany({
    where: { id: tradeId, status: 'blocked' },
    data: { status: LIVE_STATUS },
  });
  if (updated.count !== 1) {
    return { ok: false, status: 'not-live', message: 'That trade is not waiting for approval.' };
  }
  return { ok: true, status: 'approved', tradeId };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface TradeView {
  id: string;
  proposerUser: string;
  recipientUser: string;
  offeredImageId: string;
  offeredTitle: string;
  wantedImageId: string | null;
  wantedTitle: string | null;
  askCents: number;
  status: string;
  note: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
  offeredEditionNumber: number | null;
  wantedEditionNumber: number | null;
  /** True when this row is a SALE (MP on one side) rather than a pure swap. */
  isSale: boolean;
  /** 'in' = offered TO the viewer, 'out' = proposed BY the viewer. */
  direction: 'in' | 'out';
}

function toView(
  row: {
    id: string;
    proposerUser: string;
    recipientUser: string;
    offeredImageId: string;
    wantedImageId: string | null;
    askCents: number;
    status: string;
    note: string | null;
    createdAt: Date;
    resolvedAt: Date | null;
    offeredEditionNumber: number | null;
    wantedEditionNumber: number | null;
  },
  viewer: string,
): TradeView {
  return {
    id: row.id,
    proposerUser: row.proposerUser,
    recipientUser: row.recipientUser,
    offeredImageId: row.offeredImageId,
    offeredTitle: titleFor(row.offeredImageId),
    wantedImageId: row.wantedImageId,
    wantedTitle: row.wantedImageId ? titleFor(row.wantedImageId) : null,
    askCents: row.askCents,
    status: row.status,
    note: row.note,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
    offeredEditionNumber: row.offeredEditionNumber,
    wantedEditionNumber: row.wantedEditionNumber,
    isSale: row.askCents > 0,
    direction: row.recipientUser === viewer ? 'in' : 'out',
  };
}

/** Offers waiting for THIS kid to answer. The inbox. */
export async function listIncoming(rawUser: string): Promise<TradeView[]> {
  const userKey = normalizeUser(rawUser);
  if (!userKey) return [];
  const rows = await prisma.imageTrade.findMany({
    where: { recipientUser: userKey, status: { in: [LIVE_STATUS, 'blocked'] } },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((r) => toView(r, userKey));
}

/** Offers THIS kid has made and is waiting on. The outbox. */
export async function listOutgoing(rawUser: string): Promise<TradeView[]> {
  const userKey = normalizeUser(rawUser);
  if (!userKey) return [];
  const rows = await prisma.imageTrade.findMany({
    where: { proposerUser: userKey, status: { in: [LIVE_STATUS, 'blocked'] } },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((r) => toView(r, userKey));
}

/** Everything finished, either direction. The history page. */
export async function listTradeHistory(rawUser: string, limit = 50): Promise<TradeView[]> {
  const userKey = normalizeUser(rawUser);
  if (!userKey) return [];
  const rows = await prisma.imageTrade.findMany({
    where: {
      status: { notIn: [LIVE_STATUS, 'blocked'] },
      OR: [{ proposerUser: userKey }, { recipientUser: userKey }],
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map((r) => toView(r, userKey));
}

/**
 * EVERY trade, for the parent. This is the "every trade visible to the parent"
 * requirement — the MP legs also land in MpTransaction, but a pure swap moves no
 * MP and would otherwise be invisible in the ledger, so parents read this too.
 */
export async function listAllTrades(limit = 200): Promise<TradeView[]> {
  const rows = await prisma.imageTrade.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  // No single viewer for the admin list — direction is reported from the
  // proposer's point of view.
  return rows.map((r) => toView(r, r.recipientUser));
}

/** Trades a parent has to look at before they can happen. */
export async function listPendingApproval(limit = 50): Promise<TradeView[]> {
  const rows = await prisma.imageTrade.findMany({
    where: { status: 'blocked' },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map((r) => toView(r, r.recipientUser));
}
