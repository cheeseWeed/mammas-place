// TurnIndicator — one-line status badge above the board.
//
// Shows whose turn it is, surfaces check, and (during Phase 3) the
// "Wizard is thinking…" spinner during AI search. For now thinking is wired
// in but only renders when the caller sets thinking=true.

'use client';

import type { ChessColor } from '@/data/chess-themes';
import type { GameStatusLite } from './chess-ui-types';

export type TurnIndicatorProps = {
  turn: ChessColor;
  status: GameStatusLite;
  thinkingLabel?: string | null;       // e.g. "Wizard is thinking…" or null
  whiteName: string;
  blackName: string;
};

export default function TurnIndicator({
  turn,
  status,
  thinkingLabel,
  whiteName,
  blackName,
}: TurnIndicatorProps) {
  if (thinkingLabel) {
    return (
      <div className="bg-purple-900 text-yellow-300 font-bold px-4 py-3 rounded-2xl shadow-md flex items-center justify-center gap-3">
        <span
          className="inline-block w-3 h-3 rounded-full bg-yellow-300 animate-pulse"
          aria-hidden="true"
        />
        {thinkingLabel}
      </div>
    );
  }

  if (status === 'checkmate') {
    const loser = turn === 'w' ? whiteName : blackName;
    return (
      <div className="bg-red-700 text-white font-black px-4 py-3 rounded-2xl shadow-md text-center">
        Checkmate — {loser} is checkmated.
      </div>
    );
  }

  if (status === 'stalemate') {
    return (
      <div className="bg-gray-700 text-white font-black px-4 py-3 rounded-2xl shadow-md text-center">
        Stalemate — no legal moves, no check.
      </div>
    );
  }

  if (status === 'draw-50-move') {
    return (
      <div className="bg-gray-700 text-white font-black px-4 py-3 rounded-2xl shadow-md text-center">
        Draw — 50-move rule.
      </div>
    );
  }

  if (status === 'draw-threefold') {
    return (
      <div className="bg-gray-700 text-white font-black px-4 py-3 rounded-2xl shadow-md text-center">
        Draw — threefold repetition.
      </div>
    );
  }

  if (status === 'draw-insufficient') {
    return (
      <div className="bg-gray-700 text-white font-black px-4 py-3 rounded-2xl shadow-md text-center">
        Draw — insufficient material.
      </div>
    );
  }

  const whoseTurn = turn === 'w' ? whiteName : blackName;
  const isCheck = status === 'check';
  return (
    <div
      className={`px-4 py-3 rounded-2xl shadow-md font-bold flex items-center justify-center gap-2 ${
        isCheck
          ? 'bg-red-100 border-2 border-red-500 text-red-900'
          : 'bg-purple-100 border-2 border-purple-300 text-purple-900'
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-block w-3 h-3 rounded-full border-2 ${
          turn === 'w'
            ? 'bg-white border-purple-900'
            : 'bg-purple-900 border-white'
        }`}
      />
      <span>
        {whoseTurn} to move
        {isCheck ? ' — check!' : ''}
      </span>
    </div>
  );
}
