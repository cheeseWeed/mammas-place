// Anonymous, single-device progress store for the Geography hub.
//
// Backed by browser localStorage under one namespaced key. No PIN, no users,
// no server round-trip — the hub is open-play and progress is per-device.
//
// This module is the *only* place the rest of the app should touch geography
// progress. Phase pages should call readPhase/updatePhase rather than poking
// at localStorage directly. That keeps us swap-ready: when (if) we add an API
// client or move to a shared store, we replace the internals here and every
// caller keeps working.
//
// All functions are SSR-safe: when there's no window (Next.js server render),
// reads return empty/undefined and writes no-op.

const STORAGE_KEY = 'mammas-geography-progress';

// Per-phase progress slot. Each phase owns its own key and can store
// arbitrary JSON; the index signature keeps unknown future phases typed.
export type GeographyProgress = {
  // Phase 1 study has no real progress, but the slot exists.
  study?: { lastVisited?: number; statesViewed?: string[] };
  // Phase 2 quiz progress (Phase 2 will fill this in later).
  'name-quiz'?: { attempts: number; bestScore: number; misses: string[] };
  // Phase 3+ slots — keep optional; phase authors define their own shape.
  'capital-quiz'?: { attempts: number; bestScore: number; misses: string[] };
  'flag-match'?: { attempts: number; bestScore: number; misses: string[] };
  'drag-match'?: { attempts: number; bestScore: number; misses: string[] };
  'silhouette-puzzle'?: { attempts: number; bestScore: number; misses: string[] };
  'state-deep-dive'?: { lastVisited?: number; statesViewed?: string[] };
  'distance'?: { attempts: number; bestScore: number };
  'physical-quiz'?: { attempts: number; bestScore: number; misses: string[] };
  [key: string]: unknown;
};

// Read full progress object from localStorage. Returns empty object if the
// key is missing, the JSON is malformed, or we're running on the server.
export function readProgress(): GeographyProgress {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as GeographyProgress;
    }
    return {};
  } catch {
    return {};
  }
}

// Write full progress object. No-op on the server.
export function writeProgress(progress: GeographyProgress): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Quota exceeded or storage disabled — silently drop.
  }
}

// Read a single phase's slot, with type safety.
export function readPhase<K extends keyof GeographyProgress>(phaseId: K): GeographyProgress[K] {
  const all = readProgress();
  return all[phaseId];
}

// Update a single phase's slot. Replaces the slot wholesale (callers that
// want a merge should read first, spread, then write).
export function updatePhase<K extends keyof GeographyProgress>(
  phaseId: K,
  value: GeographyProgress[K]
): void {
  const all = readProgress();
  all[phaseId] = value;
  writeProgress(all);
}

// Clear all progress (settings → reset button). No-op on the server.
export function clearProgress(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage disabled — nothing to clear anyway.
  }
}
