// Image-store catalog — the SERVER'S SOURCE OF TRUTH for what exists and what
// it costs. PURE and CLIENT-SAFE (no prisma, no `server-only`, no fs), same
// rule as rotation.ts: pulling a server import in here would crash any client
// component that touches the store.
//
// The catalog is a static JSON file (data/image-store.json), not a table. That
// is deliberate — the art ships with the repo, so there is nothing to seed and
// nothing to drift. Everything money-related reads `priceCents` from HERE and
// never from a request body: a kid could otherwise POST `{ priceCents: 1 }`
// and buy a 30MP original for a penny.
//
// `originalPath` / `sourceFile` are consumed ONLY by the download route
// (app/api/image-store/download/[id]) — never echoed to the browser. The
// originals live OUTSIDE public/ on purpose so they are not URL-fetchable;
// the only way to a file is through the ownership check.

import rawCatalog from '@/data/image-store.json';
import { isMisprint, type ImageStoreItem } from './rotation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One catalog row. Extends the minimal shape the rotation engine reads. */
export interface ImageStoreEntry extends ImageStoreItem {
  id: string;
  title: string;
  setName: string;
  /** Bare filename inside the originals dir, e.g. "ball-001.svg". Server-only use. */
  sourceFile: string;
  priceCents: number;
  tier: 'archive' | 'misprint';
  /**
   * Which SUBJECT this piece depicts, e.g. "soccer-ball-study". Several entries
   * can draw the same thing (an archive plate and its restaurant re-plating, a
   * gown in two colourways, six studies of one ball) — they share a subjectId
   * so the store can say "6 versions of this exist, you own 2".
   *
   * NOT an identity: `id` stays unique per piece and is what a purchase record
   * points at. A subject with a single member is normal and expected — every
   * entry gets one so consumers never special-case.
   */
  subjectId: string;
  /** Short human label for THIS version, e.g. "Study No. 3". */
  variantLabel: string;
  /** Public, watermarked, safe to link: "/image-store/previews/<id>.png". */
  watermarkedPreview: string;
  /** Repo-relative path to the gated original. Server-only use. */
  originalPath: string;
}

// ---------------------------------------------------------------------------
// Load + validate
// ---------------------------------------------------------------------------

/**
 * Drop malformed rows rather than letting one bad entry break the whole store.
 * A row with no id, no price, or a non-integer price is not sellable — money
 * math is integer-cents only, so a float price is a correctness bug, not a
 * rounding nuisance, and it gets rejected here rather than at checkout.
 */
function coerceEntry(raw: unknown): ImageStoreEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id.trim() : '';
  const sourceFile = typeof r.sourceFile === 'string' ? r.sourceFile.trim() : '';
  const priceCents = typeof r.priceCents === 'number' ? r.priceCents : NaN;
  if (!id || !sourceFile) return null;
  if (!Number.isInteger(priceCents) || priceCents <= 0) return null;

  const tier = isMisprint({ id, tier: r.tier as string }) ? 'misprint' : 'archive';
  return {
    id,
    title: typeof r.title === 'string' && r.title.trim() ? r.title.trim() : id,
    setName: typeof r.setName === 'string' && r.setName.trim() ? r.setName.trim() : 'Odds and Ends',
    sourceFile,
    priceCents,
    tier,
    // A row with no subjectId is its OWN subject (a group of one) rather than
    // an error: grouping is descriptive metadata, not a correctness gate, and
    // falling back to the id keeps every entry inside exactly one group.
    subjectId:
      typeof r.subjectId === 'string' && r.subjectId.trim() ? r.subjectId.trim() : id,
    variantLabel:
      typeof r.variantLabel === 'string' && r.variantLabel.trim()
        ? r.variantLabel.trim()
        : 'Original archive art',
    watermarkedPreview:
      typeof r.watermarkedPreview === 'string' && r.watermarkedPreview
        ? r.watermarkedPreview
        : `/image-store/previews/${id}.png`,
    originalPath:
      typeof r.originalPath === 'string' && r.originalPath
        ? r.originalPath
        : `assets/image-store/originals/${sourceFile}`,
  };
}

function buildCatalog(): ImageStoreEntry[] {
  const seen = new Set<string>();
  const out: ImageStoreEntry[] = [];
  for (const raw of rawCatalog as unknown[]) {
    const entry = coerceEntry(raw);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

/** Every sellable piece, in catalog order. */
export const IMAGE_CATALOG: readonly ImageStoreEntry[] = Object.freeze(buildCatalog());

const BY_ID = new Map(IMAGE_CATALOG.map((e) => [e.id, e]));

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

/** Catalog entry for an id, or null. The ONLY place a price may come from. */
export function getImageById(id: unknown): ImageStoreEntry | null {
  if (typeof id !== 'string') return null;
  return BY_ID.get(id.trim()) ?? null;
}

/** Server price for an id, or null if the id is unknown. Never trust a client price. */
export function priceCentsFor(id: unknown): number | null {
  return getImageById(id)?.priceCents ?? null;
}

/** Shorthand — a piece is a misprint if the CATALOG says so. */
export function isMisprintId(id: unknown): boolean {
  const entry = getImageById(id);
  return entry ? entry.tier === 'misprint' : false;
}

// ---------------------------------------------------------------------------
// Set grouping / completion
// ---------------------------------------------------------------------------

export interface ImageSetGroup {
  setName: string;
  items: ImageStoreEntry[];
}

/**
 * Group entries by `setName`, preserving first-seen order so the drop keeps the
 * shuffled order the rotation engine chose instead of re-sorting alphabetically.
 */
export function groupBySet(items: readonly ImageStoreEntry[]): ImageSetGroup[] {
  const groups = new Map<string, ImageStoreEntry[]>();
  for (const item of items) {
    const bucket = groups.get(item.setName);
    if (bucket) bucket.push(item);
    else groups.set(item.setName, [item]);
  }
  return Array.from(groups, ([setName, group]) => ({ setName, items: group }));
}

/** How many pieces exist in a set ACROSS THE WHOLE CATALOG (the "of 6" half). */
const SET_SIZES: ReadonlyMap<string, number> = (() => {
  const sizes = new Map<string, number>();
  for (const entry of IMAGE_CATALOG) {
    sizes.set(entry.setName, (sizes.get(entry.setName) ?? 0) + 1);
  }
  return sizes;
})();

export function setSize(setName: string): number {
  return SET_SIZES.get(setName) ?? 0;
}

export interface SetProgress {
  setName: string;
  owned: number;
  total: number;
  complete: boolean;
  /** The owned pieces, catalog order. */
  items: ImageStoreEntry[];
}

/**
 * "4 of 6 Dessert Plates" for every set the kid has at least one piece from.
 * Unknown ids (art retired from the catalog after it was bought) are skipped
 * for progress but the kid still OWNS them — the entitlement row is the truth,
 * this function only drives the progress bars.
 */
export function setProgressFor(ownedIds: readonly string[]): SetProgress[] {
  const bySet = new Map<string, ImageStoreEntry[]>();
  const seen = new Set<string>();
  for (const id of ownedIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const entry = getImageById(id);
    if (!entry) continue;
    const bucket = bySet.get(entry.setName);
    if (bucket) bucket.push(entry);
    else bySet.set(entry.setName, [entry]);
  }
  return Array.from(bySet, ([setName, items]) => {
    const total = setSize(setName);
    return {
      setName,
      owned: items.length,
      total,
      complete: total > 0 && items.length >= total,
      items,
    };
  }).sort((a, b) => a.setName.localeCompare(b.setName));
}

// ---------------------------------------------------------------------------
// Variant grouping — "3 versions of this pony exist, you own 1"
// ---------------------------------------------------------------------------
//
// A SET is a shelf ("Dessert Plates"); a SUBJECT is the thing in the picture.
// The two are independent: the escargot plate and its restaurant re-plating
// live in different SETS but are the same SUBJECT, while six Soccer Ball
// Studies share both. Grouping is metadata only — nothing here decides a price
// or an entitlement, and a subject of one is the common case (136 of 151).

/** Every variant of a subject, catalog order. Empty for an unknown subject. */
const BY_SUBJECT: ReadonlyMap<string, ImageStoreEntry[]> = (() => {
  const groups = new Map<string, ImageStoreEntry[]>();
  for (const entry of IMAGE_CATALOG) {
    const bucket = groups.get(entry.subjectId);
    if (bucket) bucket.push(entry);
    else groups.set(entry.subjectId, [entry]);
  }
  return groups;
})();

/**
 * The other pieces that draw the same thing, including the one you asked about,
 * in catalog order. Returns [] for an unknown subject rather than throwing —
 * this feeds a display line, and a missing group is not worth a 500.
 */
export function variantsOf(subjectId: unknown): ImageStoreEntry[] {
  if (typeof subjectId !== 'string') return [];
  return BY_SUBJECT.get(subjectId.trim())?.slice() ?? [];
}

/** How many versions of a subject exist across the whole catalog. */
export function subjectSize(subjectId: unknown): number {
  if (typeof subjectId !== 'string') return 0;
  return BY_SUBJECT.get(subjectId.trim())?.length ?? 0;
}

export interface SubjectProgress {
  subjectId: string;
  /** Variants of this subject the kid owns. */
  owned: number;
  /** Variants that exist in the catalog. 0 for an unknown subject. */
  total: number;
  complete: boolean;
  /** EVERY variant, catalog order — the "3 versions exist" half. */
  variants: ImageStoreEntry[];
  /** Just the owned ones, catalog order — the "you own 1" half. */
  items: ImageStoreEntry[];
}

/**
 * "You own 1 of the 3 versions of this pony."
 *
 * Same contract as `setProgressFor`: duplicate ids count once and ids that are
 * not in the catalog are skipped for PROGRESS only — the ImagePurchase row is
 * still the truth about what a kid owns, this just drives the counter.
 */
export function subjectProgressFor(
  ownedIds: readonly string[],
  subjectId: unknown,
): SubjectProgress {
  const key = typeof subjectId === 'string' ? subjectId.trim() : '';
  const variants = variantsOf(key);
  const owned = new Set(ownedIds);
  const items = variants.filter((entry) => owned.has(entry.id));
  return {
    subjectId: key,
    owned: items.length,
    total: variants.length,
    complete: variants.length > 0 && items.length >= variants.length,
    variants,
    items,
  };
}
