// DistanceTool — pure SVG overlay that renders a line + 2 markers + a label
// for a pair of clicked points. Stateless w.r.t. the clicks themselves —
// the parent owns the points (so the parent can also drive the
// "guess the distance" flow that hides the label until guess is submitted).
//
// This component renders as a child of USMap via the svgChildren prop,
// sharing the 959x593 viewBox. Coordinates passed in are in SVG space.
//
// Visuals:
//   - line:    2px blue stroke + soft glow (drop shadow filter)
//   - markers: yellow circles with darker stroke (matches capital star palette)
//   - label:   white pill at the midpoint with bold dark text
//
// `showLabel=false` mode is used by the Guess sub-mode — the line + markers
// still render so the kid can see WHAT they're guessing, but the answer
// stays hidden until they submit a guess.
'use client';

import type { ReactElement } from 'react';

type Point = { x: number; y: number };

export type DistanceToolProps = {
  // Clicked points in SVG viewBox space (0..959, 0..593). 0, 1, or 2 entries.
  // Parent owns this state.
  points: Point[];
  // Pre-computed miles for label display. Parent computes via haversineMiles.
  miles: number | null;
  // When false, line + markers still render but the miles label is hidden.
  // Used by "Guess the distance" mode pre-reveal.
  showLabel?: boolean;
  // Optional label override. When set (Guess mode reveal), shows
  // e.g. "1,247 mi" with a second-line accuracy phrase below it.
  labelOverride?: string;
  labelSubtext?: string;
};

const LINE_COLOR = '#2563eb';        // blue-600
const LINE_GLOW = 'rgba(37, 99, 235, 0.45)';
const MARKER_FILL = '#facc15';       // yellow-400 (matches capital stars)
const MARKER_STROKE = '#78350f';     // amber-900
const LABEL_BG = '#ffffff';
const LABEL_BORDER = '#1e3a8a';      // blue-900
const LABEL_TEXT = '#0f172a';        // slate-900

export default function DistanceTool({
  points,
  miles,
  showLabel = true,
  labelOverride,
  labelSubtext,
}: DistanceToolProps): ReactElement {
  // Filter id is namespaced so multiple tool instances on one page don't clash.
  const filterId = 'distance-tool-glow';

  return (
    <g className="distance-tool" pointerEvents="none">
      <defs>
        {/* Soft glow underneath the measurement line. Standard SVG drop shadow. */}
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.4" result="blur" />
          <feFlood floodColor={LINE_GLOW} result="flood" />
          <feComposite in="flood" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Line — only when we have 2 points. */}
      {points.length === 2 && (
        <line
          x1={points[0].x}
          y1={points[0].y}
          x2={points[1].x}
          y2={points[1].y}
          stroke={LINE_COLOR}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray="0"
          filter={`url(#${filterId})`}
        />
      )}

      {/* Markers — render every clicked point, even if only 1 so far. */}
      {points.map((p, i) => (
        <g key={i} transform={`translate(${p.x}, ${p.y})`}>
          <circle r={5} fill={MARKER_FILL} stroke={MARKER_STROKE} strokeWidth={1.4} />
          <circle r={1.4} fill={MARKER_STROKE} />
        </g>
      ))}

      {/* Distance label — only when we have 2 points AND showLabel. */}
      {points.length === 2 && showLabel && miles !== null && (() => {
        const midX = (points[0].x + points[1].x) / 2;
        const midY = (points[0].y + points[1].y) / 2;
        const labelText = labelOverride ?? `${Math.round(miles).toLocaleString('en-US')} mi`;
        const hasSubtext = !!labelSubtext;

        // Pill sized to fit the longer string. Rough character-width estimate
        // works fine at our 11px font and is cheap (avoids needing a render
        // pass to measure). Add a comfortable padding.
        const longest = hasSubtext ? Math.max(labelText.length, labelSubtext!.length) : labelText.length;
        const charW = 6.5; // ~bold sans at fontSize 11
        const padX = 8;
        const w = longest * charW + padX * 2;
        const h = hasSubtext ? 30 : 18;
        const x = midX - w / 2;
        const y = midY - h / 2;

        return (
          <g>
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              rx={6}
              ry={6}
              fill={LABEL_BG}
              stroke={LABEL_BORDER}
              strokeWidth={1}
              opacity={0.96}
            />
            <text
              x={midX}
              y={hasSubtext ? midY - 2 : midY + 4}
              textAnchor="middle"
              fontSize={11}
              fontWeight={800}
              fill={LABEL_TEXT}
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              {labelText}
            </text>
            {hasSubtext && (
              <text
                x={midX}
                y={midY + 11}
                textAnchor="middle"
                fontSize={8.5}
                fontWeight={600}
                fill="#475569"
                fontFamily="ui-sans-serif, system-ui, sans-serif"
              >
                {labelSubtext}
              </text>
            )}
          </g>
        );
      })()}
    </g>
  );
}
