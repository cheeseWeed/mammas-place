// MoveList — scrollable sidebar of moves in algebraic notation.
//
// We render coordinate notation ("e2-e4") rather than full SAN ("e4") until
// `lib/chess/san.ts` lands (it's a Phase 1 file the engine session owns).
// When SAN is available, the caller can pass `formattedMoves` instead and we
// render those strings verbatim.
//
// Layout: each FULL move is one row — "<n>. <white> <black>". The list
// scrolls itself when it overflows; we lock to the bottom on every new move
// so the latest play is always in view.

'use client';

import { useEffect, useRef } from 'react';
import type { UiMove } from './chess-ui-types';

export type MoveListProps = {
  moves: UiMove[];
  // Optional pre-formatted strings, one per move, parallel to `moves`.
  // When provided, used instead of the coordinate fallback.
  formattedMoves?: string[];
};

function indexToCoord(idx: number): string {
  const file = idx % 8;
  const rank = 8 - Math.floor(idx / 8);
  return `${String.fromCharCode(97 + file)}${rank}`;
}

function formatMove(move: UiMove): string {
  const base = `${indexToCoord(move.from)}-${indexToCoord(move.to)}`;
  if (move.promotion) return `${base}=${move.promotion}`;
  if (move.flag === 'castle-k') return 'O-O';
  if (move.flag === 'castle-q') return 'O-O-O';
  return base;
}

export default function MoveList({ moves, formattedMoves }: MoveListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [moves.length]);

  // Group into full moves: pairs of (white, black).
  const rows: { num: number; white: string; black: string | null }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    const white = formattedMoves?.[i] ?? formatMove(moves[i]);
    const blackMove = moves[i + 1];
    const black = blackMove
      ? (formattedMoves?.[i + 1] ?? formatMove(blackMove))
      : null;
    rows.push({ num: i / 2 + 1, white, black });
  }

  return (
    <div className="bg-white rounded-2xl shadow-md border-2 border-purple-200 p-4 flex flex-col h-full max-h-[480px]">
      <div className="flex items-baseline justify-between mb-2 border-b border-purple-100 pb-2">
        <h3 className="font-black text-purple-900">Moves</h3>
        <span className="text-xs text-purple-700">{moves.length} played</span>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto text-sm font-mono tabular-nums"
      >
        {rows.length === 0 ? (
          <p className="text-xs text-purple-600 italic">
            No moves yet. White to start.
          </p>
        ) : (
          <ol className="space-y-0.5">
            {rows.map((row) => (
              <li key={row.num} className="grid grid-cols-[2rem_1fr_1fr] gap-2">
                <span className="text-purple-500 text-right">{row.num}.</span>
                <span className="text-purple-900 font-semibold">{row.white}</span>
                <span className="text-purple-700">{row.black ?? ''}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
