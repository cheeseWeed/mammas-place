// State name labels positioned via Albers USA projection over the political SVG.
//
// Tiny NE states use external labels: state name (and capital name when shown)
// render outside the state with a leader line connecting back to the state
// centroid. Capital STARS stay at their true geographic location regardless
// — only the text labels relocate.
//
// External-label state list is shared with CapitalLayer (which reads
// EXTERNAL_LABELS to know where to render its capital text for these states).
'use client';

import { useMemo } from 'react';
import { geoAlbersUsa } from 'd3-geo';
import statesData from '@/data/states.json';

type StateRecord = {
  postal: string;
  name: string;
  capital: string;
  capitalLatLon: number[];
  centroidLatLon: number[];
};

interface LabelLayerProps {
  hiddenStateLabels?: Set<string>;
}

const VIEW_W = 959;
const VIEW_H = 593;

// External-label states: postal → [dx, dy] offset from state centroid to the
// label anchor (state name). Capital name renders just below this position.
// Tuned by eye for the 959x593 viewBox.
export const EXTERNAL_LABELS: Record<string, [number, number]> = {
  ME: [60, -20],
  NH: [70, 0],
  VT: [-50, -10],
  MA: [85, 18],
  RI: [80, 35],
  CT: [40, 55],
  NJ: [65, 60],
  DE: [75, 80],
  MD: [-30, 100],
  DC: [40, 110],
};

export default function LabelLayer({ hiddenStateLabels }: LabelLayerProps) {
  const projection = useMemo(
    () => geoAlbersUsa().scale(1280).translate([VIEW_W / 2, VIEW_H / 2]),
    [],
  );

  const labels = useMemo(() => {
    return (statesData as StateRecord[])
      .map((s) => {
        const [lat, lon] = s.centroidLatLon;
        const projected = projection([lon, lat]);
        if (!projected) return null;
        const ext = EXTERNAL_LABELS[s.postal];
        return {
          postal: s.postal,
          name: s.name,
          cx: projected[0],
          cy: projected[1],
          lx: ext ? projected[0] + ext[0] : projected[0],
          ly: ext ? projected[1] + ext[1] : projected[1],
          external: !!ext,
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);
  }, [projection]);

  return (
    <g className="us-map-label-layer" pointerEvents="none">
      {labels.map((l) => {
        if (hiddenStateLabels?.has(l.postal)) return null;
        return (
          <g key={l.postal}>
            {l.external && (
              <>
                <line
                  x1={l.cx}
                  y1={l.cy}
                  x2={l.lx}
                  y2={l.ly}
                  stroke="#6b7280"
                  strokeWidth={0.6}
                  opacity={0.7}
                />
                <circle cx={l.cx} cy={l.cy} r={1.2} fill="#6b7280" opacity={0.8} />
              </>
            )}
            <text
              x={l.lx}
              y={l.ly}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={l.external ? 8 : 9}
              fontWeight={600}
              fill="#1f2937"
              stroke="#ffffff"
              strokeWidth={2.5}
              paintOrder="stroke"
            >
              {l.name}
            </text>
          </g>
        );
      })}
    </g>
  );
}
