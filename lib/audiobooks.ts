// Audiobook listen-history + up-next-per-series helpers.
//
// Data lives in two JSON columns on DriveUser:
//   audioHistory:   Record<productId, { lastListenedAt: number, completed: boolean }>
//   seriesProgress: Record<series, productId>   ← pointer to next un-completed
//
// "Series" is derived from Product.series (lib/products.ts → JSON catalog).
// Each standalone audiobook gets its own one-item series tag so the up-next
// logic always has a key (item just shows itself as "next" until listened).
//
// The server is the source of truth — kids hit /api/audiobooks/* endpoints,
// which call these helpers. No client-side history storage.

import { prisma } from './prisma';
import type { Product } from '@/types';

export interface AudioHistoryEntry {
  lastListenedAt: number;
  completed: boolean;
}

export type AudioHistory = Record<string, AudioHistoryEntry>;
export type SeriesProgress = Record<string, string>; // series → productId

// ----- Helpers -----

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function readHistory(blob: unknown): AudioHistory {
  const obj = asObject(blob);
  const out: AudioHistory = {};
  for (const [pid, raw] of Object.entries(obj)) {
    const entry = asObject(raw);
    const ts = typeof entry.lastListenedAt === 'number' ? entry.lastListenedAt : 0;
    const done = entry.completed === true;
    if (typeof pid === 'string' && pid.length > 0) {
      out[pid] = { lastListenedAt: ts, completed: done };
    }
  }
  return out;
}

function readSeriesProgress(blob: unknown): SeriesProgress {
  const obj = asObject(blob);
  const out: SeriesProgress = {};
  for (const [series, pid] of Object.entries(obj)) {
    if (typeof series === 'string' && typeof pid === 'string' && pid.length > 0) {
      out[series] = pid;
    }
  }
  return out;
}

// Order items within a series. Prefer `episode` (numeric), fall back to a
// numeric tail extracted from SKU (e.g. "BE-EP-007" → 7), then alphabetical
// id as a final tiebreak so the ordering is stable.
function seriesOrderKey(p: Product): number {
  if (typeof p.episode === 'number' && Number.isFinite(p.episode)) return p.episode;
  const m = (p.sku || '').match(/(\d+)\s*$/);
  if (m) return parseInt(m[1], 10);
  return Number.MAX_SAFE_INTEGER;
}

export function sortSeriesItems(items: Product[]): Product[] {
  return [...items].sort((a, b) => {
    const ka = seriesOrderKey(a);
    const kb = seriesOrderKey(b);
    if (ka !== kb) return ka - kb;
    return a.id.localeCompare(b.id);
  });
}

// Walk a series in order and return the first item with no `completed: true`
// in history. Returns null if every item in the series is finished.
function pickNextInSeries(
  seriesItems: Product[],
  history: AudioHistory,
): Product | null {
  const sorted = sortSeriesItems(seriesItems);
  for (const item of sorted) {
    if (!history[item.id]?.completed) return item;
  }
  return null;
}

// ----- Write helpers (used by API routes) -----

export async function markListenStart(
  userName: string,
  productId: string,
): Promise<void> {
  if (!userName || !productId) return;
  const row = await prisma.driveUser.findUnique({
    where: { name: userName },
    select: { audioHistory: true },
  });
  if (!row) return;
  const history = readHistory(row.audioHistory);
  const prev = history[productId];
  history[productId] = {
    lastListenedAt: Date.now(),
    completed: prev?.completed === true,
  };
  await prisma.driveUser.update({
    where: { name: userName },
    data: { audioHistory: history as unknown as object },
  });
}

// Mark complete + update seriesProgress to point at the next un-completed
// item in this series (or clear it if the series is finished).
export async function markListenComplete(
  userName: string,
  productId: string,
  allAudiobooks: Product[],
): Promise<void> {
  if (!userName || !productId) return;
  const row = await prisma.driveUser.findUnique({
    where: { name: userName },
    select: { audioHistory: true, seriesProgress: true },
  });
  if (!row) return;

  const history = readHistory(row.audioHistory);
  const progress = readSeriesProgress(row.seriesProgress);

  history[productId] = {
    lastListenedAt: Date.now(),
    completed: true,
  };

  // Find this product to learn its series.
  const product = allAudiobooks.find((p) => p.id === productId);
  if (product?.series) {
    const seriesItems = allAudiobooks.filter((p) => p.series === product.series);
    const next = pickNextInSeries(seriesItems, history);
    if (next) {
      progress[product.series] = next.id;
    } else {
      // Series complete — drop the pointer so the homepage stops showing it
      // as "up next" (recently-played still surfaces it).
      delete progress[product.series];
    }
  }

  await prisma.driveUser.update({
    where: { name: userName },
    data: {
      audioHistory: history as unknown as object,
      seriesProgress: progress as unknown as object,
    },
  });
}

// ----- Read helpers (used by API + UI) -----

export async function readAudioState(userName: string): Promise<{
  history: AudioHistory;
  seriesProgress: SeriesProgress;
} | null> {
  const row = await prisma.driveUser.findUnique({
    where: { name: userName },
    select: { audioHistory: true, seriesProgress: true },
  });
  if (!row) return null;
  return {
    history: readHistory(row.audioHistory),
    seriesProgress: readSeriesProgress(row.seriesProgress),
  };
}

// For each series the kid has touched, find the next un-completed item.
// Returns up to `limit` items ordered by most-recently-touched series.
//
// "Touched" = any product in the series has a history entry (started OR
// completed). We figure the series' last-touched timestamp by max() of
// lastListenedAt across all its items, then sort series desc by that.
export function getUpNextPerSeries(
  state: { history: AudioHistory; seriesProgress: SeriesProgress } | null,
  allAudiobooks: Product[],
  limit = 4,
): Product[] {
  if (!state) return [];
  const { history, seriesProgress } = state;
  if (Object.keys(history).length === 0) return [];

  // Group audiobooks by series.
  const bySeries = new Map<string, Product[]>();
  for (const p of allAudiobooks) {
    if (!p.series) continue;
    const arr = bySeries.get(p.series) ?? [];
    arr.push(p);
    bySeries.set(p.series, arr);
  }

  // For each series, compute lastTouched + pick next un-completed item.
  type Row = { series: string; next: Product; lastTouched: number };
  const rows: Row[] = [];
  for (const [series, items] of bySeries) {
    let lastTouched = 0;
    let touched = false;
    for (const item of items) {
      const h = history[item.id];
      if (h && h.lastListenedAt > 0) {
        touched = true;
        if (h.lastListenedAt > lastTouched) lastTouched = h.lastListenedAt;
      }
    }
    if (!touched) continue; // only show series the kid has started

    // Prefer the cached pointer in seriesProgress; fall back to a fresh walk
    // (covers the case where the pointer is missing, e.g. for series the kid
    // only ever started but never completed an episode of).
    let next: Product | null = null;
    const pointerId = seriesProgress[series];
    if (pointerId) {
      const cached = items.find((p) => p.id === pointerId);
      if (cached && !history[cached.id]?.completed) {
        next = cached;
      }
    }
    if (!next) {
      next = pickNextInSeries(items, history);
    }
    if (next) rows.push({ series, next, lastTouched });
  }

  rows.sort((a, b) => b.lastTouched - a.lastTouched);
  return rows.slice(0, limit).map((r) => r.next);
}

// Most-recently-listened items across all audiobooks (regardless of series).
export function getRecentlyListened(
  state: { history: AudioHistory; seriesProgress: SeriesProgress } | null,
  allAudiobooks: Product[],
  limit = 3,
): Product[] {
  if (!state) return [];
  const { history } = state;
  if (Object.keys(history).length === 0) return [];

  const byId = new Map(allAudiobooks.map((p) => [p.id, p] as const));
  const entries = Object.entries(history)
    .filter(([, h]) => h.lastListenedAt > 0)
    .sort((a, b) => b[1].lastListenedAt - a[1].lastListenedAt);

  const out: Product[] = [];
  for (const [pid] of entries) {
    const p = byId.get(pid);
    if (p) out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}
