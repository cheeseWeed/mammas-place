// Phase W1 — World Study Map.
//
// Renders the WorldMap with continent colors on by default. Hover/tap a
// country to see a floating CountryTooltip. Click a country to open the
// CountryDetailDrawer (rich facts, flag, landmarks).
//
// Layout: full-viewport, mirroring the US Study page. Top bar reserves
// ~56px; remaining height is for the map.
//
// All hover/click handlers fire ISO-3 codes (the WorldMap contract). The
// drawer needs ISO-2, so we look up the country record by ISO-3 first and
// pass its iso2 along.
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  WorldMap,
  CountryTooltip,
  CountryDetailDrawer,
  CountryZoomView,
  defaultContinentTints,
} from '@/components/geography';
import countriesData from '@/data/countries.json';
import { updatePhase } from '@/lib/geography/progress';

type CountryRecord = {
  iso2: string;
  iso3: string;
  name: string;
  capital: string;
  continent: string;
  population?: number;
  areaSqKm?: number;
};

// Tooltip reveal timings (ms from hover start).
const STAGE1_DELAY = 1500;  // basic: name + capital
const STAGE2_DELAY = 3000;  // bonus: continent + population

export default function WorldStudyPage() {
  const [showContinentColors, setShowContinentColors] = useState(true);
  const [showCountryNames, setShowCountryNames] = useState(false);
  const [showLandmarks, setShowLandmarks] = useState(false);
  const [showPhysical, setShowPhysical] = useState(false);

  // Tooltip state: which country iso3 is hovered + cursor position.
  // tooltipStage controls what's rendered: 0 = nothing, 1 = basic, 2 = with bonus.
  const [hoveredIso3, setHoveredIso3] = useState<string | null>(null);
  const [tooltipStage, setTooltipStage] = useState<0 | 1 | 2>(0);
  const [cursor, setCursor] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Drawer state: which country iso2 is open (null = closed).
  const [drawerIso2, setDrawerIso2] = useState<string | null>(null);

  // Zoom view (full-screen close-up): which country iso2 is currently open
  // in the zoom modal (null = closed). Triggered by the drawer's "View Up
  // Close" button.
  const [zoomIso2, setZoomIso2] = useState<string | null>(null);

  const countries = countriesData as CountryRecord[];

  // Lookups: iso3 -> record (for tooltip + click-to-open routing).
  const byIso3 = useMemo(() => {
    const m = new Map<string, CountryRecord>();
    countries.forEach((c) => m.set(c.iso3, c));
    return m;
  }, [countries]);

  // Continent-tint map keyed by ISO-3. defaultContinentTints() ships with the
  // WorldMap module — uses the same continent assignments as worldCountryData.
  // Toggle controls whether we pass it to the map at all.
  const continentTintMap = useMemo(
    () => (showContinentColors ? defaultContinentTints() : undefined),
    [showContinentColors],
  );

  // Track mouse position for the tooltip anchor.
  useEffect(() => {
    const handler = (e: MouseEvent) => setCursor({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  // Staged tooltip reveal — same pattern as the US study page.
  useEffect(() => {
    setTooltipStage(0);
    if (!hoveredIso3) return;
    const t1 = setTimeout(() => setTooltipStage(1), STAGE1_DELAY);
    const t2 = setTimeout(() => setTooltipStage(2), STAGE2_DELAY);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [hoveredIso3]);

  // Mark phase visited on mount. Smoke-test that the progress wrapper works
  // for the world slots we just added.
  useEffect(() => {
    updatePhase('world-study', { lastVisited: Date.now() });
  }, []);

  const hoveredCountry = hoveredIso3 ? byIso3.get(hoveredIso3) ?? null : null;

  // Click handler: map fires iso3 → look up iso2 → open drawer.
  function handleCountryClick(iso3: string) {
    const rec = byIso3.get(iso3);
    if (!rec) return;
    setDrawerIso2(rec.iso2);
  }

  return (
    <div className="w-full h-[calc(100vh-142px)] max-sm:h-[calc(100vh-218px)] flex flex-col bg-gradient-to-b from-sky-50 via-indigo-50 to-white">
      {/* Compact top bar */}
      <div className="shrink-0 bg-white/70 backdrop-blur-sm border-b border-sky-100 px-2 sm:px-4 py-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link
            href="/geography"
            className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-sky-700 hover:text-sky-500 transition-colors"
          >
            ← Geography
          </Link>
          <h2 className="text-base sm:text-lg font-black text-sky-900">World Map</h2>

          {/* Inline toggles */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 ml-auto">
            <label className="flex items-center gap-1.5 cursor-pointer text-xs sm:text-sm font-medium text-gray-800 hover:text-sky-700 transition-colors">
              <input
                type="checkbox"
                checked={showContinentColors}
                onChange={(e) => setShowContinentColors(e.target.checked)}
                className="w-4 h-4 accent-sky-600 cursor-pointer"
              />
              Continent colors
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-xs sm:text-sm font-medium text-gray-800 hover:text-sky-700 transition-colors">
              <input
                type="checkbox"
                checked={showCountryNames}
                onChange={(e) => setShowCountryNames(e.target.checked)}
                className="w-4 h-4 accent-sky-600 cursor-pointer"
              />
              Country names
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-xs sm:text-sm font-medium text-gray-800 hover:text-sky-700 transition-colors">
              <input
                type="checkbox"
                checked={showLandmarks}
                onChange={(e) => setShowLandmarks(e.target.checked)}
                className="w-4 h-4 accent-sky-600 cursor-pointer"
              />
              Landmark pins
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-xs sm:text-sm font-medium text-gray-800 hover:text-sky-700 transition-colors">
              <input
                type="checkbox"
                checked={showPhysical}
                onChange={(e) => setShowPhysical(e.target.checked)}
                className="w-4 h-4 accent-sky-600 cursor-pointer"
              />
              Physical features
            </label>

            {/* Echo of the currently-hovered country — touch-device fallback. */}
            {hoveredCountry && (
              <span className="text-xs sm:text-sm font-semibold text-sky-800">
                {hoveredCountry.name}
                {hoveredCountry.capital && (
                  <> — <span className="text-gray-700 font-medium">{hoveredCountry.capital}</span></>
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Map area — fills remaining viewport. */}
      <div className="flex-1 min-h-0 w-full px-1 sm:px-2 py-1">
        <WorldMap
          continentTints={continentTintMap}
          showCountryLabels={showCountryNames}
          onCountryHover={setHoveredIso3}
          onCountryClick={handleCountryClick}
          showLandmarks={showLandmarks}
          onLandmarkClick={(iso2) => setDrawerIso2(iso2)}
          showPhysicalLayer={showPhysical}
        />
      </div>

      {/* Staged floating tooltip. */}
      {hoveredCountry && tooltipStage >= 1 && (
        <CountryTooltip
          name={hoveredCountry.name}
          capital={hoveredCountry.capital}
          x={cursor.x}
          y={cursor.y}
          extra={
            tooltipStage >= 2
              ? {
                  continent: hoveredCountry.continent,
                  population: hoveredCountry.population,
                  area: hoveredCountry.areaSqKm,
                }
              : undefined
          }
        />
      )}

      {/* Deep-dive drawer. The "View Up Close" button on the drawer fires
          onViewUpClose, which closes the drawer and opens the full-screen
          zoom view modal instead. */}
      <CountryDetailDrawer
        iso2={drawerIso2}
        onClose={() => setDrawerIso2(null)}
        onViewUpClose={(iso2) => {
          setDrawerIso2(null);
          setZoomIso2(iso2);
        }}
      />

      {/* Full-screen close-up modal. Self-contained close: backdrop, ESC, X. */}
      <CountryZoomView iso2={zoomIso2} onClose={() => setZoomIso2(null)} />
    </div>
  );
}
