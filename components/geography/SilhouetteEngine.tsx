// SilhouetteEngine — Phase 5 "drag the shape onto the map" puzzle.
//
// Round flow:
//   1. Pick N states (region-filtered, DC excluded).
//   2. Render the political SVG underneath with EVERY state's interior dimmed
//      to a light gray. Already-placed states light up in their region tint.
//   3. The tray (right side on desktop, bottom on mobile) holds one small
//      <svg> tile per remaining state, each one drawing just that state's
//      path. Tiles are shuffled.
//   4. Kid pointerdowns on a tile → a floating clone follows the cursor.
//      Pointerup → we hit-test against the underlying map using
//      document.elementFromPoint(). If the element resolves to a path with
//      id === draggedPostal, it's a correct placement: tile leaves the tray
//      and the underlying state fills in. Otherwise the tile bounces back
//      and a brief shake is played on the dragged tile.
//   5. First-attempt-correct count is the score. Round ends when the tray
//      is empty.
//
// Touch + mouse: we use Pointer Events exclusively (one code path).
//
// We don't reuse <USMap> because USMap binds click handlers and renders
// labels we don't want here. Instead we fetch the same political SVG once,
// strip <title>s, and apply per-state fills directly.
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import statesData from '@/data/states.json';
import silhouettes from '@/public/geography/state-silhouettes.json';
import { REGION_TINTS } from './USMap';

type StateRecord = {
  postal: string;
  name: string;
  region?: string;
};

type SilhouetteEntry = {
  d: string;
  // JSON-imported tuple-ish arrays come in as number[]; we treat positions
  // 0..3 as [minX, minY, width, height] and 0..1 of center as [x, y].
  bbox: number[];
  center: number[];
};

type SilhouettesMap = Record<string, SilhouetteEntry>;
const SILHOUETTES = silhouettes as unknown as SilhouettesMap;

export type SilhouetteRegion = null | 'Northeast' | 'Midwest' | 'South' | 'West';

export type SilhouetteEngineProps = {
  questionCount: number;
  region?: SilhouetteRegion;
  onComplete: (result: { score: number; total: number; misses: string[] }) => void;
};

const VIEW_W = 959;
const VIEW_H = 593;
const SVG_URL = '/geography/us-states-political.svg';

// All states except DC — DC's silhouette is so small it'd be unfun to drag.
const ALL_STATES = (statesData as StateRecord[]).filter((s) => s.postal !== 'DC');

// Fisher-Yates over a copy.
function pickRandom<T>(source: T[], n: number): T[] {
  const copy = source.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

// Strip <title>s out of the raw political SVG and return just the inner markup
// so we can stuff it into a <g> via dangerouslySetInnerHTML. Same trick USMap uses.
function extractInnerSvg(raw: string): string {
  const openMatch = raw.match(/<svg[^>]*>/i);
  const closeIdx = raw.lastIndexOf('</svg>');
  if (!openMatch || closeIdx === -1) return raw;
  const start = openMatch.index! + openMatch[0].length;
  const inner = raw.slice(start, closeIdx);
  return inner.replace(/<title>[^<]*<\/title>/g, '');
}

// Walk the DOM upward looking for a <path id="XX"> element. Returns the
// 2-letter postal or null. elementFromPoint can return the SVG root or a
// background <rect>; we need the inner path.
function postalAtPoint(x: number, y: number): string | null {
  const el = typeof document !== 'undefined' ? document.elementFromPoint(x, y) : null;
  if (!el) return null;
  let cursor: Element | null = el;
  while (cursor) {
    const id = (cursor as Element).id;
    if (id && /^[A-Z]{2}$/.test(id)) return id;
    cursor = cursor.parentElement;
  }
  return null;
}

// --- Snap forgiveness -------------------------------------------------------
// Family feedback: "it is hard to drop it in the right spot and I know my
// states". The old rule was an EXACT hit-test — the release point had to land
// inside the target path, which is brutal for small states (RI, DE, CT) and
// for touch, where the finger position ≠ where the shape visually sits.
//
// New rule: if the exact test misses, we ring-sample elementFromPoint at two
// radii around the drop point. If any sample lands on the dragged state's own
// path, the drop is a near miss and snaps in. Because the samples probe the
// REAL path geometry, this is distance-to-border matching: it is exactly as
// forgiving for a huge state's edge as for tiny Rhode Island, and a drop that
// is farther than the snap radius from the target's border still fails —
// wrong-state drops don't succeed.
const SNAP_RADIUS_SVG_UNITS = 40; // ~4% of the 959-unit-wide map
const SNAP_RADIUS_MIN_PX = 32;    // finger-sized floor on small phone renders

// Probe 8 points on each of two rings (inner ring = half radius; outer ring
// rotated 22.5° so the 16 samples interleave). Returns which ring first hit
// the target, or null for no hit within the radius.
function snapRingHit(
  x: number,
  y: number,
  target: string,
  radiusPx: number,
): 'inner' | 'outer' | null {
  const rings: Array<{ r: number; tier: 'inner' | 'outer' }> = [
    { r: radiusPx * 0.5, tier: 'inner' },
    { r: radiusPx, tier: 'outer' },
  ];
  for (const { r, tier } of rings) {
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8 + (tier === 'outer' ? Math.PI / 8 : 0);
      if (postalAtPoint(x + Math.cos(a) * r, y + Math.sin(a) * r) === target) {
        return tier;
      }
    }
  }
  return null;
}

type DragState = {
  postal: string;
  // Pixel offset between cursor and tile origin so the clone doesn't snap
  // its top-left to the cursor.
  offsetX: number;
  offsetY: number;
  x: number;
  y: number;
  // Tile pixel dimensions (preserved while dragging so the clone matches).
  width: number;
  height: number;
  // Pointer that initiated the drag — only respond to that pointer's move/up.
  pointerId: number;
};

export default function SilhouetteEngine({
  questionCount,
  region = null,
  onComplete,
}: SilhouetteEngineProps) {
  // Frozen queue of postals for this round.
  const queue = useMemo(() => {
    const pool = region ? ALL_STATES.filter((s) => s.region === region) : ALL_STATES;
    return pickRandom(pool, questionCount);
  }, [questionCount, region]);

  // Postals waiting in the tray (shuffled once per round).
  const [trayPostals, setTrayPostals] = useState<string[]>(() =>
    pickRandom(queue.map((s) => s.postal), queue.length),
  );

  // Postals already placed correctly — these fill in on the map.
  const [placed, setPlaced] = useState<Set<string>>(() => new Set());
  const [score, setScore] = useState(0);
  // Postals that have ever been wrong-dropped — used to deny first-attempt
  // bonus on retry (still counted as "in the round" though). Tracks tried-once
  // misses for the round summary.
  const wrongOnceRef = useRef<Set<string>>(new Set());

  const [drag, setDrag] = useState<DragState | null>(null);
  const [shakingPostal, setShakingPostal] = useState<string | null>(null);
  // Feedback banner: 'right' / 'wrong' / null
  const [feedback, setFeedback] = useState<{ kind: 'right' | 'wrong'; text: string } | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Political SVG markup loaded once on mount.
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);
  const mapGroupRef = useRef<SVGGElement | null>(null);
  // Map <svg> element — needed to convert the SNAP radius from map units to
  // screen pixels at the current rendered scale.
  const mapSvgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(SVG_URL)
      .then((r) => r.text())
      .then((raw) => {
        if (!cancelled) setSvgMarkup(extractInnerSvg(raw));
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('SilhouetteEngine: failed to load political SVG', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Whenever placed/svgMarkup changes, repaint every state path:
  //   - dimmed-gray outline if not yet placed
  //   - region tint if placed
  //   - hide the original <title> hovers via pointer-events tweak
  useEffect(() => {
    const root = mapGroupRef.current;
    if (!root || !svgMarkup) return;
    const validPostals = new Set(ALL_STATES.map((s) => s.postal));
    const els = root.querySelectorAll<SVGGraphicsElement>('[id]');
    els.forEach((el) => {
      const postal = el.id?.toUpperCase();
      if (!postal || !validPostals.has(postal)) return;
      const isPlaced = placed.has(postal);
      const tint = ALL_STATES.find((s) => s.postal === postal)?.region;
      const placedFill = (tint && REGION_TINTS[tint]) || '#bbf7d0';
      el.setAttribute('fill', isPlaced ? placedFill : '#f3f4f6');
      el.setAttribute('stroke', '#9ca3af');
      el.setAttribute('stroke-width', '0.6');
      // Map paths should not steal pointer events from the tray clone, but we
      // DO need them to register for elementFromPoint hit-tests. pointer-events:
      // visible keeps them in the hit tree but the tray clone (with pointer-
      // events: none while dragging) won't block them.
      (el as SVGElement).style.pointerEvents = 'visiblePainted';
      // Subtle highlight when this slot is the drag target — outline tinges green.
      if (drag && drag.postal === postal && !isPlaced) {
        el.setAttribute('stroke', '#10b981');
        el.setAttribute('stroke-width', '1.8');
      }
    });
  }, [svgMarkup, placed, drag]);

  // Global pointermove/up listeners while a drag is active. Bound at window
  // level so a drop that lands outside the map still gets a release event.
  useEffect(() => {
    if (!drag) return;
    const handleMove = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return;
      setDrag((prev) =>
        prev
          ? {
              ...prev,
              x: e.clientX - prev.offsetX,
              y: e.clientY - prev.offsetY,
            }
          : prev,
      );
    };
    const handleUp = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return;
      const cx = e.clientX;
      const cy = e.clientY;
      const draggedPostal = drag.postal;
      // The VISUAL center of the dragged shape — on touch, the finger is
      // wherever the kid grabbed the tile (often a corner), but what they
      // aim with is the shape itself. Hit-test the shape center first, the
      // raw pointer second.
      const shapeX = drag.x + drag.width / 2;
      const shapeY = drag.y + drag.height / 2;
      // Hide our clone from the hit-test so elementFromPoint sees the map.
      const cloneEl = document.getElementById('silhouette-drag-clone');
      const prevPe = cloneEl?.style.pointerEvents;
      if (cloneEl) cloneEl.style.pointerEvents = 'none';

      const hitAtShape = postalAtPoint(shapeX, shapeY);
      const hitAtPointer = postalAtPoint(cx, cy);
      let isCorrect = hitAtShape === draggedPostal || hitAtPointer === draggedPostal;

      // Near-miss snap: exact test failed, so probe rings around both drop
      // points for the target's border (see snapRingHit above). Radius scales
      // with the rendered map (40 map-units) with a finger-sized px floor.
      if (!isCorrect) {
        let snapRadius = SNAP_RADIUS_MIN_PX;
        const svgEl = mapSvgRef.current;
        if (svgEl) {
          const rect = svgEl.getBoundingClientRect();
          const scale = Math.min(rect.width / VIEW_W, rect.height / VIEW_H);
          if (scale && Number.isFinite(scale)) {
            snapRadius = Math.max(SNAP_RADIUS_MIN_PX, SNAP_RADIUS_SVG_UNITS * scale);
          }
        }
        const tier =
          snapRingHit(shapeX, shapeY, draggedPostal, snapRadius) ??
          snapRingHit(cx, cy, draggedPostal, snapRadius);
        if (tier) {
          // Guard: if the drop point sits INSIDE a different state that is
          // still waiting in the tray (i.e. someone else's slot this round),
          // only the tight inner ring may snap. Keeps a decisive drop onto
          // the wrong tray-state counting as wrong, while staying forgiving
          // near borders and over already-placed / out-of-round states.
          const blocker =
            hitAtShape !== null &&
            hitAtShape !== draggedPostal &&
            trayPostals.includes(hitAtShape);
          isCorrect = tier === 'inner' || !blocker;
        }
      }

      // For the "That spot is X" message, prefer what's under the shape.
      const hitPostal = hitAtShape ?? hitAtPointer;

      if (cloneEl && prevPe !== undefined) cloneEl.style.pointerEvents = prevPe;

      if (isCorrect) {
        // Correct.
        setPlaced((prev) => {
          const next = new Set(prev);
          next.add(draggedPostal);
          return next;
        });
        setTrayPostals((prev) => prev.filter((p) => p !== draggedPostal));
        if (!wrongOnceRef.current.has(draggedPostal)) {
          setScore((s) => s + 1);
        }
        const name = ALL_STATES.find((s) => s.postal === draggedPostal)?.name ?? draggedPostal;
        setFeedback({ kind: 'right', text: `${name} — got it!` });
      } else {
        // Wrong (or dropped off-map). Mark as missed-on-first-try and shake.
        wrongOnceRef.current.add(draggedPostal);
        setShakingPostal(draggedPostal);
        setTimeout(() => setShakingPostal((p) => (p === draggedPostal ? null : p)), 500);
        const wrongName = hitPostal
          ? ALL_STATES.find((s) => s.postal === hitPostal)?.name
          : null;
        const draggedName =
          ALL_STATES.find((s) => s.postal === draggedPostal)?.name ?? draggedPostal;
        setFeedback({
          kind: 'wrong',
          text: wrongName
            ? `That spot is ${wrongName} — try again for ${draggedName}`
            : `Not quite — try again for ${draggedName}`,
        });
      }

      // Clear feedback banner after a moment so it doesn't pile up.
      if (feedbackTimerRef.current !== null) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => setFeedback(null), 1500);

      setDrag(null);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
    // trayPostals is read by the snap guard (blocker check) inside handleUp.
  }, [drag, trayPostals]);

  // Round-complete detection — tray empty ⇒ fire onComplete with the score.
  useEffect(() => {
    if (queue.length === 0) return;
    if (trayPostals.length === 0) {
      const total = queue.length;
      const misses = Array.from(wrongOnceRef.current);
      // Defer so the final placement animation has a beat to land before the
      // results card slides over.
      const t = setTimeout(() => {
        onComplete({ score, total, misses });
      }, 600);
      return () => clearTimeout(t);
    }
  }, [trayPostals.length, queue.length, score, onComplete]);

  // Clean up any pending feedback timer on unmount.
  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current !== null) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  // Pointer-down handler for tray tiles.
  const handleTilePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, postal: string) => {
      // Only respond to primary button / single touch.
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const target = e.currentTarget;
      const rect = target.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      // Capture the pointer so subsequent moves come to us even if the cursor
      // leaves this tile (pointer events spec).
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        // Some old browsers may throw — non-fatal.
      }
      setDrag({
        postal,
        offsetX,
        offsetY,
        x: e.clientX - offsetX,
        y: e.clientY - offsetY,
        width: rect.width,
        height: rect.height,
        pointerId: e.pointerId,
      });
      e.preventDefault();
    },
    [],
  );

  const draggedEntry = drag ? SILHOUETTES[drag.postal] : null;

  return (
    <div className="h-full w-full flex flex-col">
      <style>{`
        @keyframes silhouette-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-3px); }
          40% { transform: translateX(3px); }
          60% { transform: translateX(-2px); }
          80% { transform: translateX(2px); }
        }
        .silhouette-shake { animation: silhouette-shake 0.45s ease-in-out 1; }
        .silhouette-tile {
          touch-action: none;
          user-select: none;
          -webkit-user-select: none;
        }
      `}</style>

      {/* Top prompt strip */}
      <div className="shrink-0 bg-white/85 backdrop-blur-sm border-b border-emerald-200 px-3 sm:px-4 py-2 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wide text-emerald-700 font-bold">
            Silhouette Puzzle
          </div>
          <div className="text-sm sm:text-base font-semibold text-gray-800 truncate">
            {feedback?.text ?? 'Place the states. Drag each shape into its spot.'}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[10px] uppercase tracking-wide text-gray-500 font-bold">
            Placed
          </div>
          <div className="text-lg font-black text-emerald-800">
            {placed.size}
            <span className="text-sm text-gray-500"> / {queue.length}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[10px] uppercase tracking-wide text-gray-500 font-bold">
            Score
          </div>
          <div className="text-lg font-black text-teal-800">{score}</div>
        </div>
      </div>

      {/* Feedback band — color tinted */}
      {feedback && (
        <div
          className={`shrink-0 px-3 py-1 text-xs font-bold text-center ${
            feedback.kind === 'right'
              ? 'bg-emerald-100 text-emerald-900'
              : 'bg-rose-100 text-rose-900'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Map + tray layout. flex-col on small screens (tray underneath),
          flex-row on large (tray to the right). */}
      <div className="flex-1 min-h-0 w-full flex flex-col lg:flex-row gap-2 p-2">
        {/* MAP */}
        <div className="flex-1 min-h-0 min-w-0 flex items-center justify-center bg-sky-50/40 rounded-xl border border-sky-100 overflow-hidden">
          <svg
            ref={mapSvgRef}
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="xMidYMid meet"
            className="block w-full h-full max-w-full max-h-full"
            role="img"
            aria-label="Map of the United States — drop the silhouettes onto their spots"
          >
            {svgMarkup && (
              <g
                ref={mapGroupRef}
                dangerouslySetInnerHTML={{ __html: svgMarkup }}
              />
            )}
          </svg>
        </div>

        {/* TRAY */}
        <div className="shrink-0 lg:w-64 lg:max-w-[18rem] bg-white/85 rounded-xl border border-emerald-100 p-2 overflow-auto max-h-44 lg:max-h-full">
          <div className="text-[10px] uppercase tracking-wide text-gray-500 font-bold mb-1 px-1">
            Shapes ({trayPostals.length})
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-3 gap-2">
            {trayPostals.map((postal) => {
              const entry = SILHOUETTES[postal];
              if (!entry) return null;
              const [bx, by, bw, bh] = entry.bbox;
              const isDragging = drag?.postal === postal;
              const isShaking = shakingPostal === postal;
              const name = ALL_STATES.find((s) => s.postal === postal)?.name ?? postal;
              return (
                <div
                  key={postal}
                  onPointerDown={(e) => handleTilePointerDown(e, postal)}
                  className={`silhouette-tile relative aspect-[4/3] bg-emerald-50 hover:bg-emerald-100 rounded-md border border-emerald-200 cursor-grab active:cursor-grabbing flex items-center justify-center p-1 ${
                    isShaking ? 'silhouette-shake' : ''
                  } ${isDragging ? 'opacity-30' : ''}`}
                  aria-label={`Drag ${name}`}
                  role="button"
                  title={name}
                >
                  <svg
                    viewBox={`${bx} ${by} ${bw} ${bh}`}
                    preserveAspectRatio="xMidYMid meet"
                    className="block w-full h-full pointer-events-none"
                  >
                    <path d={entry.d} fill="#4b5563" stroke="#1f2937" strokeWidth="0.4" />
                  </svg>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Floating drag clone — portal-ish: positioned fixed in the viewport.
          pointer-events: none so the underlying map gets elementFromPoint. */}
      {drag && draggedEntry && (
        <div
          id="silhouette-drag-clone"
          style={{
            position: 'fixed',
            left: drag.x,
            top: drag.y,
            width: drag.width,
            height: drag.height,
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        >
          <svg
            viewBox={`${draggedEntry.bbox[0]} ${draggedEntry.bbox[1]} ${draggedEntry.bbox[2]} ${draggedEntry.bbox[3]}`}
            preserveAspectRatio="xMidYMid meet"
            className="block w-full h-full"
          >
            <path
              d={draggedEntry.d}
              fill="#0d9488"
              fillOpacity={0.85}
              stroke="#0f766e"
              strokeWidth="0.6"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
