// Image-store weekly rotation — PURE, CLIENT-SAFE module.
//
// The digital image store shows a "drop" of original artwork that changes once
// a WEEK. There is NO cron and NO scheduled job on this stack (the laptop is
// often off) — exactly like scheduled gifts, which are delivered lazily on read
// (lib/money/gift.ts). Here we go one better: the drop is a PURE FUNCTION OF
// THE CALENDAR. Nothing is stored, nothing is scheduled, nothing runs in the
// background. Ask for today's drop and the ISO week decides it.
//
// This file MUST stay free of server-only imports (no prisma, no `server-only`)
// so client components can import it — pulling prisma into a client module is
// what previously crashed the homepage with "global is not defined".
//
// Seeded RNG helpers (fnv1a / mulberry32 / seededShuffle) are REUSED from
// lib/inventory-rules.ts rather than duplicated, so the shop and the image
// store share one rotation engine.

import {
  fnv1a,
  isInStock,
  mulberry32,
  seededShuffle,
} from '../inventory-rules';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// 'archive'  — a normal original piece; the everyday drop pool.
// 'misprint' — a rare oddity (smudge, off-register, happy accident). These are
//              held OUT of the regular drop and only surface on a rare week.
export type ImageTier = 'archive' | 'misprint';

// Minimal shape this module reads. Deliberately NOT the generated Prisma type,
// so it also works on plain JSON objects (data/image-store.json) and on rows.
// `string & {}` on `tier` keeps literal autocomplete while still accepting the
// widened `string` that `import ... from './x.json'` produces. Unknown tiers
// are treated as 'archive'. Any field not listed here is ignored.
export interface ImageStoreItem {
  id: string;
  title?: string;
  setName?: string;
  tier?: ImageTier | (string & {}) | null;
  priceCents?: number | null;
  // Optional. Digital goods are unlimited, so null/undefined = in stock.
  // Set 0 to retire a piece without deleting it.
  stockQuantity?: number | null;
}

export type SurpriseKind = 'none' | 'bonus' | 'rare';

export type DateInput = Date | string;

export interface WeeklyDrop<T extends ImageStoreItem = ImageStoreItem> {
  /** ISO-week seed that produced this drop, e.g. "2026-W30". */
  weekSeed: string;
  /** Whole weeks since the Monday epoch — the chain index. */
  weekOrdinal: number;
  /** UTC-midnight Monday this drop went live. */
  weekStart: Date;
  /** The week's featured pieces (length = count, or the whole pool if smaller). */
  items: T[];
  /** Ids in LAST week's drop — held back from `items` (the no-repeat rule). */
  previousItemIds: string[];
  /**
   * Ids that repeated from last week anyway. Only ever non-empty when the
   * catalog is too small to avoid it (pool < 2 x count). Empty = guarantee held.
   */
  repeatedIds: string[];
  /** Surprise extra archive piece, or null. Not included in `items`. */
  bonusItem: T | null;
  /** Surfaced rare 'misprint' piece, or null. Not included in `items`. */
  rareItem: T | null;
  /** What the calendar rolled for this week. */
  plannedSurprise: SurpriseKind;
  /** What we could actually deliver (degrades to 'bonus'/'none' if no candidate). */
  surprise: SurpriseKind;
  /** items + bonusItem + rareItem — the full render list, in display order. */
  allItems: T[];
}

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** Pieces in a normal week's drop. */
export const DEFAULT_DROP_SIZE = 6;
export const MIN_DROP_SIZE = 1;
export const MAX_DROP_SIZE = 24;

/**
 * SURPRISE CADENCE — tune these two numbers, nothing else.
 *
 * Weeks are grouped into fixed blocks of SURPRISE_PERIOD_WEEKS. A hash of the
 * BLOCK picks exactly one week inside it to be the surprise week, and a second
 * draw decides whether that surprise is a rare 'misprint' reveal
 * (< RARE_REVEAL_SHARE) or a bonus archive piece. No state, no randomness — the
 * same week always rolls the same way.
 *
 * Why a block and not a plain per-week probability: an independent 25% roll per
 * week clumps, and measured over 10 years it left a 21-week dry spell. Kids
 * would experience that as "the surprises stopped". Blocks keep the rate
 * identical (1 in SURPRISE_PERIOD_WEEKS) but bound the gap to at most
 * 2 x SURPRISE_PERIOD_WEEKS - 1 weeks, while still letting the exact week wander.
 *
 * Defaults: one surprise every 4 weeks; ~40% of those (1 week in 10) reveal a
 * misprint. Set SURPRISE_PERIOD_WEEKS to 1 for a surprise every week, or to 0
 * to switch surprises off entirely. Set RARE_REVEAL_SHARE to 0 for no misprint
 * reveals, 1 to make every surprise a misprint.
 */
export const SURPRISE_PERIOD_WEEKS = 4;
export const RARE_REVEAL_SHARE = 0.4;

/**
 * The no-repeat chain is defined FORWARD from this Monday (ISO 2026-W02).
 * Weeks at or before the anchor are selected unconstrained; from the anchor on,
 * every week excludes the previous week's drop. Moving this constant reshuffles
 * all of history, so don't.
 */
export const ROTATION_ANCHOR_ISO = '2026-01-05';

/**
 * Safety valve: never walk more than this many weeks of chain in one call
 * (~100 years). Guards against an absurd date (year 9999) spinning the loop.
 * A realistic call walks tens of steps, each O(pool).
 */
export const MAX_CHAIN_WEEKS = 5200;

/** Namespaces the RNG streams so image-store seeds never collide with the shop's. */
export const SEED_NAMESPACE = 'mp-image-store';

// ---------------------------------------------------------------------------
// ISO week math (UTC-only — no DST, no timezone drift)
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
// 1970-01-05 was a Monday: the zero point for week ordinals.
const MONDAY_EPOCH_MS = Date.UTC(1970, 0, 5);

/**
 * Normalize any input to a UTC-midnight instant representing the CALENDAR DAY
 * the caller meant.
 *  - "2026-07-28" (or any ISO string starting with it) → that exact day, no TZ shift.
 *  - a Date → its LOCAL y/m/d (matches todayISO() in inventory-rules: the day
 *    the user is actually looking at), re-pinned to UTC midnight.
 *  - garbage → today.
 */
function toUtcDay(input: DateInput = new Date()): Date {
  if (typeof input === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(input.trim());
    if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    const parsed = new Date(input);
    if (!Number.isNaN(parsed.getTime())) {
      return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
    }
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }
  if (!(input instanceof Date) || Number.isNaN(input.getTime())) {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }
  return new Date(Date.UTC(input.getFullYear(), input.getMonth(), input.getDate()));
}

/** UTC-midnight MONDAY that starts the ISO week containing `date`. */
export function isoWeekStart(date: DateInput = new Date()): Date {
  const d = toUtcDay(date);
  const dayNum = d.getUTCDay() || 7; // Mon=1 .. Sun=7
  return new Date(d.getTime() - (dayNum - 1) * DAY_MS);
}

/** The Monday the NEXT drop lands (for "new pieces Monday" copy). */
export function nextDropStart(date: DateInput = new Date()): Date {
  return new Date(isoWeekStart(date).getTime() + WEEK_MS);
}

/** Whole ISO weeks since 1970-01-05. Consecutive weeks differ by exactly 1. */
export function isoWeekOrdinal(date: DateInput = new Date()): number {
  return Math.round((isoWeekStart(date).getTime() - MONDAY_EPOCH_MS) / WEEK_MS);
}

function seedForWeekStart(monday: Date): string {
  // The ISO year is whatever year the week's THURSDAY falls in — that single
  // rule is what makes 2025-12-29 (a Monday) come out as "2026-W01" instead of
  // some week 53 of 2025. Naive day-of-year math gets this wrong.
  const thursday = new Date(monday.getTime() + 3 * DAY_MS);
  const isoYear = thursday.getUTCFullYear();
  const week = Math.floor((thursday.getTime() - Date.UTC(isoYear, 0, 1)) / WEEK_MS) + 1;
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

/**
 * Stable ISO-week seed, e.g. "2026-W30". Every day Mon–Sun of the same ISO week
 * returns the SAME string — that's what makes a drop feel like "this week's
 * collection" instead of changing under the kids every midnight.
 */
export function isoWeekSeed(date: DateInput = new Date()): string {
  return seedForWeekStart(isoWeekStart(date));
}

/** Seed for a week ordinal (inverse of isoWeekOrdinal). */
export function isoWeekSeedForOrdinal(ordinal: number): string {
  return seedForWeekStart(new Date(MONDAY_EPOCH_MS + ordinal * WEEK_MS));
}

/** "2026-W31" → its week ordinal. Round-trips with isoWeekSeedForOrdinal. */
export function isoWeekOrdinalFromSeed(weekSeed: string): number {
  const m = /^(\d{4})-W(\d{1,2})$/.exec(String(weekSeed).trim());
  if (!m) return isoWeekOrdinal(new Date());
  // Jan 4 is ALWAYS in ISO week 1 — the standard anchor for the inverse.
  const jan4 = new Date(Date.UTC(Number(m[1]), 0, 4));
  const dayNum = jan4.getUTCDay() || 7;
  const mondayOfW1 = jan4.getTime() - (dayNum - 1) * DAY_MS;
  const monday = mondayOfW1 + (Number(m[2]) - 1) * WEEK_MS;
  return Math.round((monday - MONDAY_EPOCH_MS) / WEEK_MS);
}

const ANCHOR_ORDINAL = isoWeekOrdinal(ROTATION_ANCHOR_ISO);

// ---------------------------------------------------------------------------
// Pool + tier helpers
// ---------------------------------------------------------------------------

/** Case-insensitive, tolerant of a widened `string` tier from JSON. */
export function isMisprint(item: ImageStoreItem): boolean {
  return typeof item.tier === 'string' && item.tier.trim().toLowerCase() === 'misprint';
}

/** Drop malformed/duplicate/retired entries. Reuses isInStock from the shop. */
function eligibleItems<T extends ImageStoreItem>(catalog: readonly T[] | null | undefined): T[] {
  if (!Array.isArray(catalog)) return [];
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of catalog) {
    if (!item || typeof item.id !== 'string' || item.id.length === 0) continue;
    if (seen.has(item.id)) continue;
    if (!isInStock(item)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

function clampCount(count: number): number {
  const n = Number.isFinite(count) ? Math.floor(count) : DEFAULT_DROP_SIZE;
  return Math.max(MIN_DROP_SIZE, Math.min(MAX_DROP_SIZE, n));
}

// ---------------------------------------------------------------------------
// One week's selection
// ---------------------------------------------------------------------------

interface WeekPick<T> {
  items: T[];
  /** Whole pool, seeded order, everything excluded pushed to the back. */
  ranked: T[];
}

/**
 * Shuffle the pool with this week's seed, then STABLE-partition: items not in
 * `exclude` first, excluded ones behind them. Taking the first `count` therefore
 * skips last week's drop entirely whenever the pool is big enough, and falls
 * back to reusing them only when it isn't (graceful degradation — we would
 * rather show a repeat than an empty shelf).
 */
function pickWeek<T extends ImageStoreItem>(
  pool: T[],
  count: number,
  weekSeed: string,
  exclude: ReadonlySet<string>,
): WeekPick<T> {
  if (pool.length === 0) return { items: [], ranked: [] };
  const shuffled = seededShuffle(pool, mulberry32(fnv1a(`${SEED_NAMESPACE}:drop:${weekSeed}`)));
  const fresh: T[] = [];
  const stale: T[] = [];
  for (const item of shuffled) {
    if (exclude.has(item.id)) stale.push(item);
    else fresh.push(item);
  }
  const ranked = fresh.concat(stale);
  return { items: ranked.slice(0, Math.min(count, ranked.length)), ranked };
}

/**
 * Walk the chain forward from the anchor to `targetOrdinal`.
 *
 * Why a chain and not "compute last week once and exclude it": last week's REAL
 * drop was itself constrained by the week before it, so a one-step lookback that
 * ignores that constraint computes the WRONG previous drop and lets repeats
 * slip through at the seam. Anchoring the recursion and walking forward makes
 * getWeeklyDrop(w) exclude precisely what getWeeklyDrop(w-1) returns, for every
 * consecutive pair — which is the guarantee we actually promised.
 *
 * Cost is O(weeksSinceAnchor x pool) with no allocation beyond two arrays per
 * step: tens of microseconds at this catalog size, and nothing is persisted.
 */
function walkChain<T extends ImageStoreItem>(
  pool: T[],
  count: number,
  targetOrdinal: number,
): { current: WeekPick<T>; previousIds: Set<string> } {
  const start =
    targetOrdinal <= ANCHOR_ORDINAL
      ? targetOrdinal // before the anchor: unconstrained, no history to honor
      : Math.max(ANCHOR_ORDINAL, targetOrdinal - MAX_CHAIN_WEEKS);

  let previousIds = new Set<string>();
  let current: WeekPick<T> = { items: [], ranked: [] };

  for (let o = start; o <= targetOrdinal; o++) {
    if (o > start) previousIds = new Set(current.items.map((i) => i.id));
    current = pickWeek(pool, count, isoWeekSeedForOrdinal(o), previousIds);
  }
  return { current, previousIds };
}

// ---------------------------------------------------------------------------
// Surprise cadence — a pure hash of the week, no state, no randomness
// ---------------------------------------------------------------------------

/**
 * What the calendar rolled for a given week ordinal.
 * Same week → same answer, forever, on every device, with nothing stored.
 */
export function plannedSurpriseForOrdinal(ordinal: number): SurpriseKind {
  const period = Math.floor(SURPRISE_PERIOD_WEEKS);
  if (!Number.isFinite(period) || period <= 0) return 'none';

  const block = Math.floor(ordinal / period);
  const weekInBlock = ordinal - block * period; // 0 .. period-1, negatives included
  const rand = mulberry32(fnv1a(`${SEED_NAMESPACE}:surprise:${block}`));
  const chosenWeek = Math.floor(rand() * period);
  if (weekInBlock !== chosenWeek) return 'none';
  return rand() < RARE_REVEAL_SHARE ? 'rare' : 'bonus';
}

/** What the calendar rolled for a given ISO-week seed, e.g. "2026-W31". */
export function plannedSurprise(weekSeed: string): SurpriseKind {
  return plannedSurpriseForOrdinal(isoWeekOrdinalFromSeed(weekSeed));
}

export function isSurpriseWeek(weekSeed: string): boolean {
  return plannedSurprise(weekSeed) !== 'none';
}

// ---------------------------------------------------------------------------
// The drop
// ---------------------------------------------------------------------------

/**
 * The week's featured image selection, decided entirely by the ISO week.
 *
 *  - Stable Mon–Sun (isoWeekSeed), so it reads as "this week's collection".
 *  - NEVER repeats a piece from last week's drop while the pool has room
 *    (pool >= 2 x count). Below that it degrades: repeats are allowed, listed
 *    in `repeatedIds`, and the drop is never empty when the catalog isn't.
 *  - 'misprint'-tier pieces sit OUT of the normal pool and only appear as the
 *    rare surprise — unless the catalog has nothing else, in which case they
 *    carry the drop rather than leaving the shelf bare.
 */
export function getWeeklyDrop<T extends ImageStoreItem>(
  catalog: readonly T[] | null | undefined,
  date: DateInput = new Date(),
  count: number = DEFAULT_DROP_SIZE,
): WeeklyDrop<T> {
  const weekStart = isoWeekStart(date);
  const weekOrdinal = isoWeekOrdinal(date);
  const weekSeed = seedForWeekStart(weekStart);
  const size = clampCount(count);

  const eligible = eligibleItems(catalog);
  const rarePool = eligible.filter(isMisprint);
  const archivePool = eligible.filter((i) => !isMisprint(i));
  // Degradation: a catalog of nothing but misprints still gets a drop.
  const basePool = archivePool.length > 0 ? archivePool : eligible;

  const { current, previousIds } = walkChain(basePool, size, weekOrdinal);
  const items = current.items;
  const itemIds = new Set(items.map((i) => i.id));
  const repeatedIds = items.filter((i) => previousIds.has(i.id)).map((i) => i.id);

  const planned = plannedSurpriseForOrdinal(weekOrdinal);
  let bonusItem: T | null = null;
  let rareItem: T | null = null;
  let surprise: SurpriseKind = 'none';

  if (planned === 'rare') {
    const candidates = rarePool.filter((i) => !itemIds.has(i.id));
    if (candidates.length > 0) {
      const rand = mulberry32(fnv1a(`${SEED_NAMESPACE}:rare:${weekSeed}`));
      rareItem = candidates[Math.floor(rand() * candidates.length)] ?? null;
      surprise = 'rare';
    }
  }

  // A 'bonus' week, or a 'rare' week with no misprint left to reveal: hand out
  // one extra piece instead — still fresh (not in the drop, not last week's).
  if (surprise === 'none' && planned !== 'none') {
    bonusItem =
      current.ranked.find((i) => !itemIds.has(i.id) && !previousIds.has(i.id)) ?? null;
    if (bonusItem) surprise = 'bonus';
  }

  const allItems = items.slice();
  if (bonusItem) allItems.push(bonusItem);
  if (rareItem) allItems.push(rareItem);

  return {
    weekSeed,
    weekOrdinal,
    weekStart,
    items,
    previousItemIds: Array.from(previousIds),
    repeatedIds,
    bonusItem,
    rareItem,
    plannedSurprise: planned,
    surprise,
    allItems,
  };
}
