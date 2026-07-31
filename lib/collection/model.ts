// The unified collection — "everything I buy is in my collection".
//
// PURE and CLIENT-SAFE (no prisma, no server-only). The page fetches rows and
// hands them here; this module decides what the kid actually sees. Keeping it
// pure is what makes the dedup and the filters unit-testable without a DB.
//
// ---------------------------------------------------------------------------
// THE TWO SOURCES, AND WHY THEY MUST BE MERGED RATHER THAN CONCATENATED
// ---------------------------------------------------------------------------
//
//   MpOrder line items  — the shop. "I bought 3 tires."
//   ImagePurchase rows  — the image store. "I own copy #1 of the tire artwork."
//
// A kid can own BOTH for the same thing: they bought the tire in the shop AND
// (from the grant hook, or by buying it in the image store) hold its archive
// original. Those are not two possessions, they are one thing with two facets,
// and the owner was explicit: show it ONCE, noting both.
//
// So the merge key is the PRODUCT, and archive artwork folds onto its product
// via lib/collection/artwork-match.ts (sourceFile stem === productId, verified
// 1:1 across the catalog). A piece with no matching product — most of the 170
// catalog entries are art that was never a shop item — stands on its own.
//
// ---------------------------------------------------------------------------
// QUANTITY vs COPIES — two different numbers, deliberately kept apart
// ---------------------------------------------------------------------------
//
//   `quantity`      — how many of the SHOP ITEM you bought (3 tires).
//   `copies[]`      — the numbered archive copies you hold, one per serial.
//
// They are summed independently and never conflated. Three tires plus one
// artwork copy is "3 owned" with one Edition badge, not "4". Collapsing them
// into a single count would make the rookie numbering meaningless, which is the
// same mistake a `quantity` column on ImagePurchase would have been.

import { getImageById, type ImageStoreEntry } from '@/lib/image-store/catalog';
import { artworkForProduct, sourceFileStem } from './artwork-match';

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/** One line inside MpOrder.items. Shape mirrors lib/money/balance.OrderItem. */
export interface CollectionOrderLine {
  productId: string;
  name: string;
  qty: number;
  priceCents: number;
}

/** An order as the collection reads it. */
export interface CollectionOrder {
  id: string;
  items: CollectionOrderLine[];
  createdAt: Date;
  status?: string;
}

/** One owned archive copy (an ImagePurchase row). */
export interface CollectionCopy {
  imageId: string;
  pricePaidCents: number;
  editionNumber: number;
  createdAt: Date;
  /** 'store' | 'grant' | 'trade' — how this copy was acquired. */
  source: string;
  grantOrderId?: string | null;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/**
 * How a kid came to own this. Drives the honest provenance line that replaces
 * the "Bought Jun 16, 2026 for 0MP" bug — a granted piece is not worthless, it
 * came free with something they really did buy.
 */
export type Provenance = 'shop' | 'store' | 'grant' | 'both';

export interface CollectionEntry {
  /** Stable identity for React keys and filtering. Product id when there is a product. */
  key: string;
  title: string;
  /** Set name for archive art; the shop category stands in for shop-only items. */
  setName: string;
  /** Picture to show. Watermarked preview for archive art, product PNG otherwise. */
  imageUrl: string;
  /** How many of the SHOP item are owned. 0 for a piece that was never a shop buy. */
  quantity: number;
  /** The numbered archive copies held, newest first. Empty for a shop-only item. */
  copies: CollectionCopy[];
  /** The catalog entry, when this thing has archive artwork at all. */
  artwork: ImageStoreEntry | null;
  /** True when a download button should show — i.e. an archive copy is owned. */
  downloadable: boolean;
  /** The image id to download. Null unless downloadable. */
  downloadImageId: string | null;
  provenance: Provenance;
  /** Best (lowest) edition number held. Null when no archive copy is owned. */
  bestEditionNumber: number | null;
  /** True when a held copy is Edition #1 — the rookie. */
  isRookie: boolean;
  /** Total MP actually spent on this entry (shop lines + real store buys). */
  spentCents: number;
  /** Most recent acquisition, for "newest first" ordering. */
  acquiredAt: Date;
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

function laterOf(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b;
}

/**
 * Merge a kid's shop orders and archive copies into ONE gallery.
 *
 * Cancelled orders are excluded — a refunded cart is not a possession. Anything
 * else (`fulfilled`, `pending`, or a missing status on legacy rows) counts as
 * owned, because the money left the wallet.
 */
export function buildCollection(
  orders: readonly CollectionOrder[],
  copies: readonly CollectionCopy[],
): CollectionEntry[] {
  // productId -> accumulating entry. Archive-only pieces are keyed by imageId,
  // which cannot collide with a product id (catalog ids carry an "arch-" prefix
  // and products do not).
  const byKey = new Map<string, CollectionEntry>();

  // ---- 1. Shop lines ------------------------------------------------------
  for (const order of orders) {
    if (order.status === 'cancelled') continue;
    for (const line of order.items ?? []) {
      if (!line || typeof line.productId !== 'string' || !line.productId) continue;
      const qty = Number.isInteger(line.qty) && line.qty > 0 ? line.qty : 1;
      const priceCents = Number.isInteger(line.priceCents) ? line.priceCents : 0;
      const art = artworkForProduct(line.productId);
      const existing = byKey.get(line.productId);

      if (existing) {
        // Bought again on a later order — add to the pile, keep one tile.
        existing.quantity += qty;
        existing.spentCents += priceCents * qty;
        existing.acquiredAt = laterOf(existing.acquiredAt, order.createdAt);
        continue;
      }

      byKey.set(line.productId, {
        key: line.productId,
        title: line.name || line.productId,
        setName: art?.setName ?? 'From the shop',
        // Live product art. Every product ever bought has one (verified), and
        // the archive preview is preferred only when the kid actually owns the
        // archive copy — decided in the merge step below.
        imageUrl: `/images/${line.productId}.png`,
        quantity: qty,
        copies: [],
        artwork: art,
        downloadable: false,
        downloadImageId: null,
        provenance: 'shop',
        bestEditionNumber: null,
        isRookie: false,
        spentCents: priceCents * qty,
        acquiredAt: order.createdAt,
      });
    }
  }

  // ---- 2. Archive copies, folded onto their product where one exists ------
  for (const copy of copies) {
    const entry = getImageById(copy.imageId);
    // The product this art was drawn from, if any. THE DEDUP HINGE: when the kid
    // also has a shop line for that product, this copy joins that tile instead
    // of creating a second one.
    const productId = entry ? sourceFileStem(entry.sourceFile) : null;
    const existing = productId ? byKey.get(productId) : undefined;

    if (existing) {
      existing.copies.push(copy);
      // A grant cost nothing; only a real store buy adds to "invested".
      if (copy.source !== 'grant') existing.spentCents += copy.pricePaidCents;
      existing.downloadable = true;
      existing.downloadImageId = copy.imageId;
      // Prefer the archive preview once the kid owns the real artwork.
      if (entry) {
        existing.imageUrl = entry.watermarkedPreview;
        existing.setName = entry.setName;
        existing.artwork = entry;
      }
      existing.provenance = copy.source === 'grant' ? 'grant' : 'both';
      existing.acquiredAt = laterOf(existing.acquiredAt, copy.createdAt);
      continue;
    }

    // Archive-only: art the kid owns without ever buying the shop product
    // (bought in the image store, or traded for). Its own tile.
    const key = productId ?? copy.imageId;
    const already = byKey.get(key);
    if (already) {
      already.copies.push(copy);
      if (copy.source !== 'grant') already.spentCents += copy.pricePaidCents;
      already.acquiredAt = laterOf(already.acquiredAt, copy.createdAt);
      continue;
    }

    byKey.set(key, {
      key,
      title: entry?.title ?? copy.imageId,
      setName: entry?.setName ?? 'Archive',
      imageUrl: entry?.watermarkedPreview ?? `/images/${copy.imageId}.png`,
      quantity: 0,
      copies: [copy],
      artwork: entry,
      downloadable: true,
      downloadImageId: copy.imageId,
      provenance: copy.source === 'grant' ? 'grant' : 'store',
      bestEditionNumber: null,
      isRookie: false,
      spentCents: copy.source === 'grant' ? 0 : copy.pricePaidCents,
      acquiredAt: copy.createdAt,
    });
  }

  // ---- 3. Derive the per-entry roll-ups -----------------------------------
  const out = Array.from(byKey.values());
  for (const entry of out) {
    entry.copies.sort((a, b) => a.editionNumber - b.editionNumber);
    entry.bestEditionNumber = entry.copies.length > 0 ? entry.copies[0].editionNumber : null;
    entry.isRookie = entry.copies.some((c) => c.editionNumber === 1);
  }

  // Newest first — the thing you just bought should be at the top.
  out.sort((a, b) => b.acquiredAt.getTime() - a.acquiredAt.getTime());
  return out;
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export type CollectionFilter = 'all' | 'collectibles' | 'shop' | 'rookies';

/**
 * Does this entry belong under `filter`?
 *
 *   all          — everything.
 *   collectibles — entries with a numbered archive copy (the editions layer).
 *   shop         — entries that came from a shop order (quantity > 0).
 *   rookies      — entries holding an Edition #1.
 *
 * NOT mutually exclusive by design: a granted tire is BOTH a shop item and a
 * collectible, and it should appear under either lens. That is the point of
 * showing it once with both facets rather than twice.
 */
export function matchesFilter(entry: CollectionEntry, filter: CollectionFilter): boolean {
  switch (filter) {
    case 'collectibles':
      return entry.copies.length > 0;
    case 'shop':
      return entry.quantity > 0;
    case 'rookies':
      return entry.isRookie;
    case 'all':
    default:
      return true;
  }
}

/**
 * Case-insensitive substring search over the words a kid would actually type:
 * the title and the set name. Blank query matches everything.
 */
export function matchesSearch(entry: CollectionEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    entry.title.toLowerCase().includes(q) || entry.setName.toLowerCase().includes(q)
  );
}

/** Apply filter + set + search together. `set` of null means "any set". */
export function applyFilters(
  entries: readonly CollectionEntry[],
  opts: { filter?: CollectionFilter; set?: string | null; search?: string } = {},
): CollectionEntry[] {
  const { filter = 'all', set = null, search = '' } = opts;
  return entries.filter(
    (e) =>
      matchesFilter(e, filter) &&
      (set === null || e.setName === set) &&
      matchesSearch(e, search),
  );
}

/** Every set present in the collection, alphabetical — drives the set dropdown. */
export function setsIn(entries: readonly CollectionEntry[]): string[] {
  return Array.from(new Set(entries.map((e) => e.setName))).sort((a, b) =>
    a.localeCompare(b),
  );
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface CollectionSummary {
  /** Distinct tiles. */
  entries: number;
  /** Total things owned — shop quantities plus archive copies. */
  totalItems: number;
  /** Numbered archive copies held. */
  collectibles: number;
  rookies: number;
  spentCents: number;
}

export function summarize(entries: readonly CollectionEntry[]): CollectionSummary {
  let totalItems = 0;
  let collectibles = 0;
  let rookies = 0;
  let spentCents = 0;
  for (const e of entries) {
    totalItems += e.quantity + e.copies.length;
    collectibles += e.copies.length;
    if (e.isRookie) rookies += 1;
    spentCents += e.spentCents;
  }
  return { entries: entries.length, totalItems, collectibles, rookies, spentCents };
}

/**
 * The honest provenance sentence. THE BUG THIS FIXES: a backfilled grant used to
 * render "Bought Jun 16, 2026 for 0MP", which tells a kid the thing they own is
 * worth nothing. A grant was never bought for 0 — it came free WITH a real
 * purchase, and that is what we say.
 */
export function provenanceLabel(entry: CollectionEntry): string {
  switch (entry.provenance) {
    case 'grant':
      return 'Came with your shop purchase';
    case 'both':
      return 'Bought in the shop — artwork included';
    case 'store':
      return entry.spentCents > 0 ? 'Bought in the image store' : 'From your collection';
    case 'shop':
    default:
      return 'Bought in the shop';
  }
}
