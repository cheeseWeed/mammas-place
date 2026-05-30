// PromotionPicker — modal that fires when a pawn reaches the back rank.
//
// Shows the four legal promotion choices (Q, R, B, N) in the current player's
// color and the current theme. Tapping one resolves the pending move.
//
// We intentionally do not include K — kings can't be promoted to. We do offer
// underpromotion (R/B/N) because real chess does and the kid will eventually
// learn that a knight promo can be the right call.

'use client';

import type { ChessColor, ChessTheme } from '@/data/chess-themes';
import PieceSprite from './PieceSprite';

export type PromotionChoice = 'Q' | 'R' | 'B' | 'N';

export type PromotionPickerProps = {
  color: ChessColor;
  theme: ChessTheme;
  onChoose: (piece: PromotionChoice) => void;
};

const CHOICES: { type: PromotionChoice; label: string }[] = [
  { type: 'Q', label: 'Queen' },
  { type: 'R', label: 'Rook' },
  { type: 'B', label: 'Bishop' },
  { type: 'N', label: 'Knight' },
];

export default function PromotionPicker({
  color,
  theme,
  onChoose,
}: PromotionPickerProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose promotion piece"
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-3xl shadow-2xl border-4 border-yellow-400 p-6 max-w-sm w-full">
        <h2 className="text-2xl font-black text-purple-900 text-center mb-1">
          Promote your pawn!
        </h2>
        <p className="text-center text-sm text-purple-700 mb-5">
          Pick the piece your pawn becomes.
        </p>
        <div className="grid grid-cols-4 gap-3">
          {CHOICES.map((choice) => (
            <button
              key={choice.type}
              type="button"
              onClick={() => onChoose(choice.type)}
              aria-label={`Promote to ${choice.label}`}
              className="aspect-square bg-purple-50 hover:bg-yellow-100 border-2 border-purple-200 hover:border-yellow-400 rounded-2xl p-1 transition-colors"
            >
              <PieceSprite color={color} type={choice.type} theme={theme} />
              <div className="text-[10px] font-bold text-purple-700 mt-0.5">
                {choice.label}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
