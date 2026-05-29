// State capital stars + names positioned via Albers USA projection.
//
// Stars always render at the true capital geographic location.
// Capital NAMES sit just below the star — EXCEPT for tiny NE states where
// the state name is rendered externally (see EXTERNAL_LABELS in LabelLayer).
// For those, the capital name follows the state name to the external anchor
// so both labels stay grouped together in readable space.
'use client';

import { useMemo } from 'react';
import { geoAlbersUsa } from 'd3-geo';
import statesData from '@/data/states.json';
import { EXTERNAL_LABELS } from './LabelLayer';

type StateRecord = {
  postal: string;
  name: string;
  capital: string;
  capitalLatLon: number[];
  centroidLatLon: number[];
};

interface CapitalLayerProps {
  hiddenCapitalNames?: Set<string>;
  showStars?: boolean;
  showNames?: boolean;
}

const VIEW_W = 959;
const VIEW_H = 593;

const STAR_PATH =
  'M 0,-6 L 1.76,-1.85 6,-1.85 2.62,0.71 3.71,5 0,2.43 -3.71,5 -2.62,0.71 -6,-1.85 -1.76,-1.85 Z';

export default function CapitalLayer({
  hiddenCapitalNames,
  showStars = true,
  showNames = true,
}: CapitalLayerProps) {
  const projection = useMemo(
    () => geoAlbersUsa().scale(1280).translate([VIEW_W / 2, VIEW_H / 2]),
    [],
  );

  const capitals = useMemo(() => {
    return (statesData as StateRecord[])
      .map((s) => {
        const [capLat, capLon] = s.capitalLatLon;
        const [cenLat, cenLon] = s.centroidLatLon;
        const projectedCap = projection([capLon, capLat]);
        const projectedCen = projection([cenLon, cenLat]);
        if (!projectedCap || !projectedCen) return null;
        const ext = EXTERNAL_LABELS[s.postal];
        // Name position: under the external state name (if external), else
        // 12px below the star.
        const namePos = ext
          ? {
              x: projectedCen[0] + ext[0],
              y: projectedCen[1] + ext[1] + 11, // ~one line below the state name
            }
          : { x: projectedCap[0], y: projectedCap[1] + 12 };
        return {
          postal: s.postal,
          capital: s.capital,
          starX: projectedCap[0],
          starY: projectedCap[1],
          nameX: namePos.x,
          nameY: namePos.y,
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);
  }, [projection]);

  return (
    <g className="us-map-capital-layer" pointerEvents="none">
      {capitals.map((c) => (
        <g key={c.postal}>
          {showStars && (
            <path
              d={STAR_PATH}
              transform={`translate(${c.starX}, ${c.starY})`}
              fill="#facc15"
              stroke="#78350f"
              strokeWidth={0.6}
              strokeLinejoin="round"
            />
          )}
          {showNames && (
            <text
              x={c.nameX}
              y={c.nameY}
              textAnchor="middle"
              fontSize={7.5}
              fontWeight={500}
              fill="#1f2937"
              stroke="#ffffff"
              strokeWidth={2}
              paintOrder="stroke"
              style={{ display: hiddenCapitalNames?.has(c.postal) ? 'none' : undefined }}
            >
              {c.capital}
            </text>
          )}
        </g>
      ))}
    </g>
  );
}
