// Landmark pins positioned via the SAME d3-geo Albers USA projection used by
// CapitalLayer and LabelLayer. Reads landmarks from states.json — only entries
// with type === 'landmark' AND a [lat, lon] latLon array are projected.
//
// Visual: small orange triangle (▲ shape) with a thin dark stroke. Distinct
// from capital stars (yellow) and state outlines. Hover/click fire callbacks
// the parent (study page) uses to drive its tooltip + drawer state.
//
// Alignment: shares the same `translate(-3, -5)` nudge as the other layers so
// pins line up with the painted state outlines, not d3-geo's default Albers
// projection (which drifts a few pixels from the source SVG).
'use client';

import { useMemo } from 'react';
import { geoAlbersUsa } from 'd3-geo';
import statesData from '@/data/states.json';

type PhysicalFeature = {
  name: string;
  type: string;
  description?: string;
  fact?: string;
  latLon?: number[] | null;
};

type StateRecord = {
  postal: string;
  name: string;
  physicalFeatures?: PhysicalFeature[];
};

export type LandmarkLayerProps = {
  onLandmarkHover?: (landmark: { state: string; name: string } | null) => void;
  onLandmarkClick?: (state: string) => void;
  hidden?: boolean;
};

const VIEW_W = 959;
const VIEW_H = 593;

// Filled triangle pointing up, ~3.5px radius. Drawn around (0,0) so the
// transform translate places the centroid on the geocoded point.
const TRIANGLE_PATH = 'M 0,-4.2 L 3.6,2.4 -3.6,2.4 Z';

// Invisible larger hit target so clicking/hovering doesn't require pixel-
// perfect aim on the tiny 3-4px triangle.
const HIT_RADIUS = 7;

export default function LandmarkLayer({
  onLandmarkHover,
  onLandmarkClick,
  hidden,
}: LandmarkLayerProps) {
  const projection = useMemo(
    () => geoAlbersUsa().scale(1280).translate([VIEW_W / 2, VIEW_H / 2]),
    [],
  );

  const landmarks = useMemo(() => {
    const out: Array<{ key: string; postal: string; name: string; x: number; y: number }> = [];
    (statesData as StateRecord[]).forEach((s) => {
      const feats = s.physicalFeatures;
      if (!Array.isArray(feats)) return;
      feats.forEach((f, idx) => {
        if (f.type !== 'landmark') return;
        if (!Array.isArray(f.latLon) || f.latLon.length < 2) return;
        const [lat, lon] = f.latLon as [number, number];
        if (typeof lat !== 'number' || typeof lon !== 'number') return;
        const projected = projection([lon, lat]);
        if (!projected) return;
        out.push({
          key: `${s.postal}-${idx}-${f.name}`,
          postal: s.postal,
          name: f.name,
          x: projected[0],
          y: projected[1],
        });
      });
    });
    return out;
  }, [projection]);

  if (hidden) return null;

  return (
    <g className="us-map-landmark-layer" transform="translate(-3, -5)">
      {landmarks.map((l) => (
        <g
          key={l.key}
          transform={`translate(${l.x}, ${l.y})`}
          style={{ cursor: onLandmarkClick ? 'pointer' : 'default' }}
          onMouseEnter={() => onLandmarkHover?.({ state: l.postal, name: l.name })}
          onMouseLeave={() => onLandmarkHover?.(null)}
          onClick={(e) => {
            e.stopPropagation();
            onLandmarkClick?.(l.postal);
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
        </g>
      ))}
    </g>
  );
}
