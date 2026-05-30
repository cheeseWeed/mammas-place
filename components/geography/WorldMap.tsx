// WorldMap — interactive world map for the kids' geography app.
//
// Loads Natural Earth 110m countries (TopoJSON, ~105 KB), converts to GeoJSON
// via topojson-client, projects with d3-geo (default: geoEqualEarth), and
// renders one <path> per country inside a 960x540 SVG. Hover + click handlers
// fire ISO-3 codes so callers stay decoupled from the M49 numeric ids the
// topojson actually uses.
//
// Sibling map: USMap.tsx — same UX patterns (fill priority, hover filter,
// 'use client'). World data is loaded over the network at mount; states map
// is bundled SVG. Both render uncontrolled DOM via React effects.
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { geoEqualEarth, geoMercator, geoNaturalEarth1, geoPath } from 'd3-geo';
import type { GeoProjection } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import {
  NUMERIC_TO_ISO3,
  ISO3_TO_CONTINENT,
  LABELED_COUNTRIES,
} from './worldCountryData';
import WorldLandmarkLayer from './WorldLandmarkLayer';
import WorldPhysicalLayer from './WorldPhysicalLayer';

const VIEW_W = 960;
const VIEW_H = 540;
const TOPOJSON_URL = '/geography/world/countries-110m.json';

// Default fill colors. Hover handled per-element via JS filter (matches USMap).
const FILL_DEFAULT = '#e5e7eb';      // gray-200
const FILL_HIGHLIGHT = '#86efac';    // green-300
const FILL_WRONG = '#fca5a5';        // red-300
const STROKE_DEFAULT = '#ffffff';
const STROKE_WIDTH = 0.5;

// Per-continent tints. Matches the USMap REGION_TINTS pattern. Soft enough
// that black country labels stay readable; distinct from feedback red/green.
export const CONTINENT_TINTS: Record<string, string> = {
  Africa: '#fed7aa',            // orange-200
  Antarctica: '#e0e7ff',        // indigo-100
  Asia: '#fde68a',              // amber-200
  Europe: '#bae6fd',            // sky-200
  'North America': '#bbf7d0',   // emerald-200
  Oceania: '#fbcfe8',           // pink-200
  'South America': '#ddd6fe',   // violet-200
};

export type WorldMapProps = {
  // Per-country tints. Key is ISO-3 (e.g. "FRA"). Value is a CSS color.
  countryTints?: Map<string, string>;
  // Hide country labels (default: no labels rendered)
  showCountryLabels?: boolean;
  highlightedCountries?: Set<string>;  // ISO-3 codes
  wrongCountries?: Set<string>;
  onCountryHover?: (iso3: string | null) => void;
  onCountryClick?: (iso3: string) => void;
  // Continent tint mode — when supplied, every country whose ISO-3 has an
  // entry in this map gets that color (unless overridden by per-country tint
  // or feedback state). Pass `defaultContinentTints()` to color the whole map.
  continentTints?: Map<string, string>;  // ISO-3 → tint color
  className?: string;
  // Map projection. Defaults to Equal Earth — clean rectangular look that
  // shows relative country sizes accurately, good for kids. Mercator exists
  // for familiarity (school maps); Natural Earth 1 is rounded/decorative.
  projection?: 'equalEarth' | 'mercator' | 'naturalEarth1';
  // Landmark pins overlay. Renders WorldLandmarkLayer inside the same SVG so
  // pins share the projection and sit on top of country fills.
  showLandmarks?: boolean;
  onLandmarkHover?: (
    info: { country: string; iso2: string; name: string } | null,
  ) => void;
  onLandmarkClick?: (iso2: string) => void;
  // Physical-features overlay (rivers, lakes, mountain ranges, deserts).
  // Defaults to false; the study page wires a toggle that flips it.
  showPhysicalLayer?: boolean;
};

// Convenience helper for callers that want continent-colored mode without
// hand-building the ISO-3 → color map.
export function defaultContinentTints(): Map<string, string> {
  const m = new Map<string, string>();
  for (const [iso3, continent] of Object.entries(ISO3_TO_CONTINENT)) {
    const color = CONTINENT_TINTS[continent];
    if (color) m.set(iso3, color);
  }
  return m;
}

type CountryFeature = Feature<Polygon | MultiPolygon, { name?: string }>;

type ResolvedCountry = {
  feature: CountryFeature;
  iso3: string | null;          // null if topojson id can't be mapped
  name: string;
  d: string;                    // projected path data
  centroid: [number, number];   // projected [x, y] for label placement
  area: number;                 // projected area, for label-size threshold
};

function createProjection(kind: WorldMapProps['projection']): GeoProjection {
  switch (kind) {
    case 'mercator':
      return geoMercator();
    case 'naturalEarth1':
      return geoNaturalEarth1();
    case 'equalEarth':
    default:
      return geoEqualEarth();
  }
}

export default function WorldMap({
  countryTints,
  showCountryLabels = false,
  highlightedCountries,
  wrongCountries,
  onCountryHover,
  onCountryClick,
  continentTints,
  className,
  projection = 'equalEarth',
  showLandmarks = false,
  onLandmarkHover,
  onLandmarkClick,
  showPhysicalLayer = false,
}: WorldMapProps) {
  const [topology, setTopology] = useState<Topology | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const pathRefs = useRef<Map<string, SVGPathElement>>(new Map());

  // Load the topojson once on mount. Same fetch-on-mount pattern as USMap.
  useEffect(() => {
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
        // eslint-disable-next-line no-console
        console.error('WorldMap: failed to load topojson', err);
        setLoadError(msg);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Project + flatten the feature collection. Recomputed when topology or
  // projection changes. Centroid + area are derived in projected space so
  // labels land in the rendered polygon rather than the geographic centroid
  // (which Mercator can pull way off for elongated countries).
  const countries: ResolvedCountry[] = useMemo(() => {
    if (!topology) return [];
    const countriesObj = topology.objects['countries'] as
      | GeometryCollection<{ name?: string }>
      | undefined;
    if (!countriesObj) return [];

    const collection = feature(topology, countriesObj) as FeatureCollection<
      Polygon | MultiPolygon,
      { name?: string }
    >;

    const proj = createProjection(projection).fitSize(
      [VIEW_W, VIEW_H],
      collection,
    );
    const path = geoPath(proj);

    const out: ResolvedCountry[] = [];
    for (const feat of collection.features) {
      const d = path(feat);
      if (!d) continue;
      const idRaw = feat.id;
      const numericId =
        typeof idRaw === 'string' || typeof idRaw === 'number'
          ? String(idRaw).padStart(3, '0')
          : null;
      const iso3 = numericId ? NUMERIC_TO_ISO3[numericId] ?? null : null;
      const centroid = path.centroid(feat) as [number, number];
      const area = path.area(feat);
      out.push({
        feature: feat,
        iso3,
        name: feat.properties?.name ?? 'Unknown',
        d,
        centroid,
        area,
      });
    }
    return out;
  }, [topology, projection]);

  // Resolve a country's fill from the priority chain. Pure computation; runs
  // every render, but the country list is bounded at ~177 so it's cheap.
  const fillFor = (iso3: string | null): string => {
    if (iso3 && wrongCountries?.has(iso3)) return FILL_WRONG;
    if (iso3 && highlightedCountries?.has(iso3)) return FILL_HIGHLIGHT;
    if (iso3 && continentTints?.get(iso3)) return continentTints.get(iso3)!;
    if (iso3 && countryTints?.get(iso3)) return countryTints.get(iso3)!;
    return FILL_DEFAULT;
  };

  // Label gating: only render labels for countries explicitly in the curated
  // big-country set AND whose projected area clears a threshold. The area
  // check catches edge cases like Mercator-projected Antarctica (huge in
  // viewport) and trims small Caribbean states that slip into the curated
  // list when projection shrinks them off the visible map.
  const shouldLabel = (c: ResolvedCountry): boolean => {
    if (!c.iso3) return false;
    if (!LABELED_COUNTRIES.has(c.iso3)) return false;
    if (c.area < 600) return false;
    return true;
  };

  return (
    <div className={className ?? 'w-full h-full flex items-center justify-center'}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
        className="block w-full h-full max-w-full max-h-full"
        role="img"
        aria-label="World map"
      >
        {/* Ocean / background. Sits behind every path so a country's stroke
            reads against blue when it borders water but white when it borders
            another country. */}
        <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="#dbeafe" />

        {countries.map((c, idx) => {
          // Stable key: iso3 if known, otherwise feature.id, otherwise idx.
          // Some features (N. Cyprus, Somaliland, Kosovo) have no id at all,
          // so the index fallback prevents React duplicate-key warnings.
          const key =
            c.iso3 ?? (c.feature.id != null ? `n-${String(c.feature.id)}` : `i-${idx}`);
          return (
            <path
              key={key}
              ref={(el) => {
                if (!c.iso3) return;
                if (el) pathRefs.current.set(c.iso3, el);
                else pathRefs.current.delete(c.iso3);
              }}
              id={c.iso3 ?? undefined}
              d={c.d}
              fill={fillFor(c.iso3)}
              stroke={STROKE_DEFAULT}
              strokeWidth={STROKE_WIDTH}
              style={{
                transition: 'fill 200ms ease, filter 150ms ease',
                cursor: onCountryClick && c.iso3 ? 'pointer' : 'default',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.filter = 'brightness(0.92) saturate(1.1)';
                if (c.iso3) onCountryHover?.(c.iso3);
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = '';
                onCountryHover?.(null);
              }}
              onClick={() => {
                if (c.iso3) onCountryClick?.(c.iso3);
              }}
            >
              {/* Native browser tooltip — cheap discoverability. React-driven
                  tooltips can layer on top via onCountryHover. */}
              <title>{c.name}</title>
            </path>
          );
        })}

        {/* Physical-features overlay (rivers / lakes / mountain ranges /
            deserts). Rendered before pins so landmark triangles stay on top
            of feature fills; rendered before labels so country names stay
            readable above everything. */}
        {showPhysicalLayer && <WorldPhysicalLayer projection={projection} />}

        {/* Landmark pins. Rendered after country paths so they sit on top of
            fills/hover-filters; rendered before labels so country labels stay
            on top of pins for readability. */}
        {showLandmarks && (
          <WorldLandmarkLayer
            projection={projection}
            onLandmarkHover={onLandmarkHover}
            onLandmarkClick={onLandmarkClick}
          />
        )}

        {showCountryLabels &&
          countries.filter(shouldLabel).map((c) => (
            <text
              key={`lbl-${c.iso3}`}
              x={c.centroid[0]}
              y={c.centroid[1]}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={9}
              fontWeight={500}
              fill="#1f2937"          // gray-800
              stroke="#ffffff"
              strokeWidth={2}
              paintOrder="stroke"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {c.name}
            </text>
          ))}

        {loadError && (
          <text
            x={VIEW_W / 2}
            y={VIEW_H / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={14}
            fill="#991b1b"
          >
            Failed to load world map: {loadError}
          </text>
        )}
      </svg>
    </div>
  );
}
