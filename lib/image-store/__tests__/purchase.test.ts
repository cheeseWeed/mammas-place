// Image-store purchase logic — NO DATABASE.
//
// `@/lib/prisma` is stubbed the same way tests/unit/site.test.ts does it, plus
// a hand-rolled fake that records every write the transaction callback makes.
// That lets us assert the things that actually matter for money:
//
//   * the price comes from the CATALOG, never from the caller,
//   * the debit and the MpTransaction ledger row happen in the SAME
//     $transaction as the ImagePurchase row,
//   * a duplicate buy (P2002 on the composite unique) charges NOTHING,
//   * insufficient funds charges NOTHING and reports the exact shortfall,
//   * every amount stays an integer number of cents,
//   * two concurrent buys of DIFFERENT images cannot overdraft the wallet.
//
// That last one is why the fake below models the debit as a CONDITIONAL
// statement (`updateMany` whose WHERE carries `balanceCents >= price`) that is
// atomic within a JS turn, and offers a hook to park a transaction at the exact
// instant between its read and its write. Postgres READ COMMITTED gives
// `findUnique` no row lock, so that interleaving is real — and the
// @@unique([userName, imageId]) constraint cannot catch it, because two
// different images are not a duplicate of anything.
//
// Also covers the download path-traversal guard, which is the security half of
// the feature.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'node:path';

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
  /** "user|imageId" keys that already exist */
  purchases: Set<string>;
  /** every write the LAST call attempted, in order */
  writes: FakeWrite[];
  /** writes that survived (i.e. the transaction committed) */
  committed: FakeWrite[];
  transactions: number;
  /** how many conditional debits have been ATTEMPTED (won or lost) */
  debitAttempts: number;
  /**
   * Force those attempt ordinals to match 0 rows — i.e. Postgres re-evaluated
   * `balanceCents >= price` after a rival transaction committed and found the
   * money gone. Lets a test prove the guard without depending on scheduling.
   */
  loseDebitRaceOn: Set<number>;
  /**
   * Awaited right after a transaction takes its FIRST balance read (and after
   * the value has been snapshotted, so the caller holds a stale number). This
   * is the only way to park one buy in the read→write window while another buy
   * runs — the race the guard exists to lose safely.
   */
  afterFirstRead: ((userName: string) => Promise<void>) | null;
}

const state: FakeState = {
  users: new Map(),
  purchases: new Set(),
  writes: [],
  committed: [],
  transactions: 0,
  debitAttempts: 0,
  loseDebitRaceOn: new Set(),
  afterFirstRead: null,
};

/** Prisma-shaped unique-constraint error, as the real client would throw it. */
class FakeP2002 extends Error {
  code = 'P2002';
  constructor() {
    super('Unique constraint failed on the fields: (`userName`,`imageId`)');
    this.name = 'PrismaClientKnownRequestError';
  }
}

/**
 * Per-transaction undo log. Rolling back a whole-state SNAPSHOT would be wrong
 * once several transactions overlap (a late failure would restore a stale copy
 * and silently un-do a sibling's committed debit), so each transaction records
 * only the deltas IT applied and reverses exactly those.
 */
interface Journal {
  balanceDeltas: Array<{ user: string; delta: number }>;
  purchaseKeys: string[];
  /** Writes THIS transaction made — `state.writes` is shared, so it cannot be sliced. */
  writes: FakeWrite[];
  /** Balance reads this transaction has taken; the interleave hook fires on #1. */
  reads: number;
}

function record(journal: Journal, write: FakeWrite) {
  state.writes.push(write);
  journal.writes.push(write);
}

function makeTx(journal: Journal) {
  return {
    driveUser: {
      findUnique: async ({ where }: { where: { name: string } }) => {
        const bal = state.users.get(where.name);
        // Snapshot BEFORE the hook: a parked transaction must come back holding
        // the stale number it read, which is exactly what makes the race real.
        const row = bal === undefined ? null : { name: where.name, balanceCents: bal };
        journal.reads += 1;
        if (journal.reads === 1 && state.afterFirstRead) {
          await state.afterFirstRead(where.name);
        }
        return row;
      },
      /**
       * UNGUARDED decrement. Deliberately still here even though purchase.ts
       * no longer calls it: if the debit ever regresses to this shape the
       * "guarded updateMany" test must FAIL on the recorded op, not blow up
       * with "update is not a function" and look like a broken fake.
       */
      update: async ({
        where,
        data,
      }: {
        where: { name: string };
        data: { balanceCents?: { decrement?: number; increment?: number } };
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
       * check-and-decrement is ONE statement — modelled here as a synchronous
       * body with no await between the compare and the write, which is what
       * Postgres guarantees for a single UPDATE holding the row lock. A
       * transaction that lost the race matches 0 rows and writes nothing.
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
    imagePurchase: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        record(journal, { model: 'imagePurchase', op: 'create', data });
        const key = `${data.userName}|${data.imageId}`;
        // The DB unique constraint IS the duplicate gate — mirror that here.
        if (state.purchases.has(key)) throw new FakeP2002();
        state.purchases.add(key);
        journal.purchaseKeys.push(key);
        return { id: `ip-${state.writes.length}`, ...data };
      },
    },
  };
}

vi.mock('@/lib/prisma', () => ({
  prisma: {
    // Rolls back on throw: every write this callback made is reversed, so a
    // failed buy leaves the wallet exactly as it found it — what a real
    // Postgres transaction does.
    $transaction: async (fn: (tx: ReturnType<typeof makeTx>) => Promise<number>) => {
      state.transactions += 1;
      const journal: Journal = { balanceDeltas: [], purchaseKeys: [], writes: [], reads: 0 };
      try {
        const out = await fn(makeTx(journal));
        state.committed.push(...journal.writes);
        return out;
      } catch (err) {
        for (const { user, delta } of journal.balanceDeltas.reverse()) {
          state.users.set(user, (state.users.get(user) ?? 0) - delta);
        }
        for (const key of journal.purchaseKeys) state.purchases.delete(key);
        throw err;
      }
    },
    driveUser: {
      findUnique: async ({ where }: { where: { name: string } }) => {
        const bal = state.users.get(where.name);
        return bal === undefined ? null : { balanceCents: bal };
      },
    },
    imagePurchase: {
      findUnique: async ({
        where,
      }: {
        where: { userName_imageId: { userName: string; imageId: string } };
      }) => {
        const { userName, imageId } = where.userName_imageId;
        return state.purchases.has(`${userName}|${imageId}`) ? { id: 'ip-1' } : null;
      },
      findMany: async ({ where }: { where: { userName: string } }) => {
        return Array.from(state.purchases)
          .filter((k) => k.startsWith(`${where.userName}|`))
          .map((k, i) => ({
            imageId: k.split('|')[1],
            pricePaidCents: 400,
            createdAt: new Date(2026, 0, i + 1),
          }));
      },
    },
  },
}));

// Imported AFTER the mocks so the stubbed prisma is what they bind to.
import { IMAGE_CATALOG, getImageById, priceCentsFor, setProgressFor } from '../catalog';
import { ownsImage, purchaseImage, listPurchases } from '../purchase';
import { downloadFileName, originalsDir, resolveOriginalPath } from '../originals';

// A real, cheap catalog entry + a real expensive misprint — using the SHIPPED
// catalog on purpose, so a data change that breaks pricing fails a test.
const CHEAP = IMAGE_CATALOG.find((e) => e.tier === 'archive')!;
const MISPRINT = IMAGE_CATALOG.find((e) => e.tier === 'misprint')!;

function reset(balances: Record<string, number> = {}) {
  state.users = new Map(Object.entries(balances));
  state.purchases = new Set();
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

// ---------------------------------------------------------------------------
// Catalog is the price authority
// ---------------------------------------------------------------------------

describe('catalog', () => {
  it('ships a non-empty catalog with integer-cent prices only', () => {
    expect(IMAGE_CATALOG.length).toBeGreaterThan(0);
    for (const entry of IMAGE_CATALOG) {
      expect(Number.isInteger(entry.priceCents)).toBe(true);
      expect(entry.priceCents).toBeGreaterThan(0);
    }
  });

  it('never exposes an original path through a preview url', () => {
    for (const entry of IMAGE_CATALOG) {
      expect(entry.watermarkedPreview.startsWith('/image-store/previews/')).toBe(true);
      expect(entry.watermarkedPreview).not.toContain('assets/');
    }
  });

  it('returns null for unknown / non-string ids instead of throwing', () => {
    expect(getImageById('nope-does-not-exist')).toBeNull();
    expect(getImageById(undefined)).toBeNull();
    expect(getImageById(42)).toBeNull();
    expect(priceCentsFor('nope')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Buying
// ---------------------------------------------------------------------------

describe('purchaseImage', () => {
  it('charges the CATALOG price and writes debit + ledger + entitlement in one transaction', async () => {
    reset({ kid: 10_000 });
    const result = await purchaseImage('kid', CHEAP.id);

    expect(result.ok).toBe(true);
    expect(result.status).toBe('purchased');
    if (result.status !== 'purchased') throw new Error('unreachable');
    expect(result.pricePaidCents).toBe(CHEAP.priceCents);
    expect(result.balanceCents).toBe(10_000 - CHEAP.priceCents);

    // Exactly one transaction, and all three writes landed inside it.
    expect(state.transactions).toBe(1);
    const models = state.committed.map((w) => w.model);
    expect(models).toContain('driveUser');
    expect(models).toContain('mpTransaction');
    expect(models).toContain('imagePurchase');

    // The ledger row is a NEGATIVE integer of exactly the price, typed 'spend'.
    const ledger = state.committed.find((w) => w.model === 'mpTransaction')!;
    expect(ledger.data.cents).toBe(-CHEAP.priceCents);
    expect(Number.isInteger(ledger.data.cents)).toBe(true);
    expect(ledger.data.type).toBe('spend');
    expect(ledger.data.userName).toBe('kid');

    // The entitlement snapshots what was actually paid.
    const entitlement = state.committed.find((w) => w.model === 'imagePurchase')!;
    expect(entitlement.data.imageId).toBe(CHEAP.id);
    expect(entitlement.data.pricePaidCents).toBe(CHEAP.priceCents);
  });

  it('writes the entitlement LAST so a duplicate aborts before money sticks', async () => {
    reset({ kid: 10_000 });
    await purchaseImage('kid', CHEAP.id);
    const order = state.committed.map((w) => w.model);
    expect(order.indexOf('imagePurchase')).toBe(order.length - 1);
    expect(order.indexOf('driveUser')).toBeLessThan(order.indexOf('imagePurchase'));
    expect(order.indexOf('mpTransaction')).toBeLessThan(order.indexOf('imagePurchase'));
  });

  it('IGNORES any price the caller tries to smuggle in', async () => {
    reset({ kid: 10_000 });
    // purchaseImage only accepts an id — an object pretending to be an entry
    // is not a string, so it cannot even name a piece.
    const forged = await purchaseImage('kid', {
      id: CHEAP.id,
      priceCents: 1,
    } as unknown as string);
    expect(forged.ok).toBe(false);
    expect(forged.status).toBe('unknown-image');
    expect(state.users.get('kid')).toBe(10_000); // untouched

    // And buying it properly still costs the catalog price.
    const real = await purchaseImage('kid', CHEAP.id);
    if (real.status !== 'purchased') throw new Error('unreachable');
    expect(real.pricePaidCents).toBe(CHEAP.priceCents);
  });

  it('normalizes the username the same way the ledger does', async () => {
    reset({ kid: 10_000 });
    const result = await purchaseImage('  KID  ', CHEAP.id);
    expect(result.status).toBe('purchased');
    const ledger = state.committed.find((w) => w.model === 'mpTransaction')!;
    expect(ledger.data.userName).toBe('kid');
  });

  // --- duplicates ---

  it('second buy of the same piece is "already-owned" and charges nothing', async () => {
    reset({ kid: 10_000 });
    await purchaseImage('kid', CHEAP.id);
    const balanceAfterFirst = state.users.get('kid')!;

    const second = await purchaseImage('kid', CHEAP.id);
    expect(second.ok).toBe(false);
    expect(second.status).toBe('already-owned');
    if (second.status !== 'already-owned') throw new Error('unreachable');
    expect(second.title).toBe(CHEAP.title);
    expect(second.balanceCents).toBe(balanceAfterFirst);

    // Nothing extra committed, and the balance did NOT move.
    expect(state.users.get('kid')).toBe(balanceAfterFirst);
    expect(state.committed.filter((w) => w.model === 'mpTransaction')).toHaveLength(1);
    expect(state.committed.filter((w) => w.model === 'imagePurchase')).toHaveLength(1);
  });

  it('ten concurrent taps on Buy charge exactly once', async () => {
    reset({ kid: 100_000 });
    const results = await Promise.all(
      Array.from({ length: 10 }, () => purchaseImage('kid', CHEAP.id)),
    );
    const bought = results.filter((r) => r.status === 'purchased');
    const dupes = results.filter((r) => r.status === 'already-owned');
    expect(bought).toHaveLength(1);
    expect(dupes).toHaveLength(9);
    expect(state.users.get('kid')).toBe(100_000 - CHEAP.priceCents);
    expect(state.committed.filter((w) => w.model === 'imagePurchase')).toHaveLength(1);
  });

  it('two different kids can each own the same piece', async () => {
    reset({ kid: 10_000, sibling: 10_000 });
    const a = await purchaseImage('kid', CHEAP.id);
    const b = await purchaseImage('sibling', CHEAP.id);
    expect(a.status).toBe('purchased');
    expect(b.status).toBe('purchased');
  });

  it('owning one piece does not block buying a different one', async () => {
    reset({ kid: 100_000 });
    await purchaseImage('kid', CHEAP.id);
    const other = IMAGE_CATALOG.find((e) => e.id !== CHEAP.id)!;
    const second = await purchaseImage('kid', other.id);
    expect(second.status).toBe('purchased');
  });

  // --- the cross-image overdraft race ---
  //
  // The "ten concurrent taps" test above proves the DUPLICATE guard and nothing
  // more: same image, so @@unique([userName, imageId]) catches it. Two buys of
  // two DIFFERENT images collide on no constraint at all — the only thing
  // standing between them and a negative wallet is that the funds check is part
  // of the debit STATEMENT rather than a read that happened earlier.

  const OTHER = IMAGE_CATALOG.find((e) => e.id !== CHEAP.id)!;

  it('debits with a guarded updateMany, not a blind decrement', async () => {
    reset({ kid: 10_000 });
    await purchaseImage('kid', CHEAP.id);

    const debit = state.committed.find((w) => w.model === 'driveUser')!;
    expect(debit.op).toBe('updateMany');
    // The funds check IS the write's WHERE clause. That is the whole guarantee:
    // if this ever regresses to a plain `update`, `guardGte` disappears and the
    // database stops enforcing sufficiency.
    expect(debit.data.guardGte).toBe(CHEAP.priceCents);
    expect(debit.data.name).toBe('kid');
  });

  it('two concurrent buys of DIFFERENT images cannot overdraft the wallet', async () => {
    // Enough MP for the dearer ONE of the two — never for both.
    const balance = Math.max(CHEAP.priceCents, OTHER.priceCents);
    reset({ kid: balance });

    // Park BOTH transactions at the instant after they read the balance, so
    // each decides "I can afford this" against the same pre-spend number, then
    // let them both proceed to write. This is precisely what Prisma +
    // READ COMMITTED allows: findUnique takes no row lock and never re-checks.
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

    const results = await Promise.all([
      purchaseImage('kid', CHEAP.id),
      purchaseImage('kid', OTHER.id),
    ]);

    // Both read the same balance; only one is allowed to spend it.
    expect(results.filter((r) => r.status === 'purchased')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'insufficient-funds')).toHaveLength(1);
    expect(state.debitAttempts).toBe(2);

    const won = results.find((r) => r.status === 'purchased');
    if (!won || won.status !== 'purchased') throw new Error('unreachable');
    const lost = results.find((r) => r.status === 'insufficient-funds');
    if (!lost || lost.status !== 'insufficient-funds') throw new Error('unreachable');

    // THE assertion: the wallet never goes negative.
    expect(state.users.get('kid')).toBe(balance - won.pricePaidCents);
    expect(state.users.get('kid')!).toBeGreaterThanOrEqual(0);

    // The loser left nothing behind — no debit, no ledger row, no entitlement.
    expect(state.committed.filter((w) => w.model === 'driveUser')).toHaveLength(1);
    expect(state.committed.filter((w) => w.model === 'mpTransaction')).toHaveLength(1);
    expect(state.committed.filter((w) => w.model === 'imagePurchase')).toHaveLength(1);
    expect(await ownsImage('kid', won.imageId)).toBe(true);
    expect(await ownsImage('kid', lost.imageId)).toBe(false);
  });

  it('a debit that matches 0 rows at commit time charges nothing and grants nothing', async () => {
    reset({ kid: 100_000 });
    // Force the SECOND conditional debit to match 0 rows — what Postgres
    // returns when it re-evaluates `balanceCents >= price` after the rival
    // transaction committed and the money is already gone. Plenty of MP in the
    // wallet, so ONLY the guard can produce this outcome.
    state.loseDebitRaceOn = new Set([2]);

    const results = await Promise.all([
      purchaseImage('kid', CHEAP.id),
      purchaseImage('kid', OTHER.id),
    ]);

    expect(results.filter((r) => r.status === 'purchased')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'insufficient-funds')).toHaveLength(1);

    const won = results.find((r) => r.status === 'purchased');
    if (!won || won.status !== 'purchased') throw new Error('unreachable');
    const lost = results.find((r) => r.status === 'insufficient-funds');
    if (!lost || lost.status !== 'insufficient-funds') throw new Error('unreachable');

    // Exactly one piece was paid for; the blocked one is fully rolled back.
    expect(state.users.get('kid')).toBe(100_000 - won.pricePaidCents);
    expect(state.users.get('kid')!).toBeGreaterThanOrEqual(0);
    expect(state.committed.filter((w) => w.model === 'imagePurchase')).toHaveLength(1);
    expect(state.committed.filter((w) => w.model === 'mpTransaction')).toHaveLength(1);
    expect(await ownsImage('kid', lost.imageId)).toBe(false);
  });

  it('a guard failure is reported against the FRESH balance, not the stale read', async () => {
    reset({ kid: 100_000 });
    // A rival's spend lands between our read and our write. Nothing is forced
    // here — the WHERE clause is what refuses the debit.
    state.afterFirstRead = async () => {
      state.users.set('kid', 10);
    };

    const result = await purchaseImage('kid', CHEAP.id);
    expect(result.status).toBe('insufficient-funds');
    if (result.status !== 'insufficient-funds') throw new Error('unreachable');
    // 10, not the 100,000 the transaction originally read.
    expect(result.balanceCents).toBe(10);
    expect(result.shortfallCents).toBe(CHEAP.priceCents - 10);
    expect(state.users.get('kid')).toBe(10);
    expect(state.committed).toHaveLength(0);
  });

  // --- insufficient funds ---

  it('refuses when the kid is short, charges nothing, and reports the exact shortfall', async () => {
    const balance = MISPRINT.priceCents - 250;
    reset({ kid: balance });
    const result = await purchaseImage('kid', MISPRINT.id);

    expect(result.ok).toBe(false);
    expect(result.status).toBe('insufficient-funds');
    if (result.status !== 'insufficient-funds') throw new Error('unreachable');
    expect(result.priceCents).toBe(MISPRINT.priceCents);
    expect(result.balanceCents).toBe(balance);
    expect(result.shortfallCents).toBe(250);

    // Rolled back: no ledger row, no entitlement, balance untouched.
    expect(state.users.get('kid')).toBe(balance);
    expect(state.committed).toHaveLength(0);
    expect(await ownsImage('kid', MISPRINT.id)).toBe(false);
  });

  it('exact-change purchase is allowed and lands on zero', async () => {
    reset({ kid: CHEAP.priceCents });
    const result = await purchaseImage('kid', CHEAP.id);
    expect(result.status).toBe('purchased');
    expect(state.users.get('kid')).toBe(0);
  });

  it('one cent short is still short', async () => {
    reset({ kid: CHEAP.priceCents - 1 });
    const result = await purchaseImage('kid', CHEAP.id);
    expect(result.status).toBe('insufficient-funds');
    if (result.status !== 'insufficient-funds') throw new Error('unreachable');
    expect(result.shortfallCents).toBe(1);
  });

  it('a zero balance never goes negative', async () => {
    reset({ kid: 0 });
    await purchaseImage('kid', CHEAP.id);
    expect(state.users.get('kid')).toBe(0);
  });

  // --- bad input ---

  it('unknown image id is a value, not a throw', async () => {
    reset({ kid: 10_000 });
    const result = await purchaseImage('kid', 'not-a-real-piece');
    expect(result.status).toBe('unknown-image');
    expect(state.transactions).toBe(0);
  });

  it('unknown user never opens a transaction', async () => {
    reset({});
    const result = await purchaseImage('ghost', CHEAP.id);
    expect(result.status).toBe('unknown-user');
    expect(state.committed).toHaveLength(0);
  });

  it('blank username is rejected before any DB work', async () => {
    reset({ kid: 10_000 });
    const result = await purchaseImage('   ', CHEAP.id);
    expect(result.status).toBe('unknown-user');
    expect(state.transactions).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Entitlement reads (what the download route trusts)
// ---------------------------------------------------------------------------

describe('ownsImage', () => {
  it('is false before the buy and true after', async () => {
    reset({ kid: 10_000 });
    expect(await ownsImage('kid', CHEAP.id)).toBe(false);
    await purchaseImage('kid', CHEAP.id);
    expect(await ownsImage('kid', CHEAP.id)).toBe(true);
  });

  it("one kid's purchase does not entitle another kid", async () => {
    reset({ kid: 10_000, sibling: 10_000 });
    await purchaseImage('kid', CHEAP.id);
    expect(await ownsImage('sibling', CHEAP.id)).toBe(false);
  });

  it('is false for empty / non-string ids and anonymous users', async () => {
    reset({ kid: 10_000 });
    await purchaseImage('kid', CHEAP.id);
    expect(await ownsImage('kid', '')).toBe(false);
    expect(await ownsImage('kid', null)).toBe(false);
    expect(await ownsImage('', CHEAP.id)).toBe(false);
  });

  it('listPurchases is scoped to the requesting kid', async () => {
    reset({ kid: 100_000, sibling: 100_000 });
    await purchaseImage('kid', CHEAP.id);
    const other = IMAGE_CATALOG.find((e) => e.id !== CHEAP.id)!;
    await purchaseImage('sibling', other.id);

    const mine = await listPurchases('kid');
    expect(mine.map((p) => p.imageId)).toEqual([CHEAP.id]);
  });
});

// ---------------------------------------------------------------------------
// Set completion
// ---------------------------------------------------------------------------

describe('setProgressFor', () => {
  it('counts owned vs total for a real set', () => {
    const set = IMAGE_CATALOG.filter((e) => e.setName === CHEAP.setName);
    const [progress] = setProgressFor([set[0].id]);
    expect(progress.setName).toBe(CHEAP.setName);
    expect(progress.owned).toBe(1);
    expect(progress.total).toBe(set.length);
    expect(progress.complete).toBe(set.length === 1);
  });

  it('marks a set complete only when every piece is owned', () => {
    const set = IMAGE_CATALOG.filter((e) => e.setName === CHEAP.setName);
    const [progress] = setProgressFor(set.map((e) => e.id));
    expect(progress.owned).toBe(set.length);
    expect(progress.complete).toBe(true);
  });

  it('ignores duplicates and unknown ids', () => {
    const [progress] = setProgressFor([CHEAP.id, CHEAP.id, 'retired-piece-999']);
    expect(progress.owned).toBe(1);
  });

  it('returns nothing for an empty collection', () => {
    expect(setProgressFor([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Download path safety
// ---------------------------------------------------------------------------

describe('resolveOriginalPath (traversal guard)', () => {
  const DIR = originalsDir();

  it('resolves a real catalog entry to a file directly inside the originals dir', () => {
    const resolved = resolveOriginalPath(CHEAP);
    expect(resolved).not.toBeNull();
    expect(path.dirname(resolved!)).toBe(DIR);
    expect(path.basename(resolved!)).toBe(CHEAP.sourceFile);
  });

  it('every catalog entry resolves inside the originals dir', () => {
    for (const entry of IMAGE_CATALOG) {
      const resolved = resolveOriginalPath(entry);
      expect(resolved).not.toBeNull();
      expect(resolved!.startsWith(DIR + path.sep)).toBe(true);
    }
  });

  it.each([
    '../../../.env',
    '..\\..\\..\\.env',
    '/etc/passwd',
    'C:\\Windows\\System32\\config\\SAM',
    'subdir/../../secret.svg',
    './../../prisma/schema.prisma',
    '%2e%2e%2fsecret.svg',
  ])('never escapes the originals dir for %s', (evil) => {
    const resolved = resolveOriginalPath({ sourceFile: evil });
    if (resolved !== null) {
      expect(path.dirname(resolved)).toBe(DIR);
      expect(resolved.startsWith(DIR + path.sep)).toBe(true);
    }
  });

  it.each(['', '   ', '.', '..', '/', '../'])('rejects the degenerate name %j', (bad) => {
    expect(resolveOriginalPath({ sourceFile: bad })).toBeNull();
  });

  it('rejects null / empty entries', () => {
    expect(resolveOriginalPath(null)).toBeNull();
    expect(resolveOriginalPath(undefined)).toBeNull();
    expect(resolveOriginalPath({})).toBeNull();
  });

  it('falls back to the basename of originalPath when sourceFile is missing', () => {
    const resolved = resolveOriginalPath({ originalPath: CHEAP.originalPath });
    expect(resolved).toBe(path.join(DIR, CHEAP.sourceFile));
  });

  it('does not fall for the sibling-directory prefix trick', () => {
    // ".../originals-secret/x.svg" starts with ".../originals" as a STRING but
    // is a different directory — the guard must use a separator boundary.
    const resolved = resolveOriginalPath({ sourceFile: '../originals-secret/x.svg' });
    expect(resolved === null || path.dirname(resolved) === DIR).toBe(true);
  });
});

describe('downloadFileName', () => {
  it('slugs the title and keeps the real extension', () => {
    expect(downloadFileName('Soccer Ball Study No. 1', 'ball-001.svg')).toBe(
      'Soccer-Ball-Study-No-1.svg',
    );
  });

  it('strips quotes and newlines so a title cannot break the header', () => {
    const name = downloadFileName('evil"; drop\n-- x', 'a.svg');
    expect(name).not.toContain('"');
    expect(name).not.toContain('\n');
    expect(name).not.toContain(';');
  });

  it('falls back when the title is empty', () => {
    expect(downloadFileName('', 'a.svg')).toBe('mammas-place-original.svg');
    expect(downloadFileName('!!!', 'a.svg')).toBe('mammas-place-original.svg');
  });

  it('produces a header-safe ASCII name for every catalog title', () => {
    for (const entry of IMAGE_CATALOG) {
      const name = downloadFileName(entry.title, entry.sourceFile);
      expect(name).toMatch(/^[A-Za-z0-9.-]+$/);
    }
  });
});
