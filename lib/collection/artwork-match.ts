// Which archive artwork belongs to which shop product.
//
// PURE and CLIENT-SAFE — no prisma, no `server-only`, no fs. Same rule as
// lib/image-store/catalog.ts, and for the same reason: the collection page and
// its filter bar are shared between server and client code.
//
// THE MATCHING RULE, and why it is exact rather than fuzzy:
//
//   catalog entry `sourceFile` stem  ===  Product.id
//
// e.g. product "tire-003" <-> catalog entry "arch-tire-003" whose sourceFile is
// "tire-003.svg". The archive art was DRAWN FROM the product catalog, one file
// per product, so the stem is not a coincidence or a naming convention we hope
// holds — it is the provenance of the file.
//
// Verified across the whole catalog before this was written: 170 entries produce
// 170 DISTINCT stems, zero collisions. That matters, because a collision would
// make the mapping ambiguous and a kid could be granted the wrong picture. The
// unit tests assert the zero-collision property against the real catalog so a
// future art drop that reuses a stem FAILS THE BUILD instead of silently
// granting the wrong art.
//
// Deliberately NOT fuzzy-matched (no prefix stripping, no title similarity). A
// near-miss here hands a kid someone else's artwork, so an exact key is the only
// acceptable rule; a product with no matching art simply has none, and the
// collection shows it as a shop item.

import { IMAGE_CATALOG, type ImageStoreEntry } from '@/lib/image-store/catalog';

/** Strip the extension: "tire-003.svg" -> "tire-003". */
export function sourceFileStem(sourceFile: string): string {
  return sourceFile.replace(/\.[^./\\]+$/, '');
}

/**
 * productId -> the catalog entry drawn from it.
 *
 * Built once at module load from the frozen catalog. On the (currently
 * impossible) event of two entries sharing a stem, FIRST WINS and the duplicate
 * is dropped rather than overwriting — deterministic beats last-write-wins, and
 * `stemCollisions()` below exists so a test can fail loudly on it.
 */
const BY_PRODUCT_ID: ReadonlyMap<string, ImageStoreEntry> = (() => {
  const map = new Map<string, ImageStoreEntry>();
  for (const entry of IMAGE_CATALOG) {
    const stem = sourceFileStem(entry.sourceFile);
    if (!stem || map.has(stem)) continue;
    map.set(stem, entry);
  }
  return map;
})();

/**
 * Every stem claimed by more than one catalog entry. MUST be empty — an art
 * drop that reuses a source filename would make "which picture does this
 * product grant?" ambiguous. Asserted by the unit tests against the real
 * catalog.
 */
export function stemCollisions(
  entries: readonly ImageStoreEntry[] = IMAGE_CATALOG,
): Array<{ stem: string; ids: string[] }> {
  const seen = new Map<string, string[]>();
  for (const entry of entries) {
    const stem = sourceFileStem(entry.sourceFile);
    const bucket = seen.get(stem);
    if (bucket) bucket.push(entry.id);
    else seen.set(stem, [entry.id]);
  }
  return Array.from(seen, ([stem, ids]) => ({ stem, ids })).filter((g) => g.ids.length > 1);
}

/**
 * The archive artwork a shop product grants, or null if that product has no
 * companion piece. Null is a NORMAL answer (4 of the 11 products ever bought
 * have live product art but no gated archive original) — callers show those as
 * plain shop items, never as a broken collectible.
 */
export function artworkForProduct(productId: unknown): ImageStoreEntry | null {
  if (typeof productId !== 'string') return null;
  return BY_PRODUCT_ID.get(productId.trim()) ?? null;
}

/**
 * The inverse: which product an archive piece was drawn from. Used by the
 * collection merge to fold a store-bought piece onto the shop item a kid also
 * owns, so one thing shows up once.
 */
export function productIdForArtwork(imageId: unknown): string | null {
  if (typeof imageId !== 'string') return null;
  const entry = IMAGE_CATALOG.find((e) => e.id === imageId.trim());
  return entry ? sourceFileStem(entry.sourceFile) : null;
}
