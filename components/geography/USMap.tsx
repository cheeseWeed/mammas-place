// USMap — orchestrates the political SVG base + capital/label layers + interactivity.
'use client';

import { useEffect, useRef, useState } from 'react';
import statesData from '@/data/states.json';
import LabelLayer from './LabelLayer';
import CapitalLayer from './CapitalLayer';
import LandmarkLayer from './LandmarkLayer';
import PhysicalLayer from './PhysicalLayer';

type StateRecord = {
  postal: string;
  name: string;
  capital: string;
  capitalLatLon: number[];
  centroidLatLon: number[];
};

export type USMapProps = {
  // Fine-grained: hide specific state name / capital name labels by postal.
  hiddenStateLabels?: Set<string>;
  hiddenCapitalNames?: Set<string>;
  // Coarse toggles (override the hidden sets when explicitly false → hide all).
  showStateLabels?: boolean;
  showCapitalNames?: boolean;
  showCapitalStars?: boolean;
  showPhysicalLayer?: boolean;
  // Landmark pin layer. Opt-in (default off). When on, renders one orange
  // triangle per geocoded landmark via LandmarkLayer. Click fires
  // onLandmarkClick with the state postal so callers can open a drawer.
  showLandmarks?: boolean;
  onLandmarkClick?: (statePostal: string) => void;
  onStateClick?: (postal: string) => void;
  onStateHover?: (postal: string | null) => void;
  // Phase 6.5 (Distance Measure): fires on ANY click within the SVG with the
  // click's coordinates converted to SVG viewBox space (0..VIEW_W, 0..VIEW_H).
  // Fires alongside onStateClick when a state is clicked. Use this for
  // arbitrary-point interactions like distance measurement. Use the helper
  // svgPointToLatLon() from lib/geography/distance.ts to map the result back
  // to lat/lon.
  onMapPointerClick?: (svgX: number, svgY: number) => void;
  // Phase 6.5: optional children rendered INSIDE the SVG (above the political
  // base, alongside the capital/label/landmark layers). Use this to inject
  // overlays like DistanceTool that need to share the SVG coordinate space.
  svgChildren?: React.ReactNode;
  highlightedStates?: Set<string>;
  wrongStates?: Set<string>;
  // Per-state region tints. Each entry is a postal → region name (e.g.
  // 'Northeast'). USMap looks up the tint color from REGION_TINTS.
  // Quiz mode: pass only the active region's states. Study mode: pass all
  // 50 keyed by their region so the whole map is color-coded.
  // Wrong/highlighted state colors always win over the regional tint.
  regionTints?: Map<string, string>;
  className?: string;
};

const VIEW_W = 959;
const VIEW_H = 593;
const SVG_URL = '/geography/us-states-political.svg';

// Fill colors per state mode. Hover handled via CSS (filter).
const FILL_DEFAULT = '#e5e7eb';
const FILL_HIGHLIGHT = '#86efac';
const FILL_WRONG = '#fca5a5';

// Per-region tints. Soft enough that labels stay readable. Picked to be
// visually distinct from each other AND from the quiz feedback colors
// (green/red) so a state's feedback flash always reads clearly.
export const REGION_TINTS: Record<string, string> = {
  Northeast: '#fde68a',  // amber-200
  Midwest: '#bae6fd',    // sky-200
  South: '#fbcfe8',      // pink-200
  West: '#bbf7d0',       // emerald-200
};

// Extracts the inner SVG markup and strips out <title> children so the browser
// doesn't render its own native tooltip on top of our React StateTooltip.
function extractInnerSvg(raw: string): string {
  const openMatch = raw.match(/<svg[^>]*>/i);
  const closeIdx = raw.lastIndexOf('</svg>');
  if (!openMatch || closeIdx === -1) return raw;
  const start = openMatch.index! + openMatch[0].length;
  const inner = raw.slice(start, closeIdx);
  return inner.replace(/<title>[^<]*<\/title>/g, '');
}

export default function USMap({
  hiddenStateLabels,
  hiddenCapitalNames,
  showStateLabels = true,
  showCapitalNames = true,
  showCapitalStars = true,
  showPhysicalLayer = false,
  showLandmarks = false,
  onLandmarkClick,
  onStateClick,
  onStateHover,
  onMapPointerClick,
  svgChildren,
  highlightedStates,
  wrongStates,
  regionTints,
  className,
}: USMapProps) {
  const containerRef = useRef<SVGGElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);
  const states = statesData as StateRecord[];

  // Phase 6.5: convert a screen-space click to SVG viewBox coordinates and
  // forward to onMapPointerClick. Uses getBoundingClientRect + the SVG's
  // intrinsic viewBox (which we know is VIEW_W x VIEW_H with xMidYMid meet
  // preservation). Accounts for letterboxing: the SVG is centered within
  // its bounding box and scaled uniformly to fit, so the actual rendered
  // map may not fill the entire client rect.
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onMapPointerClick) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    // Uniform scale to fit (preserveAspectRatio="xMidYMid meet"): the smaller
    // of the two axis ratios wins; the other axis is letterboxed.
    const scale = Math.min(rect.width / VIEW_W, rect.height / VIEW_H);
    if (!scale || !Number.isFinite(scale)) return;
    const renderedW = VIEW_W * scale;
    const renderedH = VIEW_H * scale;
    const padX = (rect.width - renderedW) / 2;
    const padY = (rect.height - renderedH) / 2;
    const svgX = (e.clientX - rect.left - padX) / scale;
    const svgY = (e.clientY - rect.top - padY) / scale;
    // Clamp to viewBox; clicks in the letterbox area still report nearest edge.
    if (svgX < 0 || svgY < 0 || svgX > VIEW_W || svgY > VIEW_H) return;
    onMapPointerClick(svgX, svgY);
  };

  // Load the raw political SVG once on mount.
  useEffect(() => {
    let cancelled = false;
    fetch(SVG_URL)
      .then((r) => r.text())
      .then((raw) => {
        if (!cancelled) setSvgMarkup(extractInnerSvg(raw));
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('USMap: failed to load political SVG', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // After the inner SVG markup mounts, attach event handlers + apply fills.
  useEffect(() => {
    const root = containerRef.current;
    if (!root || !svgMarkup) return;

    const elements = root.querySelectorAll<SVGGraphicsElement>('[id]');
    const validPostals = new Set(states.map((s) => s.postal));
    const cleanups: Array<() => void> = [];

    elements.forEach((el) => {
      const postal = el.id?.toUpperCase();
      if (!postal || !validPostals.has(postal)) return;

      // Fill priority: wrong > highlight > region tint > default.
      let fill = FILL_DEFAULT;
      const tint = regionTints?.get(postal);
      if (tint) fill = tint;
      if (highlightedStates?.has(postal)) fill = FILL_HIGHLIGHT;
      if (wrongStates?.has(postal)) fill = FILL_WRONG;
      el.setAttribute('fill', fill);
      el.style.transition = 'fill 200ms ease, filter 150ms ease';
      el.style.cursor = onStateClick ? 'pointer' : 'default';

      if (wrongStates?.has(postal)) {
        el.classList.add('us-map-shake');
      } else {
        el.classList.remove('us-map-shake');
      }

      const handleEnter = () => {
        el.style.filter = 'brightness(0.92) saturate(1.1)';
        onStateHover?.(postal);
      };
      const handleLeave = () => {
        el.style.filter = '';
        onStateHover?.(null);
      };
      const handleClick = () => {
        onStateClick?.(postal);
      };

      el.addEventListener('mouseenter', handleEnter);
      el.addEventListener('mouseleave', handleLeave);
      el.addEventListener('click', handleClick);

      cleanups.push(() => {
        el.removeEventListener('mouseenter', handleEnter);
        el.removeEventListener('mouseleave', handleLeave);
        el.removeEventListener('click', handleClick);
      });
    });

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, [svgMarkup, highlightedStates, wrongStates, onStateClick, onStateHover, states]);

  return (
    <div className={className ?? 'w-full h-full flex items-center justify-center'}>
      <style>{`
        @keyframes us-map-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-1.5px); }
          40% { transform: translateX(1.5px); }
          60% { transform: translateX(-1px); }
          80% { transform: translateX(1px); }
        }
        .us-map-shake {
          transform-box: fill-box;
          transform-origin: center;
          animation: us-map-shake 0.5s ease-in-out 2;
        }
      `}</style>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
        className="block w-full h-full max-w-full max-h-full"
        role="img"
        aria-label="Map of the United States"
        onClick={onMapPointerClick ? handleSvgClick : undefined}
      >
        {svgMarkup && (
          <g
            ref={containerRef}
            // dangerouslySetInnerHTML on the <g> wrapper avoids parsing the
            // 50+ paths into JSX and lets us attach handlers via querySelector.
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
          />
        )}
        {/* Physical features draw OVER the political states but UNDER the
            capital stars + state-name labels so text/icons stay readable. */}
        {showPhysicalLayer && <PhysicalLayer />}
        {(showCapitalStars || showCapitalNames) && (
          <CapitalLayer
            hiddenCapitalNames={hiddenCapitalNames}
            showStars={showCapitalStars}
            showNames={showCapitalNames}
          />
        )}
        {showStateLabels && <LabelLayer hiddenStateLabels={hiddenStateLabels} />}
        {showLandmarks && <LandmarkLayer onLandmarkClick={onLandmarkClick} />}
        {/* Phase 6.5: caller-injected overlay layer (e.g. DistanceTool).
            Renders ABOVE everything else so its line + label sit on top. */}
        {svgChildren}
      </svg>
    </div>
  );
}
