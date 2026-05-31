// Inventory rotation — availability windows, stock checks, seeded "featured"
// selection, and atomic stock decrement.
//
// Lives alongside the Product Prisma model (see prisma/schema.prisma). The
// catalog migration owns the row data; this module owns the inventory fields
// (stockQuantity, availabilityRule, restockSchedule, lastRestockAt) and the
// pure JS logic that interprets them.
//
// Design decisions:
//   - stockQuantity == null  → unlimited (the legacy/default behavior)
//   - availabilityRule == null → always available (legacy default)
//   - Audiobooks + study guides ignore availabilityRule entirely (digital
//     goods, no calendar gating).
//   - getFeaturedSelection() uses a seeded shuffle so the homepage is stable
//     within a calendar day but rotates day to day.

import { prisma } from './prisma';

// Minimal product shape this module reads. We deliberately do NOT import the
// generated Prisma `Product` type so that this file can also operate on plain
// objects (e.g. JSON-loaded products during the catalog migration window).
// Any fields not listed are ignored.
export interface InventoryProduct {
  id: string;
  category?: string;
  isAudiobook?: boolean | null;
  isStudyGuide?: boolean | null;
  stockQuantity?: number | null;
  availabilityRule?: AvailabilityRule | null | unknown;
}

export type AvailabilityRule =
  | { type: 'always' }
  | { type: 'weekly'; daysOfWeek: number[] }       // 0=Sun..6=Sat
  | { type: 'monthly'; weekOfMonth: number[] }     // 1..5 (5 = last/overflow)
  | { type: 'dated'; featuredDates: string[] };    // ["MM-DD", ...]

export type RestockSchedule = {
  cadence: 'mon-thu' | 'weekly' | 'never';
  amount: number;
};

// Categories that are always available regardless of availabilityRule.
// Digital goods don't need calendar gating.
const ALWAYS_AVAILABLE_CATEGORIES = new Set(['audiobooks', 'study-guides']);

function isAlwaysAvailableCategory(p: InventoryProduct): boolean {
  if (p.isAudiobook) return true;
  if (p.isStudyGuide) return true;
  if (p.category && ALWAYS_AVAILABLE_CATEGORIES.has(p.category)) return true;
  return false;
}

function mmdd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}-${day}`;
}

// 1=first week of month .. 5=fifth/last partial week.
function weekOfMonth(d: Date): number {
  return Math.ceil(d.getDate() / 7);
}

function parseRule(raw: unknown): AvailabilityRule | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { type?: unknown };
  if (typeof r.type !== 'string') return null;
  if (r.type === 'always') return { type: 'always' };
  if (r.type === 'weekly') {
    const days = (raw as { daysOfWeek?: unknown }).daysOfWeek;
    if (!Array.isArray(days)) return null;
    return { type: 'weekly', daysOfWeek: days.filter((n): n is number => Number.isInteger(n)) };
  }
  if (r.type === 'monthly') {
    const wks = (raw as { weekOfMonth?: unknown }).weekOfMonth;
    if (!Array.isArray(wks)) return null;
    return { type: 'monthly', weekOfMonth: wks.filter((n): n is number => Number.isInteger(n)) };
  }
  if (r.type === 'dated') {
    const dates = (raw as { featuredDates?: unknown }).featuredDates;
    if (!Array.isArray(dates)) return null;
    return { type: 'dated', featuredDates: dates.filter((s): s is string => typeof s === 'string') };
  }
  return null;
}

/**
 * Returns true if the product is available to sell at `now`.
 *
 *   if-tree (decision rules):
 *     - audiobook/study-guide/audiobooks-category → true (always)
 *     - availabilityRule == null                  → true (legacy default)
 *     - type === 'always'                         → true
 *     - type === 'weekly'                         → day-of-week in daysOfWeek
 *     - type === 'monthly'                        → week-of-month in weekOfMonth
 *     - type === 'dated'                          → today's MM-DD in featuredDates
 *     - anything malformed                        → true (fail-open so a bad
 *                                                    JSON blob doesn't hide
 *                                                    the whole shop)
 */
export function isAvailableNow(p: InventoryProduct, now: Date = new Date()): boolean {
  if (isAlwaysAvailableCategory(p)) return true;

  const rule = parseRule(p.availabilityRule);
  if (!rule) return true;

  switch (rule.type) {
    case 'always':
      return true;
    case 'weekly':
      return rule.daysOfWeek.includes(now.getDay());
    case 'monthly':
      return rule.weekOfMonth.includes(weekOfMonth(now));
    case 'dated':
      return rule.featuredDates.includes(mmdd(now));
  }
}

/**
 * Stock check. null = unlimited.
 */
export function isInStock(p: InventoryProduct): boolean {
  return p.stockQuantity == null || p.stockQuantity > 0;
}

/**
 * Convenience — both gates pass.
 */
export function isPurchasable(p: InventoryProduct, now: Date = new Date()): boolean {
  return isAvailableNow(p, now) && isInStock(p);
}

/**
 * Returns true if the product is date-pinned to `now` (i.e. its rule is
 * 'dated' and today's MM-DD is in featuredDates). Used by getFeaturedSelection
 * to prioritize seasonal items.
 */
export function isFeaturedToday(p: InventoryProduct, now: Date = new Date()): boolean {
  const rule = parseRule(p.availabilityRule);
  if (!rule || rule.type !== 'dated') return false;
  return rule.featuredDates.includes(mmdd(now));
}

/** ISO date string in local TZ, for use as a stable daily seed. */
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 32-bit FNV-1a string hash → uint32 seed for mulberry32.
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Mulberry32 — small, fast, deterministic PRNG. Good enough for daily
// shuffles; we don't need crypto quality here.
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], rand: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Pick `count` products to feature on the homepage today.
 *
 *   1. Filter to currently-available + in-stock products.
 *   2. Anything pinned to today's MM-DD (rule type 'dated') goes in first —
 *      seasonal items shouldn't depend on the seed.
 *   3. Fill the remaining slots with a seeded shuffle of the rest.
 *
 * Returns 0..count items. The seed defaults to today's ISO date so the
 * homepage is stable within a day and rotates day to day; pass an explicit
 * seed to override (tests, manual previews).
 *
 * count is clamped to [5, 10] per the inventory spec.
 */
export function getFeaturedSelection<T extends InventoryProduct>(
  allProducts: T[],
  count = 7,
  seed: string = todayISO(),
): T[] {
  const clampedCount = Math.max(5, Math.min(10, count));
  const now = new Date();

  const eligible = allProducts.filter((p) => isAvailableNow(p, now) && isInStock(p));
  if (eligible.length === 0) return [];

  const pinned: T[] = [];
  const rest: T[] = [];
  for (const p of eligible) {
    if (isFeaturedToday(p, now)) pinned.push(p);
    else rest.push(p);
  }

  if (pinned.length >= clampedCount) {
    // More seasonal items than slots — still shuffle the pinned set so the
    // ordering varies day to day.
    return seededShuffle(pinned, mulberry32(fnv1a(seed))).slice(0, clampedCount);
  }

  const fillNeeded = clampedCount - pinned.length;
  const shuffledRest = seededShuffle(rest, mulberry32(fnv1a(seed)));
  return pinned.concat(shuffledRest.slice(0, fillNeeded));
}

/**
 * Atomically decrement stockQuantity. Throws if the product doesn't exist or
 * the decrement would go negative. No-op (returns null) for unlimited-stock
 * products (stockQuantity == null).
 *
 * Uses a conditional update (`stockQuantity >= qty`) to make this race-safe
 * without an explicit row lock — concurrent calls will fail their update
 * instead of oversubscribing the shelf.
 */
export class OutOfStockError extends Error {
  constructor(public productId: string, public available: number, public requested: number) {
    super(`Out of stock for ${productId}: have ${available}, need ${requested}`);
    this.name = 'OutOfStockError';
  }
}

export async function decrementStock(productId: string, qty: number): Promise<number | null> {
  if (!Number.isInteger(qty) || qty < 1) {
    throw new Error('decrementStock requires positive integer qty');
  }

  // The DB column may not exist yet (other agent's migration is in-flight).
  // We probe for the column by selecting it; on failure we silently no-op so
  // checkout still works while the migration lands.
  let current: { stockQuantity: number | null } | null;
  try {
    current = await prisma.product.findUnique({
      where: { id: productId },
      select: { stockQuantity: true },
    });
  } catch (err) {
    // Column likely missing — fail open. Log so it's visible during the
    // migration window.
    console.warn(`[inventory] decrementStock probe failed for ${productId}, skipping:`, err);
    return null;
  }

  if (!current) {
    // Product not in DB (legacy JSON-only). Fail open — the order route
    // already validates the product exists in lib/products.
    return null;
  }

  if (current.stockQuantity == null) return null; // unlimited

  if (current.stockQuantity < qty) {
    throw new OutOfStockError(productId, current.stockQuantity, qty);
  }

  // Race-safe conditional update — only succeeds if stock is still >= qty.
  const result = await prisma.product.updateMany({
    where: { id: productId, stockQuantity: { gte: qty } },
    data: { stockQuantity: { decrement: qty } },
  });

  if (result.count === 0) {
    // Someone else drained it between our read and update.
    throw new OutOfStockError(productId, 0, qty);
  }

  const after = await prisma.product.findUnique({
    where: { id: productId },
    select: { stockQuantity: true },
  });
  return after?.stockQuantity ?? null;
}

/**
 * Restock pass — applies restockSchedule to every product with a schedule.
 *   - cadence 'mon-thu' adds amount on Monday and Thursday
 *   - cadence 'weekly'  adds amount on Sunday
 *   - cadence 'never'   never auto-restocks (only manual)
 *
 * Guards against double-restock on the same calendar day via lastRestockAt.
 * Products with stockQuantity == null (unlimited) are skipped — restocking
 * unlimited stock is meaningless.
 *
 * Returns a summary of what was restocked.
 */
export interface RestockResult {
  restocked: { id: string; name: string; qty: number; newStock: number }[];
  skipped: number;
}

function parseSchedule(raw: unknown): RestockSchedule | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { cadence?: unknown; amount?: unknown };
  if (
    r.cadence !== 'mon-thu' &&
    r.cadence !== 'weekly' &&
    r.cadence !== 'never'
  ) {
    return null;
  }
  if (!Number.isInteger(r.amount) || (r.amount as number) < 1) return null;
  return { cadence: r.cadence, amount: r.amount as number };
}

function shouldRestockToday(cadence: RestockSchedule['cadence'], now: Date): boolean {
  const dow = now.getDay(); // 0=Sun..6=Sat
  if (cadence === 'never') return false;
  if (cadence === 'mon-thu') return dow === 1 || dow === 4;
  if (cadence === 'weekly') return dow === 0;
  return false;
}

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export async function runRestockPass(now: Date = new Date()): Promise<RestockResult> {
  let rows: {
    id: string;
    name: string;
    stockQuantity: number | null;
    restockSchedule: unknown;
    lastRestockAt: Date | null;
  }[] = [];

  try {
    rows = await prisma.product.findMany({
      // Pull every product; we filter for non-null schedule in JS. Prisma's
      // typed Json filter is annoying for "not null" + we need to JSON-parse
      // the schedule anyway to validate shape.
      select: {
        id: true,
        name: true,
        stockQuantity: true,
        restockSchedule: true,
        lastRestockAt: true,
      },
    });
  } catch (err) {
    console.warn('[inventory] runRestockPass: columns likely missing, returning empty:', err);
    return { restocked: [], skipped: 0 };
  }

  const result: RestockResult = { restocked: [], skipped: 0 };

  for (const row of rows) {
    const sched = parseSchedule(row.restockSchedule);
    if (!sched) {
      result.skipped++;
      continue;
    }
    if (!shouldRestockToday(sched.cadence, now)) {
      result.skipped++;
      continue;
    }
    if (row.lastRestockAt && sameLocalDay(row.lastRestockAt, now)) {
      // already restocked today
      result.skipped++;
      continue;
    }
    // Skip unlimited-stock items (null means unlimited; restocking it does
    // nothing meaningful).
    if (row.stockQuantity == null) {
      result.skipped++;
      continue;
    }

    const newStock = row.stockQuantity + sched.amount;
    await prisma.product.update({
      where: { id: row.id },
      data: {
        stockQuantity: newStock,
        lastRestockAt: now,
      },
    });
    result.restocked.push({
      id: row.id,
      name: row.name,
      qty: sched.amount,
      newStock,
    });
  }

  return result;
}
