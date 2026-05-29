// Phase 1 — Study Map.
//
// Renders the USMap with all labels on by default. A compact top bar holds the
// back link, page title, and label toggle checkboxes inline. Hover/tap a state
// to see its name and capital in a floating tooltip (StateTooltip follows the
// cursor).
//
// Layout: full-viewport. Map dominates the screen — top bar reserves ~56px,
// site header reserves ~104-128px (set in app/layout.tsx via main padding),
// remaining height is for the map. No centered narrow column.
//
// Progress wrapper is touched on mount (lastVisited timestamp) — this is
// mostly a smoke-test that the progress module works end-to-end so Phase 2+
// authors can trust it.
//
// TODO (Phase 1.5 author): wire a "Show physical features" toggle here once
// public/geography/us-states-physical.svg ships. The toggle should pass its
// value into <USMap> via `showPhysicalLayer`. (USMap already accepts the
// prop and will currently log a warn until the asset exists.) Leave the
// toggle hidden until then.
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { USMap, StateTooltip } from '@/components/geography';
import statesData from '@/data/states.json';
import { updatePhase } from '@/lib/geography/progress';

type StateRecord = { postal: string; name: string; capital: string };

export default function GeographyStudyPage() {
  const [showStateNames, setShowStateNames] = useState(true);
  const [showCapitalStars, setShowCapitalStars] = useState(true);
  const [showCapitalNames, setShowCapitalNames] = useState(true);

  // Tooltip state: which state postal is hovered + cursor position to anchor.
  const [hoveredPostal, setHoveredPostal] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Static state lookup by postal for tooltip name/capital fields.
  const states = statesData as StateRecord[];
  const stateByPostal = useMemo(() => {
    const m = new Map<string, StateRecord>();
    states.forEach((s) => m.set(s.postal, s));
    return m;
  }, [states]);

  // USMap accepts *sets* of postals to hide, not booleans. To express the
  // "hide all" form of the toggles, we feed in the full postal set when the
  // checkbox is off; empty set when on. (LabelLayer/CapitalLayer treat
  // undefined/empty as "show everything".)
  const allPostals = useMemo(() => new Set(states.map((s) => s.postal)), [states]);
  const hiddenStateLabels = showStateNames ? undefined : allPostals;
  const hiddenCapitalNames = showCapitalNames ? undefined : allPostals;

  // Track mouse position for tooltip anchor. Window-level so it works
  // regardless of which child element the cursor is over inside the map SVG.
  useEffect(() => {
    const handler = (e: MouseEvent) => setCursor({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  // Mark phase visited on mount. Tiny — this proves the progress wrapper works
  // for future phases. No-op on the server (handled inside progress.ts).
  useEffect(() => {
    updatePhase('study', { lastVisited: Date.now() });
  }, []);

  const hoveredState = hoveredPostal ? stateByPostal.get(hoveredPostal) : null;

  return (
    // Full viewport minus the global site header (104 desktop / 128 mobile,
    // already padded in app/layout.tsx via <main>). Flex column so the map
    // fills whatever's left after the compact top bar.
    <div className="w-full h-[calc(100vh-142px)] max-sm:h-[calc(100vh-218px)] flex flex-col bg-gradient-to-b from-emerald-50 via-sky-50 to-white">
      {/* Compact top bar: back link + title + toggle checkboxes on one row.
          Wraps on narrow viewports. Kept under ~80px tall. */}
      <div className="shrink-0 bg-white/70 backdrop-blur-sm border-b border-emerald-100 px-2 sm:px-4 py-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link
            href="/geography"
            className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-emerald-700 hover:text-emerald-500 transition-colors"
          >
            ← Geography
          </Link>
          <h2 className="text-base sm:text-lg font-black text-emerald-900">Study Map</h2>

          {/* Inline toggles */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 ml-auto">
            <label className="flex items-center gap-1.5 cursor-pointer text-xs sm:text-sm font-medium text-gray-800 hover:text-emerald-700 transition-colors">
              <input
                type="checkbox"
                checked={showStateNames}
                onChange={(e) => setShowStateNames(e.target.checked)}
                className="w-4 h-4 accent-emerald-600 cursor-pointer"
              />
              State names
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-xs sm:text-sm font-medium text-gray-800 hover:text-emerald-700 transition-colors">
              <input
                type="checkbox"
                checked={showCapitalStars}
                onChange={(e) => setShowCapitalStars(e.target.checked)}
                className="w-4 h-4 accent-emerald-600 cursor-pointer"
              />
              Capital stars
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-xs sm:text-sm font-medium text-gray-800 hover:text-emerald-700 transition-colors">
              <input
                type="checkbox"
                checked={showCapitalNames}
                onChange={(e) => setShowCapitalNames(e.target.checked)}
                className="w-4 h-4 accent-emerald-600 cursor-pointer"
              />
              Capital names
            </label>

            {/* TODO Phase 1.5: add a "Physical features" toggle here once
                public/geography/us-states-physical.svg exists. Pass the value
                into <USMap> via the existing `showPhysicalLayer` prop. */}

            {/* Echo of the currently-hovered state — helps touch devices where
                the floating tooltip may not fire. */}
            {hoveredState && (
              <span className="text-xs sm:text-sm font-semibold text-emerald-800">
                {hoveredState.name} — <span className="text-gray-700 font-medium">{hoveredState.capital}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Map area — fills remaining viewport. SVG's preserveAspectRatio handles
          the 959:593 ratio internally, so we just give the container 100% of
          available space and the map scales to the larger of width/height. */}
      <div className="flex-1 min-h-0 w-full px-1 sm:px-2 py-1">
        <USMap
          hiddenStateLabels={hiddenStateLabels}
          hiddenCapitalNames={hiddenCapitalNames}
          showCapitalStars={showCapitalStars}
          onStateHover={setHoveredPostal}
        />
      </div>

      {/* Floating tooltip — follows the cursor while a state is hovered. */}
      {hoveredState && (
        <StateTooltip
          name={hoveredState.name}
          capital={hoveredState.capital}
          x={cursor.x}
          y={cursor.y}
        />
      )}
    </div>
  );
}
