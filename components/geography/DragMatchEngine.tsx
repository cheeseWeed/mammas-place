// DragMatchEngine — drag a state-name tile onto the matching state on the map.
//
// Game model (v1):
//   - Tray shows ALL N state-name tiles for the round at once.
//   - Kid picks one and drags it (pointer-drag) OR taps it then taps the state
//     (tap-tap mode). Tap-tap is the reliable fallback for touch devices and
//     for kids whose drag is shaky.
//   - Drop on the CORRECT state: tile vanishes, state flashes green, score++
//     IF this was the tile's first attempt.
//   - Drop on a WRONG state (or off-map): tile bounces back to the tray with
//     a shake; the tile is now marked "missed" so a later correct drop won't
//     score (kept off the board so it doesn't penalize harder than once).
//   - Round ends when tray is empty.
//
// Hit-testing uses document.elementFromPoint(x, y) + walking up to the nearest
// <path id="XX"> whose id matches a known postal. The tile element has
// pointer-events:none while dragging so the SVG underneath is visible to the
// hit test.
//
// State pieces live in refs where possible so we don't re-render on every
// pointermove (would re-mount USMap and lose its event listeners).

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import statesData from '@/data/states.json';
import USMap, { REGION_TINTS } from './USMap';

type StateRecord = {
  postal: string;
  name: string;
  capital: string;
  region?: string;
};

export type DragMatchRegion = null | 'Northeast' | 'Midwest' | 'South' | 'West';

export type DragMatchEngineProps = {
  questionCount: number;
  region?: DragMatchRegion;
  onComplete: (result: { score: number; total: number; misses: string[] }) => void;
};

const ALL_STATES = (statesData as StateRecord[]).filter((s) => s.postal !== 'DC');
const VALID_POSTALS = new Set(ALL_STATES.map((s) => s.postal));

const RIGHT_FLASH_MS = 700;
const SHAKE_MS = 500;
const DRAG_THRESHOLD_PX = 6; // movement below this on pointerup = a tap

// Fisher-Yates over a copy. Pure.
function pickRandom<T>(source: T[], n: number): T[] {
  const copy = source.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

// Walk up from a hit-test element to find the nearest ancestor whose `id` is
// a valid state postal. Returns null if there isn't one (drop off the map).
function findStatePostalFromPoint(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y);
  let node: Element | null = el;
  while (node) {
    const id = node.id?.toUpperCase();
    if (id && VALID_POSTALS.has(id)) return id;
    node = node.parentElement;
  }
  return null;
}

type TileStatus = 'pending' | 'placed' | 'missed-pending';
// 'pending'        — not yet touched, scores on correct drop
// 'placed'         — correctly placed, tile removed from tray
// 'missed-pending' — got it wrong once; still in tray, but won't score

type Tile = {
  postal: string;
  name: string;
  status: TileStatus;
};

type DragState =
  | { kind: 'idle' }
  | { kind: 'press'; postal: string; startX: number; startY: number }
  | { kind: 'drag'; postal: string; x: number; y: number };

export default function DragMatchEngine({
  questionCount,
  region = null,
  onComplete,
}: DragMatchEngineProps) {
  // Frozen queue for the round.
  const queue = useMemo(() => {
    const pool = region ? ALL_STATES.filter((s) => s.region === region) : ALL_STATES;
    return pickRandom(pool, questionCount);
  }, [questionCount, region]);

  const [tiles, setTiles] = useState<Tile[]>(() =>
    queue.map((s) => ({ postal: s.postal, name: s.name, status: 'pending' as TileStatus })),
  );
  const [score, setScore] = useState(0);
  const [drag, setDrag] = useState<DragState>({ kind: 'idle' });
  // Selected tile for tap-tap mode (set when a tap doesn't turn into a drag).
  const [selectedPostal, setSelectedPostal] = useState<string | null>(null);
  // State currently under the dragged tile (for highlight feedback).
  const [hoverPostal, setHoverPostal] = useState<string | null>(null);
  // State currently flashing green on a correct drop.
  const [flashPostal, setFlashPostal] = useState<string | null>(null);
  // Tile currently shaking after a wrong drop (postal key).
  const [shakingPostal, setShakingPostal] = useState<string | null>(null);

  const scoreRef = useRef(0);
  const missesRef = useRef<string[]>([]);
  const completedRef = useRef(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    };
  }, []);

  // Wrap onComplete with a guard so we only call it once even if React
  // re-renders us with an already-empty tray.
  const finishIfDone = useCallback(
    (nextTiles: Tile[]) => {
      if (completedRef.current) return;
      const allPlacedOrSettled = nextTiles.every((t) => t.status === 'placed');
      if (allPlacedOrSettled) {
        completedRef.current = true;
        onComplete({
          score: scoreRef.current,
          total: queue.length,
          misses: missesRef.current.slice(),
        });
      }
    },
    [onComplete, queue.length],
  );

  // Drop handler — shared by pointer-drag and tap-tap modes.
  const resolveDrop = useCallback(
    (tilePostal: string, droppedOnPostal: string | null) => {
      const tile = tiles.find((t) => t.postal === tilePostal);
      if (!tile || tile.status === 'placed') return;

      if (droppedOnPostal === tilePostal) {
        // Correct drop. Score only if it was first-attempt (status 'pending').
        const scores = tile.status === 'pending';
        if (scores) {
          scoreRef.current += 1;
          setScore(scoreRef.current);
        } else {
          // Tile was 'missed-pending' — still record as miss (already added),
          // but at least it's off the board now.
        }
        setFlashPostal(tilePostal);
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        flashTimerRef.current = setTimeout(() => setFlashPostal(null), RIGHT_FLASH_MS);

        setTiles((prev) => {
          const next = prev.map((t) =>
            t.postal === tilePostal ? { ...t, status: 'placed' as TileStatus } : t,
          );
          finishIfDone(next);
          return next;
        });
        setSelectedPostal(null);
      } else {
        // Wrong drop OR off-map drop. Bounce tile back, shake it.
        if (tile.status === 'pending' && !missesRef.current.includes(tilePostal)) {
          missesRef.current.push(tilePostal);
        }
        setTiles((prev) =>
          prev.map((t) =>
            t.postal === tilePostal && t.status === 'pending'
              ? { ...t, status: 'missed-pending' as TileStatus }
              : t,
          ),
        );
        setShakingPostal(tilePostal);
        if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
        shakeTimerRef.current = setTimeout(() => setShakingPostal(null), SHAKE_MS);
        setSelectedPostal(null);
      }
    },
    [tiles, finishIfDone],
  );

  // ----- Pointer-drag wiring -----

  // Pointermove listener — installed globally only while we're pressing/dragging.
  useEffect(() => {
    if (drag.kind === 'idle') return;

    const move = (e: PointerEvent) => {
      if (drag.kind === 'press') {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        if (dx * dx + dy * dy >= DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
          // Upgrade press → drag once we cross the threshold.
          setDrag({ kind: 'drag', postal: drag.postal, x: e.clientX, y: e.clientY });
          setSelectedPostal(null);
        }
        return;
      }
      // drag.kind === 'drag'
      setDrag({ kind: 'drag', postal: drag.postal, x: e.clientX, y: e.clientY });
      // Hit-test under the cursor (the dragged tile has pointer-events:none).
      const under = findStatePostalFromPoint(e.clientX, e.clientY);
      setHoverPostal(under);
    };

    const up = (e: PointerEvent) => {
      if (drag.kind === 'press') {
        // Didn't move enough — treat as a tap, select this tile for tap-tap mode.
        setSelectedPostal((cur) => (cur === drag.postal ? null : drag.postal));
        setDrag({ kind: 'idle' });
        return;
      }
      // drag.kind === 'drag' — resolve drop at pointerup location.
      const dropOn = findStatePostalFromPoint(e.clientX, e.clientY);
      resolveDrop(drag.postal, dropOn);
      setHoverPostal(null);
      setDrag({ kind: 'idle' });
    };

    // Cancel (browser/OS interrupt) — bounce back without scoring.
    const cancel = () => {
      setHoverPostal(null);
      setDrag({ kind: 'idle' });
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [drag, resolveDrop]);

  // ----- Tap-tap wiring (map click handler) -----
  // When a tile is selected via tap-tap, a click on any state resolves the drop.
  const handleStateClick = useCallback(
    (postal: string) => {
      if (selectedPostal) {
        resolveDrop(selectedPostal, postal);
      }
    },
    [selectedPostal, resolveDrop],
  );

  // ----- USMap highlight sets -----
  // Show green tint on the state currently under a drag IF it's the right one;
  // OR on the state flashing after a correct drop.
  const highlightedStates = useMemo(() => {
    const s = new Set<string>();
    if (flashPostal) s.add(flashPostal);
    if (drag.kind === 'drag' && hoverPostal && hoverPostal === drag.postal) {
      s.add(hoverPostal);
    }
    // For tap-tap, also tint the selected tile's matching state on hover would
    // require tracking map hover during tap-tap; skip for v1 (kid just taps).
    return s;
  }, [flashPostal, drag, hoverPostal]);

  // Region tint (study-map style) when a region is active.
  const regionTints = useMemo(() => {
    if (!region) return undefined;
    const tint = REGION_TINTS[region];
    if (!tint) return undefined;
    const m = new Map<string, string>();
    ALL_STATES.forEach((s) => {
      if (s.region === region) m.set(s.postal, tint);
    });
    return m;
  }, [region]);

  // Hide ALL state name labels & capital names — the kid IS the labeler.
  const allPostalsSet = useMemo(
    () => new Set((statesData as StateRecord[]).map((s) => s.postal)),
    [],
  );

  // Active (still-in-tray) tiles for rendering. Placed tiles are gone.
  const trayTiles = tiles.filter((t) => t.status !== 'placed');
  const totalTiles = queue.length;
  const placedCount = tiles.filter((t) => t.status === 'placed').length;

  // The currently-dragging tile (so we can render it at the cursor as a "ghost").
  const draggingTile =
    drag.kind === 'drag' ? tiles.find((t) => t.postal === drag.postal) : null;

  return (
    <div className="h-full w-full flex flex-col select-none">
      {/* Top strip: prompt + score + progress (compact) */}
      <div className="shrink-0 bg-white/90 backdrop-blur-sm border-b border-emerald-200 px-3 sm:px-4 py-2">
        <div className="flex items-center justify-between gap-3 mb-1.5">
          <div className="text-sm sm:text-base font-black text-emerald-900 leading-tight">
            {selectedPostal
              ? `Tap the state for ${tiles.find((t) => t.postal === selectedPostal)?.name ?? '...'}`
              : drag.kind === 'drag'
                ? `Drop on ${draggingTile?.name ?? '...'}`
                : 'Drag a name onto its state'}
          </div>
          <div className="shrink-0 text-xs sm:text-sm font-bold text-emerald-800 whitespace-nowrap">
            Score: {score} / {totalTiles}
          </div>
        </div>
        <div className="w-full bg-emerald-100 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-teal-500 to-emerald-600 h-full transition-all duration-300"
            style={{ width: `${(placedCount / totalTiles) * 100}%` }}
          />
        </div>
      </div>

      {/* Middle: USMap (no labels, no stars) */}
      <div className="flex-1 min-h-0 w-full px-1 sm:px-2 py-1">
        <USMap
          hiddenStateLabels={allPostalsSet}
          hiddenCapitalNames={allPostalsSet}
          showStateLabels={false}
          showCapitalNames={false}
          showCapitalStars={false}
          onStateClick={handleStateClick}
          highlightedStates={highlightedStates}
          regionTints={regionTints}
        />
      </div>

      {/* Bottom: tray of state-name tiles, horizontally scrollable */}
      <div className="shrink-0 bg-white/95 backdrop-blur-sm border-t border-emerald-200 px-3 sm:px-4 py-2">
        <div className="text-[10px] uppercase tracking-wide text-gray-500 font-bold mb-1">
          {trayTiles.length} {trayTiles.length === 1 ? 'name' : 'names'} left
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {trayTiles.map((t) => {
            const isDragging = drag.kind !== 'idle' && drag.postal === t.postal;
            const isSelected = selectedPostal === t.postal;
            const isShaking = shakingPostal === t.postal;
            const missed = t.status === 'missed-pending';

            // The dragging tile in the tray slot becomes a placeholder (faded).
            // Its real position is rendered separately at the cursor (see ghost below).
            return (
              <button
                key={t.postal}
                type="button"
                onPointerDown={(e) => {
                  // Left button only; ignore right-click etc.
                  if (e.button !== 0 && e.pointerType === 'mouse') return;
                  // Don't start a new drag if one's already in flight, or this
                  // tile is mid-shake (let it finish bouncing back).
                  if (drag.kind !== 'idle') return;
                  if (isShaking) return;
                  setDrag({
                    kind: 'press',
                    postal: t.postal,
                    startX: e.clientX,
                    startY: e.clientY,
                  });
                }}
                className={`shrink-0 rounded-full border-2 px-3 py-1.5 text-sm sm:text-base font-bold shadow-sm transition-all
                  ${
                    isSelected
                      ? 'bg-emerald-500 text-white border-emerald-700 shadow-md scale-105'
                      : missed
                        ? 'bg-amber-50 text-amber-900 border-amber-300 hover:border-amber-400'
                        : 'bg-white text-emerald-900 border-emerald-300 hover:border-emerald-500 hover:shadow-md'
                  }
                  ${isDragging ? 'opacity-30' : ''}
                  ${isShaking ? 'animate-shake' : ''}
                  touch-none cursor-grab active:cursor-grabbing`}
                style={{
                  // Block touch scrolling so drag works on mobile.
                  touchAction: 'none',
                }}
              >
                {t.name}
              </button>
            );
          })}
          {trayTiles.length === 0 && (
            <div className="text-sm font-bold text-emerald-700 py-1.5">
              All placed! Finishing up...
            </div>
          )}
        </div>
      </div>

      {/* Drag ghost — the floating tile that follows the cursor.
          pointer-events:none so elementFromPoint sees the SVG underneath. */}
      {drag.kind === 'drag' && draggingTile && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: drag.x,
            top: drag.y,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="rounded-full border-2 border-emerald-600 bg-white px-3 py-1.5 text-sm sm:text-base font-bold text-emerald-900 shadow-xl scale-110">
            {draggingTile.name}
          </div>
        </div>
      )}
    </div>
  );
}
