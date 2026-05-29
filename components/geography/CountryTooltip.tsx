// Hover tooltip for the world map. Mirrors StateTooltip but tuned for the
// world-section visual palette (sky/indigo accent rather than emerald/teal).
//
// Mode controls what's shown in the main block:
//   'both'      — country name + capital (study mode default)
//   'name'      — just country name (capital quiz hover)
//   'capital'   — just capital (country-name quiz hover)
//
// Optional `extra` adds a second block underneath with bonus context
// (continent, population) — used by the staged-reveal tooltip on the
// world study map.
'use client';

export type CountryTooltipMode = 'both' | 'name' | 'capital';

export type CountryTooltipExtra = {
  continent?: string;
  population?: number;
  area?: number;
};

interface CountryTooltipProps {
  name: string;
  capital: string;
  x: number;
  y: number;
  mode?: CountryTooltipMode;
  extra?: CountryTooltipExtra;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

export default function CountryTooltip({
  name,
  capital,
  x,
  y,
  mode = 'both',
  extra,
}: CountryTooltipProps) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50 rounded-lg bg-white px-3 py-2 text-sm shadow-lg ring-1 ring-sky-200 animate-fadeIn"
      style={{ left: x + 14, top: y + 14 }}
    >
      {mode === 'both' && (
        <>
          <div className="font-bold text-sky-800">{name}</div>
          <div className="text-xs text-gray-600">Capital: {capital}</div>
        </>
      )}
      {mode === 'name' && <div className="font-bold text-sky-800">{name}</div>}
      {mode === 'capital' && <div className="font-bold text-sky-800">{capital}</div>}

      {extra && (
        <div className="mt-1.5 pt-1.5 border-t border-sky-100 text-xs text-gray-700 space-y-0.5">
          {extra.continent && (
            <div>
              <span className="text-gray-500">Continent:</span>{' '}
              <span className="italic">{extra.continent}</span>
            </div>
          )}
          {typeof extra.population === 'number' && (
            <div>
              <span className="text-gray-500">Population:</span>{' '}
              {formatNumber(extra.population)}
            </div>
          )}
          {typeof extra.area === 'number' && (
            <div>
              <span className="text-gray-500">Area:</span>{' '}
              {formatNumber(extra.area)} km²
            </div>
          )}
        </div>
      )}
    </div>
  );
}
