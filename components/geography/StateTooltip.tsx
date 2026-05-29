// Hover tooltip that floats near the cursor.
//
// Mode controls what's shown:
//   'both'    — state name + capital (study mode default)
//   'name'    — state name only (capital quiz hover: reveal the state)
//   'capital' — capital only (state quiz hover: reveal the capital)
'use client';

export type TooltipMode = 'both' | 'name' | 'capital';

interface StateTooltipProps {
  name: string;
  capital: string;
  x: number;
  y: number;
  mode?: TooltipMode;
}

export default function StateTooltip({
  name,
  capital,
  x,
  y,
  mode = 'both',
}: StateTooltipProps) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50 rounded-lg bg-white px-3 py-2 text-sm shadow-lg ring-1 ring-purple-200"
      style={{ left: x + 14, top: y + 14 }}
    >
      {mode === 'both' && (
        <>
          <div className="font-bold text-purple-800">{name}</div>
          <div className="text-xs text-gray-600">Capital: {capital}</div>
        </>
      )}
      {mode === 'name' && (
        <div className="font-bold text-purple-800">{name}</div>
      )}
      {mode === 'capital' && (
        <div className="font-bold text-purple-800">{capital}</div>
      )}
    </div>
  );
}
