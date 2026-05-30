// Plain-English explanation for an AI's chosen move. Used in Cub mode's
// "Why?" button so kids can learn from the AI's reasoning.
//
// Rules (checked in order; first match wins):
//   - Castling                -> "Castling to keep my king safe."
//   - Captures the opponent   -> "I took your {piece}!"
//   - Puts opponent in check  -> "Check!"
//   - Develops N/B in opening -> "Getting my {piece} into the game."
//   - Attacks an opponent piece (post-move, the moved piece sees an enemy
//                                 of equal-or-greater value)
//                            -> "Attacking your {piece}."
//   - Otherwise               -> "Moving my {piece} to a better spot."
//
// "Opening" = first 12 fullmoves; rough but fine for our audience.

import type { Move, Piece, PieceType, Position, Square } from './engine';
import { isCheck, legalMoves, makeMove } from './engine';
import { PIECE_VALUE } from './ai-eval';

const PIECE_NAME: Record<PieceType, string> = {
  K: 'king',
  Q: 'queen',
  R: 'rook',
  B: 'bishop',
  N: 'knight',
  P: 'pawn',
};

export function explainMove(pos: Position, move: Move): string {
  const moverPiece = pos.board[move.from];
  if (!moverPiece) return 'Moving to a better spot.';

  // Castling.
  if (move.flag === 'castle-k' || move.flag === 'castle-q') {
    return 'Castling to keep my king safe.';
  }

  // Capture (including en passant).
  const victim: Piece | null =
    move.flag === 'enpassant'
      ? { color: moverPiece.color === 'w' ? 'b' : 'w', type: 'P' }
      : pos.board[move.to];
  if (victim) {
    return `I took your ${PIECE_NAME[victim.type]}!`;
  }

  // Apply the move so we can ask "is opponent in check?" and "what does the
  // moved piece now attack?"
  const next = makeMove(pos, move);
  const opponentColor = moverPiece.color === 'w' ? 'b' : 'w';

  // Check.
  if (isCheck(next, opponentColor)) {
    return 'Check!';
  }

  // Opening development (knight or bishop, early game, moved off back rank).
  if ((moverPiece.type === 'N' || moverPiece.type === 'B') && pos.fullmoveNumber <= 12) {
    if (isOnBackRank(move.from, moverPiece.color) && !isOnBackRank(move.to, moverPiece.color)) {
      return `Getting my ${PIECE_NAME[moverPiece.type]} into the game.`;
    }
  }

  // Attacks an enemy piece worth >= our piece's value.
  const attackedVictim = findAttackedVictim(next, move.to, opponentColor, moverPiece);
  if (attackedVictim) {
    return `Attacking your ${PIECE_NAME[attackedVictim.type]}.`;
  }

  return `Moving my ${PIECE_NAME[moverPiece.type]} to a better spot.`;
}

function isOnBackRank(sq: Square, color: 'w' | 'b'): boolean {
  const rank = Math.floor(sq / 8);
  return color === 'w' ? rank === 7 : rank === 0;
}

// After making the move, what pieces does our piece on `from` attack? Pick the
// most valuable enemy piece that the moved piece can capture next turn (i.e.
// shows up as a destination from `attackerSquare` in the position where it's
// our turn).
function findAttackedVictim(
  posAfterMove: Position,
  attackerSquare: Square,
  opponentColor: 'w' | 'b',
  mover: Piece,
): Piece | null {
  // In `posAfterMove`, it's opponent's turn. We need to peek at what *we* could
  // do next — temporarily flip turn and look at our piece's legal moves.
  const flipped: Position = { ...posAfterMove, turn: mover.color };
  const ourMoves = legalMoves(flipped, attackerSquare);
  let best: Piece | null = null;
  let bestValue = PIECE_VALUE[mover.type] - 1; // require >= our value
  for (const m of ourMoves) {
    const target = flipped.board[m.to];
    if (target && target.color === opponentColor) {
      if (PIECE_VALUE[target.type] > bestValue) {
        best = target;
        bestValue = PIECE_VALUE[target.type];
      }
    }
  }
  return best;
}
