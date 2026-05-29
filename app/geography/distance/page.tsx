// Phase 6.5 — Distance Measure.
//
// Two modes:
//   A. Capital → Capital — click two stars (state postals). Distance is exact
//      because we use the lat/lon already in states.json. No projection
//      inversion involved, so this mode is bulletproof for kid use.
//   B. Click Anywhere — click two arbitrary SVG points. We inverse-project
//      via geoAlbersUsa (matching the visible layers' configuration + the
//      -3/-5 paint offset correction) to get lat/lon, then haversine.
//
// Sub-mode:
//   "Guess the distance" — after 2 points, hide the calculated distance and
//   prompt the kid for a number. After submit, reveal both the answer and
//   how close their guess was ("Off by 84 miles!" / "Perfect!").
//
// Progress tracking: counts how many measurements have been taken + the
// best guess accuracy (lowest absolute miles-off) achieved on the device.
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { USMap, DistanceTool } from '@/components/geography';
import statesData from '@/data/states.json';
import { haversineMiles, svgPointToLatLon, formatMiles } from '@/lib/geography/distance';
import { readPhase, updatePhase } from '@/lib/geography/progress';

type StateRecord = {
  postal: string;
  name: string;
  capital: string;
  capitalLatLon: number[];
  centroidLatLon: number[];
};

type Mode = 'capitals' | 'anywhere';

// One clicked point. Carries both SVG coords (for rendering) and lat/lon
// (for distance math). In capital mode, label is the state name + capital;
// in anywhere mode it's blank (we don't reverse-geocode for kids).
type ClickedPoint = {
  svgX: number;
  svgY: number;
  lat: number;
  lon: number;
  label?: string;
};

const STATES = statesData as StateRecord[];
// Postal → state record map for capital-mode lookups.
const STATE_BY_POSTAL = new Map<string, StateRecord>();
STATES.forEach((s) => STATE_BY_POSTAL.set(s.postal, s));

// d3-geo's projection matching CapitalLayer's settings — used here only to
// place markers at capital stars in mode A (so the marker lands exactly on
// the painted star, not just somewhere near the true coordinates).
// We need to also apply the -3/-5 paint offset that CapitalLayer uses.
import { geoAlbersUsa } from 'd3-geo';
const VIEW_W = 959;
const VIEW_H = 593;
const projection = geoAlbersUsa().scale(1280).translate([VIEW_W / 2, VIEW_H / 2]);
const PAINT_OFFSET_X = -3;
const PAINT_OFFSET_Y = -5;

// Project a capital's [lat, lon] into the same SVG space the painted star
// sits at. Returns null if d3 can't project (shouldn't happen for any US
// capital, but keeps types honest).
function projectCapital(lat: number, lon: number): { x: number; y: number } | null {
  const p = projection([lon, lat]);
  if (!p) return null;
  return { x: p[0] + PAINT_OFFSET_X, y: p[1] + PAINT_OFFSET_Y };
}

export default function DistancePage() {
  const [mode, setMode] = useState<Mode>('capitals');
  const [guessMode, setGuessMode] = useState(false);
  const [points, setPoints] = useState<ClickedPoint[]>([]);
  const [guessInput, setGuessInput] = useState('');
  const [guessSubmitted, setGuessSubmitted] = useState(false);
  // Brief flash on point #1 so the kid knows the click registered.
  const [statusFlash, setStatusFlash] = useState<string | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const miles = useMemo(() => {
    if (points.length !== 2) return null;
    return haversineMiles(points[0].lat, points[0].lon, points[1].lat, points[1].lon);
  }, [points]);

  // Reset clicks when switching modes or toggling guess sub-mode.
  useEffect(() => {
    setPoints([]);
    setGuessInput('');
    setGuessSubmitted(false);
  }, [mode, guessMode]);

  // Once a full measurement is taken (and, in guess mode, revealed), bump
  // progress. Tracks total measurements + best guess accuracy.
  useEffect(() => {
    if (points.length !== 2 || miles === null) return;
    if (guessMode && !guessSubmitted) return;
    const prev = readPhase('distance') ?? { measurements: 0 };
    const next: { measurements: number; bestGuessAccuracy?: number } = {
      ...prev,
      measurements: (prev.measurements ?? 0) + 1,
    };
    if (guessMode && guessSubmitted) {
      const guess = Number(guessInput);
      if (Number.isFinite(guess)) {
        const off = Math.round(Math.abs(guess - miles));
        // bestGuessAccuracy = lowest off-by ever achieved (lower = better).
        if (prev.bestGuessAccuracy === undefined || off < prev.bestGuessAccuracy) {
          next.bestGuessAccuracy = off;
        }
      }
    }
    updatePhase('distance', next);
    // Intentionally do NOT depend on `prev` — we only want to bump on the
    // transition into a full reveal, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.length, miles, guessSubmitted]);

  function flashStatus(text: string) {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setStatusFlash(text);
    flashTimerRef.current = setTimeout(() => setStatusFlash(null), 1500);
  }

  // Add a point (or reset to a fresh first point if we already have two).
  function pushPoint(p: ClickedPoint) {
    setPoints((prev) => {
      if (prev.length >= 2) return [p];
      return [...prev, p];
    });
    setGuessInput('');
    setGuessSubmitted(false);
    flashStatus(p.label ? `Point: ${p.label}` : 'Point set');
  }

  // Mode A handler — fires when a state SVG element is clicked. We pull the
  // capital coords from states.json and project them so the marker lands
  // on the star, not on the click cursor.
  function handleStateClick(postal: string) {
    if (mode !== 'capitals') return;
    const rec = STATE_BY_POSTAL.get(postal);
    if (!rec) return;
    // Avoid double-clicking the same state as both A and B.
    if (points.length === 1 && points[0].label?.startsWith(rec.name)) {
      flashStatus('Pick a different state!');
      return;
    }
    const [lat, lon] = rec.capitalLatLon;
    const proj = projectCapital(lat, lon);
    if (!proj) return;
    pushPoint({
      svgX: proj.x,
      svgY: proj.y,
      lat,
      lon,
      label: `${rec.name} (${rec.capital})`,
    });
  }

  // Mode B handler — fires on any click in the SVG. Inverse-project to
  // lat/lon. Reject clicks that fall outside d3-geo's US bounds.
  function handleMapPointerClick(svgX: number, svgY: number) {
    if (mode !== 'anywhere') return;
    const ll = svgPointToLatLon(svgX, svgY);
    if (!ll) {
      flashStatus('Click on the map!');
      return;
    }
    pushPoint({ svgX, svgY, lat: ll[0], lon: ll[1] });
  }

  function handleClear() {
    setPoints([]);
    setGuessInput('');
    setGuessSubmitted(false);
    flashStatus('Cleared');
  }

  function handleSubmitGuess(e: React.FormEvent) {
    e.preventDefault();
    if (miles === null) return;
    const guess = Number(guessInput);
    if (!Number.isFinite(guess) || guess < 0) return;
    setGuessSubmitted(true);
  }

  // Build label override for guess reveal: "1,247 mi" with subtext.
  let labelOverride: string | undefined;
  let labelSubtext: string | undefined;
  if (guessMode && guessSubmitted && miles !== null) {
    const guess = Number(guessInput);
    if (Number.isFinite(guess)) {
      const off = Math.abs(guess - miles);
      labelOverride = formatMiles(miles);
      if (off < 1) {
        labelSubtext = 'Perfect!';
      } else if (off < 25) {
        labelSubtext = `Off by ${Math.round(off).toLocaleString('en-US')} mi — amazing!`;
      } else if (off < 100) {
        labelSubtext = `Off by ${Math.round(off).toLocaleString('en-US')} mi — great!`;
      } else {
        labelSubtext = `Off by ${Math.round(off).toLocaleString('en-US')} mi`;
      }
    }
  }

  // Mode A shows capital stars on; mode B turns them off so the kid can click
  // anywhere without the stars stealing pointer focus (CapitalLayer has
  // pointerEvents="none" anyway so stars don't actually block clicks, but
  // hiding them makes the "click anywhere" intent visually clearer).
  const showCapitalStars = mode === 'capitals';
  const showCapitalNames = mode === 'capitals';

  // In capital mode we want the state click to do the work; in anywhere mode
  // we DON'T want onStateClick because clicks on states should be treated as
  // arbitrary-point picks (not capital picks).
  const stateClickHandler = mode === 'capitals' ? handleStateClick : undefined;
  // In anywhere mode we listen at the SVG root. In capital mode we don't
  // need it — state clicks already cover everything we want.
  const pointerClickHandler = mode === 'anywhere' ? handleMapPointerClick : undefined;

  // Don't show the calculated miles when in guess mode pre-submit.
  const showCalculatedLabel = !guessMode || guessSubmitted;

  return (
    <div className="w-full h-[calc(100vh-142px)] max-sm:h-[calc(100vh-218px)] flex flex-col bg-gradient-to-b from-emerald-50 via-sky-50 to-white">
      {/* Top bar — back link, title, mode toggles, clear button */}
      <div className="shrink-0 bg-white/70 backdrop-blur-sm border-b border-emerald-100 px-2 sm:px-4 py-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link
            href="/geography"
            className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-emerald-700 hover:text-emerald-500 transition-colors"
          >
            ← Geography
          </Link>
          <h2 className="text-base sm:text-lg font-black text-emerald-900">Distance Measure</h2>

          {/* Mode pill toggle */}
          <div className="ml-2 inline-flex rounded-full bg-emerald-100 p-0.5 text-xs sm:text-sm font-semibold">
            <button
              type="button"
              onClick={() => setMode('capitals')}
              className={
                mode === 'capitals'
                  ? 'px-3 py-1 rounded-full bg-emerald-600 text-white shadow-sm'
                  : 'px-3 py-1 rounded-full text-emerald-800 hover:text-emerald-900'
              }
            >
              Capital → Capital
            </button>
            <button
              type="button"
              onClick={() => setMode('anywhere')}
              className={
                mode === 'anywhere'
                  ? 'px-3 py-1 rounded-full bg-emerald-600 text-white shadow-sm'
                  : 'px-3 py-1 rounded-full text-emerald-800 hover:text-emerald-900'
              }
            >
              Click Anywhere
            </button>
          </div>

          {/* Guess sub-mode */}
          <label className="flex items-center gap-1.5 cursor-pointer text-xs sm:text-sm font-medium text-gray-800 hover:text-emerald-700 transition-colors ml-2">
            <input
              type="checkbox"
              checked={guessMode}
              onChange={(e) => setGuessMode(e.target.checked)}
              className="w-4 h-4 accent-emerald-600 cursor-pointer"
            />
            Guess the distance
          </label>

          {/* Clear */}
          <button
            type="button"
            onClick={handleClear}
            disabled={points.length === 0}
            className="ml-auto px-3 py-1 text-xs sm:text-sm font-semibold rounded-full bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Clear
          </button>
        </div>

        {/* Secondary row — hint / status / guess input */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 min-h-[28px] text-xs sm:text-sm">
          {/* Step hint */}
          {points.length === 0 && (
            <span className="text-gray-700">
              {mode === 'capitals'
                ? 'Click a state to pick its capital. Then click another.'
                : 'Click anywhere on the map. Then click again.'}
            </span>
          )}
          {points.length === 1 && (
            <span className="text-emerald-800 font-semibold">
              Now pick your second point…
            </span>
          )}
          {points.length === 2 && !guessMode && miles !== null && (
            <span className="font-bold text-emerald-900">
              Distance: {formatMiles(miles)}
              {points[0].label && points[1].label && (
                <span className="font-normal text-gray-700 ml-1.5">
                  ({points[0].label} → {points[1].label})
                </span>
              )}
            </span>
          )}

          {/* Guess input — appears only after 2 points are set, in guess mode, pre-submit. */}
          {points.length === 2 && guessMode && !guessSubmitted && (
            <form onSubmit={handleSubmitGuess} className="flex items-center gap-2">
              <label className="font-semibold text-emerald-900">
                Your guess (in miles):
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={guessInput}
                onChange={(e) => setGuessInput(e.target.value)}
                placeholder="e.g. 800"
                className="w-28 px-2 py-1 rounded-md border border-emerald-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                autoFocus
              />
              <button
                type="submit"
                disabled={guessInput === '' || !Number.isFinite(Number(guessInput))}
                className="px-3 py-1 font-semibold rounded-full bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Reveal
              </button>
            </form>
          )}

          {/* Guess reveal — shown after submit. The label on the map also
              shows this, but a kid-friendly summary here is louder. */}
          {points.length === 2 && guessMode && guessSubmitted && miles !== null && (() => {
            const guess = Number(guessInput);
            const off = Math.abs(guess - miles);
            const phrase =
              off < 1
                ? 'Perfect!'
                : off < 25
                ? 'Amazing!'
                : off < 100
                ? 'Great guess!'
                : off < 300
                ? 'Good try!'
                : 'Keep practicing!';
            return (
              <span className="font-bold text-emerald-900">
                You guessed {formatMiles(guess)}. Real distance: {formatMiles(miles)}.{' '}
                <span className="text-emerald-700">
                  Off by {Math.round(off).toLocaleString('en-US')} mi — {phrase}
                </span>
              </span>
            );
          })()}

          {/* Status flash — brief feedback for click registration. */}
          {statusFlash && points.length < 2 && (
            <span className="text-emerald-700 italic ml-auto">{statusFlash}</span>
          )}
        </div>
      </div>

      {/* Map area */}
      <div className="flex-1 min-h-0 w-full px-1 sm:px-2 py-1">
        <USMap
          showStateLabels={true}
          showCapitalStars={showCapitalStars}
          showCapitalNames={showCapitalNames}
          onStateClick={stateClickHandler}
          onMapPointerClick={pointerClickHandler}
          svgChildren={
            <DistanceTool
              points={points.map((p) => ({ x: p.svgX, y: p.svgY }))}
              miles={miles}
              showLabel={showCalculatedLabel}
              labelOverride={labelOverride}
              labelSubtext={labelSubtext}
            />
          }
        />
      </div>
    </div>
  );
}
