// Square — one cell of the 8x8 board.
//
// Holds zero state of its own; all visual state is computed from props by the
// parent <Board>. Responsibilities:
//   - Render the underlying light/dark color
//   - Render the piece (if any) via <PieceSprite>
//   - Layer overlays for: selected, legal-move target, last-move highlight,
//     king-in-check glow
//   - Forward clicks to the parent's onSquareClick handler
//
// The aria-label is "a4" style algebraic — screen readers describe each cell
// by its real-world chess coordinate, not by an index.

'use client';

import type { ChessTheme, ChessColor, ChessPieceType } from '@/data/chess-themes';
import PieceSprite from './PieceSprite';

export type SquarePiece = { color: ChessColor; type: ChessPieceType };

export type SquareProps = {
  algebraic: string;            // e.g. "e4" — used for aria-label
  isLightSquare: boolean;
  piece: SquarePiece | null;
  theme: ChessTheme;
  selected: boolean;
  legalTarget: boolean;         // can move here this turn
  lastMoveFrom: boolean;
  lastMoveTo: boolean;
  inCheck: boolean;             // this is the king square in check
  onClick: () => void;
};

export default function Square({
  algebraic,
  isLightSquare,
  piece,
  theme,
  selected,
  legalTarget,
  lastMoveFrom,
  lastMoveTo,
  inCheck,
  onClick,
}: SquareProps) {
  const baseColor = isLightSquare ? theme.light : theme.dark;

  // Tints. We layer translucent overlays on top of the base color so the
  // square's identity (light vs dark) is still visible.
  const lastMoveTint = lastMoveFrom || lastMoveTo;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={piece
        ? `${algebraic}, ${piece.color === 'w' ? 'white' : 'black'} ${piece.type}`
        : algebraic}
      className="relative aspect-square w-full select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 focus-visible:z-10"
      style={{ backgroundColor: baseColor, minHeight: '44px', minWidth: '44px' }}
    >
      {/* Last-move tint — yellow wash */}
      {lastMoveTint && (
        <span
          aria-hidden="true"
          className="absolute inset-0"
          style={{ backgroundColor: theme.highlight, opacity: 0.35 }}
        />
      )}

      {/* Check glow — red */}
      {inCheck && (
        <span
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at center, rgba(239,68,68,0.65) 0%, rgba(239,68,68,0.15) 60%, transparent 80%)',
          }}
        />
      )}

      {/* Selected ring */}
      {selected && (
        <span
          aria-hidden="true"
          className="absolute inset-0 ring-4 ring-inset"
          style={{ boxShadow: `inset 0 0 0 4px ${theme.highlight}` }}
        />
      )}

      {/* Piece */}
      {piece && (
        <span aria-hidden="true" className="absolute inset-[6%]">
          <PieceSprite color={piece.color} type={piece.type} theme={theme} />
        </span>
      )}

      {/* Legal-move marker:
          - empty target square → centered dot
          - occupied (capture)  → ring around the piece
       */}
      {legalTarget && (
        <span aria-hidden="true" className="absolute inset-0 pointer-events-none">
          {piece ? (
            <span
              className="absolute inset-[4%] rounded-full"
              style={{ boxShadow: `inset 0 0 0 4px ${theme.highlight}` }}
            />
          ) : (
            <span
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                width: '30%',
                height: '30%',
                backgroundColor: theme.highlight,
                opacity: 0.75,
              }}
            />
          )}
        </span>
      )}
    </button>
  );
}
