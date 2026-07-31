// Image-store EDITIONS — limited runs, rookie numbering, scarcity pricing.
//
// The pure half (tiers, clamping, restock determinism) needs no database and is
// tested directly. The RACE-SAFETY half needs a database that ENFORCES
// @@unique([imageId, editionNumber]), so the bottom of this file re-builds the
// same style of fake prisma used in purchase.test.ts and proves the thing that
// actually matters:
//
//   TWO KIDS BUYING THE SAME PICTURE AT THE SAME INSTANT CANNOT BOTH GET #1.
//
// That test is the reason this file exists. Everything above it is scaffolding
// for the price and availability rules that decide what a kid is charged.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

// ---------------------------------------------------------------------------
// Fake prisma — models BOTH unique constraints on ImagePurchase
// ---------------------------------------------------------------------------

interface FakeState {
  users: Map<string, number>;
  /** "user|imageId" — models @@unique([userName, imageId]) */
  purchases: Set<string>;
  /** "imageId#n" — models @@unique([imageId, editionNumber]) */
  editionKeys: Set<string>;
  /** Every committed (user, image, edition) triple, for assertions. */
  awarded: Array<{ userName: string; imageId: string; editionNumber: number; paid: number }>;
  transactions: number;
  /**
   * Awaited right after a transaction COUNTS the sold copies, and after the
   * count has been snapshotted. Parking here is what makes two buyers both
   * believe they are first — the exact interleaving the unique constraint
   * exists to arbitrate.
   */
  afterCount: ((imageId: string) => Promise<void>) | null;
}

const state: FakeState = {
  users: new Map(),
  purchases: new Set(),
  editionKeys: new Set(),
  awarded: [],
  transactions: 0,
  afterCount: null,
};

class FakeP2002 extends Error {
  code = 'P2002';
  meta: { target: string[] };
  constructor(target: string[]) {
    super(`Unique constraint failed on the fields: (${target.join(',')})`);
    this.name = 'PrismaClientKnownRequestError';
    this.meta = { target };
  }
}

interface Journal {
  balanceDeltas: Array<{ user: string; delta: number }>;
  purchaseKeys: string[];
  editionKeys: string[];
  awarded: number;
  counted: number;
}

function makeTx(journal: Journal) {
  return {
    driveUser: {
      findUnique: async ({ where }: { where: { name: string } }) => {
        const bal = state.users.get(where.name);
        return bal === undefined ? null : { name: where.name, balanceCents: bal };
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { name: string; balanceCents?: { gte?: number } };
        data: { balanceCents?: { decrement?: number } };
      }) => {
        const current = state.users.get(where.name);
        const guard = where.balanceCents?.gte;
        if (current === undefined) return { count: 0 };
        if (guard !== undefined && current < guard) return { count: 0 };
        const dec = data.balanceCents?.decrement ?? 0;
        state.users.set(where.name, current - dec);
        journal.balanceDeltas.push({ user: where.name, delta: -dec });
        return { count: 1 };
      },
    },
    mpTransaction: {
      create: async ({ data }: { data: Record<string, unknown> }) => ({ id: 'tx', ...data }),
    },
    imagePurchase: {
      count: async ({ where }: { where: { imageId: string } }) => {
        let n = 0;
        for (const key of state.purchases) {
          if (key.split('|')[1] === where.imageId) n += 1;
        }
        journal.counted += 1;
        // Snapshot taken above; the hook runs AFTER, so a parked buyer wakes
        // holding the stale count that makes it think it is first.
        if (journal.counted === 1 && state.afterCount) {
          await state.afterCount(where.imageId);
        }
        return n;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const ownerKey = `${data.userName}|${data.imageId}`;
        const editionKey = `${data.imageId}#${data.editionNumber}`;
        // Constraint order mirrors Postgres: any violated unique aborts.
        if (state.purchases.has(ownerKey)) throw new FakeP2002(['userName', 'imageId']);
        if (state.editionKeys.has(editionKey)) {
          throw new FakeP2002(['imageId', 'editionNumber']);
        }
        state.purchases.add(ownerKey);
        state.editionKeys.add(editionKey);
        journal.purchaseKeys.push(ownerKey);
        journal.editionKeys.push(editionKey);
        state.awarded.push({
          userName: String(data.userName),
          imageId: String(data.imageId),
          editionNumber: Number(data.editionNumber),
          paid: Number(data.pricePaidCents),
        });
        journal.awarded = state.awarded.length;
        return { id: 'ip', ...data };
      },
    },
  };
}

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: async (fn: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) => {
      state.transactions += 1;
      const journal: Journal = {
        balanceDeltas: [],
        purchaseKeys: [],
        editionKeys: [],
        awarded: 0,
        counted: 0,
      };
      try {
        return await fn(makeTx(journal));
      } catch (err) {
        // Full rollback: balances, ownership AND the claimed edition number.
        for (const { user, delta } of journal.balanceDeltas.reverse()) {
          state.users.set(user, (state.users.get(user) ?? 0) - delta);
        }
        for (const key of journal.purchaseKeys) state.purchases.delete(key);
        for (const key of journal.editionKeys) state.editionKeys.delete(key);
        // The awarded log is append-only; drop rows this transaction added.
        if (journal.awarded > 0) {
          state.awarded = state.awarded.filter(
            (a) => !journal.editionKeys.includes(`${a.imageId}#${a.editionNumber}`),
          );
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
    imagePurchase: {
      findUnique: async () => null,
      findMany: async () => [],
      count: async ({ where }: { where: { imageId: string } }) => {
        let n = 0;
        for (const key of state.purchases) {
          if (key.split('|')[1] === where.imageId) n += 1;
        }
        return n;
      },
      groupBy: async ({ where }: { where: { imageId: { in: string[] } } }) => {
        const wanted = new Set(where.imageId.in);
        const counts = new Map<string, number>();
        for (const key of state.purchases) {
          const imageId = key.split('|')[1];
          if (wanted.has(imageId)) counts.set(imageId, (counts.get(imageId) ?? 0) + 1);
        }
        return Array.from(counts, ([imageId, n]) => ({ imageId, _count: { imageId: n } }));
      },
    },
  },
}));

// Imported AFTER the mock so they bind to the stub.
import {
  ARCHIVE_MAX_DISCOUNT,
  ARCHIVE_MAX_PREMIUM,
  EDITION_TIERS,
  MISPRINT_EDITION_SIZE,
  ONE_OF_ONE_PREMIUM,
  RESTOCK_PERIOD_WEEKS,
  SCARCE_EDITION_SIZE,
  SCARCE_MAX_PREMIUM,
  currentPriceCents,
  editionBrag,
  editionLabel,
  editionSizeFor,
  editionStateFor,
  effectiveEditionSize,
  isRookie,
  isSoldOut,
  priceBandFor,
  remainingFor,
  remainingLabel,
  restockWindowFor,
  restockedCopiesBy,
  resolvedEditionSize,
  scarcityMultiplier,
} from '../editions';
import { IMAGE_CATALOG } from '../catalog';
import { isoWeekOrdinal } from '../rotation';
import { purchaseImage, soldCountFor, soldCountMap } from '../purchase';

const ARCHIVE = IMAGE_CATALOG.find((e) => e.tier === 'archive')!;
const MISPRINT = IMAGE_CATALOG.find((e) => e.tier === 'misprint')!;

function reset(balances: Record<string, number> = {}) {
  state.users = new Map(Object.entries(balances));
  state.purchases = new Set();
  state.editionKeys = new Set();
  state.awarded = [];
  state.transactions = 0;
  state.afterCount = null;
}

beforeEach(() => {
  reset();
});

// ---------------------------------------------------------------------------
// Edition-size tiers
// ---------------------------------------------------------------------------

describe('editionSizeFor — price tiers', () => {
  it('puts 3MP and under in the widest run', () => {
    expect(editionSizeFor({ priceCents: 300, tier: 'archive' })).toBe(12);
    expect(editionSizeFor({ priceCents: 100, tier: 'archive' })).toBe(12);
  });

  it('puts the 4-8MP middle in a run of 6', () => {
    expect(editionSizeFor({ priceCents: 400, tier: 'archive' })).toBe(6);
    expect(editionSizeFor({ priceCents: 800, tier: 'archive' })).toBe(6);
  });

  it('puts 9MP and up in a short run of 3', () => {
    expect(editionSizeFor({ priceCents: 900, tier: 'archive' })).toBe(3);
    expect(editionSizeFor({ priceCents: 1500, tier: 'archive' })).toBe(3);
  });

  it('is a 1-of-1 for a misprint REGARDLESS of price', () => {
    expect(editionSizeFor({ priceCents: 2500, tier: 'misprint' })).toBe(MISPRINT_EDITION_SIZE);
    // Even a cheap misprint stays one-of-one — the tier wins over the price,
    // so a price edit can never quietly turn a 1-of-1 into a run.
    expect(editionSizeFor({ priceCents: 100, tier: 'misprint' })).toBe(1);
  });

  it('lands exactly ON each tier boundary (inclusive upper bound)', () => {
    for (const tier of EDITION_TIERS) {
      if (!Number.isFinite(tier.maxPriceCents)) continue;
      expect(editionSizeFor({ priceCents: tier.maxPriceCents, tier: 'archive' })).toBe(
        tier.editionSize,
      );
      // One cent over must fall to the NEXT (smaller) run.
      const next = editionSizeFor({ priceCents: tier.maxPriceCents + 1, tier: 'archive' });
      expect(next).toBeLessThan(tier.editionSize);
    }
  });

  it('falls to the SMALLEST run on a malformed price, never to unlimited', () => {
    const smallest = EDITION_TIERS[EDITION_TIERS.length - 1].editionSize;
    for (const bad of [0, -5, 4.5, NaN, undefined]) {
      const size = editionSizeFor({ priceCents: bad as number, tier: 'archive' });
      expect(size).toBe(smallest);
      // The failure direction that matters: never an unbounded run.
      expect(Number.isFinite(size)).toBe(true);
      expect(size).toBeGreaterThan(0);
    }
  });

  it('ignores a nonsense editionSize in the JSON and falls back to the tier rules', () => {
    const entry = { priceCents: 400, tier: 'archive' as const };
    expect(resolvedEditionSize({ ...entry, editionSize: 0 })).toBe(6);
    expect(resolvedEditionSize({ ...entry, editionSize: -3 })).toBe(6);
    expect(resolvedEditionSize({ ...entry, editionSize: 2.5 })).toBe(6);
    expect(resolvedEditionSize({ ...entry, editionSize: null })).toBe(6);
    // A sane declared value IS honoured.
    expect(resolvedEditionSize({ ...entry, editionSize: 4 })).toBe(4);
  });
});

describe('the shipped catalog', () => {
  it('gives every entry an integer editionSize of at least 1', () => {
    for (const entry of IMAGE_CATALOG) {
      expect(Number.isInteger(entry.editionSize)).toBe(true);
      expect(entry.editionSize).toBeGreaterThanOrEqual(1);
    }
  });

  it('has an editionSize matching the tier rules for every entry', () => {
    // This is what keeps data/image-store.json honest: regenerate the file with
    // different numbers and this fails.
    for (const entry of IMAGE_CATALOG) {
      expect(entry.editionSize).toBe(editionSizeFor(entry));
    }
  });

  it('makes every misprint a genuine 1-of-1', () => {
    const misprints = IMAGE_CATALOG.filter((e) => e.tier === 'misprint');
    expect(misprints.length).toBeGreaterThan(0);
    for (const m of misprints) expect(m.editionSize).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Remaining stock / sold out
// ---------------------------------------------------------------------------

describe('remaining stock and sold-out detection', () => {
  const six = { priceCents: 400, tier: 'archive' as const, editionSize: 6 };

  it('counts down as copies sell', () => {
    expect(remainingFor(six, 0)).toBe(6);
    expect(remainingFor(six, 2)).toBe(4);
    expect(remainingFor(six, 5)).toBe(1);
    expect(remainingFor(six, 6)).toBe(0);
  });

  it('is sold out only once the LAST copy is gone', () => {
    expect(isSoldOut(six, 5)).toBe(false);
    expect(isSoldOut(six, 6)).toBe(true);
  });

  it('clamps an over-sold run to 0 rather than reporting negative stock', () => {
    // Only reachable if an edition size were shrunk under an existing run. The
    // safe direction is "sold out" (stops sales), never "negative" (which would
    // read as available again).
    expect(remainingFor(six, 99)).toBe(0);
    expect(isSoldOut(six, 99)).toBe(true);
  });

  it('treats a nonsense sold count as zero sold', () => {
    expect(remainingFor(six, -4)).toBe(6);
    expect(remainingFor(six, NaN)).toBe(6);
  });

  it('labels a 1-of-1 with its own copy, not "1 of 1 left"', () => {
    const one = { priceCents: 2500, tier: 'misprint' as const, editionSize: 1 };
    expect(remainingLabel(one, 0)).toBe('Only one will ever exist');
    expect(remainingLabel(one, 1)).toBe('Sold out');
  });

  it('reads "3 of 6 left" for an ordinary run', () => {
    expect(remainingLabel(six, 3)).toBe('3 of 6 left');
    expect(remainingLabel(six, 6)).toBe('Sold out');
  });
});

// ---------------------------------------------------------------------------
// Scarcity pricing — the clamp is the guarantee
// ---------------------------------------------------------------------------

describe('currentPriceCents — ordinary pieces move GENTLY', () => {
  // A run of 6 at 4MP is the most common shape in the catalog.
  const ordinary = { priceCents: 400, tier: 'archive' as const, editionSize: 6 };

  it('never leaves the +/-20% band, at ANY sold count', () => {
    const band = priceBandFor(ordinary);
    expect(band.min).toBeCloseTo(1 - ARCHIVE_MAX_DISCOUNT);
    expect(band.max).toBeCloseTo(1 + ARCHIVE_MAX_PREMIUM);

    // Walk every reachable state, plus absurd ones.
    for (const sold of [0, 1, 2, 3, 4, 5, 6, 50, -10, NaN]) {
      const price = currentPriceCents(ordinary, sold as number);
      expect(price).toBeGreaterThanOrEqual(Math.round(400 * band.min));
      expect(price).toBeLessThanOrEqual(Math.round(400 * band.max));
    }
  });

  it('rises monotonically as the run sells through', () => {
    let previous = 0;
    for (let sold = 0; sold <= 6; sold++) {
      const price = currentPriceCents(ordinary, sold);
      expect(price).toBeGreaterThanOrEqual(previous);
      previous = price;
    }
  });

  it('starts at the floor and tops out at the ceiling', () => {
    expect(currentPriceCents(ordinary, 0)).toBe(Math.round(400 * 0.8)); // 320
    expect(currentPriceCents(ordinary, 6)).toBe(Math.round(400 * 1.2)); // 480
  });

  it('holds the band for EVERY archive piece in the shipped catalog', () => {
    // The real guarantee, over real data: no ordinary piece can ever be
    // displayed or charged outside its gentle band.
    for (const entry of IMAGE_CATALOG) {
      if (entry.tier === 'misprint') continue;
      if (entry.editionSize <= SCARCE_EDITION_SIZE) continue; // short runs may swing
      const lo = Math.round(entry.priceCents * (1 - ARCHIVE_MAX_DISCOUNT));
      const hi = Math.round(entry.priceCents * (1 + ARCHIVE_MAX_PREMIUM));
      for (let sold = 0; sold <= entry.editionSize; sold++) {
        const price = currentPriceCents(entry, sold);
        expect(price).toBeGreaterThanOrEqual(lo);
        expect(price).toBeLessThanOrEqual(hi);
      }
    }
  });
});

describe('currentPriceCents — scarce pieces swing HARD', () => {
  it('lets a 1-of-1 carry its full one-of-one premium', () => {
    const one = { priceCents: 2500, tier: 'misprint' as const, editionSize: 1 };
    const price = currentPriceCents(one, 0);
    expect(price).toBe(Math.round(2500 * (1 + ONE_OF_ONE_PREMIUM))); // 8750
    // Dramatically MORE than the +20% an ordinary piece is capped at.
    expect(price).toBeGreaterThan(Math.round(2500 * (1 + ARCHIVE_MAX_PREMIUM)));
  });

  it('lets a short run of 3 climb far past the ordinary ceiling', () => {
    const short = { priceCents: 1000, tier: 'archive' as const, editionSize: 3 };
    const last = currentPriceCents(short, 3);
    expect(last).toBe(Math.round(1000 * (1 + SCARCE_MAX_PREMIUM))); // 2500
    expect(last).toBeGreaterThan(Math.round(1000 * (1 + ARCHIVE_MAX_PREMIUM)));
  });

  it('gives a scarce run a WIDER band than an ordinary one', () => {
    const ordinary = priceBandFor({ priceCents: 400, tier: 'archive', editionSize: 6 });
    const short = priceBandFor({ priceCents: 1000, tier: 'archive', editionSize: 3 });
    const one = priceBandFor({ priceCents: 2500, tier: 'misprint', editionSize: 1 });
    expect(short.max).toBeGreaterThan(ordinary.max);
    expect(one.max).toBeGreaterThan(short.max);
  });

  it('still returns INTEGER cents at both extremes', () => {
    for (const entry of IMAGE_CATALOG) {
      for (const sold of [0, 1, entry.editionSize - 1, entry.editionSize]) {
        const price = currentPriceCents(entry, Math.max(0, sold));
        expect(Number.isInteger(price)).toBe(true);
        expect(price).toBeGreaterThan(0);
      }
    }
  });

  it('never returns 0 or a negative price, even for a 1-cent piece', () => {
    expect(currentPriceCents({ priceCents: 1, tier: 'archive', editionSize: 12 }, 0)).toBe(1);
    expect(currentPriceCents({ priceCents: 1, tier: 'archive', editionSize: 12 }, 12)).toBe(1);
  });

  it('keeps the multiplier inside the declared band for arbitrary inputs', () => {
    const entries = [
      { priceCents: 300, tier: 'archive' as const, editionSize: 12 },
      { priceCents: 1000, tier: 'archive' as const, editionSize: 3 },
      { priceCents: 2500, tier: 'misprint' as const, editionSize: 1 },
    ];
    for (const entry of entries) {
      const band = priceBandFor(entry);
      for (const sold of [-99, 0, 1, 7, 999, NaN, Infinity]) {
        const m = scarcityMultiplier(entry, sold as number);
        expect(m).toBeGreaterThanOrEqual(band.min);
        expect(m).toBeLessThanOrEqual(band.max);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Restock — deterministic, calendar-driven, RARE
// ---------------------------------------------------------------------------

/** UTC Monday for a week ordinal (ordinal 0 = 1970-01-05). */
function weekDate(ordinal: number): Date {
  return new Date(Date.UTC(1970, 0, 5) + ordinal * 7 * 86_400_000);
}

/**
 * Week ordinals covering exactly ONE aligned restock block around mid-2026.
 * Blocks are floor(ordinal / RESTOCK_PERIOD_WEEKS), so a window must start on a
 * multiple of the period — an arbitrary 26-week span straddles two blocks and
 * would see 0 or 2 restock weeks, which says nothing about the rule.
 */
function blockAlignedWeeks(): number[] {
  const anchor = isoWeekOrdinal('2026-01-05');
  const blockStart = Math.floor(anchor / RESTOCK_PERIOD_WEEKS) * RESTOCK_PERIOD_WEEKS;
  return Array.from({ length: RESTOCK_PERIOD_WEEKS }, (_, i) => blockStart + i);
}

describe('restock determinism', () => {
  it('gives the SAME answer for the same piece and date, every time', () => {
    const a = restockWindowFor(ARCHIVE, '2026-07-31');
    const b = restockWindowFor(ARCHIVE, '2026-07-31');
    expect(a).toEqual(b);
  });

  it('is stable across every day of one ISO week', () => {
    // Mon 2026-07-27 .. Sun 2026-08-02 — a drop-style week.
    const days = [
      '2026-07-27',
      '2026-07-28',
      '2026-07-29',
      '2026-07-30',
      '2026-07-31',
      '2026-08-01',
      '2026-08-02',
    ];
    const first = restockWindowFor(ARCHIVE, days[0]);
    for (const day of days) {
      expect(restockWindowFor(ARCHIVE, day)).toEqual(first);
    }
  });

  it('needs no cron: it is a pure function of the calendar', () => {
    // Same call, different wall-clock moments — identical result.
    const seen = new Set<string>();
    for (let i = 0; i < 5; i++) {
      seen.add(JSON.stringify(restockWindowFor(ARCHIVE, '2027-03-15')));
    }
    expect(seen.size).toBe(1);
  });

  it('keeps a sold-out piece out for MONTHS, not days', () => {
    // Whatever week we ask about, the wait is bounded by the block length —
    // and the block is half a year. This is the "slow and rare" requirement.
    expect(RESTOCK_PERIOD_WEEKS).toBeGreaterThanOrEqual(26);

    let sawLongWait = false;
    for (const week of blockAlignedWeeks()) {
      const w = restockWindowFor(ARCHIVE, weekDate(week));
      if (w.weeksUntilRestock > 8) sawLongWait = true;
      // Bounded, just long. The bound is TWO periods, not one: a week sitting
      // just after this block's window waits out the rest of this block and
      // then however far into the NEXT block that block's window falls.
      expect(w.weeksUntilRestock).toBeLessThanOrEqual(2 * RESTOCK_PERIOD_WEEKS);
    }
    // Most of the block is a long wait — that is what "months, not days" means.
    expect(sawLongWait).toBe(true);
  });

  it('restocks at most once per block, so copies do not pile up', () => {
    // Over one whole ALIGNED block, exactly one week is the restock week.
    // Alignment matters: blocks are floor(ordinal / period) from the 1970
    // Monday epoch, so an arbitrary 26-week span straddles two of them and
    // would legitimately see 0 or 2 hits.
    let hits = 0;
    for (const week of blockAlignedWeeks()) {
      if (restockWindowFor(ARCHIVE, weekDate(week)).isRestockWeek) hits += 1;
    }
    expect(hits).toBe(1);
  });

  it('staggers different pieces onto different weeks', () => {
    // Restocks should trickle in, not refill the whole store at once.
    const weeks = new Set(
      IMAGE_CATALOG.filter((e) => e.tier === 'archive')
        .slice(0, 40)
        .map((e) => restockWindowFor(e, '2026-07-31').restockWeekOrdinal),
    );
    expect(weeks.size).toBeGreaterThan(1);
  });

  it('NEVER restocks a misprint — a 1-of-1 is forever', () => {
    const w = restockWindowFor(MISPRINT, '2026-07-31');
    expect(w.isRestockWeek).toBe(false);
    expect(w.weeksUntilRestock).toBe(Number.POSITIVE_INFINITY);
    // And it never accrues extra copies, at any point in the future.
    for (const date of ['2026-07-31', '2030-01-01', '2040-06-15']) {
      expect(restockedCopiesBy(MISPRINT, date)).toBe(0);
    }
  });

  it('grants no phantom restocks before editions went live', () => {
    expect(restockedCopiesBy(ARCHIVE, '2025-01-01')).toBe(0);
  });

  it('accrues restocked copies monotonically and stays bounded', () => {
    let previous = 0;
    for (const year of [2026, 2028, 2030, 2035, 2045]) {
      const n = restockedCopiesBy(ARCHIVE, `${year}-06-15`);
      expect(n).toBeGreaterThanOrEqual(previous);
      expect(n).toBeLessThanOrEqual(8); // MAX_RESTOCKS * batch, comfortably
      previous = n;
    }
  });
});

// ---------------------------------------------------------------------------
// editionStateFor — the one shape the UI reads
// ---------------------------------------------------------------------------

describe('editionStateFor', () => {
  it('describes an untouched run correctly against an EMPTY table', () => {
    // The state this feature ships into: image_purchases has no rows.
    const s = editionStateFor(ARCHIVE, 0, '2026-07-31');
    expect(s.sold).toBe(0);
    expect(s.soldOut).toBe(false);
    expect(s.remaining).toBe(s.availableSize);
    expect(s.nextEditionNumber).toBe(1); // the next buyer is the rookie
    expect(Number.isInteger(s.priceCents)).toBe(true);
  });

  it('reports sold out once the run is exhausted', () => {
    const s = editionStateFor(ARCHIVE, 999, '2026-07-31');
    expect(s.soldOut).toBe(true);
    expect(s.remaining).toBe(0);
    expect(s.remainingLabel).toBe('Sold out');
  });

  it('flags a misprint as one-of-one', () => {
    const s = editionStateFor(MISPRINT, 0, '2026-07-31');
    expect(s.oneOfOne).toBe(true);
    expect(s.editionSize).toBe(1);
    expect(s.remainingLabel).toBe('Only one will ever exist');
  });

  it('agrees with currentPriceCents — display and charge share one function', () => {
    for (const entry of IMAGE_CATALOG.slice(0, 25)) {
      for (const sold of [0, 1, 2]) {
        const s = editionStateFor(entry, sold, '2026-07-31');
        expect(s.priceCents).toBe(
          currentPriceCents({ ...entry, editionSize: s.availableSize }, sold),
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

describe('edition labels', () => {
  it('celebrates #1 as the rookie', () => {
    expect(isRookie(1)).toBe(true);
    expect(isRookie(2)).toBe(false);
    expect(editionBrag(1, 6)).toBe('Edition #1 — first ever sold');
  });

  it('renders "Edition #n of size"', () => {
    expect(editionLabel(3, 6)).toBe('Edition #3 of 6');
    expect(editionLabel(2, null)).toBe('Edition #2');
  });

  it('never renders "Edition #0" from a bad number', () => {
    expect(editionLabel(0, 6)).toBe('Edition #1 of 6');
    expect(editionLabel(-4, 6)).toBe('Edition #1 of 6');
  });
});

// ---------------------------------------------------------------------------
// THE RACE — two kids, one picture, one #1
// ---------------------------------------------------------------------------

describe('rookie numbering is race-safe', () => {
  it('assigns #1 to the first buyer and #2 to the second, sequentially', async () => {
    reset({ kid: 100_000, sibling: 100_000 });
    const first = await purchaseImage('kid', ARCHIVE.id);
    const second = await purchaseImage('sibling', ARCHIVE.id);

    expect(first.status).toBe('purchased');
    expect(second.status).toBe('purchased');
    if (first.status !== 'purchased' || second.status !== 'purchased') {
      throw new Error('unreachable');
    }
    expect(first.editionNumber).toBe(1);
    expect(second.editionNumber).toBe(2);
  });

  /**
   * THE TEST THIS WHOLE FEATURE HANGS ON.
   *
   * Both buyers are parked immediately after counting sold copies, so BOTH read
   * `sold === 0` and both propose edition #1 — the precise interleaving that
   * Postgres READ COMMITTED permits, because that SELECT takes no row lock.
   *
   * If the edition number were trusted from the count, both would be written as
   * #1 and the rookie card would be a lie. The unique constraint makes that
   * outcome unstorable: one INSERT wins, the other gets P2002 and retries.
   */
  it('two SIMULTANEOUS buyers of the same picture never both get #1', async () => {
    reset({ kid: 100_000, sibling: 100_000 });

    let open!: () => void;
    const gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    let arrived = 0;
    state.afterCount = async () => {
      arrived += 1;
      if (arrived >= 2) open();
      else await gate;
    };

    const results = await Promise.all([
      purchaseImage('kid', ARCHIVE.id),
      purchaseImage('sibling', ARCHIVE.id),
    ]);

    // Both genuinely raced: each counted the run as untouched.
    expect(arrived).toBeGreaterThanOrEqual(2);

    // Both succeed — they are different kids buying different copies.
    expect(results.every((r) => r.status === 'purchased')).toBe(true);

    const numbers = results
      .filter((r): r is Extract<typeof r, { status: 'purchased' }> => r.status === 'purchased')
      .map((r) => r.editionNumber)
      .sort((a, b) => a - b);

    // THE ASSERTION: exactly one #1, and no duplicates.
    expect(numbers).toEqual([1, 2]);
    expect(new Set(numbers).size).toBe(2);

    // The persisted rows agree — no two rows share a number for this image.
    const persisted = state.awarded
      .filter((a) => a.imageId === ARCHIVE.id)
      .map((a) => a.editionNumber);
    expect(persisted).toHaveLength(2);
    expect(new Set(persisted).size).toBe(2);
    expect(persisted).toContain(1);
  });

  it('ten simultaneous buyers receive ten DISTINCT numbers, 1..10', async () => {
    // A run of 12 so nobody is turned away for stock; the point here is purely
    // that no number is ever handed out twice under contention.
    const cheap = IMAGE_CATALOG.find((e) => e.editionSize >= 10 && e.tier === 'archive')!;
    const kids = Array.from({ length: 10 }, (_, i) => `kid${i}`);
    reset(Object.fromEntries(kids.map((k) => [k, 1_000_000])));

    const results = await Promise.all(kids.map((k) => purchaseImage(k, cheap.id)));
    const numbers = results
      .filter((r): r is Extract<typeof r, { status: 'purchased' }> => r.status === 'purchased')
      .map((r) => r.editionNumber)
      .sort((a, b) => a - b);

    expect(numbers).toHaveLength(10);
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    // No duplicates in the persisted rows either.
    const persisted = state.awarded.filter((a) => a.imageId === cheap.id);
    expect(new Set(persisted.map((a) => a.editionNumber)).size).toBe(10);
  });

  it('a buyer who loses the number race is charged NOTHING for the lost attempt', async () => {
    reset({ kid: 100_000, sibling: 100_000 });

    let open!: () => void;
    const gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    let arrived = 0;
    state.afterCount = async () => {
      arrived += 1;
      if (arrived >= 2) open();
      else await gate;
    };

    const results = await Promise.all([
      purchaseImage('kid', ARCHIVE.id),
      purchaseImage('sibling', ARCHIVE.id),
    ]);

    // Each kid paid for exactly ONE copy — the rolled-back attempt left no
    // trace on the wallet.
    for (const r of results) {
      if (r.status !== 'purchased') throw new Error('unreachable');
      const spent = 100_000 - state.users.get(r.imageId === ARCHIVE.id ? 'kid' : 'kid')!;
      expect(spent).toBeGreaterThan(0);
    }
    const kidSpent = 100_000 - state.users.get('kid')!;
    const sibSpent = 100_000 - state.users.get('sibling')!;
    // Exactly one purchase each, at that copy's own scarcity price.
    const paid = state.awarded.filter((a) => a.imageId === ARCHIVE.id);
    expect(paid).toHaveLength(2);
    expect(kidSpent + sibSpent).toBe(paid.reduce((sum, a) => sum + a.paid, 0));
  });
});

// ---------------------------------------------------------------------------
// Sold-out refusal
// ---------------------------------------------------------------------------

describe('sold-out refusal', () => {
  it('refuses once the whole run is gone, and charges nothing', async () => {
    const one = MISPRINT; // 1-of-1: sells out after a single purchase
    reset({ kid: 1_000_000, sibling: 1_000_000 });

    const first = await purchaseImage('kid', one.id);
    expect(first.status).toBe('purchased');

    const balanceBefore = state.users.get('sibling')!;
    const second = await purchaseImage('sibling', one.id);

    expect(second.ok).toBe(false);
    expect(second.status).toBe('sold-out');
    if (second.status !== 'sold-out') throw new Error('unreachable');
    expect(second.editionSize).toBe(1);
    expect(second.oneOfOne).toBe(true);
    // A misprint never comes back.
    expect(second.weeksUntilRestock).toBe(Number.POSITIVE_INFINITY);

    // Nothing was charged, and no second copy exists.
    expect(state.users.get('sibling')).toBe(balanceBefore);
    expect(state.awarded.filter((a) => a.imageId === one.id)).toHaveLength(1);
  });

  it('lets every copy be bought, then refuses the next', async () => {
    const entry = IMAGE_CATALOG.find((e) => e.editionSize === 3 && e.tier === 'archive')!;
    // How many copies actually exist TODAY. Restock windows that have elapsed
    // since the epoch top a sold-out run up, so this is >= the base 3 and is
    // computed the same way the server computes it.
    const capacity = effectiveEditionSize(entry, Number.MAX_SAFE_INTEGER, new Date());
    expect(capacity).toBeGreaterThanOrEqual(3);

    const kids = Array.from({ length: capacity + 1 }, (_, i) => `kid${i}`);
    reset(Object.fromEntries(kids.map((k) => [k, 1_000_000])));

    const statuses: string[] = [];
    for (const k of kids) {
      statuses.push((await purchaseImage(k, entry.id)).status);
    }
    // Every existing copy sells; the buyer after that is refused.
    expect(statuses.slice(0, capacity).every((s) => s === 'purchased')).toBe(true);
    expect(statuses[capacity]).toBe('sold-out');
    expect(state.awarded.filter((a) => a.imageId === entry.id)).toHaveLength(capacity);
  });

  it('does NOT inflate a run that has not sold out', () => {
    // The bug this guards: restock entitlement accrues with the calendar, but
    // applying it to an untouched run would make a "run of 3" secretly a run
    // of 4 before anyone bought anything.
    const entry = IMAGE_CATALOG.find((e) => e.editionSize === 3 && e.tier === 'archive')!;
    const far = '2045-06-15'; // many restock windows have elapsed by now
    expect(effectiveEditionSize(entry, 0, far)).toBe(3);
    expect(effectiveEditionSize(entry, 1, far)).toBe(3);
    expect(effectiveEditionSize(entry, 2, far)).toBe(3);
    // Only once it is exhausted does the restock headroom apply.
    expect(effectiveEditionSize(entry, 3, far)).toBeGreaterThan(3);
  });

  it('the sold-out kid is told when it might come back', async () => {
    const entry = IMAGE_CATALOG.find((e) => e.editionSize === 3 && e.tier === 'archive')!;
    const capacity = effectiveEditionSize(entry, Number.MAX_SAFE_INTEGER, new Date());
    const kids = Array.from({ length: capacity + 1 }, (_, i) => `kid${i}`);
    reset(Object.fromEntries(kids.map((k) => [k, 1_000_000])));
    for (const k of kids.slice(0, capacity)) await purchaseImage(k, entry.id);

    const refused = await purchaseImage(kids[capacity], entry.id);
    if (refused.status !== 'sold-out') throw new Error('unreachable');
    // An archive piece DOES restock — a finite, months-away number.
    expect(Number.isFinite(refused.weeksUntilRestock)).toBe(true);
    expect(refused.oneOfOne).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Sold-count reads
// ---------------------------------------------------------------------------

describe('sold-count reads', () => {
  it('returns 0 for every id against an EMPTY table', async () => {
    reset();
    expect(await soldCountFor(ARCHIVE.id)).toBe(0);
    const map = await soldCountMap([ARCHIVE.id, MISPRINT.id]);
    expect(map.get(ARCHIVE.id)).toBe(0);
    expect(map.get(MISPRINT.id)).toBe(0);
  });

  it('seeds a 0 for ids with no rows rather than leaving them absent', async () => {
    reset({ kid: 100_000 });
    await purchaseImage('kid', ARCHIVE.id);
    const map = await soldCountMap([ARCHIVE.id, MISPRINT.id]);
    expect(map.get(ARCHIVE.id)).toBe(1);
    // groupBy omits empty groups; the map must still answer for it.
    expect(map.get(MISPRINT.id)).toBe(0);
    expect(map.has(MISPRINT.id)).toBe(true);
  });

  it('ignores blank / non-string ids', async () => {
    const map = await soldCountMap(['', '   ', ARCHIVE.id]);
    expect(map.has('')).toBe(false);
    expect(map.get(ARCHIVE.id)).toBe(0);
    expect(await soldCountFor('')).toBe(0);
  });
});
