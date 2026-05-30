// StateZoomView — full-screen zoomed-in close-up of a single state.
//
// Triggered from StateDetailDrawer's "View Up Close" button (parent owns the
// open/close state). Renders a modal overlay with:
//   - LEFT: a big SVG of JUST this state, viewBox set to its bbox from
//     public/geography/state-silhouettes.json, painted in its region tint.
//     Pins overlaid for capital (gold star), major cities (purple dot +
//     label), and any physical feature with a latLon — landmarks as orange
//     triangles, peaks/mountains as small brown carets, rivers/lakes as
//     blue droplets. Parks are NOT plotted on the map (their lat/lon isn't
//     in the dataset); they appear in the right-side panel only.
//   - RIGHT: a scrollable panel with name, nickname, flag, quick facts,
//     and a parks-to-visit list.
//
// Projection strategy: Option 1 from the spec — render the state's path in
// the ORIGINAL political-SVG coordinate space (no re-projection). The SVG's
// viewBox is set to the state's bbox so it fills the canvas. Pins are
// projected via the same `geoAlbersUsa().scale(1280).translate([959/2,
// 593/2])` projection + the empirical `translate(-3, -5)` nudge used by
// CapitalLayer / LandmarkLayer. Since pins and path share one coordinate
// system, they line up automatically once the viewBox crops to the state.
//
// Close affordances: ESC, backdrop click, big X in the corner. Body scroll
// is locked while open.
'use client';

import { useEffect, useMemo } from 'react';
import { geoAlbersUsa } from 'd3-geo';
import statesData from '@/data/states.json';
import silhouettes from '@/public/geography/state-silhouettes.json';
import { REGION_TINTS } from './USMap';

export type StateZoomViewProps = {
  postal: string | null; // null = closed
  onClose: () => void;
};

// --- Local types mirroring the slice of states.json this view reads ---
type PhysicalFeature = {
  name: string;
  type: string;
  description?: string;
  fact?: string;
  latLon?: number[] | null;
};

type Park = {
  name: string;
  type: string;
  description: string;
  yearEstablished: number | null;
};

type MajorCity = {
  name: string;
  population: number;
  isCapital: boolean;
};

type StateFlag = {
  path: string;
  adoptedYear?: number;
  description?: string;
};

type StateRecord = {
  postal: string;
  name: string;
  capital: string;
  capitalLatLon: number[];
  nickname?: string;
  region?: string;
  admittedYear?: number;
  population?: number;
  populationYear?: number;
  areaSqMi?: number;
  largestCity?: string;
  flag?: StateFlag;
  majorCities?: MajorCity[];
  physicalFeatures?: PhysicalFeature[];
  parks?: Park[];
};

type SilhouetteEntry = {
  d: string;
  bbox: number[];   // [x, y, w, h]
  center: number[]; // [x, y]
};

const STATES = statesData as unknown as StateRecord[];
const SILHOUETTES = silhouettes as unknown as Record<string, SilhouetteEntry>;

// Source political SVG dimensions — must match what state-silhouettes.json
// was extracted from and the same projection setup used by CapitalLayer /
// LandmarkLayer.
const VIEW_W = 959;
const VIEW_H = 593;

// Tiny nudge so the projected pins line up with the painted silhouette path
// (matches CapitalLayer + LandmarkLayer's calibration).
const NUDGE_X = -3;
const NUDGE_Y = -5;

// Padding around the silhouette bbox so the shape doesn't kiss the SVG edge.
// Applied in source-coordinate units, scaled with the bbox so a smaller
// state gets proportionally less absolute padding.
const BBOX_PAD_RATIO = 0.08;

// Filled triangle pointing up, same shape as LandmarkLayer so the mental
// model carries over (orange triangle = landmark).
const TRIANGLE_PATH = 'M 0,-5 L 4.4,3 -4.4,3 Z';
const STAR_PATH =
  'M 0,-7 L 2.05,-2.16 7,-2.16 3.06,0.83 4.33,5.83 0,2.83 -4.33,5.83 -3.06,0.83 -7,-2.16 -2.05,-2.16 Z';

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

function isPlottable(type: string): boolean {
  const t = type.toLowerCase();
  return (
    t === 'landmark' ||
    t === 'peak' ||
    t === 'mountain' ||
    t === 'mountains' ||
    t === 'lake' ||
    t === 'river' ||
    t === 'volcano' ||
    t === 'waterfall' ||
    t === 'canyon' ||
    t === 'desert' ||
    t === 'glacier' ||
    t === 'falls' ||
    t === 'bay' ||
    t === 'island'
  );
}

// Visual style for a plottable physical feature pin.
function pinStyleFor(
  type: string,
): { kind: 'triangle' | 'star' | 'circle'; fill: string; stroke: string; r: number } {
  const t = type.toLowerCase();
  if (t === 'landmark') {
    return { kind: 'triangle', fill: '#ea580c', stroke: '#7c2d12', r: 5 };
  }
  if (t === 'volcano') {
    return { kind: 'triangle', fill: '#dc2626', stroke: '#7f1d1d', r: 5 };
  }
  if (t === 'peak' || t === 'mountain' || t === 'mountains') {
    return { kind: 'triangle', fill: '#78350f', stroke: '#1c1917', r: 4 };
  }
  if (t === 'lake' || t === 'bay') {
    return { kind: 'circle', fill: '#0ea5e9', stroke: '#0c4a6e', r: 4 };
  }
  if (t === 'river' || t === 'waterfall' || t === 'falls') {
    return { kind: 'circle', fill: '#38bdf8', stroke: '#0c4a6e', r: 4 };
  }
  if (t === 'canyon' || t === 'desert') {
    return { kind: 'triangle', fill: '#d97706', stroke: '#78350f', r: 4 };
  }
  if (t === 'glacier') {
    return { kind: 'circle', fill: '#bae6fd', stroke: '#0c4a6e', r: 4 };
  }
  if (t === 'island') {
    return { kind: 'circle', fill: '#10b981', stroke: '#064e3b', r: 4 };
  }
  return { kind: 'circle', fill: '#6b7280', stroke: '#1f2937', r: 4 };
}

// Park badge styling — mirrors StateDetailDrawer for visual continuity.
function parkBadge(type: string): { label: string; classes: string } {
  const t = type.toLowerCase();
  if (t === 'national')
    return { label: 'National Park', classes: 'bg-green-100 text-green-800 ring-green-200' };
  if (t === 'state')
    return { label: 'State Park', classes: 'bg-emerald-100 text-emerald-800 ring-emerald-200' };
  if (t === 'monument')
    return { label: 'Monument', classes: 'bg-amber-100 text-amber-800 ring-amber-200' };
  if (t === 'historic' || t === 'historical')
    return { label: 'Historic Site', classes: 'bg-rose-100 text-rose-800 ring-rose-200' };
  if (t === 'seashore' || t === 'lakeshore')
    return { label: 'Seashore', classes: 'bg-sky-100 text-sky-800 ring-sky-200' };
  if (t === 'recreation' || t === 'recreational')
    return { label: 'Recreation Area', classes: 'bg-orange-100 text-orange-800 ring-orange-200' };
  if (t === 'preserve')
    return { label: 'Preserve', classes: 'bg-teal-100 text-teal-800 ring-teal-200' };
  const label = type.charAt(0).toUpperCase() + type.slice(1);
  return { label, classes: 'bg-gray-100 text-gray-800 ring-gray-200' };
}

export default function StateZoomView({ postal, onClose }: StateZoomViewProps) {
  const isOpen = postal !== null;
  const state = postal ? STATES.find((s) => s.postal === postal) ?? null : null;
  const silhouette = postal ? SILHOUETTES[postal] ?? null : null;

  // Shared projection — identical to CapitalLayer / LandmarkLayer so the pins
  // sit in the SAME source-SVG coordinate space as the silhouette path.
  const projection = useMemo(
    () => geoAlbersUsa().scale(1280).translate([VIEW_W / 2, VIEW_H / 2]),
    [],
  );

  // ESC closes; lock body scroll while open.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  // Compute padded viewBox once we know the silhouette. Bail out gracefully
  // when a state has no silhouette entry (shouldn't happen — JSON has all
  // 50 + DC — but degrade rather than throw).
  const viewBox = useMemo(() => {
    if (!silhouette) return `0 0 ${VIEW_W} ${VIEW_H}`;
    const [x, y, w, h] = silhouette.bbox;
    const pad = Math.max(w, h) * BBOX_PAD_RATIO;
    return `${x - pad} ${y - pad} ${w + pad * 2} ${h + pad * 2}`;
  }, [silhouette]);

  // Capital pin position in source SVG coords (Albers + nudge).
  const capitalPin = useMemo(() => {
    if (!state) return null;
    const [lat, lon] = state.capitalLatLon;
    const projected = projection([lon, lat]);
    if (!projected) return null;
    return { x: projected[0] + NUDGE_X, y: projected[1] + NUDGE_Y };
  }, [state, projection]);

  // Physical-feature pins (anything with latLon AND a plottable type).
  const featurePins = useMemo(() => {
    if (!state || !state.physicalFeatures) return [];
    const out: Array<{
      key: string;
      name: string;
      type: string;
      x: number;
      y: number;
    }> = [];
    state.physicalFeatures.forEach((f, idx) => {
      if (!f.latLon || f.latLon.length < 2) return;
      if (!isPlottable(f.type)) return;
      const [lat, lon] = f.latLon as [number, number];
      if (typeof lat !== 'number' || typeof lon !== 'number') return;
      const projected = projection([lon, lat]);
      if (!projected) return;
      out.push({
        key: `${state.postal}-${idx}-${f.name}`,
        name: f.name,
        type: f.type,
        x: projected[0] + NUDGE_X,
        y: projected[1] + NUDGE_Y,
      });
    });
    return out;
  }, [state, projection]);

  // Region tint color, falls back to a neutral gray-blue.
  const fillColor = state?.region ? REGION_TINTS[state.region] ?? '#cbd5e1' : '#cbd5e1';

  // Scale label font sizes inversely with bbox size so labels read at a
  // consistent on-screen size regardless of how zoomed-in we are.
  const fontScale = useMemo(() => {
    if (!silhouette) return 1;
    const [, , w, h] = silhouette.bbox;
    const span = Math.max(w, h);
    // 50px-span tiny state → bigger fonts; 250px-span huge state → smaller.
    // Clamped so we don't generate insane sizes.
    return Math.min(2.5, Math.max(0.6, span / 120));
  }, [silhouette]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={state ? `${state.name} close-up` : 'State close-up'}
      aria-hidden={!isOpen}
      className={`fixed inset-0 z-50 transition-opacity duration-200 ease-out ${
        isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      {/* Backdrop — click to close. */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
      />

      {/* Floating close button — top-right of the whole viewport, always visible. */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close close-up view"
        className="absolute right-4 top-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-gray-800 shadow-lg ring-2 ring-white/40 transition-all hover:scale-105 hover:bg-white"
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      {state && (
        <div
          // Centered modal that fills most of the screen. Two-pane layout:
          // map on the left grows to fill, info panel on the right is fixed-
          // width on desktop and stacks below on mobile.
          onClick={(e) => e.stopPropagation()}
          className="relative mx-auto flex h-full w-full max-w-[1400px] flex-col p-3 sm:p-6 md:flex-row md:gap-6"
        >
          {/* Map pane */}
          <div className="relative flex min-h-0 flex-1 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-100 via-white to-emerald-50 p-3 shadow-2xl ring-1 ring-white/40">
            <svg
              viewBox={viewBox}
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="xMidYMid meet"
              className="block h-full w-full max-h-full max-w-full"
              role="img"
              aria-label={`Close-up map of ${state.name}`}
            >
              {/* The state shape itself. */}
              {silhouette && (
                <path
                  d={silhouette.d}
                  fill={fillColor}
                  stroke="#1f2937"
                  strokeWidth={Math.max(0.6, 1.2 / fontScale)}
                  strokeLinejoin="round"
                />
              )}

              {/* Physical-feature pins (landmarks, peaks, lakes, etc). */}
              {featurePins.map((p) => {
                const style = pinStyleFor(p.type);
                const sz = style.r * fontScale;
                return (
                  <g key={p.key} transform={`translate(${p.x}, ${p.y})`}>
                    {style.kind === 'triangle' && (
                      <path
                        d={TRIANGLE_PATH}
                        transform={`scale(${fontScale})`}
                        fill={style.fill}
                        stroke={style.stroke}
                        strokeWidth={0.8}
                        strokeLinejoin="round"
                      />
                    )}
                    {style.kind === 'circle' && (
                      <circle r={sz} fill={style.fill} stroke={style.stroke} strokeWidth={0.8} />
                    )}
                    <text
                      x={0}
                      y={sz + 4 * fontScale + 3}
                      textAnchor="middle"
                      fontSize={3.6 * fontScale}
                      fontWeight={600}
                      fill="#111827"
                      stroke="#ffffff"
                      strokeWidth={1.2 * fontScale}
                      paintOrder="stroke"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {p.name}
                    </text>
                  </g>
                );
              })}

              {/* Major-city dots — no latLon in dataset, so we don't plot
                  them on the map. They appear in the side panel instead. */}

              {/* Capital star (drawn LAST so it sits on top of everything). */}
              {capitalPin && (
                <g transform={`translate(${capitalPin.x}, ${capitalPin.y})`}>
                  <path
                    d={STAR_PATH}
                    transform={`scale(${fontScale})`}
                    fill="#facc15"
                    stroke="#78350f"
                    strokeWidth={0.9}
                    strokeLinejoin="round"
                  />
                  <text
                    x={0}
                    y={7 * fontScale + 4 * fontScale + 3}
                    textAnchor="middle"
                    fontSize={4 * fontScale}
                    fontWeight={700}
                    fill="#111827"
                    stroke="#ffffff"
                    strokeWidth={1.3 * fontScale}
                    paintOrder="stroke"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    ★ {state.capital}
                  </text>
                </g>
              )}
            </svg>

            {/* Legend overlay — bottom-left of the map pane. */}
            <div className="absolute bottom-4 left-4 hidden rounded-lg bg-white/95 px-3 py-2 text-[11px] shadow ring-1 ring-gray-200 sm:block">
              <div className="mb-1 font-bold uppercase tracking-wide text-gray-500">Legend</div>
              <div className="flex flex-col gap-0.5 text-gray-700">
                <span><span aria-hidden="true">★</span> Capital</span>
                <span><span aria-hidden="true" style={{ color: '#ea580c' }}>▲</span> Landmark</span>
                <span><span aria-hidden="true" style={{ color: '#0ea5e9' }}>●</span> Lake / River</span>
                <span><span aria-hidden="true" style={{ color: '#78350f' }}>▲</span> Peak / Mountain</span>
              </div>
            </div>
          </div>

          {/* Info pane */}
          <aside className="mt-3 flex max-h-[40vh] min-h-0 flex-col overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-white/40 md:mt-0 md:max-h-none md:w-[360px] md:flex-shrink-0">
            {/* Header */}
            <header className="bg-gradient-to-br from-emerald-600 to-teal-600 px-5 py-4 text-white">
              <h2 className="text-2xl font-extrabold tracking-tight">{state.name}</h2>
              {state.nickname && (
                <p className="mt-0.5 text-sm italic text-emerald-50">{state.nickname}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-emerald-50">
                <span><span aria-hidden="true">★</span> {state.capital}</span>
                {state.region && (
                  <>
                    <span className="text-white/60">|</span>
                    <span>{state.region}</span>
                  </>
                )}
                {state.admittedYear && (
                  <>
                    <span className="text-white/60">|</span>
                    <span>Admitted {state.admittedYear}</span>
                  </>
                )}
              </div>
            </header>

            <div className="flex-1 space-y-5 px-5 py-4">
              {/* Flag */}
              {state.flag && (
                <section>
                  <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Flag
                  </h3>
                  <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={state.flag.path}
                      alt={`Flag of ${state.name}`}
                      className="h-12 w-16 shrink-0 rounded-sm object-cover ring-1 ring-gray-300"
                    />
                    {state.flag.adoptedYear && (
                      <span className="text-xs text-gray-600">
                        Adopted {state.flag.adoptedYear}
                      </span>
                    )}
                  </div>
                </section>
              )}

              {/* Quick facts */}
              <section>
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  Quick Facts
                </h3>
                <dl className="space-y-1.5 rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-gray-600">Capital</dt>
                    <dd className="text-right font-semibold text-gray-900">{state.capital}</dd>
                  </div>
                  {typeof state.population === 'number' && (
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-gray-600">Population</dt>
                      <dd className="text-right font-semibold text-gray-900">
                        {formatNumber(state.population)}
                      </dd>
                    </div>
                  )}
                  {typeof state.areaSqMi === 'number' && (
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-gray-600">Area</dt>
                      <dd className="text-right font-semibold text-gray-900">
                        {formatNumber(state.areaSqMi)} sq mi
                      </dd>
                    </div>
                  )}
                  {state.largestCity && (
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-gray-600">Largest City</dt>
                      <dd className="text-right font-semibold text-gray-900">
                        {state.largestCity}
                      </dd>
                    </div>
                  )}
                </dl>
              </section>

              {/* Major cities */}
              {state.majorCities && state.majorCities.length > 0 && (
                <section>
                  <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Major Cities
                  </h3>
                  <ul className="space-y-1.5">
                    {state.majorCities.map((c) => (
                      <li
                        key={c.name}
                        className="flex items-center justify-between rounded-md border border-gray-100 bg-white px-3 py-1.5 text-sm shadow-sm"
                      >
                        <span className="flex items-center gap-1.5">
                          {c.isCapital ? (
                            <span className="text-yellow-500" aria-hidden="true">★</span>
                          ) : (
                            <span className="text-purple-500" aria-hidden="true">●</span>
                          )}
                          <span className="font-medium text-gray-900">{c.name}</span>
                        </span>
                        <span className="text-xs text-gray-500">{formatNumber(c.population)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Landmarks on the map — list mirror of the orange pins. */}
              {state.physicalFeatures && state.physicalFeatures.some((f) => f.type === 'landmark') && (
                <section>
                  <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Famous Landmarks
                  </h3>
                  <ul className="space-y-2">
                    {state.physicalFeatures
                      .filter((f) => f.type === 'landmark')
                      .map((f) => (
                        <li
                          key={f.name}
                          className="rounded-md border border-orange-100 bg-orange-50/60 px-3 py-2 text-sm"
                        >
                          <div className="flex items-center gap-1.5 font-bold text-gray-900">
                            <span className="text-orange-600" aria-hidden="true">▲</span>
                            {f.name}
                          </div>
                          {f.description && (
                            <p className="mt-0.5 text-xs text-gray-700">{f.description}</p>
                          )}
                        </li>
                      ))}
                  </ul>
                </section>
              )}

              {/* Parks — text-only (no latLon to pin them on the map). */}
              {state.parks && state.parks.length > 0 && (
                <section>
                  <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Parks to Visit
                  </h3>
                  <ul className="space-y-2">
                    {state.parks.map((p) => {
                      const badge = parkBadge(p.type);
                      return (
                        <li
                          key={p.name}
                          className="rounded-md border border-gray-100 bg-white px-3 py-2 text-sm shadow-sm"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${badge.classes}`}
                            >
                              {badge.label}
                            </span>
                            {p.yearEstablished !== null && (
                              <span className="text-[10px] text-gray-500">
                                est. {p.yearEstablished}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-sm font-bold text-gray-900">{p.name}</div>
                          <p className="mt-0.5 text-xs text-gray-700">{p.description}</p>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
            </div>

            {/* Footer */}
            <footer className="mt-auto border-t border-gray-100 bg-gray-50 px-5 py-3">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-500 active:bg-emerald-700"
              >
                ← Back to map
              </button>
            </footer>
          </aside>
        </div>
      )}
    </div>
  );
}
