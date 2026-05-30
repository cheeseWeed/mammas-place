// FEN (Forsyth-Edwards Notation) parser and serializer.
//
// Standard 6-field FEN: board, side-to-move, castling, en-passant, halfmove,
// fullmove. We validate strictly — garbage input throws.

import type { Position, Piece, Color, PieceType, CastlingRights, Square } from './engine';
import { algebraicToSquare, squareToAlgebraic } from './engine';
import { hashPosition } from './zobrist';

const PIECE_FROM_CHAR: Record<string, PieceType> = {
  k: 'K', q: 'Q', r: 'R', b: 'B', n: 'N', p: 'P',
};

function charToPiece(c: string): Piece {
  const lower = c.toLowerCase();
  const type = PIECE_FROM_CHAR[lower];
  if (!type) throw new Error(`Invalid FEN piece char: ${c}`);
  return { color: c === lower ? 'b' : 'w', type };
}

function pieceToChar(p: Piece): string {
  const lower = p.type.toLowerCase();
  return p.color === 'w' ? p.type : lower;
}

export function parseFEN(fen: string): Position {
  const parts = fen.trim().split(/\s+/);
  if (parts.length !== 6) {
    throw new Error(`FEN must have 6 fields, got ${parts.length}`);
  }
  const [boardField, turnField, castlingField, epField, halfField, fullField] = parts;

  const board: (Piece | null)[] = new Array(64).fill(null);
  const ranks = boardField.split('/');
  if (ranks.length !== 8) throw new Error(`FEN board must have 8 ranks`);
  for (let r = 0; r < 8; r++) {
    let f = 0;
    for (const ch of ranks[r]) {
      if (/[1-8]/.test(ch)) {
        f += Number(ch);
      } else {
        if (f >= 8) throw new Error(`FEN rank ${r} overflows`);
        board[r * 8 + f] = charToPiece(ch);
        f++;
      }
    }
    if (f !== 8) throw new Error(`FEN rank ${r} doesn't sum to 8`);
  }

  if (turnField !== 'w' && turnField !== 'b') {
    throw new Error(`FEN turn must be 'w' or 'b'`);
  }
  const turn: Color = turnField;

  const castling: CastlingRights = { wK: false, wQ: false, bK: false, bQ: false };
  if (castlingField !== '-') {
    if (!/^[KQkq]+$/.test(castlingField)) {
      throw new Error(`Invalid FEN castling: ${castlingField}`);
    }
    if (castlingField.includes('K')) castling.wK = true;
    if (castlingField.includes('Q')) castling.wQ = true;
    if (castlingField.includes('k')) castling.bK = true;
    if (castlingField.includes('q')) castling.bQ = true;
  }

  let enPassantTarget: Square | null = null;
  if (epField !== '-') {
    enPassantTarget = algebraicToSquare(epField);
  }

  const halfmoveClock = Number(halfField);
  const fullmoveNumber = Number(fullField);
  if (!Number.isInteger(halfmoveClock) || halfmoveClock < 0) {
    throw new Error(`FEN halfmove invalid: ${halfField}`);
  }
  if (!Number.isInteger(fullmoveNumber) || fullmoveNumber < 1) {
    throw new Error(`FEN fullmove invalid: ${fullField}`);
  }

  const pos: Position = {
    board, turn, castling, enPassantTarget, halfmoveClock, fullmoveNumber,
    positionHistory: [],
  };
  return { ...pos, positionHistory: [hashPosition(pos)] };
}

export function toFEN(pos: Position): string {
  const rankStrs: string[] = [];
  for (let r = 0; r < 8; r++) {
    let s = '';
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const p = pos.board[r * 8 + f];
      if (!p) {
        empty++;
      } else {
        if (empty > 0) { s += empty; empty = 0; }
        s += pieceToChar(p);
      }
    }
    if (empty > 0) s += empty;
    rankStrs.push(s);
  }
  const board = rankStrs.join('/');

  let castling = '';
  if (pos.castling.wK) castling += 'K';
  if (pos.castling.wQ) castling += 'Q';
  if (pos.castling.bK) castling += 'k';
  if (pos.castling.bQ) castling += 'q';
  if (castling === '') castling = '-';

  const ep = pos.enPassantTarget === null ? '-' : squareToAlgebraic(pos.enPassantTarget);

  return `${board} ${pos.turn} ${castling} ${ep} ${pos.halfmoveClock} ${pos.fullmoveNumber}`;
}
