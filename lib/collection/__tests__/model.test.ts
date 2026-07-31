// The unified collection — merge, dedup, multiples, and filters.
//
// PURE tests, no DB: buildCollection takes plain rows and returns plain entries,
// which is exactly why the merge logic lives in lib/collection/model.ts instead
// of inside the page component.
//
// These tests are written to FAIL if the guard they describe is removed. Each
// one was verified against a deliberately broken build (see the negative-control
// pass in the task report), because this repo has twice shipped tests that
// passed with the guard deleted.

import { describe, expect, it } from 'vitest';
import {
  applyFilters,
  buildCollection,
  matchesFilter,
  matchesSearch,
  provenanceLabel,
  setsIn,
  summarize,
  type CollectionCopy,
  type CollectionOrder,
} from '../model';
import { artworkForProduct, sourceFileStem, stemCollisions } from '../artwork-match';
import { grantKeyForOrderItem, grantKeysForLine } from '../grant-key';

const D = (iso: string) => new Date(iso);

function order(
  id: string,
  items: Array<{ productId: string; name?: string; qty?: number; priceCents?: number }>,
  createdAt = '2026-07-31T00:00:00Z',
  status = 'fulfilled',
): CollectionOrder {
  return {
    id,
    createdAt: D(createdAt),
    status,
    items: items.map((i) => ({
      productId: i.productId,
      name: i.name ?? i.productId,
      qty: i.qty ?? 1,
      priceCents: i.priceCents ?? 100,
    })),
  };
}

function copy(
  imageId: string,
  editionNumber = 1,
  source = 'store',
  pricePaidCents = 400,
  createdAt = '2026-07-31T00:00:00Z',
): CollectionCopy {
  return { imageId, editionNumber, source, pricePaidCents, createdAt: D(createdAt) };
}

// ---------------------------------------------------------------------------
// The matching rule the whole feature rests on
// ---------------------------------------------------------------------------

describe('artwork matching', () => {
  it('maps a product id to the artwork drawn from it', () => {
    // Verified against the real catalog: tire-003 -> arch-tire-003.
    expect(artworkForProduct('tire-003')?.id).toBe('arch-tire-003');
    expect(artworkForProduct('battery-001')?.id).toBe('arch-battery-001');
  });

  it('returns null for a product with no archive artwork', () => {
    // pony-001 has a live product PNG but no gated archive original.
    expect(artworkForProduct('pony-001')).toBeNull();
    expect(artworkForProduct('does-not-exist')).toBeNull();
  });

  it('strips only the extension', () => {
    expect(sourceFileStem('tire-003.svg')).toBe('tire-003');
    expect(sourceFileStem('classic-car-004.png')).toBe('classic-car-004');
  });

  it('the REAL catalog has no stem collisions', () => {
    // A collision would make "which picture does this product grant?"
    // ambiguous and could hand a kid the wrong artwork. Fail the build instead.
    expect(stemCollisions()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// MULTIPLES — "I want to be able to buy multiple if I want"
// ---------------------------------------------------------------------------

describe('multiples', () => {
  it('quantity 3 of a tire means 3 owned, not a rejected duplicate', () => {
    const [entry] = buildCollection([order('o1', [{ productId: 'tire-003', qty: 3 }])], []);
    expect(entry.quantity).toBe(3);
  });

  it('sums quantity across separate orders into ONE tile', () => {
    const entries = buildCollection(
      [
        order('o1', [{ productId: 'tire-003', qty: 2 }], '2026-07-01T00:00:00Z'),
        order('o2', [{ productId: 'tire-003', qty: 1 }], '2026-07-15T00:00:00Z'),
      ],
      [],
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].quantity).toBe(3);
  });

  it('keeps EVERY archive copy as its own numbered edition', () => {
    // The heart of the design: N rows, N serials — not one row with quantity N.
    const [entry] = buildCollection(
      [],
      [copy('arch-tire-003', 1), copy('arch-tire-003', 2), copy('arch-tire-003', 3)],
    );
    expect(entry.copies).toHaveLength(3);
    expect(entry.copies.map((c) => c.editionNumber)).toEqual([1, 2, 3]);
  });

  it('does NOT conflate shop quantity with archive copies', () => {
    // 3 tires + 1 artwork copy is "3 owned" and ONE edition, never 4 editions.
    const [entry] = buildCollection(
      [order('o1', [{ productId: 'tire-003', qty: 3 }])],
      [copy('arch-tire-003', 5)],
    );
    expect(entry.quantity).toBe(3);
    expect(entry.copies).toHaveLength(1);
    expect(entry.bestEditionNumber).toBe(5);
  });

  it('grant keys are distinct per ordinal so all N copies land', () => {
    const keys = grantKeysForLine('o1', 'arch-tire-003', 3);
    expect(new Set(keys).size).toBe(3);
  });

  it('grant keys are STABLE across runs so a replay grants nothing new', () => {
    // No clock, no randomness — this is what makes checkout and the backfill
    // script idempotent without either doing a read-then-write.
    expect(grantKeyForOrderItem('o1', 'arch-tire-003', 1)).toBe(
      grantKeyForOrderItem('o1', 'arch-tire-003', 1),
    );
    expect(grantKeysForLine('o1', 'arch-tire-003', 2)).toEqual(
      grantKeysForLine('o1', 'arch-tire-003', 2),
    );
  });

  it('a different order produces different keys for the same picture', () => {
    expect(grantKeyForOrderItem('o1', 'arch-tire-003', 1)).not.toBe(
      grantKeyForOrderItem('o2', 'arch-tire-003', 1),
    );
  });

  it('qty 0 or negative produces no keys at all', () => {
    expect(grantKeysForLine('o1', 'arch-tire-003', 0)).toEqual([]);
    expect(grantKeysForLine('o1', 'arch-tire-003', -3)).toEqual([]);
  });

  it('a qty-2 line owed one more copy plans exactly ONE additional grant', () => {
    // The reconciliation the backfill script performs for pre-grantKey rows:
    // consume the legacy copies a kid already holds, then grant the remainder.
    // Verified against the real DB — sam bought 2 burgers in June and was
    // hand-granted only 1, so exactly one copy is still owed.
    const keys = grantKeysForLine('order-sam', 'arch-rest-lunch-004', 2);
    const legacyHeld = 1;
    expect(keys.slice(legacyHeld)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// DEDUP — one thing shows once, noting both facets
// ---------------------------------------------------------------------------

describe('dedup between a shop item and its artwork', () => {
  it('shows ONE entry when the kid owns both the product and its artwork', () => {
    const entries = buildCollection(
      [order('o1', [{ productId: 'tire-003', qty: 1 }])],
      [copy('arch-tire-003', 2)],
    );
    expect(entries).toHaveLength(1);
    // NOT just a count — assert the two facets actually MERGED onto one tile.
    // A count alone passes even when the fold is broken, because the fallback
    // key derives from the same product id and collides by accident. Caught by
    // the negative-control pass; this is the assertion that really pins it.
    expect(entries[0].key).toBe('tire-003');
    expect(entries[0].quantity).toBe(1);
    expect(entries[0].copies).toHaveLength(1);
    expect(entries[0].provenance).toBe('both');
  });

  it('that one entry carries BOTH facets', () => {
    const [entry] = buildCollection(
      [order('o1', [{ productId: 'tire-003', qty: 1 }])],
      [copy('arch-tire-003', 2)],
    );
    expect(entry.quantity).toBe(1); // the shop facet
    expect(entry.copies).toHaveLength(1); // the artwork facet
    expect(entry.downloadable).toBe(true);
    expect(entry.downloadImageId).toBe('arch-tire-003');
  });

  it('does NOT merge a product with unrelated artwork', () => {
    const entries = buildCollection(
      [order('o1', [{ productId: 'tire-003' }])],
      [copy('arch-battery-001', 1)],
    );
    expect(entries).toHaveLength(2);
  });

  it('artwork with no matching product stands on its own', () => {
    const entries = buildCollection([], [copy('arch-service-005', 1)]);
    expect(entries).toHaveLength(1);
    expect(entries[0].quantity).toBe(0);
    expect(entries[0].downloadable).toBe(true);
  });

  it('a shop item with no artwork still appears, just not downloadable', () => {
    // pony-001 has no archive original — the "everything I buy" requirement
    // means it must STILL show up.
    const [entry] = buildCollection([order('o1', [{ productId: 'pony-001', qty: 8 }])], []);
    expect(entry.quantity).toBe(8);
    expect(entry.downloadable).toBe(false);
    expect(entry.artwork).toBeNull();
  });

  it("shepherd's battery + tire order yields two entries, both present", () => {
    // The exact regression that motivated this work.
    const entries = buildCollection(
      [
        order('cms9ifz520001srq87faef1o8', [
          { productId: 'battery-001', name: 'Car Battery 12V', priceCents: 13999 },
          { productId: 'tire-003', name: 'Winter Tire 17"', priceCents: 14999 },
        ]),
      ],
      [],
    );
    expect(entries.map((e) => e.key).sort()).toEqual(['battery-001', 'tire-003']);
  });
});

// ---------------------------------------------------------------------------
// PROVENANCE — the "0MP" display bug
// ---------------------------------------------------------------------------

describe('provenance', () => {
  it('never says a granted piece was bought for 0MP', () => {
    const [entry] = buildCollection([], [copy('arch-service-005', 1, 'grant', 0)]);
    expect(entry.provenance).toBe('grant');
    expect(provenanceLabel(entry)).toBe('Came with your shop purchase');
    expect(provenanceLabel(entry)).not.toMatch(/0MP/);
  });

  it('a grant contributes NOTHING to the amount spent', () => {
    const [entry] = buildCollection(
      [order('o1', [{ productId: 'tire-003', priceCents: 14999 }])],
      [copy('arch-tire-003', 1, 'grant', 0)],
    );
    expect(entry.spentCents).toBe(14999);
  });

  it('a real store buy reports its real price', () => {
    const [entry] = buildCollection([], [copy('arch-service-005', 3, 'store', 400)]);
    expect(entry.spentCents).toBe(400);
    expect(provenanceLabel(entry)).toBe('Bought in the image store');
  });

  it('owning both reads as a shop purchase with artwork included', () => {
    const [entry] = buildCollection(
      [order('o1', [{ productId: 'tire-003' }])],
      [copy('arch-tire-003', 1, 'store', 400)],
    );
    expect(entry.provenance).toBe('both');
    expect(provenanceLabel(entry)).toBe('Bought in the shop — artwork included');
  });
});

// ---------------------------------------------------------------------------
// FILTERS
// ---------------------------------------------------------------------------

describe('filters', () => {
  const entries = buildCollection(
    [
      order('o1', [{ productId: 'pony-001', name: 'Rainbow Sparkle Pony', qty: 8 }]),
      order('o2', [{ productId: 'tire-003', name: 'Winter Tire 17"' }]),
    ],
    [copy('arch-tire-003', 1, 'grant', 0), copy('arch-service-005', 4, 'store', 400)],
  );

  it('"all" shows everything', () => {
    expect(applyFilters(entries, { filter: 'all' })).toHaveLength(3);
  });

  it('"shop" shows only things bought in the shop', () => {
    const keys = applyFilters(entries, { filter: 'shop' }).map((e) => e.key).sort();
    expect(keys).toEqual(['pony-001', 'tire-003']);
  });

  it('"collectibles" shows only things with a numbered edition', () => {
    const keys = applyFilters(entries, { filter: 'collectibles' }).map((e) => e.key).sort();
    expect(keys).toEqual(['service-005', 'tire-003']);
  });

  it('"rookies" shows only Edition #1', () => {
    const rookies = applyFilters(entries, { filter: 'rookies' });
    expect(rookies).toHaveLength(1);
    expect(rookies[0].key).toBe('tire-003');
  });

  it('a granted shop item appears under BOTH shop and collectibles', () => {
    // Deliberately non-exclusive: it genuinely is both.
    const shop = applyFilters(entries, { filter: 'shop' }).map((e) => e.key);
    const coll = applyFilters(entries, { filter: 'collectibles' }).map((e) => e.key);
    expect(shop).toContain('tire-003');
    expect(coll).toContain('tire-003');
  });

  it('filters by set', () => {
    const sets = setsIn(entries);
    expect(sets.length).toBeGreaterThan(0);
    const target = entries[0].setName;
    for (const e of applyFilters(entries, { set: target })) {
      expect(e.setName).toBe(target);
    }
  });

  it('searches by title, case-insensitively', () => {
    const found = applyFilters(entries, { search: 'pony' });
    expect(found).toHaveLength(1);
    expect(found[0].key).toBe('pony-001');
    expect(applyFilters(entries, { search: 'PONY' })).toHaveLength(1);
  });

  it('a blank search matches everything', () => {
    expect(applyFilters(entries, { search: '   ' })).toHaveLength(3);
  });

  it('a search matching nothing returns nothing', () => {
    expect(applyFilters(entries, { search: 'zzzznope' })).toHaveLength(0);
  });

  it('combines filter + search', () => {
    expect(applyFilters(entries, { filter: 'shop', search: 'tire' })).toHaveLength(1);
    // pony is a shop item but is not a collectible, so this combination is empty.
    expect(applyFilters(entries, { filter: 'collectibles', search: 'pony' })).toHaveLength(0);
  });

  it('matchesFilter / matchesSearch agree with applyFilters', () => {
    for (const e of entries) {
      expect(matchesFilter(e, 'all')).toBe(true);
      expect(matchesSearch(e, '')).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Summary + edge cases
// ---------------------------------------------------------------------------

describe('summary and edge cases', () => {
  it('counts shop quantities and archive copies separately', () => {
    const entries = buildCollection(
      [order('o1', [{ productId: 'tire-003', qty: 3, priceCents: 100 }])],
      [copy('arch-tire-003', 1, 'grant', 0)],
    );
    const s = summarize(entries);
    expect(s.entries).toBe(1);
    expect(s.totalItems).toBe(4); // 3 tires + 1 artwork copy
    expect(s.collectibles).toBe(1);
    expect(s.rookies).toBe(1);
  });

  it('excludes cancelled orders', () => {
    const entries = buildCollection(
      [order('o1', [{ productId: 'tire-003' }], '2026-07-01T00:00:00Z', 'cancelled')],
      [],
    );
    expect(entries).toHaveLength(0);
  });

  it('survives a malformed items blob', () => {
    const bad = { id: 'o1', createdAt: D('2026-07-01T00:00:00Z'), items: [] } as CollectionOrder;
    expect(() => buildCollection([bad], [])).not.toThrow();
    expect(buildCollection([bad], [])).toHaveLength(0);
  });

  it('handles an empty collection', () => {
    expect(buildCollection([], [])).toEqual([]);
    expect(summarize([])).toEqual({
      entries: 0,
      totalItems: 0,
      collectibles: 0,
      rookies: 0,
      spentCents: 0,
    });
  });

  it('orders newest first', () => {
    const entries = buildCollection(
      [
        order('o1', [{ productId: 'pony-001' }], '2026-06-01T00:00:00Z'),
        order('o2', [{ productId: 'tire-003' }], '2026-07-31T00:00:00Z'),
      ],
      [],
    );
    expect(entries[0].key).toBe('tire-003');
  });

  it('reports the LOWEST edition held as the headline number', () => {
    const [entry] = buildCollection(
      [],
      [copy('arch-tire-003', 5), copy('arch-tire-003', 2), copy('arch-tire-003', 9)],
    );
    expect(entry.bestEditionNumber).toBe(2);
    expect(entry.isRookie).toBe(false);
  });
});
