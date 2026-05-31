// Inventory rules — PURE, CLIENT-SAFE module.
//
// Holds the availability/stock decision logic that the ProductCard (a client
// component) needs. The prisma-backed mutations (decrementStock, runRestockPass)
// live in lib/inventory.ts which imports + re-exports everything here.
//
// Split exists because importing lib/inventory.ts from a 'use client' module
// pulled prisma into the client bundle, crashing the homepage with
// "global is not defined". This file MUST stay free of any server-only imports.

// Minimal product shape this module reads. We deliberately do NOT import the
// generated Prisma `Product` type so this file can also operate on plain
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

export function isInStock(p: InventoryProduct): boolean {
  return p.stockQuantity == null || p.stockQuantity > 0;
}

export function isPurchasable(p: InventoryProduct, now: Date = new Date()): boolean {
  return isAvailableNow(p, now) && isInStock(p);
}

export function isFeaturedToday(p: InventoryProduct, now: Date = new Date()): boolean {
  const rule = parseRule(p.availabilityRule);
  if (!rule || rule.type !== 'dated') return false;
  return rule.featuredDates.includes(mmdd(now));
}

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
    return seededShuffle(pinned, mulberry32(fnv1a(seed))).slice(0, clampedCount);
  }
  const fillNeeded = clampedCount - pinned.length;
  const shuffledRest = seededShuffle(rest, mulberry32(fnv1a(seed)));
  return pinned.concat(shuffledRest.slice(0, fillNeeded));
}
