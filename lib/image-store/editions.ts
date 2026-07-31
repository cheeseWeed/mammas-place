// Image-store EDITIONS — limited print runs, rookie numbering, and scarcity
// pricing. PURE and CLIENT-SAFE (no prisma, no `server-only`, no fs), same rule
// as catalog.ts and rotation.ts: a server import in here would crash any client
// component that touches the store.
//
// WHAT THIS MODULE IS FOR
// -----------------------
// Every piece of art used to be infinitely copyable — a digital file, so stock
// was meaningless. That made buying one feel like downloading a file, because
// it was. Editions turn each piece into a small, numbered print run:
//
//   * A piece has an EDITION SIZE derived from its price tier (see
//     EDITION_TIERS). Cheap pieces print 12; the dearest print 3; a misprint is
//     a 1-of-1 and there will only ever be one in the world.
//   * The first buyer gets EDITION #1 — the rookie card. Second gets #2. The
//     number is derived from purchase ORDER, is permanent, and cannot be
//     forged: it is assigned by the DATABASE inside the same transaction as the
//     debit (see lib/image-store/purchase.ts).
//   * When the run sells out the piece is UNAVAILABLE. It comes back only on a
//     rare, calendar-determined RESTOCK WINDOW months later — no cron, exactly
//     like the weekly drop in rotation.ts.
//   * The price MOVES with scarcity: gently for ordinary archive pieces
//     (+/-20%), dramatically for 1-of-1s and near-sellouts.
//
// MONEY RULE THIS FILE MUST NOT BREAK
// -----------------------------------
// `currentPriceCents` is the ONE function that decides what a piece costs. The
// store page, the detail page and the CHARGE in purchaseImage all call it with
// the same inputs and therefore always agree. It returns an INTEGER number of
// cents — never a float — because the whole MP economy is integer cents
// (CLAUDE.md, "MP Money — correctness is sacred"). A client-sent price is never
// consulted anywhere in this system.

import type { ImageStoreEntry } from './catalog';
import { isoWeekOrdinal, type DateInput } from './rotation';
// Seeded-RNG primitives are REUSED, never re-implemented, so the same seed
// string means the same thing in the shop, the weekly drop and here (see the
// note in lib/inventory-rules.ts).
import { fnv1a, mulberry32 } from '../inventory-rules';

// ---------------------------------------------------------------------------
// Edition sizes — the tunable tier table
// ---------------------------------------------------------------------------

/**
 * Price-tier → edition size. TUNE THIS TABLE, nothing else.
 *
 * Read as "a piece costing up to `maxPriceCents` prints `editionSize` copies".
 * Rows are consulted in order and the FIRST match wins, so they must stay
 * sorted ascending by `maxPriceCents`. The last row is the catch-all.
 *
 * The shape is deliberate: cheap art is the on-ramp, so there is plenty of it
 * and a kid saving 3MP is very unlikely to find it gone. Expensive art is the
 * prize, so it is genuinely scarce and being #1 of 3 means something. A misprint
 * never reaches this table at all — it is a 1-of-1 by tier (see MISPRINT_EDITION_SIZE).
 */
export interface EditionTier {
  /** Inclusive upper bound, in cents. */
  maxPriceCents: number;
  /** How many copies of a piece in this tier will ever exist. */
  editionSize: number;
  /** Short label for the UI, e.g. "Open archive". */
  label: string;
}

export const EDITION_TIERS: readonly EditionTier[] = Object.freeze([
  // 3MP and under — the on-ramp. Widest run.
  { maxPriceCents: 300, editionSize: 12, label: 'Archive run of 12' },
  // 4-8MP — the everyday middle of the catalog.
  { maxPriceCents: 800, editionSize: 6, label: 'Archive run of 6' },
  // 9-15MP (and anything dearer that is still 'archive') — the prizes.
  { maxPriceCents: Number.POSITIVE_INFINITY, editionSize: 3, label: 'Short run of 3' },
]);

/** A misprint is a one-off press mistake. Exactly one will ever exist. */
export const MISPRINT_EDITION_SIZE = 1;

/** Hard floor/ceiling so a bad catalog edit can never print 0 or 10,000 copies. */
export const MIN_EDITION_SIZE = 1;
export const MAX_EDITION_SIZE = 100;

/**
 * How many copies of this piece will ever exist.
 *
 * Misprints short-circuit to 1 REGARDLESS of price: "one-of-a-kind" is the
 * whole story we tell kids about them, and a price edit must never quietly turn
 * a 1-of-1 into a run of 3. Everything else falls through the tier table.
 *
 * A malformed price (missing, float, <= 0) is NOT treated as free art: it falls
 * to the smallest run rather than the largest, so the failure mode is "too
 * scarce" (visible, annoying) instead of "unlimited" (an economy hole).
 */
export function editionSizeFor(entry: Pick<ImageStoreEntry, 'priceCents' | 'tier'>): number {
  if (entry?.tier === 'misprint') return MISPRINT_EDITION_SIZE;

  const price = entry?.priceCents;
  if (!Number.isInteger(price) || (price as number) <= 0) {
    return clampEditionSize(EDITION_TIERS[EDITION_TIERS.length - 1].editionSize);
  }

  for (const tier of EDITION_TIERS) {
    if ((price as number) <= tier.maxPriceCents) return clampEditionSize(tier.editionSize);
  }
  return clampEditionSize(EDITION_TIERS[EDITION_TIERS.length - 1].editionSize);
}

function clampEditionSize(n: number): number {
  if (!Number.isFinite(n)) return MIN_EDITION_SIZE;
  return Math.max(MIN_EDITION_SIZE, Math.min(MAX_EDITION_SIZE, Math.floor(n)));
}

/** The tier row a price falls in — drives the UI label. Misprints get their own. */
export function editionTierFor(
  entry: Pick<ImageStoreEntry, 'priceCents' | 'tier'>,
): EditionTier {
  if (entry?.tier === 'misprint') {
    return { maxPriceCents: Number.POSITIVE_INFINITY, editionSize: 1, label: 'One of one' };
  }
  const price = Number.isInteger(entry?.priceCents) ? (entry.priceCents as number) : 0;
  for (const tier of EDITION_TIERS) {
    if (price <= tier.maxPriceCents) return tier;
  }
  return EDITION_TIERS[EDITION_TIERS.length - 1];
}

/**
 * The catalog's own `editionSize` if data/image-store.json carries one, else the
 * derived value. The JSON column exists so the run size is VISIBLE in the data
 * file and reviewable in a diff, but the tier rules stay the authority for
 * anything the file does not answer — and a nonsense value in the file is
 * ignored rather than trusted.
 */
export function resolvedEditionSize(
  entry: Pick<ImageStoreEntry, 'priceCents' | 'tier'> & { editionSize?: number | null },
): number {
  const declared = entry?.editionSize;
  if (Number.isInteger(declared) && (declared as number) >= MIN_EDITION_SIZE) {
    return clampEditionSize(declared as number);
  }
  return editionSizeFor(entry);
}

// ---------------------------------------------------------------------------
// Remaining stock / sold out
// ---------------------------------------------------------------------------

/**
 * Copies still available. `sold` is the COUNT OF ImagePurchase ROWS for this
 * image — the only source of truth for how many have gone.
 *
 * Never returns a negative number. An over-sold run (only reachable if the
 * edition size were shrunk under an existing run) clamps to 0, i.e. "sold out",
 * which is the safe direction: it stops sales rather than resuming them.
 */
export function remainingFor(
  entry: Pick<ImageStoreEntry, 'priceCents' | 'tier'> & { editionSize?: number | null },
  sold: number,
): number {
  const size = resolvedEditionSize(entry);
  const gone = Number.isFinite(sold) && sold > 0 ? Math.floor(sold) : 0;
  return Math.max(0, size - gone);
}

/** True when every copy has been claimed. */
export function isSoldOut(
  entry: Pick<ImageStoreEntry, 'priceCents' | 'tier'> & { editionSize?: number | null },
  sold: number,
): boolean {
  return remainingFor(entry, sold) <= 0;
}

/** "3 of 6 left" — the string the store cards and detail page show. */
export function remainingLabel(
  entry: Pick<ImageStoreEntry, 'priceCents' | 'tier'> & { editionSize?: number | null },
  sold: number,
): string {
  const size = resolvedEditionSize(entry);
  const left = remainingFor(entry, sold);
  if (left <= 0) return 'Sold out';
  if (size === 1) return 'Only one will ever exist';
  return `${left} of ${size} left`;
}

// ---------------------------------------------------------------------------
// Scarcity pricing
// ---------------------------------------------------------------------------
//
// One formula, two bands. The multiplier is driven purely by how much of the
// run is GONE, so it is a pure function of (entry, sold) and the store page,
// the detail page and the charge in purchaseImage can never disagree.
//
//   soldRatio = sold / editionSize          (0 = untouched, 1 = sold out)
//   multiplier = 1 + soldRatio ^ CURVE * (maxMultiplier - 1)
//
// The exponent bends the curve so the first buyers pay near list price and the
// last one pays the top of the band. CURVE > 1 keeps the early copies cheap
// (kids saving up are not punished for being slow); the jump lands on the LAST
// copies, which is where scarcity should bite.
//
// The band is what separates "gentle" from "dramatic":
//   * ordinary archive pieces  -> capped at +ARCHIVE_MAX_PREMIUM (20%)
//   * scarce runs (size <= SCARCE_EDITION_SIZE) and 1-of-1s -> up to
//     SCARCE_MAX_PREMIUM / ONE_OF_ONE_PREMIUM, which is a real swing.

/** Ordinary archive pieces may never move more than this fraction. +/-20%. */
export const ARCHIVE_MAX_PREMIUM = 0.2;

/** Floor for ordinary pieces — a fresh, untouched run sells slightly UNDER list. */
export const ARCHIVE_MAX_DISCOUNT = 0.2;

/** Runs this small or smaller are allowed to swing hard. */
export const SCARCE_EDITION_SIZE = 3;

/** A short run may climb this far above list on its final copy. +150%. */
export const SCARCE_MAX_PREMIUM = 1.5;

/** A 1-of-1 is the most dramatic case: its single copy may cost +250%. */
export const ONE_OF_ONE_PREMIUM = 2.5;

/**
 * Bend of the price curve. 1 = linear. Higher = the rise is back-loaded onto
 * the last copies, which is the "the last one is the expensive one" feel.
 */
export const SCARCITY_CURVE = 1.8;

export interface PriceBand {
  /** Lowest multiplier this piece can ever be sold at. */
  min: number;
  /** Highest multiplier this piece can ever be sold at. */
  max: number;
}

/**
 * The clamp window for a piece. This is the guarantee the tests assert:
 * an ordinary archive piece can NEVER leave [0.8x, 1.2x] of its list price,
 * whatever the demand math does.
 */
export function priceBandFor(
  entry: Pick<ImageStoreEntry, 'priceCents' | 'tier'> & { editionSize?: number | null },
): PriceBand {
  const size = resolvedEditionSize(entry);
  if (entry?.tier === 'misprint' || size <= 1) {
    return { min: 1, max: 1 + ONE_OF_ONE_PREMIUM };
  }
  if (size <= SCARCE_EDITION_SIZE) {
    return { min: 1 - ARCHIVE_MAX_DISCOUNT, max: 1 + SCARCE_MAX_PREMIUM };
  }
  return { min: 1 - ARCHIVE_MAX_DISCOUNT, max: 1 + ARCHIVE_MAX_PREMIUM };
}

/**
 * The multiplier applied to list price, before rounding. Always inside
 * `priceBandFor(entry)` — the clamp is unconditional, so no combination of
 * inputs (a corrupt sold count, a hand-edited editionSize) can produce a price
 * outside the band.
 *
 * A 1-of-1 is a special case with no curve to walk: there is one copy, so it is
 * either available at its full one-of-one premium or it is gone. Charging a
 * misprint list price would make the rarest thing in the store the cheapest
 * relative to its scarcity.
 */
export function scarcityMultiplier(
  entry: Pick<ImageStoreEntry, 'priceCents' | 'tier'> & { editionSize?: number | null },
  sold: number,
): number {
  const band = priceBandFor(entry);
  const size = resolvedEditionSize(entry);
  const gone = Number.isFinite(sold) && sold > 0 ? Math.floor(sold) : 0;

  if (entry?.tier === 'misprint' || size <= 1) {
    // The only copy carries the full premium from the moment it is listed.
    return clampMultiplier(band.max, band);
  }

  // Fraction of the run already claimed, 0..1.
  const soldRatio = Math.max(0, Math.min(1, gone / size));
  const raw = band.min + Math.pow(soldRatio, SCARCITY_CURVE) * (band.max - band.min);
  return clampMultiplier(raw, band);
}

function clampMultiplier(m: number, band: PriceBand): number {
  if (!Number.isFinite(m)) return band.min;
  return Math.max(band.min, Math.min(band.max, m));
}

/**
 * WHAT A PIECE COSTS RIGHT NOW. The single source of truth for price — the
 * store card, the detail page, and the debit in purchaseImage all call THIS.
 *
 * Returns an INTEGER number of cents, always >= 1. Rounding is `Math.round`, so
 * a piece never drifts to 0 and never carries a fractional cent into the
 * ledger.
 *
 * A piece with a malformed list price is returned unchanged-ish (clamped to a
 * minimum of 1 cent) rather than thrown on: the catalog loader already drops
 * malformed rows, so reaching here with junk means something upstream changed,
 * and a visible odd price beats a 500 on the store page.
 */
export function currentPriceCents(
  entry: Pick<ImageStoreEntry, 'priceCents' | 'tier'> & { editionSize?: number | null },
  sold: number,
): number {
  const list = entry?.priceCents;
  if (!Number.isFinite(list) || (list as number) <= 0) return 1;
  const multiplier = scarcityMultiplier(entry, sold);
  const cents = Math.round((list as number) * multiplier);
  return Math.max(1, cents);
}

/** Signed difference from list price, in cents. Negative = on sale. */
export function priceDeltaCents(
  entry: Pick<ImageStoreEntry, 'priceCents' | 'tier'> & { editionSize?: number | null },
  sold: number,
): number {
  const list = Number.isFinite(entry?.priceCents) ? (entry.priceCents as number) : 0;
  return currentPriceCents(entry, sold) - list;
}

// ---------------------------------------------------------------------------
// Restock — deterministic, calendar-driven, and RARE
// ---------------------------------------------------------------------------
//
// A sold-out edition must stay gone for MONTHS, not days, or scarcity is a lie
// and edition #1 stops meaning anything. There is no cron on this stack (see
// rotation.ts), so a restock is a PURE FUNCTION OF THE CALENDAR in exactly the
// same way the weekly drop is: nothing stored, nothing scheduled.
//
// The rule: weeks are grouped into fixed blocks of RESTOCK_PERIOD_WEEKS. A hash
// of (piece, block) picks ONE week inside that block to be that piece's restock
// window. Different pieces get different weeks, so restocks trickle in rather
// than the whole store refilling at once — and each individual piece restocks
// at most once per block.

/**
 * How often a sold-out edition MAY come back. 26 weeks = about half a year.
 * TUNE THIS ONE NUMBER to make restocks rarer or more frequent. Set to 0 to
 * turn restocking off entirely — sold out then means gone forever.
 */
export const RESTOCK_PERIOD_WEEKS = 26;

/**
 * How many copies a restock adds to the run. Deliberately small: a restock is a
 * "a few more surfaced in the archive" event, not a reprint. The original
 * edition numbering continues (#7 after a run of 6), so a restocked copy is
 * visibly later than the originals and #1 is untouched.
 */
export const RESTOCK_BATCH_SIZE = 1;

/**
 * A 1-of-1 NEVER restocks. That is the entire promise of a misprint: exactly
 * one exists, forever. Flipping this to true would retroactively break every
 * "only one will ever exist" line in the UI.
 */
export const MISPRINTS_EVER_RESTOCK = false;

/** Namespaces the restock RNG so it never collides with the drop's stream. */
const RESTOCK_NAMESPACE = 'mp-image-store:restock';

export interface RestockWindow {
  /** The week ordinal this piece restocks in, inside the current block. */
  restockWeekOrdinal: number;
  /** True when the week being asked about IS that week. */
  isRestockWeek: boolean;
  /** Whole weeks until the next restock window (0 when it is this week). */
  weeksUntilRestock: number;
}

/**
 * Which week inside a block this piece restocks in. Pure hash of (id, block):
 * the same piece always restocks in the same week of the same block, on every
 * device, with nothing persisted.
 */
function restockWeekInBlock(imageId: string, block: number, period: number): number {
  const rand = mulberry32(fnv1a(`${RESTOCK_NAMESPACE}:${imageId}:${block}`));
  return Math.floor(rand() * period);
}

/**
 * When this piece's next restock window is, relative to `date`.
 *
 * Returns `isRestockWeek: false` with `weeksUntilRestock: Infinity` for pieces
 * that never restock (misprints, or a period of 0).
 */
export function restockWindowFor(
  entry: Pick<ImageStoreEntry, 'id' | 'tier'>,
  date: DateInput = new Date(),
): RestockWindow {
  const period = Math.floor(RESTOCK_PERIOD_WEEKS);
  const never: RestockWindow = {
    restockWeekOrdinal: -1,
    isRestockWeek: false,
    weeksUntilRestock: Number.POSITIVE_INFINITY,
  };
  if (!Number.isFinite(period) || period <= 0) return never;
  if (entry?.tier === 'misprint' && !MISPRINTS_EVER_RESTOCK) return never;

  const ordinal = isoWeekOrdinal(date);
  const block = Math.floor(ordinal / period);
  const weekInBlock = ordinal - block * period;
  const chosen = restockWeekInBlock(entry.id, block, period);

  if (weekInBlock === chosen) {
    return {
      restockWeekOrdinal: block * period + chosen,
      isRestockWeek: true,
      weeksUntilRestock: 0,
    };
  }

  if (chosen > weekInBlock) {
    return {
      restockWeekOrdinal: block * period + chosen,
      isRestockWeek: false,
      weeksUntilRestock: chosen - weekInBlock,
    };
  }

  // This block's window has already passed — look into the NEXT block.
  const nextBlock = block + 1;
  const nextChosen = restockWeekInBlock(entry.id, nextBlock, period);
  const nextOrdinal = nextBlock * period + nextChosen;
  return {
    restockWeekOrdinal: nextOrdinal,
    isRestockWeek: false,
    weeksUntilRestock: nextOrdinal - ordinal,
  };
}

/**
 * How many EXTRA copies a piece has been granted by restocks, on top of its
 * base edition size, as of `date`.
 *
 * Counts the restock windows that have elapsed since editions went live
 * (RESTOCK_EPOCH_ISO), capped by MAX_RESTOCKS so a piece cannot grow without
 * bound over a decade.
 *
 * IMPORTANT — this is the *entitlement*, not the applied amount. It is the
 * number of top-ups the calendar has authorised, and on its own it would
 * inflate a run nobody has exhausted: a piece with an edition size of 3 that
 * has sold ZERO copies must still show "3 of 3 left" and must still sell out
 * after the third sale, not the fourth.
 *
 * `effectiveEditionSize` is what applies the cap — a restock can only ever
 * top up copies that have actually been SOLD. Call that, not this, when you
 * need a run size. This function stays exported because the restock schedule
 * itself is worth testing and displaying in isolation.
 */
export const MAX_RESTOCKS = 4;

/**
 * The week editions went live. Restock windows before this date do not count —
 * without it, a piece would be born already carrying a decade of phantom
 * restocks. Same reasoning as ROTATION_ANCHOR_ISO: moving it rewrites history.
 *
 * Declared ABOVE restockedCopiesBy on purpose: it is that function's default
 * argument, and a `const` referenced from a default parameter that is declared
 * later would be in the temporal dead zone at call time.
 */
export const RESTOCK_EPOCH_ISO = '2026-01-05';

export function restockedCopiesBy(
  entry: Pick<ImageStoreEntry, 'id' | 'tier'>,
  date: DateInput = new Date(),
  /** Ordinal the piece went on sale. Defaults to the rotation anchor's block. */
  firstOrdinal: number = isoWeekOrdinal(RESTOCK_EPOCH_ISO),
): number {
  const period = Math.floor(RESTOCK_PERIOD_WEEKS);
  if (!Number.isFinite(period) || period <= 0) return 0;
  if (entry?.tier === 'misprint' && !MISPRINTS_EVER_RESTOCK) return 0;

  const ordinal = isoWeekOrdinal(date);
  if (ordinal < firstOrdinal) return 0;

  const firstBlock = Math.floor(firstOrdinal / period);
  const currentBlock = Math.floor(ordinal / period);

  let count = 0;
  for (let block = firstBlock; block <= currentBlock && count < MAX_RESTOCKS; block++) {
    const windowOrdinal = block * period + restockWeekInBlock(entry.id, block, period);
    // Only windows that are in the past (or now) AND at/after the piece went on
    // sale count. A window earlier in the first block predates the piece.
    if (windowOrdinal >= firstOrdinal && windowOrdinal <= ordinal) count += 1;
  }
  return Math.min(MAX_RESTOCKS, count) * Math.max(0, Math.floor(RESTOCK_BATCH_SIZE));
}

/**
 * THE run size that actually governs availability and price.
 *
 * Base edition size, plus restocked copies — but NEVER more headroom than the
 * piece has actually sold. That cap is what makes a restock mean "a sold-out
 * piece came back" rather than "every piece silently got bigger":
 *
 *   * Nothing sold yet  -> size is exactly the base run. A run of 3 shows
 *     "3 of 3 left" and sells out on the 3rd sale, no matter how many restock
 *     windows the calendar has ticked past.
 *   * Sold out, and a window has passed -> the run grows by up to the number of
 *     authorised restocks, so the piece becomes buyable again at edition #4.
 *   * Half sold -> the cap binds at `sold`, so unsold stock is never inflated.
 *
 * Still deterministic: (entry, sold, date) fully determine the answer, with
 * nothing stored and no cron.
 */
export function effectiveEditionSize(
  entry: Pick<ImageStoreEntry, 'id' | 'priceCents' | 'tier'> & { editionSize?: number | null },
  sold: number,
  date: DateInput = new Date(),
): number {
  const base = resolvedEditionSize(entry);
  const gone = Number.isFinite(sold) && sold > 0 ? Math.floor(sold) : 0;
  const authorised = restockedCopiesBy(entry, date);

  // Headroom the run has left before any restock. While this is positive the
  // piece has not sold out, so a restock adds nothing.
  const unsold = base - gone;
  if (unsold > 0 || authorised <= 0) return clampEditionSize(base);

  // Sold out (unsold <= 0). Release restocked copies, but only as many as the
  // calendar authorised — the run grows to at most base + authorised.
  return clampEditionSize(base + authorised);
}

// ---------------------------------------------------------------------------
// The one shape the UI reads
// ---------------------------------------------------------------------------

export interface EditionState {
  imageId: string;
  /** Base run size from the tier table. */
  editionSize: number;
  /** Base size PLUS any copies deterministic restocks have surfaced. */
  availableSize: number;
  /** ImagePurchase rows for this image. */
  sold: number;
  /** Copies still buyable. 0 = sold out. */
  remaining: number;
  soldOut: boolean;
  /** List price from the catalog, unchanged. */
  listPriceCents: number;
  /** What it costs RIGHT NOW. The charged price. Integer cents. */
  priceCents: number;
  /** priceCents - listPriceCents. Negative = below list. */
  priceDeltaCents: number;
  /** True for a run of exactly one — the rookie-card case. */
  oneOfOne: boolean;
  /** "3 of 6 left" / "Sold out" / "Only one will ever exist". */
  remainingLabel: string;
  /** Next deterministic restock window. */
  restock: RestockWindow;
  /** The edition number the NEXT buyer would receive. */
  nextEditionNumber: number;
}

/**
 * Everything the UI and the purchase path need about one piece, from one call.
 *
 * `sold` must be the ImagePurchase COUNT for this image — the caller does that
 * query (it is the only server-side part) and hands the number in, which keeps
 * this module client-safe and trivially testable.
 */
export function editionStateFor(
  entry: ImageStoreEntry & { editionSize?: number | null },
  sold: number,
  date: DateInput = new Date(),
): EditionState {
  const gone = Number.isFinite(sold) && sold > 0 ? Math.floor(sold) : 0;
  const baseSize = resolvedEditionSize(entry);
  // Restocks only top up a run that has actually sold out — see
  // effectiveEditionSize. An untouched run of 3 stays a run of 3 forever.
  const availableSize = effectiveEditionSize(entry, gone, date);

  // Price and "left" both read the AVAILABLE size, so a restock visibly cools
  // the price back down as well as putting copies back on the shelf.
  const sizedEntry = { ...entry, editionSize: availableSize };
  const remaining = Math.max(0, availableSize - gone);
  const priceCents = currentPriceCents(sizedEntry, gone);
  const listPriceCents = Number.isFinite(entry.priceCents) ? entry.priceCents : 0;

  return {
    imageId: entry.id,
    editionSize: baseSize,
    availableSize,
    sold: gone,
    remaining,
    soldOut: remaining <= 0,
    listPriceCents,
    priceCents,
    priceDeltaCents: priceCents - listPriceCents,
    oneOfOne: baseSize === 1,
    remainingLabel: remainingLabel(sizedEntry, gone),
    restock: restockWindowFor(entry, date),
    nextEditionNumber: gone + 1,
  };
}

// ---------------------------------------------------------------------------
// Edition-number presentation
// ---------------------------------------------------------------------------

/** "Edition #1 of 6". Size 0/unknown degrades to "Edition #1". */
export function editionLabel(editionNumber: number, editionSize?: number | null): string {
  const n = Number.isInteger(editionNumber) && editionNumber > 0 ? editionNumber : 1;
  if (Number.isInteger(editionSize) && (editionSize as number) > 0) {
    return `Edition #${n} of ${editionSize}`;
  }
  return `Edition #${n}`;
}

/** True for the rookie card — the very first copy ever sold. */
export function isRookie(editionNumber: number): boolean {
  return editionNumber === 1;
}

/** The celebratory line for a copy. #1 is the one worth shouting about. */
export function editionBrag(editionNumber: number, editionSize?: number | null): string {
  if (isRookie(editionNumber)) return 'Edition #1 — first ever sold';
  if (Number.isInteger(editionSize) && editionSize === 1) return 'The only one that exists';
  return editionLabel(editionNumber, editionSize);
}
