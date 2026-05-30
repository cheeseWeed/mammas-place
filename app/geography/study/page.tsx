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
import { USMap, StateTooltip, StateDetailDrawer, StateZoomView } from '@/components/geography';
import { REGION_TINTS } from '@/components/geography/USMap';
import statesData from '@/data/states.json';
import { updatePhase } from '@/lib/geography/progress';

type StateRecord = {
  postal: string;
  name: string;
  capital: string;
  nickname?: string;
  region?: string;
  population?: number;
};

// Tooltip reveal timings (ms from hover start).
const STAGE1_DELAY = 1500;  // basic: name + capital
const STAGE2_DELAY = 3000;  // bonus: nickname + region + population

export default function GeographyStudyPage() {
  const [showStateNames, setShowStateNames] = useState(true);
  const [showCapitalStars, setShowCapitalStars] = useState(true);
  const [showCapitalNames, setShowCapitalNames] = useState(true);
  const [showRegionColors, setShowRegionColors] = useState(true);
  const [showLandmarks, setShowLandmarks] = useState(false);
  const [showPhysical, setShowPhysical] = useState(false);

  // Tooltip state: which state postal is hovered + cursor position to anchor.
  // tooltipStage controls what's rendered: 0 = nothing, 1 = basic, 2 = with bonus.
  const [hoveredPostal, setHoveredPostal] = useState<string | null>(null);
  const [tooltipStage, setTooltipStage] = useState<0 | 1 | 2>(0);
  const [cursor, setCursor] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Deep-dive drawer: which state postal is currently open (null = closed).
  // Click on a state opens the drawer; hover continues to drive the tooltip.
  const [drawerPostal, setDrawerPostal] = useState<string | null>(null);

  // Zoom view (full-screen close-up): which state postal is currently open
  // in the zoom modal (null = closed). Triggered by the drawer's "View Up
  // Close" button, which fires onViewUpClose with the postal here.
  const [zoomPostal, setZoomPostal] = useState<string | null>(null);

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

  // Build per-state region-color map. Each state gets its region's tint color.
  // Toggle controls whether USMap actually paints them.
  const regionTints = useMemo(() => {
    if (!showRegionColors) return undefined;
    const m = new Map<string, string>();
    states.forEach((s) => {
      if (s.region && REGION_TINTS[s.region]) {
        m.set(s.postal, REGION_TINTS[s.region]);
      }
    });
    return m;
  }, [states, showRegionColors]);

  // Track mouse position for tooltip anchor. Window-level so it works
  // regardless of which child element the cursor is over inside the map SVG.
  useEffect(() => {
    const handler = (e: MouseEvent) => setCursor({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  // Staged tooltip reveal. Whenever hoveredPostal changes, reset to stage 0
  // and schedule stage 1 at 1.5s, stage 2 at 3.0s. Leaving a state cancels
  // both timers and snaps back to nothing.
  useEffect(() => {
    setTooltipStage(0);
    if (!hoveredPostal) return;
    const t1 = setTimeout(() => setTooltipStage(1), STAGE1_DELAY);
    const t2 = setTimeout(() => setTooltipStage(2), STAGE2_DELAY);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [hoveredPostal]);

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
            <label className="flex items-center gap-1.5 cursor-pointer text-xs sm:text-sm font-medium text-gray-800 hover:text-emerald-700 transition-colors">
              <input
                type="checkbox"
                checked={showRegionColors}
                onChange={(e) => setShowRegionColors(e.target.checked)}
                className="w-4 h-4 accent-emerald-600 cursor-pointer"
              />
              Region colors
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-xs sm:text-sm font-medium text-gray-800 hover:text-emerald-700 transition-colors">
              <input
                type="checkbox"
                checked={showLandmarks}
                onChange={(e) => setShowLandmarks(e.target.checked)}
                className="w-4 h-4 accent-emerald-600 cursor-pointer"
              />
              Landmarks
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-xs sm:text-sm font-medium text-gray-800 hover:text-emerald-700 transition-colors">
              <input
                type="checkbox"
                checked={showPhysical}
                onChange={(e) => setShowPhysical(e.target.checked)}
                className="w-4 h-4 accent-emerald-600 cursor-pointer"
              />
              Physical features
            </label>

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
          showLandmarks={showLandmarks}
          showPhysicalLayer={showPhysical}
          regionTints={regionTints}
          onStateHover={setHoveredPostal}
          onStateClick={setDrawerPostal}
          onLandmarkClick={(postal) => setDrawerPostal(postal)}
        />
      </div>

      {/* Staged floating tooltip — only renders after the appropriate delay.
          Stage 1 (1.5s): name + capital. Stage 2 (3.0s): adds nickname,
          region, and population on additional lines below. */}
      {hoveredState && tooltipStage >= 1 && (
        <StateTooltip
          name={hoveredState.name}
          capital={hoveredState.capital}
          x={cursor.x}
          y={cursor.y}
          extra={
            tooltipStage >= 2
              ? {
                  nickname: hoveredState.nickname,
                  region: hoveredState.region,
                  population: hoveredState.population,
                }
              : undefined
          }
        />
      )}

      {/* Deep-dive drawer — opens when a state is clicked. Drawer owns its own
          dismiss (escape key, backdrop click, close button) and calls onClose
          back to clear the postal here. The "View Up Close" button on the
          drawer fires onViewUpClose, which closes the drawer and opens the
          full-screen zoom view modal instead. */}
      <StateDetailDrawer
        postal={drawerPostal}
        onClose={() => setDrawerPostal(null)}
        onViewUpClose={(postal) => {
          setDrawerPostal(null);
          setZoomPostal(postal);
        }}
      />

      {/* Full-screen close-up modal — opens from the drawer's "View Up Close"
          button. Self-contained: backdrop click, ESC, and close button all
          call onClose. */}
      <StateZoomView postal={zoomPostal} onClose={() => setZoomPostal(null)} />
    </div>
  );
}
