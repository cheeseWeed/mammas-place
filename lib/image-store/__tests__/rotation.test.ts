// Weekly image-store rotation.
//
// NOTE: this file deliberately does NOT stub `server-only` or `@/lib/prisma`
// (unlike tests/unit/site.test.ts). If rotation.ts ever grows a server-only
// import, these tests fail at import time — that's the client-safety guard.

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DROP_SIZE,
  RARE_REVEAL_SHARE,
  ROTATION_ANCHOR_ISO,
  SURPRISE_PERIOD_WEEKS,
  getWeeklyDrop,
  isMisprint,
  isSurpriseWeek,
  isoWeekOrdinal,
  isoWeekOrdinalFromSeed,
  isoWeekSeed,
  isoWeekSeedForOrdinal,
  isoWeekStart,
  nextDropStart,
  plannedSurprise,
  plannedSurpriseForOrdinal,
  type ImageStoreItem,
} from '../rotation';

// ---------------------------------------------------------------------------
// Fixtures — plain JSON-shaped objects, no generated Prisma type involved.
// ---------------------------------------------------------------------------

function img(over: Partial<ImageStoreItem> & { id: string }): ImageStoreItem {
  return {
    title: `Piece ${over.id}`,
    setName: 'Backyard Studies',
    tier: 'archive',
    priceCents: 500,
    ...over,
  };
}

/** n archive pieces (a-01, a-02, ...) plus `misprints` misprint pieces. */
function catalogOf(n: number, misprints = 0): ImageStoreItem[] {
  const out: ImageStoreItem[] = [];
  for (let i = 1; i <= n; i++) {
    out.push(img({ id: `a-${String(i).padStart(2, '0')}`, setName: `Set ${i % 4}` }));
  }
  for (let i = 1; i <= misprints; i++) {
    out.push(img({ id: `m-${String(i).padStart(2, '0')}`, tier: 'misprint', priceCents: 1200 }));
  }
  return out;
}

const WEEK_MS = 7 * 86_400_000;
const ANCHOR_MS = Date.UTC(2026, 0, 5); // Monday of ISO 2026-W02 == ROTATION_ANCHOR_ISO

/**
 * "YYYY-MM-DD" for the Monday `offsetWeeks` after the rotation anchor.
 * Tests always pass STRINGS (or locally-built Dates) so nothing depends on the
 * machine timezone.
 */
function weekDay(offsetWeeks: number, dayOffset = 0): string {
  return new Date(ANCHOR_MS + offsetWeeks * WEEK_MS + dayOffset * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function ids(items: ImageStoreItem[]): string[] {
  return items.map((i) => i.id);
}

function overlap(a: ImageStoreItem[], b: ImageStoreItem[]): string[] {
  const bIds = new Set(ids(b));
  return ids(a).filter((id) => bIds.has(id));
}

// ===========================================================================
// 1. ISO week seed
// ===========================================================================

describe('isoWeekSeed', () => {
  it('anchors the constant we chain from (2026-01-05 is Monday of 2026-W02)', () => {
    expect(ROTATION_ANCHOR_ISO).toBe('2026-01-05');
    expect(isoWeekSeed(ROTATION_ANCHOR_ISO)).toBe('2026-W02');
  });

  it('formats as YYYY-Www, zero-padded', () => {
    expect(isoWeekSeed('2026-07-28')).toBe('2026-W31');
    expect(isoWeekSeed('2026-02-10')).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('is stable Mon→Sun — every day of one week returns the same seed', () => {
    const seeds = [0, 1, 2, 3, 4, 5, 6].map((d) => isoWeekSeed(weekDay(29, d)));
    expect(new Set(seeds).size).toBe(1);
    // ...and the day before / after belong to different weeks.
    expect(isoWeekSeed(weekDay(29, -1))).not.toBe(seeds[0]);
    expect(isoWeekSeed(weekDay(29, 7))).not.toBe(seeds[0]);
  });

  it('handles the 2025→2026 year boundary by ISO rules, not day-of-year math', () => {
    // Dec 29 2025 is a MONDAY whose Thursday is Jan 1 2026 → it is 2026-W01.
    expect(isoWeekSeed('2025-12-29')).toBe('2026-W01');
    expect(isoWeekSeed('2025-12-31')).toBe('2026-W01');
    expect(isoWeekSeed('2026-01-01')).toBe('2026-W01');
    expect(isoWeekSeed('2026-01-04')).toBe('2026-W01'); // Sunday, still W01
    expect(isoWeekSeed('2026-01-05')).toBe('2026-W02'); // next Monday
    // The Sunday BEFORE that Monday still belongs to 2025.
    expect(isoWeekSeed('2025-12-28')).toBe('2025-W52');
  });

  it('handles a 53-week ISO year (2026 starts on a Thursday)', () => {
    expect(isoWeekSeed('2026-12-31')).toBe('2026-W53');
    expect(isoWeekSeed('2027-01-01')).toBe('2026-W53');
    expect(isoWeekSeed('2027-01-03')).toBe('2026-W53'); // Sunday
    expect(isoWeekSeed('2027-01-04')).toBe('2027-W01');
  });

  it('week ordinals stay consecutive across the year boundary', () => {
    expect(isoWeekOrdinal('2026-01-05') - isoWeekOrdinal('2025-12-29')).toBe(1);
    expect(isoWeekOrdinal('2027-01-04') - isoWeekOrdinal('2026-12-28')).toBe(1);
    expect(isoWeekSeedForOrdinal(isoWeekOrdinal('2025-12-29'))).toBe('2026-W01');
  });

  it('seed ↔ ordinal round-trips over 6 years, year boundaries included', () => {
    const start = isoWeekOrdinal('2024-01-01');
    for (let w = 0; w < 6 * 53; w++) {
      const seed = isoWeekSeedForOrdinal(start + w);
      expect(isoWeekOrdinalFromSeed(seed)).toBe(start + w);
    }
    expect(isoWeekOrdinalFromSeed('2026-W01')).toBe(isoWeekOrdinal('2025-12-29'));
    expect(isoWeekOrdinalFromSeed('2026-W53')).toBe(isoWeekOrdinal('2026-12-31'));
  });

  it('accepts a Date and a string interchangeably (local calendar day)', () => {
    expect(isoWeekSeed(new Date(2025, 11, 29))).toBe('2026-W01');
    expect(isoWeekSeed(new Date(2026, 0, 1, 23, 45))).toBe('2026-W01');
    expect(isoWeekSeed(new Date(2026, 6, 28))).toBe(isoWeekSeed('2026-07-28'));
  });

  it('isoWeekStart is the UTC-midnight Monday; nextDropStart is 7 days later', () => {
    const start = isoWeekStart('2026-07-30'); // a Thursday
    expect(start.toISOString()).toBe('2026-07-27T00:00:00.000Z');
    expect(start.getUTCDay()).toBe(1);
    expect(nextDropStart('2026-07-30').toISOString()).toBe('2026-08-03T00:00:00.000Z');
  });

  it('falls back to today on unparseable input instead of throwing', () => {
    expect(isoWeekSeed('not a date')).toBe(isoWeekSeed(new Date()));
    expect(isoWeekSeed(new Date(NaN))).toBe(isoWeekSeed(new Date()));
  });
});

// ===========================================================================
// 2. Determinism
// ===========================================================================

describe('getWeeklyDrop — determinism', () => {
  const catalog = catalogOf(40, 5);

  it('same date + same catalog → identical drop, every time', () => {
    const a = getWeeklyDrop(catalog, '2026-07-28', 6);
    const b = getWeeklyDrop(catalog, '2026-07-28', 6);
    expect(a).toEqual(b);
    expect(ids(a.items)).toEqual(ids(b.items));
  });

  it('every day of the week produces the SAME drop (weekly, not daily)', () => {
    const monday = getWeeklyDrop(catalog, weekDay(80, 0), 6);
    for (let d = 1; d < 7; d++) {
      const other = getWeeklyDrop(catalog, weekDay(80, d), 6);
      expect(ids(other.items)).toEqual(ids(monday.items));
      expect(other.weekSeed).toBe(monday.weekSeed);
    }
  });

  it('a Date and its ISO string agree', () => {
    const viaString = getWeeklyDrop(catalog, '2026-07-28', 6);
    const viaDate = getWeeklyDrop(catalog, new Date(2026, 6, 28), 6);
    expect(ids(viaDate.items)).toEqual(ids(viaString.items));
  });

  it('different weeks produce different seeds and different selections', () => {
    const w1 = getWeeklyDrop(catalog, weekDay(10), 6);
    const w2 = getWeeklyDrop(catalog, weekDay(11), 6);
    expect(w1.weekSeed).not.toBe(w2.weekSeed);
    expect(ids(w1.items)).not.toEqual(ids(w2.items));
  });

  it('does not mutate the caller catalog', () => {
    const input = catalogOf(20, 2);
    const before = ids(input);
    getWeeklyDrop(input, '2026-07-28', 6);
    expect(ids(input)).toEqual(before);
  });
});

// ===========================================================================
// 3. The no-repeat guarantee
// ===========================================================================

describe('getWeeklyDrop — no repeats from last week', () => {
  const catalog = catalogOf(40, 4);
  const COUNT = 6;

  it('60 consecutive weeks: zero overlap with the immediately previous week', () => {
    const drops = Array.from({ length: 60 }, (_, w) =>
      getWeeklyDrop(catalog, weekDay(w), COUNT),
    );
    for (let w = 1; w < drops.length; w++) {
      const shared = overlap(drops[w].items, drops[w - 1].items);
      expect({ week: drops[w].weekSeed, shared }).toEqual({ week: drops[w].weekSeed, shared: [] });
      expect(drops[w].items).toHaveLength(COUNT);
      expect(drops[w].repeatedIds).toEqual([]);
    }
  });

  it('previousItemIds is EXACTLY what last week\'s own call returned', () => {
    // This is the real guarantee: the exclusion set is the previous week's
    // published drop, not an approximation of it.
    for (const w of [1, 2, 17, 40, 59]) {
      const thisWeek = getWeeklyDrop(catalog, weekDay(w), COUNT);
      const lastWeek = getWeeklyDrop(catalog, weekDay(w - 1), COUNT);
      expect([...thisWeek.previousItemIds].sort()).toEqual([...ids(lastWeek.items)].sort());
    }
  });

  it('holds across the ISO year boundary (2026-W53 → 2027-W01)', () => {
    const w53 = getWeeklyDrop(catalog, '2026-12-31', COUNT);
    const w01 = getWeeklyDrop(catalog, '2027-01-04', COUNT);
    expect(w53.weekSeed).toBe('2026-W53');
    expect(w01.weekSeed).toBe('2027-W01');
    expect(overlap(w01.items, w53.items)).toEqual([]);
  });

  it('holds at the tightest pool that allows it (pool === 2 x count)', () => {
    const tight = catalogOf(12);
    for (let w = 1; w < 12; w++) {
      const cur = getWeeklyDrop(tight, weekDay(w), 6);
      const prev = getWeeklyDrop(tight, weekDay(w - 1), 6);
      expect(overlap(cur.items, prev.items)).toEqual([]);
      expect(cur.items).toHaveLength(6);
    }
  });

  it('still holds a decade out, and the chain stays fast', () => {
    const t0 = Date.now();
    const far = getWeeklyDrop(catalog, '2036-06-16', COUNT);
    const farPrev = getWeeklyDrop(catalog, '2036-06-09', COUNT);
    expect(overlap(far.items, farPrev.items)).toEqual([]);
    expect(far.items).toHaveLength(COUNT);
    expect(Date.now() - t0).toBeLessThan(2000); // ~540 chain steps x 2, no cron, no cache
  });

  it('still rotates broadly — a 40-piece catalog is well covered over 60 weeks', () => {
    const seen = new Set<string>();
    for (let w = 0; w < 60; w++) {
      for (const id of ids(getWeeklyDrop(catalog, weekDay(w), COUNT).items)) seen.add(id);
    }
    expect(seen.size).toBeGreaterThanOrEqual(35);
  });
});

// ===========================================================================
// 4. Graceful degradation
// ===========================================================================

describe('getWeeklyDrop — degrades gracefully, never an empty shelf', () => {
  it('catalog smaller than the drop size returns the whole catalog', () => {
    const tiny = catalogOf(3);
    for (let w = 0; w < 6; w++) {
      const d = getWeeklyDrop(tiny, weekDay(w), 6);
      expect(d.items).toHaveLength(3);
      expect(new Set(ids(d.items)).size).toBe(3); // no duplicates inside one drop
    }
  });

  it('a catalog too small to avoid repeats repeats — but reports it, never empties', () => {
    const small = catalogOf(4);
    const prev = getWeeklyDrop(small, weekDay(20), 3);
    const cur = getWeeklyDrop(small, weekDay(21), 3);
    expect(cur.items).toHaveLength(3);
    expect(cur.repeatedIds.length).toBeGreaterThan(0); // 4 pieces, 3 a week → unavoidable
    // Fresh pieces are still preferred: only the shortfall repeats.
    expect(cur.repeatedIds.length).toBe(3 - (4 - prev.items.length));
  });

  it('a single-piece catalog keeps showing that piece', () => {
    const one = catalogOf(1);
    expect(ids(getWeeklyDrop(one, weekDay(5), 6).items)).toEqual(['a-01']);
    expect(ids(getWeeklyDrop(one, weekDay(6), 6).items)).toEqual(['a-01']);
  });

  it('an empty / missing catalog returns an empty drop instead of throwing', () => {
    expect(getWeeklyDrop([], '2026-07-28').items).toEqual([]);
    expect(getWeeklyDrop(null, '2026-07-28').allItems).toEqual([]);
    expect(getWeeklyDrop(undefined, '2026-07-28').bonusItem).toBeNull();
    expect(getWeeklyDrop([], '2026-07-28').weekSeed).toBe('2026-W31');
  });

  it('skips malformed, duplicate and retired (stock 0) entries', () => {
    const messy = [
      img({ id: 'a-01' }),
      img({ id: 'a-01' }), // duplicate id
      img({ id: 'a-02', stockQuantity: 0 }), // retired
      img({ id: 'a-03', stockQuantity: 5 }),
      { id: '' } as ImageStoreItem, // malformed
    ];
    const d = getWeeklyDrop(messy, '2026-07-28', 6);
    expect(ids(d.items).sort()).toEqual(['a-01', 'a-03']);
  });

  it('a catalog of nothing but misprints still fills the drop', () => {
    const onlyMisprints = catalogOf(0, 8);
    const d = getWeeklyDrop(onlyMisprints, weekDay(12), 4);
    expect(d.items).toHaveLength(4);
    expect(d.items.every(isMisprint)).toBe(true);
  });

  it('clamps a silly count instead of misbehaving', () => {
    const catalog = catalogOf(40);
    expect(getWeeklyDrop(catalog, weekDay(3), 0).items.length).toBeGreaterThan(0);
    expect(getWeeklyDrop(catalog, weekDay(3), -5).items).toHaveLength(1);
    expect(getWeeklyDrop(catalog, weekDay(3), 999).items).toHaveLength(24);
    expect(getWeeklyDrop(catalog, weekDay(3), NaN).items).toHaveLength(DEFAULT_DROP_SIZE);
  });

  it('dates before the rotation anchor still produce a drop', () => {
    const catalog = catalogOf(40);
    const d = getWeeklyDrop(catalog, '2024-03-11', 6);
    expect(d.items).toHaveLength(6);
    expect(d.previousItemIds).toEqual([]); // unconstrained before the anchor
  });
});

// ===========================================================================
// 5. Surprise cadence
// ===========================================================================

describe('surprise cadence — a pure hash of the week', () => {
  it('is deterministic per week seed, and agrees with the ordinal form', () => {
    for (const seed of ['2026-W31', '2026-W01', '2027-W09']) {
      expect(plannedSurprise(seed)).toBe(plannedSurprise(seed));
      expect(plannedSurprise(seed)).toBe(plannedSurpriseForOrdinal(isoWeekOrdinalFromSeed(seed)));
      expect(isSurpriseWeek(seed)).toBe(plannedSurprise(seed) !== 'none');
    }
  });

  it('fires EXACTLY once per SURPRISE_PERIOD_WEEKS block', () => {
    const start = isoWeekOrdinal('2026-01-05');
    // Walk whole blocks so the count is exact, not off-by-a-partial-block.
    for (let b = 0; b < 40; b++) {
      const blockStart = start - (start % SURPRISE_PERIOD_WEEKS) + b * SURPRISE_PERIOD_WEEKS;
      const kinds = Array.from({ length: SURPRISE_PERIOD_WEEKS }, (_, i) =>
        plannedSurpriseForOrdinal(blockStart + i),
      );
      expect(kinds.filter((k) => k !== 'none')).toHaveLength(1);
    }
  });

  it('never leaves a long dry spell — gaps are bounded by the cadence', () => {
    const raw = isoWeekOrdinal('2026-01-05');
    const start = raw - (raw % SURPRISE_PERIOD_WEEKS); // whole blocks → exact counts
    let gap = 0;
    let worst = 0;
    let surprises = 0;
    let rares = 0;
    for (let w = 0; w < 520; w++) {
      const kind = plannedSurpriseForOrdinal(start + w);
      if (kind === 'none') {
        gap += 1;
        worst = Math.max(worst, gap);
      } else {
        gap = 0;
        surprises += 1;
        if (kind === 'rare') rares += 1;
      }
    }
    // One surprise per block ⇒ the worst case is "last week of a block, then
    // first week of the next", i.e. 2 x period - 2 quiet weeks between them.
    expect(worst).toBeLessThanOrEqual(2 * SURPRISE_PERIOD_WEEKS - 2);
    expect(surprises).toBe(520 / SURPRISE_PERIOD_WEEKS);
    // Rare reveals are the minority of surprises, at roughly RARE_REVEAL_SHARE.
    expect(RARE_REVEAL_SHARE).toBeLessThan(0.5);
    expect(rares).toBeGreaterThan(0);
    expect(rares / surprises).toBeGreaterThan(RARE_REVEAL_SHARE / 2);
    expect(rares / surprises).toBeLessThan(RARE_REVEAL_SHARE * 2);
  });

  it('most weeks are plain — no bonus, no rare, allItems === items', () => {
    const catalog = catalogOf(40, 5);
    const plain = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
      .map((w) => getWeeklyDrop(catalog, weekDay(w), 6))
      .filter((d) => d.plannedSurprise === 'none');
    expect(plain.length).toBeGreaterThan(0);
    for (const d of plain) {
      expect(d.bonusItem).toBeNull();
      expect(d.rareItem).toBeNull();
      expect(d.surprise).toBe('none');
      expect(ids(d.allItems)).toEqual(ids(d.items));
    }
  });

  it('a bonus week hands out one EXTRA piece, fresh and outside the drop', () => {
    const catalog = catalogOf(40, 5);
    const bonusWeeks = Array.from({ length: 104 }, (_, w) => getWeeklyDrop(catalog, weekDay(w), 6))
      .filter((d) => d.surprise === 'bonus');
    expect(bonusWeeks.length).toBeGreaterThan(0);
    for (const d of bonusWeeks) {
      expect(d.bonusItem).not.toBeNull();
      expect(d.items).toHaveLength(6); // bonus is on TOP of the normal drop
      expect(ids(d.items)).not.toContain(d.bonusItem!.id);
      expect(d.previousItemIds).not.toContain(d.bonusItem!.id);
      expect(isMisprint(d.bonusItem!)).toBe(false);
      expect(ids(d.allItems)).toEqual([...ids(d.items), d.bonusItem!.id]);
    }
  });

  it('a rare week surfaces a misprint that never appears in the normal drop', () => {
    const catalog = catalogOf(40, 5);
    const rareWeeks = Array.from({ length: 104 }, (_, w) => getWeeklyDrop(catalog, weekDay(w), 6))
      .filter((d) => d.surprise === 'rare');
    expect(rareWeeks.length).toBeGreaterThan(0);
    for (const d of rareWeeks) {
      expect(d.rareItem).not.toBeNull();
      expect(isMisprint(d.rareItem!)).toBe(true);
      expect(ids(d.items)).not.toContain(d.rareItem!.id);
      expect(d.bonusItem).toBeNull();
    }
  });

  it('misprints stay out of the ordinary drop entirely', () => {
    const catalog = catalogOf(40, 5);
    for (let w = 0; w < 52; w++) {
      const d = getWeeklyDrop(catalog, weekDay(w), 6);
      expect(d.items.filter(isMisprint)).toEqual([]);
    }
  });

  it('a rare week with no misprints in the catalog degrades to a bonus', () => {
    const archiveOnly = catalogOf(40);
    const withMisprints = catalogOf(40, 5);
    const rareWeekOffsets = Array.from({ length: 104 }, (_, w) => w).filter(
      (w) => getWeeklyDrop(withMisprints, weekDay(w), 6).surprise === 'rare',
    );
    expect(rareWeekOffsets.length).toBeGreaterThan(0);
    for (const w of rareWeekOffsets) {
      const d = getWeeklyDrop(archiveOnly, weekDay(w), 6);
      expect(d.plannedSurprise).toBe('rare');
      expect(d.rareItem).toBeNull();
      expect(d.surprise).toBe('bonus');
      expect(d.bonusItem).not.toBeNull();
    }
  });

  it('the surprise schedule is fixed by the calendar (locked snapshot)', () => {
    // Regression lock: these weeks must keep rolling the same way as long as
    // SURPRISE_PERIOD_WEEKS / RARE_REVEAL_SHARE / the seed namespace are
    // unchanged. (2026-W02 sits mid-block — its block's surprise fell on
    // 2025-W52/2026-W01, before this window starts.)
    const schedule = Array.from({ length: 16 }, (_, w) => {
      const seed = isoWeekSeedForOrdinal(isoWeekOrdinal('2026-01-05') + w);
      return `${seed}:${plannedSurprise(seed)}`;
    });
    expect(schedule).toMatchInlineSnapshot(`
      [
        "2026-W02:none",
        "2026-W03:none",
        "2026-W04:none",
        "2026-W05:none",
        "2026-W06:none",
        "2026-W07:rare",
        "2026-W08:none",
        "2026-W09:bonus",
        "2026-W10:none",
        "2026-W11:none",
        "2026-W12:none",
        "2026-W13:none",
        "2026-W14:none",
        "2026-W15:bonus",
        "2026-W16:bonus",
        "2026-W17:none",
      ]
    `);
  });
});
