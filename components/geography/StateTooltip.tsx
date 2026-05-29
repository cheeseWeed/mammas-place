// Hover tooltip that floats near the cursor.
//
// Mode controls what's shown in the main block:
//   'both'    — state name + capital (study mode default)
//   'name'    — state name only (capital quiz hover: reveal the state)
//   'capital' — capital only (state quiz hover: reveal the capital)
//
// Optional `extra` adds a second block underneath with bonus context
// (nickname, region, population) — used by the staged-reveal tooltip on
// the study map.
'use client';

export type TooltipMode = 'both' | 'name' | 'capital';

export type TooltipExtra = {
  nickname?: string;
  region?: string;
  population?: number;
};

interface StateTooltipProps {
  name: string;
  capital: string;
  x: number;
  y: number;
  mode?: TooltipMode;
  extra?: TooltipExtra;
}

function formatPopulation(n: number): string {
  return n.toLocaleString();
}

export default function StateTooltip({
  name,
  capital,
  x,
  y,
  mode = 'both',
  extra,
}: StateTooltipProps) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50 rounded-lg bg-white px-3 py-2 text-sm shadow-lg ring-1 ring-purple-200 animate-fadeIn"
      style={{ left: x + 14, top: y + 14 }}
    >
      {mode === 'both' && (
        <>
          <div className="font-bold text-purple-800">{name}</div>
          <div className="text-xs text-gray-600">Capital: {capital}</div>
        </>
      )}
      {mode === 'name' && <div className="font-bold text-purple-800">{name}</div>}
      {mode === 'capital' && <div className="font-bold text-purple-800">{capital}</div>}

      {extra && (
        <div className="mt-1.5 pt-1.5 border-t border-purple-100 text-xs text-gray-700 space-y-0.5">
          {extra.nickname && (
            <div>
              <span className="text-gray-500">Nickname:</span>{' '}
              <span className="italic">{extra.nickname}</span>
            </div>
          )}
          {extra.region && (
            <div>
              <span className="text-gray-500">Region:</span> {extra.region}
            </div>
          )}
          {typeof extra.population === 'number' && (
            <div>
              <span className="text-gray-500">Population:</span>{' '}
              {formatPopulation(extra.population)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
