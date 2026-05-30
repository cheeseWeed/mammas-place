// chess-ui-types — UI-side mirror of the engine's public types.
//
// Components import from here, not from `lib/chess/engine.ts`, so:
//   1) The UI tree can typecheck even while the engine is in flux
//   2) We control the surface UI cares about — board view, move display,
//      game-status enum — and reshape it if the engine ever grows internal
//      types (PV lines, eval, hash debug) we don't want bleeding into JSX.
//
// The play page is the marriage point: it imports the engine AND these
// types and converts engine outputs to UI-side shapes when needed.

import type { ChessColor, ChessPieceType } from '@/data/chess-themes';

export type UiPiece = { color: ChessColor; type: ChessPieceType };

// Mirrors engine GameStatus exactly. Listed here so components don't need to
// import the engine just to type a status prop.
export type GameStatusLite =
  | 'playing'
  | 'check'
  | 'checkmate'
  | 'stalemate'
  | 'draw-50-move'
  | 'draw-threefold'
  | 'draw-insufficient';

// Move shape for display purposes. Engine may produce additional fields
// (flag, promotion) that the move list still wants to read; widen if needed.
export type UiMove = {
  from: number;            // 0..63
  to: number;
  promotion?: 'Q' | 'R' | 'B' | 'N';
  flag?: 'enpassant' | 'castle-k' | 'castle-q' | 'double-pawn';
};
