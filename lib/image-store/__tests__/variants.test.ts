// Variant grouping — "3 versions of this pony exist, you own 1".
//
// NO DATABASE and no prisma stub: lib/image-store/catalog.ts is a pure,
// client-safe module over data/image-store.json, and these tests exercise it
// directly. That is deliberate — if this file ever needs a prisma mock to run,
// something server-only has leaked into the catalog and every client component
// that touches the store is about to crash.
//
// The invariants worth defending:
//   * every entry belongs to exactly one subject, and ids stay unique,
//   * a subject with a SINGLE member behaves like any other (no special case
//     at the call site — that is the whole reason singletons get a subjectId),
//   * the misprint pieces are grouped by what the art DEPICTS, not by the
//     product that happened to ship it (see mis-be-ep-012 below).

import { describe, expect, it } from 'vitest';
import {
  IMAGE_CATALOG,
  getImageById,
  subjectProgressFor,
  subjectSize,
  variantsOf,
} from '../catalog';

/** A subject that genuinely has more than one version in the catalog. */
const MULTI = 'soccer-ball-study';
/** A subject with exactly one version — the common case (136 of 151). */
const SOLO = 'strawberry-cheesecake';

describe('catalog subject integrity', () => {
  it('gives every entry a non-empty subjectId and variantLabel', () => {
    expect(IMAGE_CATALOG.length).toBeGreaterThan(0);
    for (const entry of IMAGE_CATALOG) {
      expect(typeof entry.subjectId).toBe('string');
      expect(entry.subjectId.trim()).not.toBe('');
      expect(typeof entry.variantLabel).toBe('string');
      expect(entry.variantLabel.trim()).not.toBe('');
    }
  });

  it('keeps ids unique and kebab-case (a purchase record points at one)', () => {
    const ids = IMAGE_CATALOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('normalized arch-Shepherd to arch-shepherd', () => {
    expect(getImageById('arch-shepherd')).not.toBeNull();
    expect(getImageById('arch-Shepherd')).toBeNull();
  });

  it('puts every entry in exactly one subject group', () => {
    const grouped = IMAGE_CATALOG.reduce(
      (sum, entry) => sum + (variantsOf(entry.subjectId).includes(entry) ? 1 : 0),
      0,
    );
    expect(grouped).toBe(IMAGE_CATALOG.length);
  });

  it('gives every variant of a subject the same subjectId and a distinct label', () => {
    for (const entry of IMAGE_CATALOG) {
      const group = variantsOf(entry.subjectId);
      expect(group.every((v) => v.subjectId === entry.subjectId)).toBe(true);
      const labels = group.map((v) => v.variantLabel);
      expect(new Set(labels).size).toBe(labels.length);
    }
  });
});

describe('variantsOf', () => {
  it('returns every version of a multi-variant subject in catalog order', () => {
    const group = variantsOf(MULTI);
    expect(group.length).toBe(6);
    expect(group.map((e) => e.id)).toEqual([
      'arch-ball-001',
      'arch-ball-002',
      'arch-ball-003',
      'arch-ball-004',
      'arch-ball-005',
      'arch-ball-006',
    ]);
  });

  it('returns a one-item group for a subject with a single version', () => {
    const group = variantsOf(SOLO);
    expect(group.map((e) => e.id)).toEqual(['arch-dessert-001']);
    expect(subjectSize(SOLO)).toBe(1);
  });

  it('hands back a copy, so a caller cannot mutate the catalog index', () => {
    const first = variantsOf(MULTI);
    first.pop();
    expect(variantsOf(MULTI).length).toBe(6);
  });

  it('returns [] for unknown / non-string subjects instead of throwing', () => {
    expect(variantsOf('no-such-subject')).toEqual([]);
    expect(variantsOf(undefined)).toEqual([]);
    expect(variantsOf(42)).toEqual([]);
    expect(subjectSize('no-such-subject')).toBe(0);
    expect(subjectSize(null)).toBe(0);
  });
});

describe('subjectProgressFor', () => {
  it('counts owned vs total across a multi-variant subject', () => {
    const progress = subjectProgressFor(['arch-ball-002', 'arch-ball-005'], MULTI);
    expect(progress.subjectId).toBe(MULTI);
    expect(progress.owned).toBe(2);
    expect(progress.total).toBe(6);
    expect(progress.complete).toBe(false);
    expect(progress.variants.length).toBe(6);
    expect(progress.items.map((e) => e.id)).toEqual(['arch-ball-002', 'arch-ball-005']);
  });

  it('is complete only when every version is owned', () => {
    const all = variantsOf(MULTI).map((e) => e.id);
    expect(subjectProgressFor(all, MULTI).complete).toBe(true);
    expect(subjectProgressFor(all.slice(1), MULTI).complete).toBe(false);
  });

  it('treats a single-variant subject as complete once that one is owned', () => {
    const solo = subjectProgressFor(['arch-dessert-001'], SOLO);
    expect(solo.total).toBe(1);
    expect(solo.owned).toBe(1);
    expect(solo.complete).toBe(true);

    const none = subjectProgressFor([], SOLO);
    expect(none.total).toBe(1);
    expect(none.owned).toBe(0);
    expect(none.complete).toBe(false);
  });

  it('ignores duplicates and ids that are not in the subject', () => {
    const progress = subjectProgressFor(
      ['arch-ball-002', 'arch-ball-002', 'arch-dessert-001', 'retired-piece-999'],
      MULTI,
    );
    expect(progress.owned).toBe(1);
  });

  it('never claims completion for an unknown subject', () => {
    const progress = subjectProgressFor(['arch-ball-002'], 'no-such-subject');
    expect(progress.total).toBe(0);
    expect(progress.owned).toBe(0);
    expect(progress.complete).toBe(false);
    expect(progress.variants).toEqual([]);
  });
});

describe('cross-set pairings (same dish, two renderings)', () => {
  // The archive plate and its restaurant re-plating sit in DIFFERENT setName
  // shelves, so `setProgressFor` can never surface them as related. This is
  // exactly the gap subjectId exists to close.
  const PAIRS: ReadonlyArray<[string, string, string]> = [
    ['escargot-garlic-butter', 'arch-dinner-001', 'arch-rest-dinner-001'],
    ['prime-rib-yorkshire-pudding', 'arch-dinner-003', 'arch-rest-dinner-003'],
    ['grilled-lobster-tail', 'arch-dinner-004', 'arch-rest-dinner-004'],
    ['spaghetti-carbonara', 'arch-dinner-005', 'arch-rest-dinner-005'],
    ['tiramisu', 'arch-dessert-003', 'arch-rest-dessert-004'],
    ['cheeseburger-and-fries', 'arch-lunch-004', 'arch-rest-lunch-004'],
  ];

  it.each(PAIRS)('%s groups %s with %s across sets', (subjectId, a, b) => {
    expect(variantsOf(subjectId).map((e) => e.id).sort()).toEqual([a, b].sort());
    expect(getImageById(a)!.setName).not.toBe(getImageById(b)!.setName);
  });
});

describe('same-set pairings (two versions on one shelf)', () => {
  // Sharing a setName is NOT the same as being the same subject: the Auto Parts
  // shelf holds tyres, oil and filters as well as these two drawings of one pair
  // of wiper blades. subjectId is what separates "same shelf" from "same thing".
  const PAIRS: ReadonlyArray<[string, string, string]> = [
    ['windshield-wiper-pair', 'arch-wiper-001', 'arch-wipers-001'],
    ['chestnut-horse-portrait', 'arch-paint-horse', 'arch-squirrel-horse'],
    ['royal-ball-gown', 'arch-princess-005', 'arch-princess-006'],
  ];

  it.each(PAIRS)('%s groups %s with %s inside one set', (subjectId, a, b) => {
    expect(variantsOf(subjectId).map((e) => e.id).sort()).toEqual([a, b].sort());
    expect(getImageById(a)!.setName).toBe(getImageById(b)!.setName);
    // ...and every OTHER piece on that shelf stays out of the subject.
    const shelfMates = IMAGE_CATALOG.filter(
      (e) => e.setName === getImageById(a)!.setName && e.id !== a && e.id !== b,
    );
    expect(shelfMates.every((e) => e.subjectId !== subjectId)).toBe(true);
  });
});

describe('misprint pairings', () => {
  // Each misprint's art is the SAME FILE the live shop still serves as that
  // product's secondary image; only the shop's primary .png differs. The PNG is
  // deliberately NOT a catalog row — IMAGE_CATALOG is the SELLABLE set, and
  // adding live shop art to it would put it on sale. The pairing is recorded in
  // the subjectId (what the art depicts) and called out in the variantLabel.
  const MISPRINTS: ReadonlyArray<[string, string]> = [
    ['mis-audio-001', 'magical-pony-kingdom-cover'],
    ['mis-bow-002', 'ranger-pro-archery-set'],
    ['mis-be-ep-012', 'princess-unicorn-star-cover'],
  ];

  it.each(MISPRINTS)('%s carries the subject of the art it depicts (%s)', (id, subjectId) => {
    const entry = getImageById(id)!;
    expect(entry.tier).toBe('misprint');
    expect(entry.subjectId).toBe(subjectId);
    expect(entry.variantLabel.toLowerCase()).toContain('misprint');
    // The live PNG counterpart is called out but is not itself for sale.
    expect(entry.variantLabel.toLowerCase()).toContain('png');
    expect(IMAGE_CATALOG.some((e) => e.sourceFile.endsWith('.png'))).toBe(false);
  });

  it('files mis-be-ep-012 under the cover art it DRAWS, not the Jonah episode', () => {
    const entry = getImageById('mis-be-ep-012')!;
    // audio-002.svg is the Princess and the Unicorn Star cover; product
    // be-ep-012 (Jonah) is one of five episodes that borrow it, so "Jonah"
    // would be an arbitrary owner for a picture of a princess and a unicorn.
    expect(entry.sourceFile).toBe('audio-002.svg');
    expect(entry.subjectId).toBe('princess-unicorn-star-cover');
    // The Jonah link is not lost — it is in the title and the label.
    expect(entry.title).toContain('Jonah');
    expect(entry.variantLabel).toContain('Jonah');
  });
});
