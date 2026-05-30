// PieceSprite — renders a single chess piece via the active theme's SVG URL.
//
// The component is theme-driven on purpose: a theme swap is one prop change,
// no piece-specific code lives in components. See data/chess-themes.ts.
//
// We use a plain <img> (not next/image) because:
//   - SVGs render best as direct browser-loaded vectors
//   - Board pieces are tiny (~64px square) so optimization isn't worth it
//   - next/image's lazy-loading would flash on legitimate piece moves

'use client';

import type { ChessColor, ChessPieceType, ChessTheme } from '@/data/chess-themes';

export type PieceSpriteProps = {
  color: ChessColor;
  type: ChessPieceType;
  theme: ChessTheme;
};

const PIECE_NAMES: Record<ChessPieceType, string> = {
  K: 'king',
  Q: 'queen',
  R: 'rook',
  B: 'bishop',
  N: 'knight',
  P: 'pawn',
};

export default function PieceSprite({ color, type, theme }: PieceSpriteProps) {
  const colorName = color === 'w' ? 'white' : 'black';
  const alt = `${colorName} ${PIECE_NAMES[type]}`;
  return (
    <img
      src={theme.pieceUrl(color, type)}
      alt={alt}
      draggable={false}
      className="w-full h-full pointer-events-none select-none transition-transform duration-150"
      // Drag prevention is belt-and-suspenders — the page disables drag too.
    />
  );
}
