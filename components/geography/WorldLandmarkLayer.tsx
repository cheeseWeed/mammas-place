// WorldLandmarkLayer — landmark pins for the WorldMap.
//
// Mirrors LandmarkLayer.tsx (the US version) but reads from countries.json
// instead of states.json and uses world projections instead of Albers USA.
//
// Projection: shares WorldMap's 960x540 viewBox. WorldMap uses
// projection.fitSize([960, 540], featureCollection) after loading the
// topojson, so to keep pins aligned without re-fetching ~105 KB of topojson
// we use the EXACT scale + translate that fitSize produces for the same
// viewbox + bundled Natural Earth 110m collection. Constants here were
// computed by running the same fitSize call on the live topojson once
// (see PROJECTION_PARAMS below).
//
// If WorldMap's topojson source or viewBox ever changes, recompute these by
// running:
//   const p = geoEqualEarth().fitSize([960, 540], coll);
//   console.log(p.scale(), p.translate());
//
// Alternative implementation (not used): re-fetch /geography/world/countries-
// 110m.json in this layer and rerun fitSize. Correct under any future map
// change but doubles the network cost on study pages that render both.
'use client';

import { useMemo } from 'react';
import { geoEqualEarth, geoMercator, geoNaturalEarth1 } from 'd3-geo';
import type { GeoProjection } from 'd3-geo';
import countriesData from '@/data/countries.json';

const VIEW_W = 960;
const VIEW_H = 540;

// Measured fitSize([960, 540], <Natural Earth 110m countries>) outputs.
// Recompute and update if the topojson source or viewBox changes.
const PROJECTION_PARAMS: Record<
  'equalEarth' | 'mercator' | 'naturalEarth1',
  { scale: number; translate: [number, number] }
> = {
  equalEarth: { scale: 180.72423394560667, translate: [480, 268.92159182691324] },
  mercator: { scale: 89.51186989988287, translate: [480, 258.79016711320685] },
  naturalEarth1: { scale: 177.61248501421676, translate: [480, 266.123414440842] },
};

// Filled triangle pointing up, ~3.5px radius. Same shape as LandmarkLayer
// (US) so the kid sees a consistent "orange triangle = landmark" mental
// model across both maps.
const TRIANGLE_PATH = 'M 0,-4.2 L 3.6,2.4 -3.6,2.4 Z';

// Invisible larger hit target so clicking/hovering doesn't require pixel-
// perfect aim on the tiny triangle. Matches LandmarkLayer's pattern.
const HIT_RADIUS = 7;

type LandmarkRecord = {
  name: string;
  description?: string;
  fact?: string;
  latLon?: number[] | null;
};

type CountryRecord = {
  iso2: string;
  iso3: string;
  name: string;
  landmarks?: LandmarkRecord[];
};

export type WorldLandmarkLayerProps = {
  hidden?: boolean;
  onLandmarkHover?: (
    info: { country: string; iso2: string; name: string } | null,
  ) => void;
  onLandmarkClick?: (iso2: string) => void;
  // Inherit the same projection used by WorldMap. The page passes it through
  // so all overlays share one source of truth.
  projection?: 'equalEarth' | 'mercator' | 'naturalEarth1';
};

function createProjection(
  kind: WorldLandmarkLayerProps['projection'],
): GeoProjection {
  const params = PROJECTION_PARAMS[kind ?? 'equalEarth'];
  switch (kind) {
    case 'mercator':
      return geoMercator().scale(params.scale).translate(params.translate);
    case 'naturalEarth1':
      return geoNaturalEarth1().scale(params.scale).translate(params.translate);
    case 'equalEarth':
    default:
      return geoEqualEarth().scale(params.scale).translate(params.translate);
  }
}

export default function WorldLandmarkLayer({
  hidden,
  onLandmarkHover,
  onLandmarkClick,
  projection = 'equalEarth',
}: WorldLandmarkLayerProps) {
  const proj = useMemo(() => createProjection(projection), [projection]);

  // Flatten the country list into a single landmark array, dropping anything
  // without a valid [lat, lon] pair. Recomputes when the projection changes.
  const pins = useMemo(() => {
    const out: Array<{
      key: string;
      iso2: string;
      countryName: string;
      landmarkName: string;
      x: number;
      y: number;
    }> = [];
    (countriesData as CountryRecord[]).forEach((c) => {
      const lms = c.landmarks;
      if (!Array.isArray(lms) || lms.length === 0) return;
      lms.forEach((l, idx) => {
        if (!Array.isArray(l.latLon) || l.latLon.length < 2) return;
        const [lat, lon] = l.latLon as [number, number];
        if (typeof lat !== 'number' || typeof lon !== 'number') return;
        const projected = proj([lon, lat]);
        if (!projected) return;
        out.push({
          key: `${c.iso2}-${idx}-${l.name}`,
          iso2: c.iso2,
          countryName: c.name,
          landmarkName: l.name,
          x: projected[0],
          y: projected[1],
        });
      });
    });
    return out;
  }, [proj]);

  if (hidden) return null;

  return (
    <g className="world-map-landmark-layer">
      {pins.map((p) => (
        <g
          key={p.key}
          transform={`translate(${p.x}, ${p.y})`}
          style={{ cursor: onLandmarkClick ? 'pointer' : 'default' }}
          onMouseEnter={() =>
            onLandmarkHover?.({
              country: p.countryName,
              iso2: p.iso2,
              name: p.landmarkName,
            })
          }
          onMouseLeave={() => onLandmarkHover?.(null)}
          onClick={(e) => {
            e.stopPropagation();
            onLandmarkClick?.(p.iso2);
          }}
        >
          {/* Invisible larger hit target — drawn first so the visible triangle
              still renders on top. pointerEvents=all so it catches hover/click
              without needing a fill. */}
          <circle r={HIT_RADIUS} fill="transparent" pointerEvents="all" />
          <path
            d={TRIANGLE_PATH}
            fill="#ea580c"
            stroke="#7c2d12"
            strokeWidth={0.7}
            strokeLinejoin="round"
            pointerEvents="none"
          />
          <title>
            {p.landmarkName} ({p.countryName})
          </title>
        </g>
      ))}
    </g>
  );
}
