// WorldPhysicalLayer — projects hand-authored rivers/lakes/mountain-ranges/
// deserts coords through the SAME projection WorldMap uses (geoEqualEarth /
// geoMercator / geoNaturalEarth1), then renders SVG polylines/polygons + labels.
//
// Renders into WorldMap's existing 960×540 viewBox. Re-creates the projection
// using the exact same fitSize() parameters WorldLandmarkLayer uses (see
// PROJECTION_PARAMS) so features line up without re-fetching the topojson.
//
// Layering inside WorldMap's SVG:
//   <rect ocean>          ← bottom
//   <path country>        ← country shapes
//   <WorldPhysicalLayer/> ← THIS (sits over country fills so features draw on top)
//   <WorldLandmarkLayer/> ← pins
//   <text country names>  ← labels on top
//
// All shapes are pointerEvents="none" so they don't intercept country
// hover/click.
'use client';

import { useMemo } from 'react';
import { geoEqualEarth, geoMercator, geoNaturalEarth1 } from 'd3-geo';
import type { GeoProjection } from 'd3-geo';
import {
  WORLD_RIVERS,
  WORLD_LAKES,
  WORLD_MOUNTAIN_RANGES,
  WORLD_DESERTS,
  type LatLon,
} from './worldPhysicalFeaturesData';

// Same fitSize-derived projection parameters as WorldLandmarkLayer. Keep in
// sync if WorldMap's viewBox or topojson changes.
const PROJECTION_PARAMS: Record<
  'equalEarth' | 'mercator' | 'naturalEarth1',
  { scale: number; translate: [number, number] }
> = {
  equalEarth: { scale: 180.72423394560667, translate: [480, 268.92159182691324] },
  mercator: { scale: 89.51186989988287, translate: [480, 258.79016711320685] },
  naturalEarth1: { scale: 177.61248501421676, translate: [480, 266.123414440842] },
};

// Colors — same general palette as the US PhysicalLayer for cross-map
// consistency. Deserts get a sandy tan with very low opacity so country
// outlines remain visible — the goal is "you can see the dry zones," not
// "the desert dominates the map."
const RIVER_STROKE = '#0284c7';      // sky-600
const LAKE_FILL = '#bae6fd';         // sky-200
const LAKE_STROKE = '#0369a1';       // sky-700
const MOUNTAIN_FILL = '#a8a29e';     // stone-400
const MOUNTAIN_STROKE = '#78716c';   // stone-500
const DESERT_FILL = '#fde68a';       // amber-200 — sandy tan
const DESERT_STROKE = '#d97706';     // amber-600

const RIVER_LABEL_FILL = '#075985';     // sky-800
const LAKE_LABEL_FILL = '#075985';      // sky-800
const MOUNTAIN_LABEL_FILL = '#44403c';  // stone-700
const DESERT_LABEL_FILL = '#92400e';    // amber-800

export type WorldPhysicalLayerProps = {
  hidden?: boolean;
  showRivers?: boolean;
  showLakes?: boolean;
  showMountains?: boolean;
  showDeserts?: boolean;
  // Inherit the same projection WorldMap renders with so coordinates align.
  projection?: 'equalEarth' | 'mercator' | 'naturalEarth1';
};

function createProjection(
  kind: WorldPhysicalLayerProps['projection'],
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

// Project a list of [lat, lon] into an SVG points= string. Skips individual
// points the projection returns null for. Returns null if fewer than 2
// points project on-map.
function projectPoints(
  points: readonly LatLon[],
  project: (coord: [number, number]) => [number, number] | null,
): string | null {
  const out: string[] = [];
  for (const [lat, lon] of points) {
    const p = project([lon, lat]); // d3-geo wants [lon, lat]
    if (!p) continue;
    out.push(`${p[0].toFixed(2)},${p[1].toFixed(2)}`);
  }
  if (out.length < 2) return null;
  return out.join(' ');
}

// Polyline midpoint for rivers; vertex-average centroid for polygons.
function labelAnchor(
  points: readonly LatLon[],
  project: (coord: [number, number]) => [number, number] | null,
  mode: 'midpoint' | 'centroid',
): [number, number] | null {
  const projected: Array<[number, number]> = [];
  for (const [lat, lon] of points) {
    const p = project([lon, lat]);
    if (!p) continue;
    projected.push([p[0], p[1]]);
  }
  if (projected.length < 1) return null;
  if (mode === 'midpoint') {
    return projected[Math.floor(projected.length / 2)] ?? null;
  }
  let sx = 0;
  let sy = 0;
  for (const [x, y] of projected) {
    sx += x;
    sy += y;
  }
  return [sx / projected.length, sy / projected.length];
}

export default function WorldPhysicalLayer({
  hidden = false,
  showRivers = true,
  showLakes = true,
  showMountains = true,
  showDeserts = true,
  projection = 'equalEarth',
}: WorldPhysicalLayerProps) {
  const proj = useMemo(() => createProjection(projection), [projection]);

  const rivers = useMemo(
    () =>
      WORLD_RIVERS.map((r) => ({
        name: r.name,
        d: projectPoints(r.points, proj),
        anchor: labelAnchor(r.points, proj, 'midpoint'),
      })).filter(
        (r): r is { name: string; d: string; anchor: [number, number] | null } =>
          r.d !== null,
      ),
    [proj],
  );

  const lakes = useMemo(
    () =>
      WORLD_LAKES.map((l) => ({
        name: l.name,
        d: projectPoints(l.points, proj),
        anchor: labelAnchor(l.points, proj, 'centroid'),
      })).filter(
        (l): l is { name: string; d: string; anchor: [number, number] | null } =>
          l.d !== null,
      ),
    [proj],
  );

  const mountains = useMemo(
    () =>
      WORLD_MOUNTAIN_RANGES.map((m) => ({
        name: m.name,
        d: projectPoints(m.points, proj),
        anchor: labelAnchor(m.points, proj, 'centroid'),
      })).filter(
        (m): m is { name: string; d: string; anchor: [number, number] | null } =>
          m.d !== null,
      ),
    [proj],
  );

  const deserts = useMemo(
    () =>
      WORLD_DESERTS.map((d) => ({
        name: d.name,
        d: projectPoints(d.points, proj),
        anchor: labelAnchor(d.points, proj, 'centroid'),
      })).filter(
        (d): d is { name: string; d: string; anchor: [number, number] | null } =>
          d.d !== null,
      ),
    [proj],
  );

  if (hidden) return null;

  return (
    <g className="world-map-physical-layer" pointerEvents="none">
      {/* Deserts first — very low opacity wash so country outlines + borders
          remain visible underneath. */}
      {showDeserts &&
        deserts.map((d) => (
          <polygon
            key={`desert-${d.name}`}
            points={d.d}
            fill={DESERT_FILL}
            fillOpacity={0.25}
            stroke={DESERT_STROKE}
            strokeOpacity={0.35}
            strokeWidth={0.5}
            strokeDasharray="2 2"
          >
            <title>{d.name}</title>
          </polygon>
        ))}

      {/* Mountains next so rivers and lakes draw over them where they cross. */}
      {showMountains &&
        mountains.map((m) => (
          <polygon
            key={`mtn-${m.name}`}
            points={m.d}
            fill={MOUNTAIN_FILL}
            fillOpacity={0.35}
            stroke={MOUNTAIN_STROKE}
            strokeOpacity={0.5}
            strokeWidth={0.5}
          >
            <title>{m.name}</title>
          </polygon>
        ))}

      {showRivers &&
        rivers.map((r) => (
          <polyline
            key={`river-${r.name}`}
            points={r.d}
            fill="none"
            stroke={RIVER_STROKE}
            strokeWidth={1.0}
            strokeOpacity={0.75}
            strokeLinejoin="round"
            strokeLinecap="round"
          >
            <title>{r.name}</title>
          </polyline>
        ))}

      {showLakes &&
        lakes.map((l) => (
          <polygon
            key={`lake-${l.name}`}
            points={l.d}
            fill={LAKE_FILL}
            fillOpacity={0.9}
            stroke={LAKE_STROKE}
            strokeOpacity={0.7}
            strokeWidth={0.6}
          >
            <title>{l.name}</title>
          </polygon>
        ))}

      {/* Labels — drawn LAST so they sit on top of every shape. Small italic
          text with a white halo (paintOrder: stroke) for legibility against
          continent tints. */}
      {showDeserts &&
        deserts.map((d) =>
          d.anchor ? (
            <text
              key={`desert-lbl-${d.name}`}
              x={d.anchor[0]}
              y={d.anchor[1]}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={7}
              fontStyle="italic"
              fill={DESERT_LABEL_FILL}
              fillOpacity={0.85}
              stroke="#ffffff"
              strokeWidth={1.8}
              strokeOpacity={0.7}
              paintOrder="stroke"
              style={{ userSelect: 'none' }}
            >
              {d.name}
            </text>
          ) : null,
        )}

      {showMountains &&
        mountains.map((m) =>
          m.anchor ? (
            <text
              key={`mtn-lbl-${m.name}`}
              x={m.anchor[0]}
              y={m.anchor[1]}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={7}
              fontStyle="italic"
              fill={MOUNTAIN_LABEL_FILL}
              fillOpacity={0.85}
              stroke="#ffffff"
              strokeWidth={1.8}
              strokeOpacity={0.7}
              paintOrder="stroke"
              style={{ userSelect: 'none' }}
            >
              {m.name}
            </text>
          ) : null,
        )}

      {showRivers &&
        rivers.map((r) =>
          r.anchor ? (
            <text
              key={`river-lbl-${r.name}`}
              x={r.anchor[0]}
              y={r.anchor[1]}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={7}
              fontStyle="italic"
              fill={RIVER_LABEL_FILL}
              fillOpacity={0.9}
              stroke="#ffffff"
              strokeWidth={1.8}
              strokeOpacity={0.75}
              paintOrder="stroke"
              style={{ userSelect: 'none' }}
            >
              {r.name}
            </text>
          ) : null,
        )}

      {showLakes &&
        lakes.map((l) =>
          l.anchor ? (
            <text
              key={`lake-lbl-${l.name}`}
              x={l.anchor[0]}
              y={l.anchor[1]}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={7}
              fontStyle="italic"
              fill={LAKE_LABEL_FILL}
              fillOpacity={0.9}
              stroke="#ffffff"
              strokeWidth={1.8}
              strokeOpacity={0.75}
              paintOrder="stroke"
              style={{ userSelect: 'none' }}
            >
              {l.name}
            </text>
          ) : null,
        )}
    </g>
  );
}
