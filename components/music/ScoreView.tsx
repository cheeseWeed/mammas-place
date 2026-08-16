'use client';

// The full score — every instrument stacked on one page, aligned bar by bar.
//
// This is the conductor's view. Each part gets its own stave with its name in
// the margin, they share bar lines down the page, and the whole thing scrolls
// sideways as one object so the parts can never drift apart visually.
//
// Switching to a single part is a VIEW change, not a different file — see
// lib/music/score.ts for why score and parts are the same data.

import { useMemo } from 'react';
import {
  FAMILY_ORDER,
  instrumentById,
  outOfRange,
  partBeats,
  scoreOrder,
  type MultiScore,
} from '@/lib/music/score';
import { isSharp, ledgerLines, staffPosition, staveFor } from '@/lib/music/sightread';

const STEP = 8;          // px between a staff line and the next space
const SPACING = 44;      // px between notes
const LEFT = 96;         // x where the music starts (names live to the left)
const STAVE_GAP = 30;    // px of air between one instrument and the next
const STAVE_H = 8 * STEP;

/** A colour per family, so the eye can find the strings without reading. */
const FAMILY_TINT: Record<string, string> = {
  woodwind: '#0d9488',
  brass: '#b45309',
  percussion: '#7c3aed',
  keyboard: '#be185d',
  voice: '#0369a1',
  string: '#4d7c0f',
};

export interface ScoreViewProps {
  score: MultiScore;
  /** Show every part (the conductor's score) or just one (a player's part). */
  focusPartId?: string | null;
  /** Which note is sounding, for playback highlighting. */
  playingBeat?: number | null;
  onPickNote?: (partId: string, index: number) => void;
  selected?: { partId: string; index: number } | null;
}

export default function ScoreView({
  score,
  focusPartId,
  playingBeat,
  onPickNote,
  selected,
}: ScoreViewProps) {
  const parts = useMemo(() => {
    const ordered = scoreOrder(score.parts);
    return focusPartId ? ordered.filter(p => p.id === focusPartId) : ordered;
  }, [score.parts, focusPartId]);

  const longest = Math.max(1, ...score.parts.map(p => p.notes.length));
  const width = LEFT + (longest + 1) * SPACING;
  const height = parts.length * (STAVE_H + STAVE_GAP) + 40;

  // Bar lines are drawn ACROSS every stave from one part's beat positions —
  // all parts share the same bars, which is the whole point of a score.
  const barBeats = useMemo(() => {
    const total = Math.max(0, ...score.parts.map(partBeats));
    const out: number[] = [];
    for (let b = score.beatsPerBar; b < total; b += score.beatsPerBar) out.push(b);
    return out;
  }, [score.parts, score.beatsPerBar]);

  if (parts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
        No instruments yet — add one to start your score.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-[#fbfaff]">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: Math.max(760, width), maxWidth: 'none' }}
        className="block"
        role="img"
        aria-label={`${score.title} — ${focusPartId ? 'part' : 'full score'}`}
      >
        {parts.map((part, pi) => {
          const inst = instrumentById(part.instrumentId);
          const top = 20 + pi * (STAVE_H + STAVE_GAP);
          const yFor = (pos: number) => top + (8 - pos) * STEP;
          const tint = FAMILY_TINT[inst.family] ?? '#581c87';

          // Where each note sits horizontally, by BEAT not by index — that is
          // what keeps a half note in one part lined up with two quarters in
          // another. Index-based spacing would look aligned and be wrong.
          let beat = 0;
          const placed = part.notes.map(nt => {
            const at = beat;
            beat += nt.beats;
            return { nt, at };
          });
          const beatX = (b: number) => LEFT + b * (SPACING / 1);

          return (
            <g key={part.id}>
              {/* instrument name in the margin */}
              <text x="6" y={top + 4 * STEP + 4} fontSize="12" fontWeight="700" fill={tint}>
                {part.name}
              </text>
              {inst.transpose !== 0 && (
                <text x="6" y={top + 4 * STEP + 18} fontSize="9" fill="#71717a">
                  transposing
                </text>
              )}

              {/* the five lines */}
              {[0, 2, 4, 6, 8].map(pos => (
                <line
                  key={pos}
                  x1={LEFT - 30} y1={yFor(pos)} x2={width} y2={yFor(pos)}
                  stroke="#cfc8da" strokeWidth="1.2"
                />
              ))}
              <text x={LEFT - 26} y={yFor(2) + 8} fontSize="34" fill={tint} fontFamily="serif">
                {inst.clef === 'bass' ? '\u{1D122}' : '\u{1D11E}'}
              </text>

              {/* shared bar lines */}
              {barBeats.map(b => (
                <line
                  key={`bar${b}`} x1={beatX(b) - SPACING / 2} y1={yFor(8)}
                  x2={beatX(b) - SPACING / 2} y2={yFor(0)}
                  stroke="#cfc8da" strokeWidth="1.5"
                />
              ))}

              {/* the notes */}
              {placed.map(({ nt, at }, i) => {
                const x = beatX(at);
                if (nt.rest) {
                  return (
                    <text key={i} x={x - 5} y={yFor(4) + 5} fontSize="20" fill="#8f86a0">
                      &#119197;
                    </text>
                  );
                }
                const stave = staveFor(nt.midi, inst.clef);
                const pos = staffPosition(nt.midi, stave);
                const y = yFor(pos);
                const bad = outOfRange(nt, part.instrumentId);
                const isSel = selected?.partId === part.id && selected.index === i;
                const sounding =
                  playingBeat != null && playingBeat >= at && playingBeat < at + nt.beats;

                return (
                  <g
                    key={i}
                    onClick={() => onPickNote?.(part.id, i)}
                    style={{ cursor: onPickNote ? 'pointer' : 'default' }}
                  >
                    {onPickNote && <rect x={x - 12} y={y - 16} width="24" height="32" fill="transparent" />}
                    {ledgerLines(pos).map(lp => (
                      <line key={lp} x1={x - 9} y1={yFor(lp)} x2={x + 9} y2={yFor(lp)} stroke="#8f86a0" strokeWidth="1.2" />
                    ))}
                    {sounding && <circle cx={x} cy={y} r="13" fill={tint} fillOpacity="0.25" />}
                    {isSel && <circle cx={x} cy={y} r="13" fill="#facc15" fillOpacity="0.45" />}
                    <ellipse
                      cx={x} cy={y} rx="6" ry="4.6"
                      fill={nt.beats >= 2 ? '#fbfaff' : bad ? '#dc2626' : tint}
                      stroke={bad ? '#dc2626' : tint}
                      strokeWidth={nt.beats >= 2 ? 1.8 : 0}
                      transform={`rotate(-18 ${x} ${y})`}
                    />
                    {nt.beats < 4 && (
                      <line
                        x1={pos >= 4 ? x - 6 : x + 6} y1={y}
                        x2={pos >= 4 ? x - 6 : x + 6} y2={pos >= 4 ? y + 24 : y - 24}
                        stroke={bad ? '#dc2626' : tint} strokeWidth="1.6"
                      />
                    )}
                    {isSharp(nt.midi) && (
                      <text x={x - 17} y={y + 4} fontSize="12" fill={tint} fontFamily="serif">&#9839;</text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* The bracket down the left edge that ties the staves into ONE system.
            Without it a score reads as separate tunes rather than one piece. */}
        {parts.length > 1 && (
          <path
            d={`M ${LEFT - 34} 20 L ${LEFT - 38} 20 L ${LEFT - 38} ${20 + (parts.length - 1) * (STAVE_H + STAVE_GAP) + STAVE_H} L ${LEFT - 34} ${20 + (parts.length - 1) * (STAVE_H + STAVE_GAP) + STAVE_H}`}
            fill="none" stroke="#581c87" strokeWidth="2.5"
          />
        )}
      </svg>
    </div>
  );
}

/** Legend so the family colours mean something. */
export function FamilyLegend() {
  return (
    <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-600">
      {FAMILY_ORDER.map(f => (
        <span key={f} className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: FAMILY_TINT[f] }} />
          {f}
        </span>
      ))}
    </div>
  );
}
