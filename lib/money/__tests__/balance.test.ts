// MP Money debit paths — NO DATABASE.
//
// `@/lib/prisma` is stubbed with a hand-rolled fake that records every write a
// transaction callback makes and rolls those writes back when it throws. The
// point is to prove the ONE property that a read-then-decrement cannot have:
//
//   two concurrent spends against a balance that only covers ONE of them
//   cannot both succeed.
//
// Why an ordinary "fire N calls with Promise.all" test does NOT prove that:
// a fake transaction whose reads and writes never yield is serialized by the JS
// event loop, so the calls simply queue up and the buggy code passes. The race
// is only real if one transaction is PARKED in its read→write window while
// another runs to completion. `state.afterFirstRead` is that hook, and
// `state.loseDebitRaceOn` models the other half — a `updateMany` that matches 0
// rows because Postgres re-evaluated `balanceCents >= amount` (EvalPlanQual)
// after the rival committed.
//
// Both are needed: the hook proves the guard's WHERE clause refuses the loser,
// and the forced `count: 0` proves the code HANDLES a lost race by rolling back
// rather than carrying on.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

// ---------------------------------------------------------------------------
// Fake prisma
// ---------------------------------------------------------------------------

interface FakeWrite {
  model: string;
  op: string;
  data: Record<string, unknown>;
}

interface FakeState {
  /** name -> balanceCents */
  users: Map<string, number>;
  /** every write attempted, in order (committed or not) */
  writes: FakeWrite[];
  /** writes that survived — i.e. their transaction committed */
  committed: FakeWrite[];
  transactions: number;
  /** how many conditional debits have been ATTEMPTED (won or lost) */
  debitAttempts: number;
  /**
   * Force these attempt ordinals to match 0 rows — what Postgres returns when
   * it re-evaluates the WHERE against a newly committed balance and the money
   * is already gone. Lets a test prove the loser path without depending on
   * scheduling.
   */
  loseDebitRaceOn: Set<number>;
  /**
   * Awaited right after a transaction takes its FIRST balance read, AFTER the
   * value has been snapshotted — so a parked caller comes back holding a stale
   * number. This is the only way to interleave two transactions inside the
   * read→write window.
   */
  afterFirstRead: ((userName: string) => Promise<void>) | null;
}

const state: FakeState = {
  users: new Map(),
  writes: [],
  committed: [],
  transactions: 0,
  debitAttempts: 0,
  loseDebitRaceOn: new Set(),
  afterFirstRead: null,
};

interface Journal {
  balanceDeltas: Array<{ user: string; delta: number }>;
  /** Writes THIS transaction made — `state.writes` is shared, so it cannot be sliced. */
  writes: FakeWrite[];
  /** Balance reads this transaction has taken; the interleave hook fires on #1. */
  reads: number;
}

function record(journal: Journal, write: FakeWrite) {
  state.writes.push(write);
  journal.writes.push(write);
}

let orderSeq = 0;

function makeTx(journal: Journal) {
  return {
    driveUser: {
      findUnique: async ({ where }: { where: { name: string } }) => {
        const bal = state.users.get(where.name);
        // Snapshot BEFORE the hook: a parked transaction must resume holding
        // the stale number it read. That staleness is the bug's whole premise.
        const row = bal === undefined ? null : { name: where.name, balanceCents: bal };
        journal.reads += 1;
        if (journal.reads === 1 && state.afterFirstRead) {
          await state.afterFirstRead(where.name);
        }
        return row;
      },
      /**
       * UNGUARDED decrement — the OLD shape. Kept even though balance.ts no
       * longer calls it: if a debit ever regresses to this, the "guarded
       * updateMany" assertions must FAIL on the recorded op rather than blow up
       * with "update is not a function" and look like a broken fake.
       */
      update: async ({
        where,
        data,
      }: {
        where: { name: string };
        data: { balanceCents?: { decrement?: number; increment?: number } };
        select?: unknown;
      }) => {
        const current = state.users.get(where.name) ?? 0;
        const dec = data.balanceCents?.decrement ?? 0;
        const inc = data.balanceCents?.increment ?? 0;
        const delta = inc - dec;
        const next = current + delta;
        record(journal, {
          model: 'driveUser',
          op: 'update',
          data: { name: where.name, guardGte: null, next },
        });
        state.users.set(where.name, next);
        journal.balanceDeltas.push({ user: where.name, delta });
        return { balanceCents: next };
      },
      /**
       * The CONDITIONAL debit. The funds check lives in the WHERE clause, so
       * check-and-decrement is ONE statement — modelled here as a body with no
       * await between the compare and the write, which is exactly what Postgres
       * guarantees for a single UPDATE holding the row lock. A transaction that
       * lost the race matches 0 rows and writes nothing.
       */
      updateMany: async ({
        where,
        data,
      }: {
        where: { name: string; balanceCents?: { gte?: number } };
        data: { balanceCents?: { decrement?: number; increment?: number } };
      }) => {
        state.debitAttempts += 1;
        const current = state.users.get(where.name);
        const guardGte = where.balanceCents?.gte;
        const lostRace = state.loseDebitRaceOn.has(state.debitAttempts);
        if (current === undefined || lostRace) return { count: 0 };
        if (guardGte !== undefined && current < guardGte) return { count: 0 };

        const dec = data.balanceCents?.decrement ?? 0;
        const inc = data.balanceCents?.increment ?? 0;
        const delta = inc - dec;
        const next = current + delta;
        record(journal, {
          model: 'driveUser',
          op: 'updateMany',
          data: { name: where.name, guardGte: guardGte ?? null, next },
        });
        state.users.set(where.name, next);
        journal.balanceDeltas.push({ user: where.name, delta });
        return { count: 1 };
      },
    },
    mpTransaction: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        record(journal, { model: 'mpTransaction', op: 'create', data });
        return { id: `tx-${state.writes.length}`, ...data };
      },
    },
    mpOrder: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        record(journal, { model: 'mpOrder', op: 'create', data });
        orderSeq += 1;
        return { id: `order-${orderSeq}`, ...data };
      },
    },
  };
}

vi.mock('@/lib/prisma', () => ({
  prisma: {
    // Rolls back on throw: every balance delta this callback applied is
    // reversed and its writes never reach `committed` — what a real Postgres
    // transaction does. Deltas rather than a whole-state snapshot, because a
    // snapshot restore would silently un-do a CONCURRENT transaction's
    // committed debit.
    $transaction: async <T,>(fn: (tx: ReturnType<typeof makeTx>) => Promise<T>): Promise<T> => {
      state.transactions += 1;
      const journal: Journal = { balanceDeltas: [], writes: [], reads: 0 };
      try {
        const out = await fn(makeTx(journal));
        state.committed.push(...journal.writes);
        return out;
      } catch (err) {
        for (const { user, delta } of journal.balanceDeltas.reverse()) {
          state.users.set(user, (state.users.get(user) ?? 0) - delta);
        }
        throw err;
      }
    },
    driveUser: {
      findUnique: async ({ where }: { where: { name: string } }) => {
        const bal = state.users.get(where.name);
        return bal === undefined ? null : { balanceCents: bal };
      },
    },
  },
}));

// Imported AFTER the mock so the stubbed prisma is what it binds to.
import { credit, debit, placeOrder, InsufficientFundsError, type OrderItem } from '../balance';

function reset(balances: Record<string, number> = {}) {
  state.users = new Map(Object.entries(balances));
  state.writes = [];
  state.committed = [];
  state.transactions = 0;
  state.debitAttempts = 0;
  state.loseDebitRaceOn = new Set();
  state.afterFirstRead = null;
}

beforeEach(() => {
  reset();
});

function cart(name: string, priceCents: number, qty = 1): OrderItem[] {
  return [{ productId: `p-${name}`, name, qty, priceCents }];
}

/**
 * Park BOTH transactions at the instant after their first balance read, so each
 * decides "I can afford this" against the same pre-spend number, then release
 * them to write. This is precisely what Prisma + READ COMMITTED allows:
 * findUnique takes no row lock and the code never re-checks.
 */
function parkBothAfterFirstRead() {
  let open!: () => void;
  const gate = new Promise<void>((resolve) => {
    open = resolve;
  });
  let arrived = 0;
  state.afterFirstRead = async () => {
    arrived += 1;
    if (arrived >= 2) open();
    else await gate;
  };
}

function settle<T>(p: Promise<T>) {
  return p.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
}

// ---------------------------------------------------------------------------
// debit — the shape of the guard
// ---------------------------------------------------------------------------

describe('debit', () => {
  it('debits with a guarded updateMany, not a blind decrement', async () => {
    reset({ kid: 10_000 });
    await debit('kid', 2_500, 'spend', 'candy');

    const write = state.committed.find((w) => w.model === 'driveUser')!;
    expect(write.op).toBe('updateMany');
    // The funds check IS the write's WHERE clause. That is the whole guarantee:
    // if this regresses to a plain `update`, guardGte disappears and the
    // database stops enforcing sufficiency.
    expect(write.data.guardGte).toBe(2_500);
    expect(write.data.name).toBe('kid');
  });

  it('writes the balance change and the ledger row in ONE transaction', async () => {
    reset({ kid: 10_000 });
    const balance = await debit('kid', 2_500, 'spend', 'candy');

    expect(balance).toBe(7_500);
    expect(state.transactions).toBe(1);
    const models = state.committed.map((w) => w.model);
    expect(models).toContain('driveUser');
    expect(models).toContain('mpTransaction');

    const ledger = state.committed.find((w) => w.model === 'mpTransaction')!;
    expect(ledger.data.cents).toBe(-2_500);
    expect(ledger.data.type).toBe('spend');
    expect(ledger.data.userName).toBe('kid');
    expect(ledger.data.orderId).toBeNull();
  });

  it('links orderId onto the ledger row when given one', async () => {
    reset({ kid: 10_000 });
    await debit('kid', 100, 'spend', 'thing', 'order-abc');
    const ledger = state.committed.find((w) => w.model === 'mpTransaction')!;
    expect(ledger.data.orderId).toBe('order-abc');
  });

  it('returns the balance the update produced, not the stale read', async () => {
    reset({ kid: 10_000 });
    // A rival credit lands between our read and our write. The number we return
    // must reflect the row as it actually stands, not read-minus-amount.
    state.afterFirstRead = async () => {
      state.users.set('kid', 10_000 + 5_000);
    };
    const balance = await debit('kid', 2_500, 'spend', 'candy');
    expect(balance).toBe(12_500);
    expect(state.users.get('kid')).toBe(12_500);
  });

  // --- the overdraft race ---

  it('two concurrent debits on a balance that covers only one cannot both succeed', async () => {
    // Enough for exactly ONE 600-cent debit.
    reset({ kid: 600 });
    parkBothAfterFirstRead();

    const results = await Promise.all([
      settle(debit('kid', 600, 'spend', 'first')),
      settle(debit('kid', 600, 'spend', 'second')),
    ]);

    // Both read 600 and both believed they could afford it. Only one may spend.
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const losers = results.filter((r) => !r.ok);
    expect(losers).toHaveLength(1);
    expect((losers[0] as { error: unknown }).error).toBeInstanceOf(InsufficientFundsError);
    expect(state.debitAttempts).toBe(2);

    // THE assertion: the wallet never goes negative.
    expect(state.users.get('kid')).toBe(0);
    expect(state.users.get('kid')!).toBeGreaterThanOrEqual(0);

    // The loser left NOTHING behind — no debit, no ledger row.
    expect(state.committed.filter((w) => w.model === 'driveUser')).toHaveLength(1);
    expect(state.committed.filter((w) => w.model === 'mpTransaction')).toHaveLength(1);
  });

  it('two concurrent debits of DIFFERENT amounts cannot overdraft', async () => {
    // Covers either one alone (400 or 500), never both.
    reset({ kid: 500 });
    parkBothAfterFirstRead();

    const results = await Promise.all([
      settle(debit('kid', 400, 'spend', 'small')),
      settle(debit('kid', 500, 'spend', 'large')),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toHaveLength(1);
    expect(state.users.get('kid')!).toBeGreaterThanOrEqual(0);
    expect(state.committed.filter((w) => w.model === 'mpTransaction')).toHaveLength(1);
  });

  it('a debit that matches 0 rows at commit time charges nothing', async () => {
    // Plenty of MP in the wallet, so ONLY the guard can produce this outcome:
    // the second conditional debit is forced to match 0 rows, exactly as
    // Postgres does when it re-evaluates the WHERE after a rival commits.
    reset({ kid: 100_000 });
    state.loseDebitRaceOn = new Set([2]);

    const results = await Promise.all([
      settle(debit('kid', 1_000, 'spend', 'a')),
      settle(debit('kid', 1_000, 'spend', 'b')),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const loser = results.find((r) => !r.ok)!;
    expect((loser as { error: unknown }).error).toBeInstanceOf(InsufficientFundsError);

    // Exactly one debit stuck; the blocked one is fully rolled back.
    expect(state.users.get('kid')).toBe(99_000);
    expect(state.committed.filter((w) => w.model === 'driveUser')).toHaveLength(1);
    expect(state.committed.filter((w) => w.model === 'mpTransaction')).toHaveLength(1);
  });

  it('reports a guard failure against the FRESH balance, not the stale read', async () => {
    reset({ kid: 100_000 });
    // A rival's spend lands between our read and our write. Nothing is forced
    // here — the WHERE clause is what refuses the debit.
    state.afterFirstRead = async () => {
      state.users.set('kid', 10);
    };

    const err = await debit('kid', 5_000, 'spend', 'candy').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InsufficientFundsError);
    // 10, not the 100,000 the transaction originally read.
    expect((err as InsufficientFundsError).balanceCents).toBe(10);
    expect((err as InsufficientFundsError).neededCents).toBe(5_000);
    expect((err as InsufficientFundsError).message).toBe('Insufficient funds: have 10, need 5000');
    expect(state.users.get('kid')).toBe(10);
    expect(state.committed).toHaveLength(0);
  });

  // --- ordinary insufficiency, unchanged behavior ---

  it('refuses an overspend, charges nothing, and keeps the error shape', async () => {
    reset({ kid: 500 });
    const err = await debit('kid', 600, 'spend', 'too much').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InsufficientFundsError);
    expect((err as InsufficientFundsError).name).toBe('InsufficientFundsError');
    expect((err as InsufficientFundsError).balanceCents).toBe(500);
    expect((err as InsufficientFundsError).neededCents).toBe(600);
    expect((err as InsufficientFundsError).message).toBe('Insufficient funds: have 500, need 600');
    expect(state.users.get('kid')).toBe(500);
    expect(state.committed).toHaveLength(0);
  });

  it('exact-change debit is allowed and lands on zero', async () => {
    reset({ kid: 750 });
    expect(await debit('kid', 750, 'spend', 'all of it')).toBe(0);
    expect(state.users.get('kid')).toBe(0);
  });

  it('one cent short is still short', async () => {
    reset({ kid: 749 });
    await expect(debit('kid', 750, 'spend', 'nope')).rejects.toBeInstanceOf(
      InsufficientFundsError,
    );
    expect(state.users.get('kid')).toBe(749);
  });

  it('rejects non-positive / non-integer cents before opening a transaction', async () => {
    reset({ kid: 10_000 });
    for (const bad of [0, -1, 2.5, Number.NaN]) {
      await expect(debit('kid', bad, 'spend', 'bad')).rejects.toThrow(
        'debit() requires positive integer cents',
      );
    }
    expect(state.transactions).toBe(0);
  });

  it('throws User not found for an unknown kid and writes nothing', async () => {
    reset({});
    await expect(debit('ghost', 100, 'spend', 'x')).rejects.toThrow('User not found');
    expect(state.committed).toHaveLength(0);
  });

  it('normalizes the username the same way the ledger does', async () => {
    reset({ kid: 10_000 });
    await debit('  KID  ', 100, 'spend', 'x');
    const ledger = state.committed.find((w) => w.model === 'mpTransaction')!;
    expect(ledger.data.userName).toBe('kid');
  });
});

// ---------------------------------------------------------------------------
// placeOrder — the shop checkout
// ---------------------------------------------------------------------------

describe('placeOrder', () => {
  it('debits with a guarded updateMany, not a blind decrement', async () => {
    reset({ kid: 10_000 });
    await placeOrder('kid', cart('ball', 2_500), 2_500);

    const write = state.committed.find((w) => w.model === 'driveUser')!;
    expect(write.op).toBe('updateMany');
    expect(write.data.guardGte).toBe(2_500);
  });

  it('writes order + balance + ledger in ONE transaction with orderId linked', async () => {
    reset({ kid: 10_000 });
    const result = await placeOrder('kid', cart('ball', 2_500), 2_500);

    expect(state.transactions).toBe(1);
    const models = state.committed.map((w) => w.model);
    expect(models).toContain('mpOrder');
    expect(models).toContain('driveUser');
    expect(models).toContain('mpTransaction');

    const ledger = state.committed.find((w) => w.model === 'mpTransaction')!;
    expect(ledger.data.cents).toBe(-2_500);
    expect(ledger.data.type).toBe('spend');
    expect(ledger.data.orderId).toBe(result.orderId);
    expect(ledger.data.reason).toBe(`Order ${result.orderId}`);

    const order = state.committed.find((w) => w.model === 'mpOrder')!;
    expect(order.data.totalCents).toBe(2_500);
    expect(order.data.status).toBe('fulfilled');
    expect(order.data.userName).toBe('kid');
  });

  // --- the stale return value ---

  it('returns the balance the UPDATE produced, not the stale pre-read minus total', async () => {
    reset({ kid: 10_000 });
    // A gift is credited between placeOrder's balance read and its debit. The
    // old code returned `user.balanceCents - totalCents` = 10_000 - 2_500 =
    // 7_500, which is simply wrong: the row actually holds 12_500.
    state.afterFirstRead = async () => {
      state.users.set('kid', 10_000 + 5_000);
    };

    const result = await placeOrder('kid', cart('ball', 2_500), 2_500);

    expect(result.balanceCents).toBe(12_500);
    expect(result.balanceCents).not.toBe(7_500); // the stale answer
    // And the returned number agrees with the row the DB now holds.
    expect(result.balanceCents).toBe(state.users.get('kid'));
  });

  it('the returned balance always equals the stored balance', async () => {
    reset({ kid: 4_321 });
    const result = await placeOrder('kid', cart('ball', 1_111), 1_111);
    expect(result.balanceCents).toBe(state.users.get('kid'));
    expect(result.balanceCents).toBe(3_210);
  });

  // --- the checkout overdraft race ---

  it('two concurrent orders with DIFFERENT carts cannot both succeed', async () => {
    // Enough for the dearer ONE of the two carts — never for both.
    reset({ kid: 3_000 });
    parkBothAfterFirstRead();

    const results = await Promise.all([
      settle(placeOrder('kid', cart('bike', 3_000), 3_000)),
      settle(placeOrder('kid', cart('book', 2_000), 2_000)),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const losers = results.filter((r) => !r.ok);
    expect(losers).toHaveLength(1);
    expect((losers[0] as { error: unknown }).error).toBeInstanceOf(InsufficientFundsError);
    expect(state.debitAttempts).toBe(2);

    // THE assertion: the wallet never goes negative.
    expect(state.users.get('kid')!).toBeGreaterThanOrEqual(0);

    // Exactly ONE order, ONE debit, ONE ledger row survived. The loser's
    // MpOrder row rolled back with everything else — no unpaid order.
    expect(state.committed.filter((w) => w.model === 'mpOrder')).toHaveLength(1);
    expect(state.committed.filter((w) => w.model === 'driveUser')).toHaveLength(1);
    expect(state.committed.filter((w) => w.model === 'mpTransaction')).toHaveLength(1);

    const won = results.find((r) => r.ok) as { value: { balanceCents: number } };
    expect(won.value.balanceCents).toBe(state.users.get('kid'));
  });

  it('an order whose debit matches 0 rows at commit time creates no order row', async () => {
    reset({ kid: 100_000 });
    state.loseDebitRaceOn = new Set([2]);

    const results = await Promise.all([
      settle(placeOrder('kid', cart('bike', 1_000), 1_000)),
      settle(placeOrder('kid', cart('book', 2_000), 2_000)),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const loser = results.find((r) => !r.ok)!;
    expect((loser as { error: unknown }).error).toBeInstanceOf(InsufficientFundsError);

    // Only the winner's money moved, and no orphan order/ledger row was left.
    expect(state.committed.filter((w) => w.model === 'mpOrder')).toHaveLength(1);
    expect(state.committed.filter((w) => w.model === 'mpTransaction')).toHaveLength(1);
    const paid = state.committed.find((w) => w.model === 'mpTransaction')!.data.cents as number;
    expect(state.users.get('kid')).toBe(100_000 + paid);
  });

  it('reports a guard failure against the FRESH balance', async () => {
    reset({ kid: 100_000 });
    state.afterFirstRead = async () => {
      state.users.set('kid', 42);
    };

    const err = await placeOrder('kid', cart('bike', 5_000), 5_000).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InsufficientFundsError);
    expect((err as InsufficientFundsError).balanceCents).toBe(42);
    expect((err as InsufficientFundsError).neededCents).toBe(5_000);
    expect(state.users.get('kid')).toBe(42);
    expect(state.committed).toHaveLength(0);
  });

  // --- unchanged behavior ---

  it('refuses an unaffordable order, charges nothing, and writes no order row', async () => {
    reset({ kid: 500 });
    const err = await placeOrder('kid', cart('bike', 3_000), 3_000).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InsufficientFundsError);
    expect((err as InsufficientFundsError).balanceCents).toBe(500);
    expect((err as InsufficientFundsError).neededCents).toBe(3_000);
    expect(state.users.get('kid')).toBe(500);
    expect(state.committed).toHaveLength(0);
  });

  it('exact-change order is allowed and lands on zero', async () => {
    reset({ kid: 3_000 });
    const result = await placeOrder('kid', cart('bike', 3_000), 3_000);
    expect(result.balanceCents).toBe(0);
    expect(state.users.get('kid')).toBe(0);
  });

  it('rejects an empty cart / bad total before opening a transaction', async () => {
    reset({ kid: 10_000 });
    await expect(placeOrder('kid', [], 100)).rejects.toThrow('Order has no items');
    for (const bad of [0, -1, 2.5]) {
      await expect(placeOrder('kid', cart('x', 100), bad)).rejects.toThrow(
        'Order total must be positive integer cents',
      );
    }
    expect(state.transactions).toBe(0);
  });

  it('throws User not found for an unknown kid and writes nothing', async () => {
    reset({});
    await expect(placeOrder('ghost', cart('x', 100), 100)).rejects.toThrow('User not found');
    expect(state.committed).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// credit — pure increment, nothing to race. Guard-rail only.
// ---------------------------------------------------------------------------

describe('credit', () => {
  it('increments and writes a positive ledger row in one transaction', async () => {
    reset({ kid: 1_000 });
    expect(await credit('kid', 250, 'earn', 'math')).toBe(1_250);
    const ledger = state.committed.find((w) => w.model === 'mpTransaction')!;
    expect(ledger.data.cents).toBe(250);
    expect(ledger.data.type).toBe('earn');
    expect(state.transactions).toBe(1);
  });

  it('two concurrent credits both land (no guard, and none needed)', async () => {
    reset({ kid: 0 });
    parkBothAfterFirstRead();
    await Promise.all([credit('kid', 100, 'earn', 'a'), credit('kid', 250, 'earn', 'b')]);
    expect(state.users.get('kid')).toBe(350);
    expect(state.committed.filter((w) => w.model === 'mpTransaction')).toHaveLength(2);
  });
});
