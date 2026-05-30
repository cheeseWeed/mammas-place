// Board — 8x8 CSS grid, renders 64 <Square> children.
//
// Pure presentation: it does NOT decide legality. The parent passes in
// `legalDestinations` (squares the currently selected piece can move to) and
// `selectedSquare`. The parent's reducer + engine.legalMoves() are the only
// arbiters of what's legal.
//
// Index convention matches the engine: 0 = a8 (top-left), 63 = h1
// (bottom-right). When `flipped` is true, we render row-by-row from the other
// side so Black sits at the bottom; the underlying square indices don't move.

'use client';

import { useMemo } from 'react';
import type { ChessTheme, ChessColor, ChessPieceType } from '@/data/chess-themes';
import Square from './Square';

export type BoardPiece = { color: ChessColor; type: ChessPieceType };

export type BoardProps = {
  // 64-cell board, index 0 = a8, index 63 = h1.
  board: (BoardPiece | null)[];
  legalDestinations: number[];     // square indices the selected piece may move to
  selectedSquare: number | null;
  lastMove: { from: number; to: number } | null;
  checkSquare: number | null;      // index of king that is in check, or null
  theme: ChessTheme;
  flipped: boolean;
  onSquareClick: (square: number) => void;
};

// Convert a board index (0..63, a8=0, h1=63) to algebraic ("a8"..."h1").
function indexToAlgebraic(idx: number): string {
  const file = idx % 8;            // 0=a, 7=h
  const rank = 8 - Math.floor(idx / 8); // row 0 -> rank 8, row 7 -> rank 1
  return `${String.fromCharCode(97 + file)}${rank}`;
}

// File letter at a column index (0..7), respecting the flip.
function fileLabel(col: number, flipped: boolean): string {
  const fileIdx = flipped ? 7 - col : col;
  return String.fromCharCode(97 + fileIdx);
}

function rankLabel(row: number, flipped: boolean): string {
  return String(flipped ? row + 1 : 8 - row);
}

export default function Board({
  board,
  legalDestinations,
  selectedSquare,
  lastMove,
  checkSquare,
  theme,
  flipped,
  onSquareClick,
}: BoardProps) {
  const legalSet = useMemo(() => new Set(legalDestinations), [legalDestinations]);

  // Build the render-order list of square indices. When flipped, we reverse
  // both rows and columns so a1 sits top-left and h8 bottom-right.
  const renderOrder = useMemo<number[]>(() => {
    const order: number[] = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const realRow = flipped ? 7 - row : row;
        const realCol = flipped ? 7 - col : col;
        order.push(realRow * 8 + realCol);
      }
    }
    return order;
  }, [flipped]);

  return (
    <div
      className="relative w-full max-w-[640px] mx-auto"
      role="grid"
      aria-label="Chess board"
    >
      {/* Outer ring for visual weight (matches Geography map's bordered look) */}
      <div className="rounded-2xl overflow-hidden border-4 border-purple-900 shadow-2xl bg-purple-900">
        {/* The grid itself */}
        <div
          className="grid grid-cols-8 grid-rows-8 w-full"
          style={{ aspectRatio: '1 / 1' }}
        >
          {renderOrder.map((idx) => {
            const piece = board[idx];
            const row = Math.floor(idx / 8);
            const col = idx % 8;
            const isLight = (row + col) % 2 === 0;
            const algebraic = indexToAlgebraic(idx);

            return (
              <Square
                key={idx}
                algebraic={algebraic}
                isLightSquare={isLight}
                piece={piece}
                theme={theme}
                selected={selectedSquare === idx}
                legalTarget={legalSet.has(idx)}
                lastMoveFrom={lastMove?.from === idx}
                lastMoveTo={lastMove?.to === idx}
                inCheck={checkSquare === idx}
                onClick={() => onSquareClick(idx)}
              />
            );
          })}
        </div>
      </div>

      {/* File labels along the bottom (a..h or h..a) */}
      <div className="grid grid-cols-8 mt-1 text-center text-xs font-bold text-purple-900">
        {Array.from({ length: 8 }, (_, col) => (
          <div key={col}>{fileLabel(col, flipped)}</div>
        ))}
      </div>

      {/* Rank labels along the left side, absolutely positioned */}
      <div
        className="absolute top-1 -left-5 grid grid-rows-8 text-xs font-bold text-purple-900 text-center"
        style={{ height: 'calc(100% - 1.25rem)' }}
        aria-hidden="true"
      >
        {Array.from({ length: 8 }, (_, row) => (
          <div key={row} className="flex items-center justify-center">
            {rankLabel(row, flipped)}
          </div>
        ))}
      </div>
    </div>
  );
}
