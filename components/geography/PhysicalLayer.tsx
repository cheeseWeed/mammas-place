// PhysicalLayer — projects hand-authored rivers/lakes/mountain-range coords
// through the SAME geoAlbersUsa projection USMap uses for capitals + labels,
// then renders SVG polylines/polygons.
//
// Renders into USMap's existing 959×593 viewBox. Wraps everything in the
// same `translate(-3, -5)` drift correction CapitalLayer uses so the
// features line up with the painted state outlines.
//
// Layering inside the parent SVG matters:
//   <PoliticalSVG> ← states (bottom)
//   <PhysicalLayer> ← THIS (sits over the states so rivers/lakes draw on the map)
//   <CapitalLayer>  ← stars + names (on top)
//   <LabelLayer>    ← state names (on top)
//
// All shapes are pointerEvents="none" so they don't intercept state hover/click.
'use client';

import { useMemo } from 'react';
import { geoAlbersUsa } from 'd3-geo';
import { RIVERS, LAKES, MOUNTAIN_RANGES, type LatLon } from './physicalFeaturesData';

const VIEW_W = 959;
const VIEW_H = 593;

export type PhysicalLayerProps = {
  hidden?: boolean;
  showRivers?: boolean;
  showLakes?: boolean;
  showMountains?: boolean;
};

// Colors — picked to look "geographic" while staying lighter than the
// region tints USMap paints behind them so state outlines remain readable.
const RIVER_STROKE = '#0284c7';     // sky-600 — clearly blue but not navy
const LAKE_FILL = '#bae6fd';        // sky-200
const LAKE_STROKE = '#0369a1';      // sky-700
const MOUNTAIN_FILL = '#a8a29e';    // stone-400 — muted tan/gray
const MOUNTAIN_STROKE = '#78716c';  // stone-500

// Label colors — italic small text so it reads as "natural feature" rather
// than competing with the state names painted by LabelLayer.
const RIVER_LABEL_FILL = '#075985';     // sky-800
const LAKE_LABEL_FILL = '#075985';      // sky-800
const MOUNTAIN_LABEL_FILL = '#44403c';  // stone-700

// Convert a list of [lat, lon] into "x,y x,y x,y" suitable for an SVG
// points= attribute. Returns null if NO points project (off-map). Drops
// individual points the projection returns null for (e.g. coords outside
// the Albers USA composite region).
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

// For a polyline (river), pick the middle projected point as the label
// anchor. For a closed polygon (lake / mountain range), average all
// projected points to get a rough centroid. Returns null if not enough
// points project on-map.
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
  // Simple arithmetic mean of vertices. Not the polygon's true centroid, but
  // good enough for "where to put a name" on a kid map.
  let sx = 0;
  let sy = 0;
  for (const [x, y] of projected) {
    sx += x;
    sy += y;
  }
  return [sx / projected.length, sy / projected.length];
}

export default function PhysicalLayer({
  hidden = false,
  showRivers = true,
  showLakes = true,
  showMountains = true,
}: PhysicalLayerProps) {
  // Same projection settings as CapitalLayer — scale 1280, centered in the
  // 959×593 viewBox. The translate(-3, -5) wrapper handles the drift.
  const projection = useMemo(
    () => geoAlbersUsa().scale(1280).translate([VIEW_W / 2, VIEW_H / 2]),
    [],
  );

  const rivers = useMemo(
    () =>
      RIVERS.map((r) => ({
        name: r.name,
        d: projectPoints(r.points, projection),
        anchor: labelAnchor(r.points, projection, 'midpoint'),
      })).filter(
        (r): r is { name: string; d: string; anchor: [number, number] | null } =>
          r.d !== null,
      ),
    [projection],
  );

  const lakes = useMemo(
    () =>
      LAKES.map((l) => ({
        name: l.name,
        d: projectPoints(l.points, projection),
        anchor: labelAnchor(l.points, projection, 'centroid'),
      })).filter(
        (l): l is { name: string; d: string; anchor: [number, number] | null } =>
          l.d !== null,
      ),
    [projection],
  );

  const mountains = useMemo(
    () =>
      MOUNTAIN_RANGES.map((m) => ({
        name: m.name,
        d: projectPoints(m.points, projection),
        anchor: labelAnchor(m.points, projection, 'centroid'),
      })).filter(
        (m): m is { name: string; d: string; anchor: [number, number] | null } =>
          m.d !== null,
      ),
    [projection],
  );

  if (hidden) return null;

  return (
    <g
      className="us-map-physical-layer"
      pointerEvents="none"
      transform="translate(-3, -5)"
    >
      {/* Mountains first so rivers and lakes draw over them where they cross. */}
      {showMountains &&
        mountains.map((m) => (
          <polygon
            key={`mtn-${m.name}`}
            points={m.d}
            fill={MOUNTAIN_FILL}
            fillOpacity={0.35}
            stroke={MOUNTAIN_STROKE}
            strokeOpacity={0.5}
            strokeWidth={0.6}
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
            strokeWidth={1.2}
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
            strokeWidth={0.7}
          >
            <title>{l.name}</title>
          </polygon>
        ))}

      {/* Labels — rendered LAST so they sit on top of every feature.
          Small italic text, semi-transparent. Drawn with a thin white
          stroke (paintOrder: stroke) for legibility against tinted
          regions, same trick LabelLayer uses for state names. */}
      {showMountains &&
        mountains.map((m) =>
          m.anchor ? (
            <text
              key={`mtn-lbl-${m.name}`}
              x={m.anchor[0]}
              y={m.anchor[1]}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={8}
              fontStyle="italic"
              fill={MOUNTAIN_LABEL_FILL}
              fillOpacity={0.85}
              stroke="#ffffff"
              strokeWidth={2}
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
              fontSize={8}
              fontStyle="italic"
              fill={RIVER_LABEL_FILL}
              fillOpacity={0.9}
              stroke="#ffffff"
              strokeWidth={2}
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
              fontSize={8}
              fontStyle="italic"
              fill={LAKE_LABEL_FILL}
              fillOpacity={0.9}
              stroke="#ffffff"
              strokeWidth={2}
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
