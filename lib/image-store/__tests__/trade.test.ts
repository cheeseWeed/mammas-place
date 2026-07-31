// Kid-to-kid trading — NO DATABASE.
//
// Same fake-transaction style as purchase.test.ts: `@/lib/prisma` is stubbed
// with a hand-rolled client that models the things that actually decide
// correctness here, rather than a generic mock that would let a broken guard
// pass:
//
//   * GUARDED updateMany. Every gate in trade.ts is a WHERE clause, so the fake
//     evaluates WHERE clauses for real and returns `count: 0` when nothing
//     matches. That is the only reason a race test can fail meaningfully.
//   * REAL ROLLBACK. Each $transaction keeps an undo journal of exactly the
//     deltas IT applied and reverses those on throw — not a whole-state
//     snapshot, which would let a late failure clobber a sibling transaction's
//     committed work.
//   * @@unique([userName, imageId]). The fake refuses a second row for the same
//     (user, image) pair, so the already-owns edge case is a real constraint
//     here and not just an `if`.
//   * An INTERLEAVE HOOK that parks a transaction between its read and its
//     write, which is what makes "both accept simultaneously" and "the MP was
//     spent in between" testable without depending on scheduling.
//
// THE RACES UNDER TEST (one describe block each):
//   1. both parties accepting simultaneously
//   2. a stale offer — the image was already traded away
//   3. the buyer's MP spent between offer and accept
//   4. an offer accepted twice
//   5. self-trading
//   6. offering an image the proposer does not own
//   7. the recipient already owns a different edition of the same piece

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

// ---------------------------------------------------------------------------
// Fake prisma
// ---------------------------------------------------------------------------

interface PurchaseRow {
  id: string;
  userName: string;
  imageId: string;
  pricePaidCents: number;
  editionNumber: number;
  createdAt: Date;
}

interface TradeRow {
  id: string;
  proposerUser: string;
  recipientUser: string;
  offeredImageId: string;
  wantedImageId: string | null;
  askCents: number;
  status: string;
  note: string | null;
  resolvedAt: Date | null;
  offeredEditionNumber: number | null;
  wantedEditionNumber: number | null;
  createdAt: Date;
  updatedAt: Date;
}

interface LedgerRow {
  userName: string;
  cents: number;
  type: string;
  reason: string;
}

interface FakeState {
  users: Map<string, number>;
  purchases: PurchaseRow[];
  trades: Map<string, TradeRow>;
  /** Ledger rows that COMMITTED (a rolled-back transaction leaves none). */
  ledger: LedgerRow[];
  transactions: number;
  seq: number;
  /** How many guarded status-claims have been attempted. */
  claimAttempts: number;
  /**
   * Awaited right after a transaction claims the trade row, BEFORE it moves any
   * entitlement. Parks one accept mid-flight so another can run — the only way
   * to make "two accepts at once" deterministic.
   */
  afterClaim: (() => Promise<void>) | null;
  /** Awaited right after a transaction reads a balance, before it writes. */
  afterBalanceRead: (() => Promise<void>) | null;
  /**
   * Force the next guarded DEBIT to match 0 rows — i.e. Postgres re-evaluated
   * `balanceCents >= askCents` after a rival transaction committed and found the
   * money gone. Lets a test prove the guard without depending on scheduling.
   * Consumed on use.
   */
  loseNextDebit: boolean;
}

const state: FakeState = {
  users: new Map(),
  purchases: [],
  trades: new Map(),
  ledger: [],
  transactions: 0,
  seq: 0,
  claimAttempts: 0,
  afterClaim: null,
  afterBalanceRead: null,
  loseNextDebit: false,
};

/** Per-transaction undo log — see the note in purchase.test.ts. */
interface Journal {
  balanceDeltas: Array<{ user: string; delta: number }>;
  /** (purchase id, previous owner) so a rolled-back move restores the owner. */
  ownerMoves: Array<{ id: string; from: string }>;
  /** (trade id, previous row) so a rolled-back claim restores the status. */
  tradeEdits: Array<{ id: string; before: TradeRow }>;
  ledger: LedgerRow[];
  createdPurchases: string[];
}

class FakeP2002 extends Error {
  code = 'P2002';
  meta: { target: string[] };
  constructor(target: string[]) {
    super(`Unique constraint failed on the fields: (${target.join(',')})`);
    this.name = 'PrismaClientKnownRequestError';
    this.meta = { target };
  }
}

function findPurchase(userName: string, imageId: string): PurchaseRow | undefined {
  return state.purchases.find((p) => p.userName === userName && p.imageId === imageId);
}

/** Does a WHERE like `{ name, balanceCents: { gte } }` match? */
function balanceMatches(where: { name: string; balanceCents?: { gte?: number } }): boolean {
  const current = state.users.get(where.name);
  if (current === undefined) return false;
  const gte = where.balanceCents?.gte;
  if (gte !== undefined && current < gte) return false;
  return true;
}

/** Does a trade row satisfy an updateMany WHERE? Models the guarded flips. */
function tradeMatches(
  row: TradeRow,
  where: {
    id?: string;
    recipientUser?: string;
    proposerUser?: string;
    status?: string | { in?: string[]; notIn?: string[] };
  },
): boolean {
  if (where.id !== undefined && row.id !== where.id) return false;
  if (where.recipientUser !== undefined && row.recipientUser !== where.recipientUser) return false;
  if (where.proposerUser !== undefined && row.proposerUser !== where.proposerUser) return false;
  if (where.status !== undefined) {
    if (typeof where.status === 'string') {
      if (row.status !== where.status) return false;
    } else {
      if (where.status.in && !where.status.in.includes(row.status)) return false;
      if (where.status.notIn && where.status.notIn.includes(row.status)) return false;
    }
  }
  return true;
}

function makeTx(journal: Journal) {
  return {
    driveUser: {
      findUnique: async ({ where }: { where: { name: string } }) => {
        const bal = state.users.get(where.name);
        const row = bal === undefined ? null : { name: where.name, balanceCents: bal };
        if (state.afterBalanceRead) await state.afterBalanceRead();
        return row;
      },
      /**
       * The CONDITIONAL money move. Check and write are ONE statement with no
       * await between the compare and the assignment — what Postgres guarantees
       * for a single UPDATE holding the row lock.
       */
      updateMany: async ({
        where,
        data,
      }: {
        where: { name: string; balanceCents?: { gte?: number } };
        data: { balanceCents?: { decrement?: number; increment?: number } };
      }) => {
        const isDebit = (data.balanceCents?.decrement ?? 0) > 0;
        if (isDebit && state.loseNextDebit) {
          state.loseNextDebit = false;
          return { count: 0 };
        }
        if (!balanceMatches(where)) return { count: 0 };
        const current = state.users.get(where.name)!;
        const delta = (data.balanceCents?.increment ?? 0) - (data.balanceCents?.decrement ?? 0);
        state.users.set(where.name, current + delta);
        journal.balanceDeltas.push({ user: where.name, delta });
        return { count: 1 };
      },
    },
    mpTransaction: {
      create: async ({ data }: { data: LedgerRow }) => {
        journal.ledger.push(data);
        return { id: `tx-${++state.seq}`, ...data };
      },
    },
    imagePurchase: {
      findUnique: async ({
        where,
      }: {
        where: { userName_imageId: { userName: string; imageId: string } };
      }) => {
        const { userName, imageId } = where.userName_imageId;
        return findPurchase(userName, imageId) ?? null;
      },
      /**
       * THE ENTITLEMENT MOVE. Guarded on the CURRENT owner — that WHERE is the
       * stale-offer gate, so the fake must evaluate it honestly.
       *
       * It also enforces @@unique([userName, imageId]): moving a row onto a user
       * who already holds that image raises P2002, exactly as Postgres would.
       * Without that, the already-owns edge case would be untestable.
       */
      updateMany: async ({
        where,
        data,
      }: {
        where: { userName: string; imageId: string };
        data: { userName: string };
      }) => {
        const row = findPurchase(where.userName, where.imageId);
        if (!row) return { count: 0 };
        if (findPurchase(data.userName, where.imageId)) {
          throw new FakeP2002(['userName', 'imageId']);
        }
        journal.ownerMoves.push({ id: row.id, from: row.userName });
        row.userName = data.userName;
        return { count: 1 };
      },
    },
    imageTrade: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.trades.get(where.id) ?? null,
      /** The guarded status flip — the double-accept gate. */
      updateMany: async ({
        where,
        data,
      }: {
        where: Parameters<typeof tradeMatches>[1];
        data: Partial<TradeRow>;
      }) => {
        state.claimAttempts += 1;
        const row = where.id ? state.trades.get(where.id) : undefined;
        if (!row || !tradeMatches(row, where)) return { count: 0 };
        journal.tradeEdits.push({ id: row.id, before: { ...row } });
        Object.assign(row, data);
        // Parking AFTER the claim commits in-memory is what lets a rival accept
        // observe the new status and correctly lose.
        if (data.status === 'accepted' && state.afterClaim) await state.afterClaim();
        return { count: 1 };
      },
    },
  };
}

function buildPrismaMock() {
  return {
  $transaction: async (fn: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) => {
    state.transactions += 1;
    const journal: Journal = {
      balanceDeltas: [],
      ownerMoves: [],
      tradeEdits: [],
      ledger: [],
      createdPurchases: [],
    };
    try {
      const out = await fn(makeTx(journal));
      // Committed: ledger rows become visible.
      state.ledger.push(...journal.ledger);
      return out;
    } catch (err) {
      // ROLL BACK exactly what this transaction did, newest first.
      for (const { user, delta } of [...journal.balanceDeltas].reverse()) {
        state.users.set(user, (state.users.get(user) ?? 0) - delta);
      }
      for (const { id, from } of [...journal.ownerMoves].reverse()) {
        const row = state.purchases.find((p) => p.id === id);
        if (row) row.userName = from;
      }
      for (const { id, before } of [...journal.tradeEdits].reverse()) {
        state.trades.set(id, before);
      }
      for (const id of journal.createdPurchases) {
        state.purchases = state.purchases.filter((p) => p.id !== id);
      }
      throw err;
    }
  },
  driveUser: {
    findUnique: async ({ where }: { where: { name: string } }) => {
      const bal = state.users.get(where.name);
      return bal === undefined ? null : { name: where.name, balanceCents: bal };
    },
    findMany: async () =>
      Array.from(state.users.keys()).map((name) => ({ name, displayName: null })),
  },
  imagePurchase: {
    findUnique: async ({
      where,
    }: {
      where: { userName_imageId: { userName: string; imageId: string } };
    }) => {
      const { userName, imageId } = where.userName_imageId;
      return findPurchase(userName, imageId) ?? null;
    },
    findMany: async ({ where }: { where?: { userName?: string } }) =>
      state.purchases.filter((p) => !where?.userName || p.userName === where.userName),
  },
  imageTrade: {
    create: async ({ data }: { data: Partial<TradeRow> }) => {
      const id = `trade-${++state.seq}`;
      const row: TradeRow = {
        id,
        proposerUser: data.proposerUser!,
        recipientUser: data.recipientUser!,
        offeredImageId: data.offeredImageId!,
        wantedImageId: data.wantedImageId ?? null,
        askCents: data.askCents ?? 0,
        status: data.status ?? 'pending',
        note: data.note ?? null,
        resolvedAt: null,
        offeredEditionNumber: null,
        wantedEditionNumber: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      state.trades.set(id, row);
      return row;
    },
    findUnique: async ({ where }: { where: { id: string } }) => state.trades.get(where.id) ?? null,
    /**
     * Honours the WHERE. A findMany that ignored its filter would make every
     * queue test pass vacuously — the inbox would look correct simply because
     * it contained everything.
     */
    findMany: async ({
      where,
      take,
    }: {
      where?: {
        recipientUser?: string;
        proposerUser?: string;
        status?: { in?: string[]; notIn?: string[] };
        OR?: Array<{ proposerUser?: string; recipientUser?: string }>;
      };
      take?: number;
    } = {}) => {
      let rows = Array.from(state.trades.values());
      if (where?.recipientUser) rows = rows.filter((r) => r.recipientUser === where.recipientUser);
      if (where?.proposerUser) rows = rows.filter((r) => r.proposerUser === where.proposerUser);
      if (where?.status?.in) rows = rows.filter((r) => where.status!.in!.includes(r.status));
      if (where?.status?.notIn) rows = rows.filter((r) => !where.status!.notIn!.includes(r.status));
      if (where?.OR) {
        rows = rows.filter((r) =>
          where.OR!.some(
            (c) =>
              (c.proposerUser && r.proposerUser === c.proposerUser) ||
              (c.recipientUser && r.recipientUser === c.recipientUser),
          ),
        );
      }
      rows = rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return typeof take === 'number' ? rows.slice(0, take) : rows;
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: Parameters<typeof tradeMatches>[1];
      data: Partial<TradeRow>;
    }) => {
      const row = where.id ? state.trades.get(where.id) : undefined;
      if (!row || !tradeMatches(row, where)) return { count: 0 };
      Object.assign(row, data);
      return { count: 1 };
    },
  },
  };
}

// vi.mock is HOISTED to the top of the file, so its factory runs BEFORE any
// module-level `const`/`let` is initialized — closing over one is a TDZ
// ReferenceError. Function DECLARATIONS are fully hoisted though, so the
// builder above is callable, and the singleton is stashed on the function
// object itself rather than in a module-level binding.
function prismaMockInstance(): ReturnType<typeof buildPrismaMock> {
  const self = prismaMockInstance as unknown as {
    cached?: ReturnType<typeof buildPrismaMock>;
  };
  if (!self.cached) self.cached = buildPrismaMock();
  return self.cached;
}

vi.mock('@/lib/prisma', () => ({ prisma: prismaMockInstance() }));

// Imported AFTER the mock so they bind to the stub.
import { IMAGE_CATALOG } from '../catalog';
import {
  acceptTrade,
  cancelTrade,
  declineTrade,
  approveTrade,
  listIncoming,
  listOutgoing,
  proposeTrade,
  TRADE_APPROVAL_THRESHOLD_CENTS,
} from '../trade';

// Real catalog pieces — a data change that breaks trading fails a test.
const PONY = IMAGE_CATALOG[0];
const UNICORN = IMAGE_CATALOG[1];
const THIRD = IMAGE_CATALOG[2];

function reset(balances: Record<string, number> = {}) {
  state.users = new Map(Object.entries(balances));
  state.purchases = [];
  state.trades = new Map();
  state.ledger = [];
  state.transactions = 0;
  state.seq = 0;
  state.claimAttempts = 0;
  state.afterClaim = null;
  state.afterBalanceRead = null;
  state.loseNextDebit = false;
}

/** Give `user` a copy of `imageId` at a specific edition number. */
function own(user: string, imageId: string, editionNumber = 1): PurchaseRow {
  const row: PurchaseRow = {
    id: `ip-${++state.seq}`,
    userName: user,
    imageId,
    pricePaidCents: 400,
    editionNumber,
    createdAt: new Date(),
  };
  state.purchases.push(row);
  return row;
}

function ownerOf(imageId: string): string | undefined {
  return state.purchases.find((p) => p.imageId === imageId)?.userName;
}

function editionOf(imageId: string): number | undefined {
  return state.purchases.find((p) => p.imageId === imageId)?.editionNumber;
}

beforeEach(() => {
  reset();
});

// ---------------------------------------------------------------------------
// Propose
// ---------------------------------------------------------------------------

describe('proposeTrade', () => {
  it('creates a pending SWAP when both kids own their side', async () => {
    reset({ shepherd: 1000, hailey: 1000 });
    own('shepherd', PONY.id, 1);
    own('hailey', UNICORN.id, 2);

    const result = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      wantedImageId: UNICORN.id,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.status).toBe('proposed');
    expect(result.needsApproval).toBe(false);
    expect(result.askCents).toBe(0);
    expect(state.trades.get(result.tradeId)!.status).toBe('pending');
  });

  it('creates a pending SALE when MP is asked for instead of a picture', async () => {
    reset({ shepherd: 0, hailey: 5000 });
    own('shepherd', PONY.id);

    const result = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      askCents: 500,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.wantedImageId).toBeNull();
    expect(result.askCents).toBe(500);
  });

  // --- RACE 5: self-trading ---

  it('REFUSES a self-trade', async () => {
    reset({ shepherd: 1000 });
    own('shepherd', PONY.id);
    const result = await proposeTrade('shepherd', 'shepherd', { offeredImageId: PONY.id, askCents: 100 });
    expect(result.ok).toBe(false);
    expect(result.status).toBe('self-trade');
    expect(state.trades.size).toBe(0);
  });

  it('refuses a self-trade even when the name is cased differently', async () => {
    reset({ shepherd: 1000 });
    own('shepherd', PONY.id);
    const result = await proposeTrade('Shepherd', '  SHEPHERD  ', {
      offeredImageId: PONY.id,
      askCents: 100,
    });
    expect(result.status).toBe('self-trade');
  });

  // --- RACE 6: offering an image the proposer does not own ---

  it('REFUSES to offer a picture the proposer does not own', async () => {
    reset({ shepherd: 1000, hailey: 1000 });
    own('hailey', PONY.id); // it's HAILEY's pony
    const result = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      askCents: 100,
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe('not-owned');
    expect(state.trades.size).toBe(0);
  });

  it('refuses to offer a picture nobody owns', async () => {
    reset({ shepherd: 1000, hailey: 1000 });
    const result = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      askCents: 100,
    });
    expect(result.status).toBe('not-owned');
  });

  it('refuses to ask for a picture the recipient does not have', async () => {
    reset({ shepherd: 1000, hailey: 1000 });
    own('shepherd', PONY.id);
    const result = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      wantedImageId: UNICORN.id,
    });
    expect(result.status).toBe('recipient-missing-wanted');
  });

  // --- RACE 7: the already-owns edge case, at propose time ---

  it('REFUSES when the recipient already owns the offered piece', async () => {
    reset({ shepherd: 1000, hailey: 1000 });
    own('shepherd', PONY.id, 1);
    own('hailey', PONY.id, 4); // Hailey already has a pony, edition #4
    const result = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      askCents: 100,
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe('recipient-already-owns-offered');
    expect(state.trades.size).toBe(0);
  });

  it('REFUSES when the proposer already owns the piece they are asking for', async () => {
    reset({ shepherd: 1000, hailey: 1000 });
    own('shepherd', PONY.id, 1);
    own('shepherd', UNICORN.id, 3);
    own('hailey', UNICORN.id, 5);
    const result = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      wantedImageId: UNICORN.id,
    });
    expect(result.status).toBe('proposer-already-owns-wanted');
  });

  // --- money validation ---

  it('rejects a negative ask (which would invert the debit)', async () => {
    reset({ shepherd: 1000, hailey: 1000 });
    own('shepherd', PONY.id);
    const result = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      askCents: -500,
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe('bad-ask');
  });

  it('rejects a fractional ask — integer cents only', async () => {
    reset({ shepherd: 1000, hailey: 1000 });
    own('shepherd', PONY.id);
    const result = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      askCents: 12.5,
    });
    expect(result.status).toBe('bad-ask');
  });

  it('rejects a trade with nothing coming back', async () => {
    reset({ shepherd: 1000, hailey: 1000 });
    own('shepherd', PONY.id);
    const result = await proposeTrade('shepherd', 'hailey', { offeredImageId: PONY.id });
    expect(result.status).toBe('bad-ask');
  });

  // --- admin threshold ---

  it('blocks a big-money trade for parent approval', async () => {
    reset({ shepherd: 0, hailey: 1_000_000 });
    own('shepherd', PONY.id);
    const result = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      askCents: TRADE_APPROVAL_THRESHOLD_CENTS,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.needsApproval).toBe(true);
    expect(state.trades.get(result.tradeId)!.status).toBe('blocked');
  });

  it('does NOT block one cent under the threshold', async () => {
    reset({ shepherd: 0, hailey: 1_000_000 });
    own('shepherd', PONY.id);
    const result = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      askCents: TRADE_APPROVAL_THRESHOLD_CENTS - 1,
    });
    if (!result.ok) throw new Error('unreachable');
    expect(result.needsApproval).toBe(false);
    expect(state.trades.get(result.tradeId)!.status).toBe('pending');
  });
});

// ---------------------------------------------------------------------------
// Accept — the happy paths, and what they prove about atomicity
// ---------------------------------------------------------------------------

describe('acceptTrade — swap', () => {
  it('moves BOTH entitlements and CARRIES THE EDITION NUMBER with the image', async () => {
    reset({ shepherd: 1000, hailey: 1000 });
    own('shepherd', PONY.id, 1); // the rookie
    own('hailey', UNICORN.id, 7);

    const proposed = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      wantedImageId: UNICORN.id,
    });
    if (!proposed.ok) throw new Error('unreachable');

    const result = await acceptTrade('hailey', proposed.tradeId);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');

    // The giver LOST it, the receiver HAS it.
    expect(ownerOf(PONY.id)).toBe('hailey');
    expect(ownerOf(UNICORN.id)).toBe('shepherd');

    // THE WHOLE POINT: Edition #1 travelled. Hailey now holds the rookie card.
    expect(editionOf(PONY.id)).toBe(1);
    expect(result.offeredEditionNumber).toBe(1);
    expect(editionOf(UNICORN.id)).toBe(7);
    expect(result.wantedEditionNumber).toBe(7);

    // Nobody holds two copies of anything.
    expect(state.purchases.filter((p) => p.imageId === PONY.id)).toHaveLength(1);
  });

  it('a pure swap moves NO MP and writes NO ledger rows', async () => {
    reset({ shepherd: 1000, hailey: 1000 });
    own('shepherd', PONY.id);
    own('hailey', UNICORN.id);
    const proposed = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      wantedImageId: UNICORN.id,
    });
    if (!proposed.ok) throw new Error('unreachable');
    await acceptTrade('hailey', proposed.tradeId);

    expect(state.users.get('shepherd')).toBe(1000);
    expect(state.users.get('hailey')).toBe(1000);
    expect(state.ledger).toHaveLength(0);
  });
});

describe('acceptTrade — sale', () => {
  it('moves the picture, moves the MP, and writes BOTH ledger rows in one transaction', async () => {
    reset({ shepherd: 0, hailey: 5000 });
    own('shepherd', PONY.id, 1);

    const proposed = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      askCents: 1200,
    });
    if (!proposed.ok) throw new Error('unreachable');

    const result = await acceptTrade('hailey', proposed.tradeId);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');

    expect(ownerOf(PONY.id)).toBe('hailey');
    expect(editionOf(PONY.id)).toBe(1); // the number travelled
    expect(state.users.get('hailey')).toBe(5000 - 1200);
    expect(state.users.get('shepherd')).toBe(1200);
    expect(result.balanceCents).toBe(3800);

    // EVERY MP movement writes a ledger row — one per side, both committed.
    expect(state.ledger).toHaveLength(2);
    const spend = state.ledger.find((l) => l.userName === 'hailey')!;
    const receive = state.ledger.find((l) => l.userName === 'shepherd')!;
    expect(spend.cents).toBe(-1200);
    expect(spend.type).toBe('spend');
    expect(receive.cents).toBe(1200);
    expect(Number.isInteger(spend.cents)).toBe(true);

    // MP is conserved — a trade never mints or destroys currency.
    expect(state.users.get('hailey')! + state.users.get('shepherd')!).toBe(5000);
  });

  it('the trade is exactly ONE transaction', async () => {
    reset({ shepherd: 0, hailey: 5000 });
    own('shepherd', PONY.id);
    const proposed = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      askCents: 500,
    });
    if (!proposed.ok) throw new Error('unreachable');
    state.transactions = 0;
    await acceptTrade('hailey', proposed.tradeId);
    expect(state.transactions).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// RACE 1 — both parties accepting simultaneously
// RACE 4 — an offer accepted twice
// ---------------------------------------------------------------------------

describe('double accept', () => {
  it('RACE: two simultaneous accepts — exactly one wins, nothing moves twice', async () => {
    reset({ shepherd: 0, hailey: 5000 });
    own('shepherd', PONY.id, 1);
    const proposed = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      askCents: 1000,
    });
    if (!proposed.ok) throw new Error('unreachable');

    // Park the FIRST accept right after it claims the row, and let the second
    // run to completion against the already-claimed status. This is exactly the
    // interleaving two taps on two devices produce.
    let open!: () => void;
    const gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    let parked = false;
    state.afterClaim = async () => {
      if (!parked) {
        parked = true;
        await gate;
      }
    };

    const first = acceptTrade('hailey', proposed.tradeId);
    // Give the first accept a turn to reach the claim and park.
    await Promise.resolve();
    await Promise.resolve();
    const second = acceptTrade('hailey', proposed.tradeId);
    const secondResult = await second;
    open();
    const firstResult = await first;

    const results = [firstResult, secondResult];
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toHaveLength(1);
    const loser = results.find((r) => !r.ok)!;
    expect(loser.status).toBe('not-live');

    // The art moved ONCE and the money moved ONCE.
    expect(state.purchases.filter((p) => p.imageId === PONY.id)).toHaveLength(1);
    expect(ownerOf(PONY.id)).toBe('hailey');
    expect(state.users.get('hailey')).toBe(4000);
    expect(state.users.get('shepherd')).toBe(1000);
    expect(state.ledger).toHaveLength(2);
  });

  it('accepting an already-accepted trade a second time is refused and charges nothing', async () => {
    reset({ shepherd: 0, hailey: 5000 });
    own('shepherd', PONY.id);
    const proposed = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      askCents: 1000,
    });
    if (!proposed.ok) throw new Error('unreachable');

    const first = await acceptTrade('hailey', proposed.tradeId);
    expect(first.ok).toBe(true);
    const balanceAfterFirst = state.users.get('hailey')!;

    const second = await acceptTrade('hailey', proposed.tradeId);
    expect(second.ok).toBe(false);
    expect(second.status).toBe('not-live');
    expect(state.users.get('hailey')).toBe(balanceAfterFirst);
    expect(state.ledger).toHaveLength(2); // still just the one trade's rows
  });

  /**
   * THE IN-TRANSACTION STATUS GATE, on its own.
   *
   * acceptTrade has TWO status defences: a read-only PRE-FLIGHT outside the
   * transaction (fast, friendly) and the GUARDED CLAIM inside it (the real
   * gate). The pre-flight is not race-safe on its own — it is a read at READ
   * COMMITTED with no row lock, so in production two accepts can both pass it
   * and reach the transaction together.
   *
   * Every other double-accept test above is satisfied by the pre-flight, which
   * means they would ALL still pass if the guarded claim were deleted. This
   * test exists to make the guarded claim independently falsifiable: it flips
   * the row to 'accepted' AFTER the pre-flight has read it, so the only thing
   * left that can refuse the trade is `status: LIVE_STATUS` in the claim's
   * WHERE clause.
   */
  it('GATE: the in-transaction claim refuses a trade resolved after the pre-flight', async () => {
    reset({ shepherd: 0, hailey: 5000 });
    own('shepherd', PONY.id, 1);
    const proposed = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      askCents: 1000,
    });
    if (!proposed.ok) throw new Error('unreachable');

    // Simulate the rival transaction committing in the window between the
    // pre-flight read and the claim: the row is already 'accepted' by the time
    // our UPDATE takes its row lock and re-evaluates its WHERE.
    const row = state.trades.get(proposed.tradeId)!;
    const realGet = state.trades.get.bind(state.trades);
    let reads = 0;
    state.trades.get = ((id: string) => {
      const found = realGet(id);
      // The FIRST read is the pre-flight — let it see a live trade. Everything
      // after it (i.e. the claim) sees the rival's committed result.
      if (found && ++reads === 1) return { ...found, status: 'pending' };
      return found;
    }) as typeof state.trades.get;
    row.status = 'accepted';

    const result = await acceptTrade('hailey', proposed.tradeId);
    state.trades.get = realGet;

    expect(result.ok).toBe(false);
    expect(result.status).toBe('not-live');
    // Nothing moved: no art, no MP, no ledger rows.
    expect(ownerOf(PONY.id)).toBe('shepherd');
    expect(state.users.get('hailey')).toBe(5000);
    expect(state.users.get('shepherd')).toBe(0);
    expect(state.ledger).toHaveLength(0);
  });

  it('ten concurrent accepts move the art exactly once', async () => {
    reset({ shepherd: 0, hailey: 50_000 });
    own('shepherd', PONY.id);
    const proposed = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      askCents: 1000,
    });
    if (!proposed.ok) throw new Error('unreachable');

    const results = await Promise.all(
      Array.from({ length: 10 }, () => acceptTrade('hailey', proposed.tradeId)),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(state.users.get('hailey')).toBe(49_000);
    expect(state.ledger).toHaveLength(2);
    expect(state.purchases.filter((p) => p.imageId === PONY.id)).toHaveLength(1);
  });

  it('a decline racing an accept cannot un-resolve a completed trade', async () => {
    reset({ shepherd: 0, hailey: 5000 });
    own('shepherd', PONY.id);
    const proposed = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      askCents: 1000,
    });
    if (!proposed.ok) throw new Error('unreachable');

    await acceptTrade('hailey', proposed.tradeId);
    const declined = await declineTrade('hailey', proposed.tradeId);
    expect(declined.ok).toBe(false);
    expect(state.trades.get(proposed.tradeId)!.status).toBe('accepted');
    expect(ownerOf(PONY.id)).toBe('hailey');
  });
});

// ---------------------------------------------------------------------------
// RACE 2 — a stale offer (the image was already traded away)
// ---------------------------------------------------------------------------

describe('stale offer', () => {
  it('RACE: the proposer traded the piece to somebody else first', async () => {
    reset({ shepherd: 0, hailey: 5000, ruby: 5000 });
    own('shepherd', PONY.id, 1);

    // TWO pending offers for the SAME picture — legal and expected.
    const toHailey = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      askCents: 1000,
    });
    const toRuby = await proposeTrade('shepherd', 'ruby', {
      offeredImageId: PONY.id,
      askCents: 1000,
    });
    if (!toHailey.ok || !toRuby.ok) throw new Error('unreachable');

    // Ruby accepts first and gets it.
    const rubyResult = await acceptTrade('ruby', toRuby.tradeId);
    expect(rubyResult.ok).toBe(true);
    expect(ownerOf(PONY.id)).toBe('ruby');

    // Hailey's offer is now STALE. Shepherd no longer owns the pony.
    const haileyResult = await acceptTrade('hailey', toHailey.tradeId);
    expect(haileyResult.ok).toBe(false);
    expect(haileyResult.status).toBe('stale-offer');

    // THE assertion: Hailey was NOT charged and Ruby still has the art.
    expect(state.users.get('hailey')).toBe(5000);
    expect(ownerOf(PONY.id)).toBe('ruby');
    expect(state.ledger.filter((l) => l.userName === 'hailey')).toHaveLength(0);
    // Only Ruby's trade wrote ledger rows.
    expect(state.ledger).toHaveLength(2);
    // The stale trade is rolled back to pending, not silently consumed.
    expect(state.trades.get(toHailey.tradeId)!.status).toBe('pending');
  });

  it('RACE: the recipient traded away the piece the proposer asked for', async () => {
    reset({ shepherd: 1000, hailey: 1000, ruby: 1000 });
    own('shepherd', PONY.id);
    own('hailey', UNICORN.id, 3);

    const swap = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      wantedImageId: UNICORN.id,
    });
    if (!swap.ok) throw new Error('unreachable');

    // Hailey's unicorn goes to Ruby in the meantime.
    const sale = await proposeTrade('hailey', 'ruby', {
      offeredImageId: UNICORN.id,
      askCents: 500,
    });
    if (!sale.ok) throw new Error('unreachable');
    await acceptTrade('ruby', sale.tradeId);
    expect(ownerOf(UNICORN.id)).toBe('ruby');

    // Now the swap cannot complete — and must not hand the pony over for free.
    const result = await acceptTrade('hailey', swap.tradeId);
    expect(result.ok).toBe(false);
    expect(result.status).toBe('stale-wanted');
    expect(ownerOf(PONY.id)).toBe('shepherd'); // never left
    expect(ownerOf(UNICORN.id)).toBe('ruby');
  });
});

// ---------------------------------------------------------------------------
// RACE 3 — the buyer's MP spent between offer and accept
// ---------------------------------------------------------------------------

describe('funds race', () => {
  // Asks stay UNDER TRADE_APPROVAL_THRESHOLD_CENTS on purpose: these tests are
  // about the funds guard, and a blocked-for-approval trade would never reach
  // the debit at all (which is itself covered in the authorization block).
  const BIG_ASK = TRADE_APPROVAL_THRESHOLD_CENTS - 1;

  it('RACE: MP spent between offer and accept — refused, and NO art moves', async () => {
    reset({ shepherd: 0, hailey: 5000 });
    own('shepherd', PONY.id, 1);
    const proposed = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      askCents: BIG_ASK,
    });
    if (!proposed.ok) throw new Error('unreachable');

    // Hailey blows her MP in the shop after making the offer but before the tap.
    state.users.set('hailey', 100);

    const result = await acceptTrade('hailey', proposed.tradeId);
    expect(result.ok).toBe(false);
    expect(result.status).toBe('insufficient-funds');
    if (result.status !== 'insufficient-funds') throw new Error('unreachable');
    // Reported against the FRESH balance, not the one the offer was built on.
    expect(result.balanceCents).toBe(100);
    expect(result.shortfallCents).toBe(BIG_ASK - 100);

    // THE assertion: the ENTITLEMENT ROLLED BACK TOO. The art must not move
    // when the money cannot. This is the "paid nothing, received nothing" half
    // of atomicity, and it only holds because the move and the debit share one
    // transaction.
    expect(ownerOf(PONY.id)).toBe('shepherd');
    expect(state.users.get('hailey')).toBe(100);
    expect(state.users.get('shepherd')).toBe(0);
    expect(state.ledger).toHaveLength(0);
    expect(state.trades.get(proposed.tradeId)!.status).toBe('pending');
  });

  /**
   * The debit in acceptTrade takes NO balance read before its guarded
   * updateMany — unlike purchaseImage, which keeps one to report a shortfall.
   * That is deliberate and it is stronger: with no read there is no
   * read→write window for a rival spend to land in at all, and the WHERE
   * clause is the only thing that decides.
   *
   * So this test forces the write itself to lose, which is what Postgres does
   * when it re-evaluates `balanceCents >= askCents` after a rival transaction
   * commits (EvalPlanQual). Plenty of MP is in the wallet at the moment of the
   * call, so ONLY the guard can produce this outcome.
   */
  it('RACE: a debit that matches 0 rows at commit time moves NOTHING', async () => {
    reset({ shepherd: 0, hailey: 5000 });
    own('shepherd', PONY.id, 1);
    const proposed = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      askCents: BIG_ASK,
    });
    if (!proposed.ok) throw new Error('unreachable');

    // The rival's spend lands the instant before our UPDATE takes its row lock,
    // so our WHERE re-evaluates against the new, insufficient balance.
    state.loseNextDebit = true;

    const result = await acceptTrade('hailey', proposed.tradeId);
    expect(result.ok).toBe(false);
    expect(result.status).toBe('insufficient-funds');

    // THE assertion: the art rolled back with the money. Atomic or nothing.
    expect(ownerOf(PONY.id)).toBe('shepherd');
    expect(editionOf(PONY.id)).toBe(1);
    expect(state.users.get('hailey')).toBe(5000);
    expect(state.users.get('shepherd')).toBe(0);
    expect(state.ledger).toHaveLength(0);
    expect(state.trades.get(proposed.tradeId)!.status).toBe('pending');
  });

  it('exact-change trade is allowed and lands on zero', async () => {
    reset({ shepherd: 0, hailey: 1200 });
    own('shepherd', PONY.id);
    const proposed = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      askCents: 1200,
    });
    if (!proposed.ok) throw new Error('unreachable');
    const result = await acceptTrade('hailey', proposed.tradeId);
    expect(result.ok).toBe(true);
    expect(state.users.get('hailey')).toBe(0);
    expect(ownerOf(PONY.id)).toBe('hailey');
  });

  it('one cent short is still short, and nothing moves', async () => {
    reset({ shepherd: 0, hailey: 1199 });
    own('shepherd', PONY.id);
    const proposed = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      askCents: 1200,
    });
    if (!proposed.ok) throw new Error('unreachable');
    const result = await acceptTrade('hailey', proposed.tradeId);
    expect(result.status).toBe('insufficient-funds');
    if (result.status !== 'insufficient-funds') throw new Error('unreachable');
    expect(result.shortfallCents).toBe(1);
    expect(ownerOf(PONY.id)).toBe('shepherd');
    expect(state.users.get('hailey')).toBe(1199);
  });

  it('a wallet never goes negative under a trade', async () => {
    reset({ shepherd: 0, hailey: 0 });
    own('shepherd', PONY.id);
    const proposed = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      askCents: 500,
    });
    if (!proposed.ok) throw new Error('unreachable');
    await acceptTrade('hailey', proposed.tradeId);
    expect(state.users.get('hailey')).toBeGreaterThanOrEqual(0);
  });

  it('two trades that each fit but together do not cannot overdraft', async () => {
    reset({ shepherd: 0, ruby: 0, hailey: 1000 });
    own('shepherd', PONY.id);
    own('ruby', UNICORN.id);
    const a = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      askCents: 800,
    });
    const b = await proposeTrade('ruby', 'hailey', {
      offeredImageId: UNICORN.id,
      askCents: 800,
    });
    if (!a.ok || !b.ok) throw new Error('unreachable');

    const results = await Promise.all([
      acceptTrade('hailey', a.tradeId),
      acceptTrade('hailey', b.tradeId),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(state.users.get('hailey')).toBe(200);
    expect(state.users.get('hailey')!).toBeGreaterThanOrEqual(0);
    // Exactly one picture changed hands.
    const moved = [ownerOf(PONY.id), ownerOf(UNICORN.id)].filter((o) => o === 'hailey');
    expect(moved).toHaveLength(1);
    expect(state.ledger).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// RACE 7 — the recipient already owns a different edition of that piece
// ---------------------------------------------------------------------------

describe('already-owns edge case', () => {
  it('ACCEPT-TIME: the recipient bought their own copy after the offer was made', async () => {
    reset({ shepherd: 0, hailey: 5000 });
    own('shepherd', PONY.id, 1);

    const proposed = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      askCents: 1000,
    });
    if (!proposed.ok) throw new Error('unreachable');

    // Between the offer and the tap, Hailey buys her OWN pony — edition #4.
    own('hailey', PONY.id, 4);

    const result = await acceptTrade('hailey', proposed.tradeId);

    // Refused with a sentence, NOT a 500 from a P2002.
    expect(result.ok).toBe(false);
    expect(result.status).toBe('recipient-already-owns-offered');

    // Both editions survive with their original owners. Nothing was deleted,
    // nothing was merged, and no money moved.
    expect(state.purchases.filter((p) => p.imageId === PONY.id)).toHaveLength(2);
    expect(findPurchase('shepherd', PONY.id)!.editionNumber).toBe(1);
    expect(findPurchase('hailey', PONY.id)!.editionNumber).toBe(4);
    expect(state.users.get('hailey')).toBe(5000);
    expect(state.ledger).toHaveLength(0);
    expect(state.trades.get(proposed.tradeId)!.status).toBe('pending');
  });

  it('ACCEPT-TIME: the collision on the PROPOSER side of a swap is also refused', async () => {
    reset({ shepherd: 1000, hailey: 1000 });
    own('shepherd', PONY.id);
    own('hailey', UNICORN.id, 2);

    const proposed = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      wantedImageId: UNICORN.id,
    });
    if (!proposed.ok) throw new Error('unreachable');

    // Shepherd buys his own unicorn before Hailey taps accept.
    own('shepherd', UNICORN.id, 9);

    const result = await acceptTrade('hailey', proposed.tradeId);
    expect(result.ok).toBe(false);
    expect(result.status).toBe('proposer-already-owns-wanted');
    expect(ownerOf(PONY.id)).toBe('shepherd');
    expect(findPurchase('hailey', UNICORN.id)).toBeDefined();
    expect(state.purchases.filter((p) => p.imageId === UNICORN.id)).toHaveLength(2);
  });

  it('never violates the one-copy-per-kid rule, whatever happens', async () => {
    reset({ shepherd: 0, hailey: 5000 });
    own('shepherd', PONY.id, 1);
    own('hailey', PONY.id, 2);
    // Force a trade row into existence that propose-time would have refused,
    // proving the ACCEPT-time gate stands on its own.
    const row = await prismaMockInstance().imageTrade.create({
      data: {
        proposerUser: 'shepherd',
        recipientUser: 'hailey',
        offeredImageId: PONY.id,
        wantedImageId: null,
        askCents: 500,
        status: 'pending',
      },
    });

    const result = await acceptTrade('hailey', row.id);
    expect(result.ok).toBe(false);
    expect(result.status).toBe('recipient-already-owns-offered');

    // The invariant: at most one row per (user, image), always.
    const keys = state.purchases.map((p) => `${p.userName}|${p.imageId}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

// ---------------------------------------------------------------------------
// Authorization — who may do what
// ---------------------------------------------------------------------------

describe('authorization', () => {
  it('the PROPOSER cannot accept their own offer (both parties must confirm)', async () => {
    reset({ shepherd: 5000, hailey: 5000 });
    own('shepherd', PONY.id);
    const proposed = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      askCents: 500,
    });
    if (!proposed.ok) throw new Error('unreachable');

    const result = await acceptTrade('shepherd', proposed.tradeId);
    expect(result.ok).toBe(false);
    expect(result.status).toBe('not-yours');
    expect(ownerOf(PONY.id)).toBe('shepherd');
    expect(state.ledger).toHaveLength(0);
  });

  it('a THIRD kid cannot accept somebody else\'s trade', async () => {
    reset({ shepherd: 0, hailey: 5000, ruby: 5000 });
    own('shepherd', PONY.id);
    const proposed = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      askCents: 500,
    });
    if (!proposed.ok) throw new Error('unreachable');

    const result = await acceptTrade('ruby', proposed.tradeId);
    expect(result.status).toBe('not-yours');
    expect(ownerOf(PONY.id)).toBe('shepherd');
    expect(state.users.get('ruby')).toBe(5000);
  });

  it('a blocked trade CANNOT be accepted until a parent approves it', async () => {
    reset({ shepherd: 0, hailey: 1_000_000 });
    own('shepherd', PONY.id);
    const proposed = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      askCents: TRADE_APPROVAL_THRESHOLD_CENTS + 500,
    });
    if (!proposed.ok) throw new Error('unreachable');

    const blocked = await acceptTrade('hailey', proposed.tradeId);
    expect(blocked.ok).toBe(false);
    expect(blocked.status).toBe('needs-approval');
    expect(ownerOf(PONY.id)).toBe('shepherd');
    expect(state.ledger).toHaveLength(0);

    // Parent approves -> now it goes through.
    const approved = await approveTrade(proposed.tradeId);
    expect(approved.ok).toBe(true);
    const accepted = await acceptTrade('hailey', proposed.tradeId);
    expect(accepted.ok).toBe(true);
    expect(ownerOf(PONY.id)).toBe('hailey');
  });

  it('approving twice is a no-op', async () => {
    reset({ shepherd: 0, hailey: 1_000_000 });
    own('shepherd', PONY.id);
    const proposed = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      askCents: TRADE_APPROVAL_THRESHOLD_CENTS,
    });
    if (!proposed.ok) throw new Error('unreachable');
    expect((await approveTrade(proposed.tradeId)).ok).toBe(true);
    expect((await approveTrade(proposed.tradeId)).ok).toBe(false);
  });

  it('an unknown trade id is a value, not a throw', async () => {
    reset({ hailey: 100 });
    const result = await acceptTrade('hailey', 'no-such-trade');
    expect(result.ok).toBe(false);
    expect(result.status).toBe('not-found');
    expect(state.transactions).toBe(0);
  });

  it('a blank user never opens a transaction', async () => {
    reset({ hailey: 100 });
    const result = await acceptTrade('   ', 'anything');
    expect(result.status).toBe('unknown-user');
    expect(state.transactions).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Decline / cancel
// ---------------------------------------------------------------------------

describe('decline and cancel', () => {
  it('the recipient can decline, and nothing moves', async () => {
    reset({ shepherd: 0, hailey: 5000 });
    own('shepherd', PONY.id);
    const proposed = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      askCents: 500,
    });
    if (!proposed.ok) throw new Error('unreachable');

    const result = await declineTrade('hailey', proposed.tradeId);
    expect(result.ok).toBe(true);
    expect(state.trades.get(proposed.tradeId)!.status).toBe('declined');
    expect(ownerOf(PONY.id)).toBe('shepherd');
    expect(state.users.get('hailey')).toBe(5000);
  });

  it('a declined trade can no longer be accepted', async () => {
    reset({ shepherd: 0, hailey: 5000 });
    own('shepherd', PONY.id);
    const proposed = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      askCents: 500,
    });
    if (!proposed.ok) throw new Error('unreachable');
    await declineTrade('hailey', proposed.tradeId);
    const result = await acceptTrade('hailey', proposed.tradeId);
    expect(result.status).toBe('not-live');
    expect(ownerOf(PONY.id)).toBe('shepherd');
  });

  it('the proposer can cancel; the recipient cannot cancel', async () => {
    reset({ shepherd: 0, hailey: 5000 });
    own('shepherd', PONY.id);
    const proposed = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      askCents: 500,
    });
    if (!proposed.ok) throw new Error('unreachable');

    const wrongSide = await cancelTrade('hailey', proposed.tradeId);
    expect(wrongSide.ok).toBe(false);
    expect(wrongSide.status).toBe('not-yours');

    const right = await cancelTrade('shepherd', proposed.tradeId);
    expect(right.ok).toBe(true);
    expect(state.trades.get(proposed.tradeId)!.status).toBe('cancelled');
  });

  it('the proposer cannot decline (that is the recipient\'s word)', async () => {
    reset({ shepherd: 0, hailey: 5000 });
    own('shepherd', PONY.id);
    const proposed = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      askCents: 500,
    });
    if (!proposed.ok) throw new Error('unreachable');
    const result = await declineTrade('shepherd', proposed.tradeId);
    expect(result.ok).toBe(false);
    expect(result.status).toBe('not-yours');
  });

  it('declining twice is refused the second time', async () => {
    reset({ shepherd: 0, hailey: 5000 });
    own('shepherd', PONY.id);
    const proposed = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      askCents: 500,
    });
    if (!proposed.ok) throw new Error('unreachable');
    expect((await declineTrade('hailey', proposed.tradeId)).ok).toBe(true);
    expect((await declineTrade('hailey', proposed.tradeId)).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

describe('queues', () => {
  it('an offer lands in the recipient inbox and the proposer outbox', async () => {
    reset({ shepherd: 0, hailey: 5000 });
    own('shepherd', PONY.id);
    const proposed = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      askCents: 500,
      note: 'I really want your unicorn!',
    });
    if (!proposed.ok) throw new Error('unreachable');

    const inbox = await listIncoming('hailey');
    expect(inbox).toHaveLength(1);
    expect(inbox[0].direction).toBe('in');
    expect(inbox[0].isSale).toBe(true);
    expect(inbox[0].offeredTitle).toBe(PONY.title);
    expect(inbox[0].note).toBe('I really want your unicorn!');

    const outbox = await listOutgoing('shepherd');
    expect(outbox).toHaveLength(1);
    expect(outbox[0].direction).toBe('out');

    // Not in the other kid's queues.
    expect(await listIncoming('shepherd')).toHaveLength(0);
    expect(await listOutgoing('hailey')).toHaveLength(0);
  });

  it('a resolved trade leaves the live queues', async () => {
    reset({ shepherd: 0, hailey: 5000 });
    own('shepherd', PONY.id);
    const proposed = await proposeTrade('shepherd', 'hailey', {
      offeredImageId: PONY.id,
      askCents: 500,
    });
    if (!proposed.ok) throw new Error('unreachable');
    await acceptTrade('hailey', proposed.tradeId);
    expect(await listIncoming('hailey')).toHaveLength(0);
    expect(await listOutgoing('shepherd')).toHaveLength(0);
  });
});
