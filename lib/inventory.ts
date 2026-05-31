// Inventory — DB-backed mutations (decrementStock, runRestockPass).
//
// Pure availability/stock rules live in lib/inventory-rules.ts (client-safe).
// This file imports prisma so it CANNOT be imported by 'use client' components.
// Anything that needs availability checks from the client should import from
// lib/inventory-rules directly.

import { prisma } from './prisma';
import type { RestockSchedule } from './inventory-rules';

// Re-export pure rule helpers + types so server callers can keep importing
// from a single module.
export {
  isAvailableNow,
  isInStock,
  isPurchasable,
  isFeaturedToday,
  todayISO,
  getFeaturedSelection,
} from './inventory-rules';
export type {
  InventoryProduct,
  AvailabilityRule,
  RestockSchedule,
} from './inventory-rules';

// ---------- Server-only mutations below ----------

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
    console.warn(`[inventory] decrementStock probe failed for ${productId}, skipping:`, err);
    return null;
  }

  if (!current) return null; // product not in DB — fail open
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
    throw new OutOfStockError(productId, 0, qty);
  }

  const after = await prisma.product.findUnique({
    where: { id: productId },
    select: { stockQuantity: true },
  });
  return after?.stockQuantity ?? null;
}

export interface RestockResult {
  restocked: { id: string; name: string; qty: number; newStock: number }[];
  skipped: number;
}

function parseSchedule(raw: unknown): RestockSchedule | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { cadence?: unknown; amount?: unknown };
  if (r.cadence !== 'mon-thu' && r.cadence !== 'weekly' && r.cadence !== 'never') return null;
  if (!Number.isInteger(r.amount) || (r.amount as number) < 1) return null;
  return { cadence: r.cadence, amount: r.amount as number };
}

function shouldRestockToday(cadence: RestockSchedule['cadence'], now: Date): boolean {
  const dow = now.getDay();
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
    if (!sched) { result.skipped++; continue; }
    if (!shouldRestockToday(sched.cadence, now)) { result.skipped++; continue; }
    if (row.lastRestockAt && sameLocalDay(row.lastRestockAt, now)) { result.skipped++; continue; }
    if (row.stockQuantity == null) { result.skipped++; continue; }

    const newStock = row.stockQuantity + sched.amount;
    await prisma.product.update({
      where: { id: row.id },
      data: { stockQuantity: newStock, lastRestockAt: now },
    });
    result.restocked.push({ id: row.id, name: row.name, qty: sched.amount, newStock });
  }
  return result;
}
