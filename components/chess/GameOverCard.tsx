// GameOverCard — full-screen card shown when the game ends.
//
// Covers all 6 end-states from the engine's GameStatus union (checkmate,
// stalemate, the three draws) plus an explicit resignation. The card spells
// out the winner (or "draw"), the reason in plain English, and offers
// "Play Again" + "Back to hub" CTAs.
//
// MP earning is NOT done here — that's the parent page's job (Phase 4 wires
// it through /api/money/earn). We just announce the result.

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ChessColor } from '@/data/chess-themes';

export type GameOverReason =
  | 'checkmate'
  | 'stalemate'
  | 'resignation'
  | 'draw-50-move'
  | 'draw-threefold'
  | 'draw-insufficient';

export type GameOverResult = {
  winner: ChessColor | 'draw';
  reason: GameOverReason;
};

export type GameOverCardProps = {
  result: GameOverResult;
  whiteName: string;
  blackName: string;
  onPlayAgain: () => void;
  hubHref?: string;            // default '/chess'
};

function reasonText(reason: GameOverReason): string {
  switch (reason) {
    case 'checkmate':
      return 'Checkmate — the king has nowhere to run.';
    case 'stalemate':
      return 'Stalemate — no legal moves, but the king is safe.';
    case 'resignation':
      return 'Resignation.';
    case 'draw-50-move':
      return '50-move rule — no captures or pawn moves in 50 turns.';
    case 'draw-threefold':
      return 'Threefold repetition — the same position came up three times.';
    case 'draw-insufficient':
      return 'Insufficient material — neither side has enough to checkmate.';
  }
}

export default function GameOverCard({
  result,
  whiteName,
  blackName,
  onPlayAgain,
  hubHref = '/chess',
}: GameOverCardProps) {
  // Trigger a one-shot confetti burst (CSS only) on a win.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const isDraw = result.winner === 'draw';
  const winnerName =
    result.winner === 'w'
      ? whiteName
      : result.winner === 'b'
        ? blackName
        : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Game over"
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-3xl shadow-2xl border-4 border-yellow-400 p-6 md:p-8 max-w-md w-full text-center relative overflow-hidden">
        {/* Confetti — pure CSS, fires once on mount when there's a winner */}
        {!isDraw && mounted && <Confetti />}

        <div className="text-6xl mb-3">
          {isDraw ? '🤝' : '👑'}
        </div>
        <h2 className="text-3xl md:text-4xl font-black text-purple-900 mb-2">
          {isDraw ? 'Draw' : `${winnerName} wins!`}
        </h2>
        <p className="text-purple-700 mb-6">{reasonText(result.reason)}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onPlayAgain}
            className="bg-purple-900 hover:bg-purple-800 text-white font-black py-3 rounded-2xl transition-colors"
          >
            Play again
          </button>
          <Link
            href={hubHref}
            className="bg-white border-2 border-purple-300 hover:border-purple-500 text-purple-900 font-bold py-3 rounded-2xl transition-colors flex items-center justify-center"
          >
            Back to hub
          </Link>
        </div>
      </div>
    </div>
  );
}

// Lightweight CSS confetti — 30 colored squares falling in randomized arcs.
// Keeps DOM small and animations short (1.6s total).
function Confetti() {
  const pieces = Array.from({ length: 30 }, (_, i) => i);
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {pieces.map((i) => {
        const left = (i / pieces.length) * 100;
        const delay = (i % 6) * 0.06;
        const duration = 1.2 + (i % 4) * 0.1;
        const colors = ['#fde047', '#a78bfa', '#fb7185', '#34d399', '#60a5fa'];
        const bg = colors[i % colors.length];
        return (
          <span
            key={i}
            className="absolute top-0 w-2 h-3 rounded-sm animate-[confetti_var(--dur)_ease-in_var(--delay)_forwards]"
            style={
              {
                left: `${left}%`,
                backgroundColor: bg,
                ['--dur' as string]: `${duration}s`,
                ['--delay' as string]: `${delay}s`,
                animation: `confetti ${duration}s ease-in ${delay}s forwards`,
              } as React.CSSProperties
            }
          />
        );
      })}
      <style>{`
        @keyframes confetti {
          0%   { transform: translateY(-40px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(420px) rotate(540deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
