// CountryZoomView — full-screen zoomed-in close-up of a single country.
//
// Parallel to StateZoomView but for the world map. Triggered from
// CountryDetailDrawer's "View Up Close" button (parent owns open/close).
//
// Renders a modal overlay with:
//   - LEFT: an SVG of JUST this country, extracted from
//     public/geography/world/countries-110m.json (TopoJSON). Projected with
//     d3-geo's `geoEqualEarth().fitSize(...)` against the canvas, which
//     centers + scales the country to fill the available space. Pins for
//     capital (gold star), landmarks (orange triangles with names), and
//     physical features that have a latLon (blue lakes/rivers, brown peaks).
//   - RIGHT: a scrollable info panel with flag, nickname-equivalent (continent
//     subtitle), quick facts, landmarks list, and physical features list.
//
// Projection strategy: Option 2 from the spec — we create a NEW local
// projection per opened country, fit to the local canvas via `fitSize`.
// This is much cleaner here than reusing WorldMap's full-world projection
// because the country IS the canvas now. Pins share the same per-country
// projection so they align automatically.
//
// Close affordances: ESC, backdrop click, big X in the corner. Body scroll
// is locked while open.
'use client';

import { useEffect, useMemo, useState } from 'react';
import { geoEqualEarth, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import countriesData from '@/data/countries.json';
import { CONTINENT_TINTS } from './WorldMap';
import { NUMERIC_TO_ISO3 } from './worldCountryData';

export type CountryZoomViewProps = {
  iso2: string | null; // null = closed
  onClose: () => void;
};

// --- Local types mirroring the slice of countries.json this view reads ---
type Landmark = {
  name: string;
  type?: string;
  description?: string;
  fact?: string;
  latLon?: number[] | null;
};

type PhysicalFeature = {
  name: string;
  type?: string;
  description?: string;
  fact?: string;
  latLon?: number[] | null;
};

type CountryRecord = {
  iso2: string;
  iso3: string;
  name: string;
  capital?: string;
  capitalLatLon?: number[];
  continent?: string;
  region?: string;
  population?: number;
  populationYear?: number;
  areaSqKm?: number;
  languages?: string[];
  currency?: string;
  currencyCode?: string;
  funFacts?: string[];
  landmarks?: Landmark[];
  physicalFeatures?: PhysicalFeature[];
};

type CountryFeature = Feature<Polygon | MultiPolygon, { name?: string }>;

const ALL_COUNTRIES = countriesData as CountryRecord[];

// Canvas size for the zoomed SVG. fitSize() projects the country into this
// box; preserveAspectRatio keeps the country centered when the rendered
// element is non-square.
const VIEW_W = 1000;
const VIEW_H = 700;

// Bounded padding (in pixels) so the country doesn't kiss the edges.
const FIT_PADDING = 40;

// TopoJSON source — same file WorldMap fetches.
const TOPOJSON_URL = '/geography/world/countries-110m.json';

// Pin shapes.
const TRIANGLE_PATH = 'M 0,-9 L 7.5,5 -7.5,5 Z';
const STAR_PATH =
  'M 0,-12 L 3.5,-3.7 12,-3.7 5.25,1.43 7.42,10 0,4.85 -7.42,10 -5.25,1.43 -12,-3.7 -3.5,-3.7 Z';

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

function flagPath(c: CountryRecord): string | null {
  if (!c.iso2) return null;
  return `/geography/world/flags/${c.iso2.toLowerCase()}.svg`;
}

function currencyLabel(c: CountryRecord): string | null {
  if (!c.currency && !c.currencyCode) return null;
  if (c.currency && c.currencyCode) return `${c.currency} (${c.currencyCode})`;
  return c.currency ?? c.currencyCode ?? null;
}

function isPlottablePhysical(type: string | undefined): boolean {
  const t = (type ?? '').toLowerCase();
  return (
    t.includes('peak') ||
    t.includes('mountain') ||
    t.includes('volcano') ||
    t.includes('lake') ||
    t.includes('river') ||
    t.includes('waterfall') ||
    t.includes('falls') ||
    t.includes('canyon') ||
    t.includes('desert') ||
    t.includes('glacier') ||
    t.includes('bay') ||
    t.includes('reef')
  );
}

function physicalPinStyle(type: string | undefined): {
  kind: 'triangle' | 'circle';
  fill: string;
  stroke: string;
} {
  const t = (type ?? '').toLowerCase();
  if (t.includes('volcano')) return { kind: 'triangle', fill: '#dc2626', stroke: '#7f1d1d' };
  if (t.includes('peak') || t.includes('mountain'))
    return { kind: 'triangle', fill: '#78350f', stroke: '#1c1917' };
  if (t.includes('lake') || t.includes('bay') || t.includes('reef'))
    return { kind: 'circle', fill: '#0ea5e9', stroke: '#0c4a6e' };
  if (t.includes('river') || t.includes('waterfall') || t.includes('falls'))
    return { kind: 'circle', fill: '#38bdf8', stroke: '#0c4a6e' };
  if (t.includes('canyon') || t.includes('desert'))
    return { kind: 'triangle', fill: '#d97706', stroke: '#78350f' };
  if (t.includes('glacier')) return { kind: 'circle', fill: '#bae6fd', stroke: '#0c4a6e' };
  return { kind: 'circle', fill: '#6b7280', stroke: '#1f2937' };
}

// Look up the country record by ISO-2.
function findCountry(iso2: string): CountryRecord | null {
  const key = iso2.toUpperCase();
  return ALL_COUNTRIES.find((c) => c.iso2.toUpperCase() === key) ?? null;
}

// To match a feature in the topojson to our country record, we look up by
// the numeric M49 id encoded in `feature.id`. NUMERIC_TO_ISO3 is the same
// map WorldMap uses to convert these to our ISO-3 keys.
function featureForIso3(topology: Topology, iso3: string): CountryFeature | null {
  const countriesObj = topology.objects['countries'] as
    | GeometryCollection<{ name?: string }>
    | undefined;
  if (!countriesObj) return null;
  const collection = feature(topology, countriesObj) as FeatureCollection<
    Polygon | MultiPolygon,
    { name?: string }
  >;
  for (const feat of collection.features) {
    const idRaw = feat.id;
    const numericId =
      typeof idRaw === 'string' || typeof idRaw === 'number'
        ? String(idRaw).padStart(3, '0')
        : null;
    if (!numericId) continue;
    if (NUMERIC_TO_ISO3[numericId] === iso3) return feat;
  }
  return null;
}

export default function CountryZoomView({ iso2, onClose }: CountryZoomViewProps) {
  const isOpen = iso2 !== null;
  const country = iso2 ? findCountry(iso2) : null;

  // Topology cached at module-component scope. We refetch lazily on first
  // open, then keep it — the file is ~105 KB and WorldMap already fetches it
  // separately. (Co-fetching is OK; browser cache will serve the second hit.)
  const [topology, setTopology] = useState<Topology | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || topology) return;
    let cancelled = false;
    fetch(TOPOJSON_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<Topology>;
      })
      .then((topo) => {
        if (!cancelled) setTopology(topo);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        console.error('CountryZoomView: failed to load topojson', err);
        setLoadError(msg);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, topology]);

  // Per-country fitted projection — recomputed when the open country or the
  // (lazy-loaded) topology changes. Returns null until the topology arrives.
  const projected = useMemo(() => {
    if (!country || !topology) return null;
    const feat = featureForIso3(topology, country.iso3);
    if (!feat) return null;
    // fitSize() centers + scales the feature to fill the canvas (minus
    // padding). Then geoPath() generates the SVG `d` string in projected
    // coords.
    const proj = geoEqualEarth().fitExtent(
      [
        [FIT_PADDING, FIT_PADDING],
        [VIEW_W - FIT_PADDING, VIEW_H - FIT_PADDING],
      ],
      feat,
    );
    const path = geoPath(proj);
    const d = path(feat);
    if (!d) return null;
    return { d, proj };
  }, [country, topology]);

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

  // Capital pin position via the per-country projection.
  const capitalPin = useMemo(() => {
    if (!country || !country.capitalLatLon || !projected) return null;
    const [lat, lon] = country.capitalLatLon;
    const xy = projected.proj([lon, lat]);
    if (!xy) return null;
    return { x: xy[0], y: xy[1] };
  }, [country, projected]);

  // Landmark pins (orange triangles).
  const landmarkPins = useMemo(() => {
    if (!country || !projected || !country.landmarks) return [];
    const out: Array<{ key: string; name: string; x: number; y: number }> = [];
    country.landmarks.forEach((l, idx) => {
      if (!Array.isArray(l.latLon) || l.latLon.length < 2) return;
      const [lat, lon] = l.latLon as [number, number];
      if (typeof lat !== 'number' || typeof lon !== 'number') return;
      const xy = projected.proj([lon, lat]);
      if (!xy) return;
      out.push({ key: `lm-${idx}-${l.name}`, name: l.name, x: xy[0], y: xy[1] });
    });
    return out;
  }, [country, projected]);

  // Physical-feature pins (mountains, lakes, etc) — only types we know how
  // to symbolize. Anything without a latLon stays as a list-only entry.
  const featurePins = useMemo(() => {
    if (!country || !projected || !country.physicalFeatures) return [];
    const out: Array<{ key: string; name: string; type: string | undefined; x: number; y: number }> = [];
    country.physicalFeatures.forEach((f, idx) => {
      if (!isPlottablePhysical(f.type)) return;
      if (!Array.isArray(f.latLon) || f.latLon.length < 2) return;
      const [lat, lon] = f.latLon as [number, number];
      if (typeof lat !== 'number' || typeof lon !== 'number') return;
      const xy = projected.proj([lon, lat]);
      if (!xy) return;
      out.push({ key: `pf-${idx}-${f.name}`, name: f.name, type: f.type, x: xy[0], y: xy[1] });
    });
    return out;
  }, [country, projected]);

  // Continent tint for the country fill.
  const fillColor = country?.continent
    ? CONTINENT_TINTS[country.continent] ?? '#cbd5e1'
    : '#cbd5e1';

  const flag = country ? flagPath(country) : null;
  const currency = country ? currencyLabel(country) : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={country ? `${country.name} close-up` : 'Country close-up'}
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

      {/* Floating close button. */}
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

      {country && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative mx-auto flex h-full w-full max-w-[1400px] flex-col p-3 sm:p-6 md:flex-row md:gap-6"
        >
          {/* Map pane */}
          <div className="relative flex min-h-0 flex-1 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-100 via-white to-indigo-50 p-3 shadow-2xl ring-1 ring-white/40">
            <svg
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="xMidYMid meet"
              className="block h-full w-full max-h-full max-w-full"
              role="img"
              aria-label={`Close-up map of ${country.name}`}
            >
              {/* Ocean-ish background tint, lighter than WorldMap's. */}
              <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="#eff6ff" />

              {projected && (
                <path
                  d={projected.d}
                  fill={fillColor}
                  stroke="#1f2937"
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                />
              )}

              {/* Physical-feature pins first (under landmarks/capital). */}
              {featurePins.map((p) => {
                const style = physicalPinStyle(p.type);
                return (
                  <g key={p.key} transform={`translate(${p.x}, ${p.y})`}>
                    {style.kind === 'triangle' && (
                      <path
                        d="M 0,-7 L 6,4 -6,4 Z"
                        fill={style.fill}
                        stroke={style.stroke}
                        strokeWidth={1}
                        strokeLinejoin="round"
                      />
                    )}
                    {style.kind === 'circle' && (
                      <circle r={5} fill={style.fill} stroke={style.stroke} strokeWidth={1} />
                    )}
                    <text
                      x={0}
                      y={14}
                      textAnchor="middle"
                      fontSize={10}
                      fontWeight={600}
                      fill="#111827"
                      stroke="#ffffff"
                      strokeWidth={2.5}
                      paintOrder="stroke"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {p.name}
                    </text>
                  </g>
                );
              })}

              {/* Landmark pins (orange triangles + label). */}
              {landmarkPins.map((p) => (
                <g key={p.key} transform={`translate(${p.x}, ${p.y})`}>
                  <path
                    d={TRIANGLE_PATH}
                    fill="#ea580c"
                    stroke="#7c2d12"
                    strokeWidth={1}
                    strokeLinejoin="round"
                  />
                  <text
                    x={0}
                    y={18}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={600}
                    fill="#111827"
                    stroke="#ffffff"
                    strokeWidth={2.5}
                    paintOrder="stroke"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {p.name}
                  </text>
                </g>
              ))}

              {/* Capital star (drawn last). */}
              {capitalPin && country.capital && (
                <g transform={`translate(${capitalPin.x}, ${capitalPin.y})`}>
                  <path
                    d={STAR_PATH}
                    fill="#facc15"
                    stroke="#78350f"
                    strokeWidth={1.2}
                    strokeLinejoin="round"
                  />
                  <text
                    x={0}
                    y={24}
                    textAnchor="middle"
                    fontSize={12}
                    fontWeight={700}
                    fill="#111827"
                    stroke="#ffffff"
                    strokeWidth={3}
                    paintOrder="stroke"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    ★ {country.capital}
                  </text>
                </g>
              )}

              {!projected && !loadError && (
                <text
                  x={VIEW_W / 2}
                  y={VIEW_H / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={18}
                  fill="#6b7280"
                >
                  Loading map…
                </text>
              )}
              {loadError && (
                <text
                  x={VIEW_W / 2}
                  y={VIEW_H / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={14}
                  fill="#991b1b"
                >
                  Failed to load map: {loadError}
                </text>
              )}
            </svg>

            {/* Legend overlay */}
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
            <header className="bg-gradient-to-br from-sky-600 to-indigo-600 px-5 py-4 text-white">
              <div className="flex items-start gap-3">
                {flag && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={flag}
                    alt={`Flag of ${country.name}`}
                    className="h-12 w-16 shrink-0 rounded-sm bg-white object-cover shadow ring-1 ring-white/30"
                  />
                )}
                <div className="min-w-0">
                  <h2 className="text-2xl font-extrabold tracking-tight">{country.name}</h2>
                  {country.continent && (
                    <p className="mt-0.5 text-xs italic text-sky-50">{country.continent}</p>
                  )}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-sky-50">
                {country.capital && <span><span aria-hidden="true">★</span> {country.capital}</span>}
                {country.iso2 && (
                  <>
                    <span className="text-white/60">|</span>
                    <span className="font-mono uppercase">{country.iso2}</span>
                  </>
                )}
              </div>
            </header>

            <div className="flex-1 space-y-5 px-5 py-4">
              {/* Quick facts */}
              <section>
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  Quick Facts
                </h3>
                <dl className="space-y-1.5 rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
                  {country.capital && (
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-gray-600">Capital</dt>
                      <dd className="text-right font-semibold text-gray-900">{country.capital}</dd>
                    </div>
                  )}
                  {country.region && (
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-gray-600">Region</dt>
                      <dd className="text-right font-semibold text-gray-900">{country.region}</dd>
                    </div>
                  )}
                  {typeof country.population === 'number' && (
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-gray-600">Population</dt>
                      <dd className="text-right font-semibold text-gray-900">
                        {formatNumber(country.population)}
                      </dd>
                    </div>
                  )}
                  {typeof country.areaSqKm === 'number' && (
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-gray-600">Area</dt>
                      <dd className="text-right font-semibold text-gray-900">
                        {formatNumber(country.areaSqKm)} km²
                      </dd>
                    </div>
                  )}
                  {country.languages && country.languages.length > 0 && (
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-gray-600">Languages</dt>
                      <dd className="text-right font-semibold text-gray-900">
                        {country.languages.join(', ')}
                      </dd>
                    </div>
                  )}
                  {currency && (
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-gray-600">Currency</dt>
                      <dd className="text-right font-semibold text-gray-900">{currency}</dd>
                    </div>
                  )}
                </dl>
              </section>

              {/* Fun facts */}
              {country.funFacts && country.funFacts.length > 0 && (
                <section>
                  <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Fun Facts
                  </h3>
                  <ul className="space-y-1.5">
                    {country.funFacts.map((fact, i) => (
                      <li
                        key={i}
                        className="rounded-md bg-indigo-50 px-3 py-1.5 text-sm text-gray-700 ring-1 ring-indigo-100"
                      >
                        <span className="mr-1.5" aria-hidden="true">✨</span>
                        {fact}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Landmarks list */}
              {country.landmarks && country.landmarks.length > 0 && (
                <section>
                  <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Famous Landmarks
                  </h3>
                  <ul className="space-y-2">
                    {country.landmarks.map((l) => (
                      <li
                        key={l.name}
                        className="rounded-md border border-orange-100 bg-orange-50/60 px-3 py-2 text-sm"
                      >
                        <div className="flex items-center gap-1.5 font-bold text-gray-900">
                          <span className="text-orange-600" aria-hidden="true">▲</span>
                          {l.name}
                        </div>
                        {l.description && (
                          <p className="mt-0.5 text-xs text-gray-700">{l.description}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Physical features list */}
              {country.physicalFeatures && country.physicalFeatures.length > 0 && (
                <section>
                  <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Land &amp; Water
                  </h3>
                  <ul className="space-y-2">
                    {country.physicalFeatures.map((f) => (
                      <li
                        key={f.name}
                        className="rounded-md border border-gray-100 bg-white px-3 py-2 text-sm shadow-sm"
                      >
                        <div className="font-bold text-gray-900">{f.name}</div>
                        {f.description && (
                          <p className="mt-0.5 text-xs text-gray-700">{f.description}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {/* Footer */}
            <footer className="mt-auto border-t border-gray-100 bg-gray-50 px-5 py-3">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-sky-500 active:bg-sky-700"
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
