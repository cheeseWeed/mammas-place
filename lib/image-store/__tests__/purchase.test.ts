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
//   * every amount stays an integer number of cents.
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
}

const state: FakeState = {
  users: new Map(),
  purchases: new Set(),
  writes: [],
  committed: [],
  transactions: 0,
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
        return bal === undefined ? null : { name: where.name, balanceCents: bal };
      },
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
        record(journal, { model: 'driveUser', op: 'update', data: { ...where, next } });
        state.users.set(where.name, next);
        journal.balanceDeltas.push({ user: where.name, delta });
        return { balanceCents: next };
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
      const journal: Journal = { balanceDeltas: [], purchaseKeys: [], writes: [] };
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
