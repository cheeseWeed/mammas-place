// Pure chess engine — zero side effects, immutable Position in / new Position out.
//
// Board convention: 64-entry array, index 0 = a8 (top-left from White's POV),
// index 63 = h1 (bottom-right). rank index 0 = rank 8, file index 0 = file a.
// All public functions are pure; same input always yields same output.
//
// Move generation is two-pass: (1) pseudo-legal moves per piece per rules,
// (2) filter by king safety — simulate each move and reject if our king ends
// up attacked. This makes pin detection, check evasion, and "can't castle
// through check" fall out of the filter with no special-case branches.

import { hashPosition } from './zobrist';

export type Color = 'w' | 'b';
export type PieceType = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';
export type Piece = { color: Color; type: PieceType };

export type Square = number;

export type Move = {
  from: Square;
  to: Square;
  promotion?: 'Q' | 'R' | 'B' | 'N';
  flag?: 'enpassant' | 'castle-k' | 'castle-q' | 'double-pawn';
};

export type CastlingRights = { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean };

export type Position = {
  board: (Piece | null)[];
  turn: Color;
  castling: CastlingRights;
  enPassantTarget: Square | null;
  halfmoveClock: number;
  fullmoveNumber: number;
  positionHistory: string[];
};

export type GameStatus =
  | 'playing'
  | 'check'
  | 'checkmate'
  | 'stalemate'
  | 'draw-50-move'
  | 'draw-threefold'
  | 'draw-insufficient';

// Coordinate helpers. rankIdx 0 = rank 8 (top), fileIdx 0 = file a.
function rankOf(sq: Square): number { return Math.floor(sq / 8); }
function fileOf(sq: Square): number { return sq % 8; }
function sqOf(rank: number, file: number): Square { return rank * 8 + file; }
function inBounds(rank: number, file: number): boolean {
  return rank >= 0 && rank < 8 && file >= 0 && file < 8;
}

export function squareToAlgebraic(sq: Square): string {
  const file = fileOf(sq);
  const rank = rankOf(sq);
  return String.fromCharCode(97 + file) + String(8 - rank);
}

export function algebraicToSquare(s: string): Square {
  if (s.length !== 2) throw new Error(`Invalid algebraic square: ${s}`);
  const file = s.charCodeAt(0) - 97;
  const rank = 8 - Number(s[1]);
  if (!inBounds(rank, file) || Number.isNaN(rank)) {
    throw new Error(`Invalid algebraic square: ${s}`);
  }
  return sqOf(rank, file);
}

export function initialPosition(): Position {
  const board: (Piece | null)[] = new Array(64).fill(null);
  const backRank: PieceType[] = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  for (let f = 0; f < 8; f++) {
    board[sqOf(0, f)] = { color: 'b', type: backRank[f] };
    board[sqOf(1, f)] = { color: 'b', type: 'P' };
    board[sqOf(6, f)] = { color: 'w', type: 'P' };
    board[sqOf(7, f)] = { color: 'w', type: backRank[f] };
  }
  const pos: Position = {
    board,
    turn: 'w',
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    enPassantTarget: null,
    halfmoveClock: 0,
    fullmoveNumber: 1,
    positionHistory: [],
  };
  return { ...pos, positionHistory: [hashPosition(pos)] };
}

function opposite(c: Color): Color { return c === 'w' ? 'b' : 'w'; }

// Directional offsets (rank delta, file delta).
const BISHOP_DIRS: ReadonlyArray<readonly [number, number]> = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ROOK_DIRS: ReadonlyArray<readonly [number, number]> = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const QUEEN_DIRS: ReadonlyArray<readonly [number, number]> = [...BISHOP_DIRS, ...ROOK_DIRS];
const KNIGHT_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1],
];
const KING_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1],
];

// Square attack test — does `attacker` color attack `target` square?
// Used both for check detection and for castle-through-check validation.
// Does not consider en passant (irrelevant for check) or castling (king can't
// give check via castle).
function isSquareAttacked(board: (Piece | null)[], target: Square, attacker: Color): boolean {
  const tr = rankOf(target);
  const tf = fileOf(target);

  // Pawn attacks. White pawns attack toward smaller rank index (up the board),
  // black pawns attack toward larger rank index. So an enemy white pawn on
  // rank tr+1 (one rank "below" target visually) attacks target.
  const pawnRank = attacker === 'w' ? tr + 1 : tr - 1;
  for (const df of [-1, 1]) {
    if (inBounds(pawnRank, tf + df)) {
      const p = board[sqOf(pawnRank, tf + df)];
      if (p && p.color === attacker && p.type === 'P') return true;
    }
  }

  // Knight attacks.
  for (const [dr, df] of KNIGHT_OFFSETS) {
    if (inBounds(tr + dr, tf + df)) {
      const p = board[sqOf(tr + dr, tf + df)];
      if (p && p.color === attacker && p.type === 'N') return true;
    }
  }

  // King attacks (adjacent enemy king).
  for (const [dr, df] of KING_OFFSETS) {
    if (inBounds(tr + dr, tf + df)) {
      const p = board[sqOf(tr + dr, tf + df)];
      if (p && p.color === attacker && p.type === 'K') return true;
    }
  }

  // Sliding attacks: bishops/queens on diagonals, rooks/queens on orthogonals.
  for (const [dr, df] of BISHOP_DIRS) {
    let r = tr + dr, f = tf + df;
    while (inBounds(r, f)) {
      const p = board[sqOf(r, f)];
      if (p) {
        if (p.color === attacker && (p.type === 'B' || p.type === 'Q')) return true;
        break;
      }
      r += dr; f += df;
    }
  }
  for (const [dr, df] of ROOK_DIRS) {
    let r = tr + dr, f = tf + df;
    while (inBounds(r, f)) {
      const p = board[sqOf(r, f)];
      if (p) {
        if (p.color === attacker && (p.type === 'R' || p.type === 'Q')) return true;
        break;
      }
      r += dr; f += df;
    }
  }

  return false;
}

function findKing(board: (Piece | null)[], color: Color): Square {
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (p && p.color === color && p.type === 'K') return i;
  }
  // Should never happen in a legal game, but the move-generator's filter pass
  // shouldn't crash if a constructed position is missing a king.
  return -1;
}

export function isCheck(pos: Position, color: Color): boolean {
  const king = findKing(pos.board, color);
  if (king < 0) return false;
  return isSquareAttacked(pos.board, king, opposite(color));
}

// Pseudo-legal move generation. Does NOT filter for king safety — the caller
// (legalMoves) does that pass. Promotion expansion happens here so the
// filter step doesn't see un-promoted pawn moves to the back rank.
function pseudoLegalMoves(pos: Position, from: Square): Move[] {
  const piece = pos.board[from];
  if (!piece || piece.color !== pos.turn) return [];
  const moves: Move[] = [];
  const r = rankOf(from);
  const f = fileOf(from);

  const pushSlide = (dirs: ReadonlyArray<readonly [number, number]>) => {
    for (const [dr, df] of dirs) {
      let nr = r + dr, nf = f + df;
      while (inBounds(nr, nf)) {
        const to = sqOf(nr, nf);
        const target = pos.board[to];
        if (!target) {
          moves.push({ from, to });
        } else {
          if (target.color !== piece.color) moves.push({ from, to });
          break;
        }
        nr += dr; nf += df;
      }
    }
  };

  const pushStep = (offsets: ReadonlyArray<readonly [number, number]>) => {
    for (const [dr, df] of offsets) {
      const nr = r + dr, nf = f + df;
      if (!inBounds(nr, nf)) continue;
      const to = sqOf(nr, nf);
      const target = pos.board[to];
      if (!target || target.color !== piece.color) moves.push({ from, to });
    }
  };

  switch (piece.type) {
    case 'P': {
      const dir = piece.color === 'w' ? -1 : 1;
      const startRank = piece.color === 'w' ? 6 : 1;
      const promoRank = piece.color === 'w' ? 0 : 7;
      // Single push.
      const oneR = r + dir;
      if (inBounds(oneR, f) && !pos.board[sqOf(oneR, f)]) {
        if (oneR === promoRank) {
          for (const promotion of ['Q', 'R', 'B', 'N'] as const) {
            moves.push({ from, to: sqOf(oneR, f), promotion });
          }
        } else {
          moves.push({ from, to: sqOf(oneR, f) });
          // Double push only from starting rank, intermediate square also empty.
          if (r === startRank) {
            const twoR = r + 2 * dir;
            if (inBounds(twoR, f) && !pos.board[sqOf(twoR, f)]) {
              moves.push({ from, to: sqOf(twoR, f), flag: 'double-pawn' });
            }
          }
        }
      }
      // Captures.
      for (const df of [-1, 1]) {
        const nr = r + dir, nf = f + df;
        if (!inBounds(nr, nf)) continue;
        const to = sqOf(nr, nf);
        const target = pos.board[to];
        if (target && target.color !== piece.color) {
          if (nr === promoRank) {
            for (const promotion of ['Q', 'R', 'B', 'N'] as const) {
              moves.push({ from, to, promotion });
            }
          } else {
            moves.push({ from, to });
          }
        } else if (!target && pos.enPassantTarget === to) {
          moves.push({ from, to, flag: 'enpassant' });
        }
      }
      break;
    }
    case 'N':
      pushStep(KNIGHT_OFFSETS);
      break;
    case 'B':
      pushSlide(BISHOP_DIRS);
      break;
    case 'R':
      pushSlide(ROOK_DIRS);
      break;
    case 'Q':
      pushSlide(QUEEN_DIRS);
      break;
    case 'K': {
      pushStep(KING_OFFSETS);
      // Castling. King-safety filter rejects castling out of / through check,
      // but the destination check is part of the filter. We additionally
      // require: castling right intact, intervening squares empty, and the
      // squares the king passes through aren't attacked. The "not currently
      // in check" condition is handled because the filter rejects any move
      // that leaves the king in check after — combined with the path check,
      // that covers all three castle-illegality conditions.
      const enemy = opposite(piece.color);
      const homeRank = piece.color === 'w' ? 7 : 0;
      if (r === homeRank && f === 4) {
        const rights = pos.castling;
        const canK = piece.color === 'w' ? rights.wK : rights.bK;
        const canQ = piece.color === 'w' ? rights.wQ : rights.bQ;
        // Kingside: squares f and g must be empty; e, f, g must not be attacked.
        if (canK
          && !pos.board[sqOf(homeRank, 5)]
          && !pos.board[sqOf(homeRank, 6)]
          && !isSquareAttacked(pos.board, sqOf(homeRank, 4), enemy)
          && !isSquareAttacked(pos.board, sqOf(homeRank, 5), enemy)
          && !isSquareAttacked(pos.board, sqOf(homeRank, 6), enemy)) {
          moves.push({ from, to: sqOf(homeRank, 6), flag: 'castle-k' });
        }
        // Queenside: b/c/d empty; e, d, c not attacked. b1/b8 may be attacked.
        if (canQ
          && !pos.board[sqOf(homeRank, 1)]
          && !pos.board[sqOf(homeRank, 2)]
          && !pos.board[sqOf(homeRank, 3)]
          && !isSquareAttacked(pos.board, sqOf(homeRank, 4), enemy)
          && !isSquareAttacked(pos.board, sqOf(homeRank, 3), enemy)
          && !isSquareAttacked(pos.board, sqOf(homeRank, 2), enemy)) {
          moves.push({ from, to: sqOf(homeRank, 2), flag: 'castle-q' });
        }
      }
      break;
    }
  }

  return moves;
}

// Apply a move to a board WITHOUT validation or state housekeeping. Used by
// the king-safety filter (we just need to know if our king ends up attacked).
// Returns the resulting board only.
function applyMoveToBoard(board: (Piece | null)[], move: Move, mover: Piece): (Piece | null)[] {
  const next = board.slice();
  next[move.from] = null;
  if (move.flag === 'enpassant') {
    // Captured pawn sits behind the destination square (same file, mover's previous rank).
    const dir = mover.color === 'w' ? 1 : -1;
    const capturedSq = sqOf(rankOf(move.to) + dir, fileOf(move.to));
    next[capturedSq] = null;
    next[move.to] = mover;
  } else if (move.flag === 'castle-k') {
    const homeRank = rankOf(move.from);
    next[move.to] = mover;
    next[sqOf(homeRank, 5)] = next[sqOf(homeRank, 7)];
    next[sqOf(homeRank, 7)] = null;
  } else if (move.flag === 'castle-q') {
    const homeRank = rankOf(move.from);
    next[move.to] = mover;
    next[sqOf(homeRank, 3)] = next[sqOf(homeRank, 0)];
    next[sqOf(homeRank, 0)] = null;
  } else if (move.promotion) {
    next[move.to] = { color: mover.color, type: move.promotion };
  } else {
    next[move.to] = mover;
  }
  return next;
}

export function legalMoves(pos: Position, from?: Square): Move[] {
  const out: Move[] = [];
  const squares = from === undefined ? Array.from({ length: 64 }, (_, i) => i) : [from];
  for (const sq of squares) {
    const piece = pos.board[sq];
    if (!piece || piece.color !== pos.turn) continue;
    const pseudo = pseudoLegalMoves(pos, sq);
    for (const move of pseudo) {
      const nextBoard = applyMoveToBoard(pos.board, move, piece);
      const king = findKing(nextBoard, pos.turn);
      if (king < 0 || !isSquareAttacked(nextBoard, king, opposite(pos.turn))) {
        out.push(move);
      }
    }
  }
  return out;
}

// Are two moves the same for matching the caller's request? Promotion field
// is optional — caller may omit it to mean "default to queen."
function movesMatch(want: Move, have: Move): boolean {
  if (want.from !== have.from || want.to !== have.to) return false;
  if (have.promotion) {
    // Pawn promotion required. If caller omitted, default queen.
    const wantPromo = want.promotion ?? 'Q';
    return wantPromo === have.promotion;
  }
  return !want.promotion;
}

export function makeMove(pos: Position, move: Move): Position {
  const piece = pos.board[move.from];
  if (!piece) throw new Error(`No piece at ${squareToAlgebraic(move.from)}`);
  if (piece.color !== pos.turn) {
    throw new Error(`Not ${piece.color}'s turn`);
  }
  const legal = legalMoves(pos, move.from);
  const matched = legal.find((m) => movesMatch(move, m));
  if (!matched) {
    throw new Error(
      `Illegal move ${squareToAlgebraic(move.from)}-${squareToAlgebraic(move.to)}`,
    );
  }

  const captured = matched.flag === 'enpassant' ? { color: opposite(piece.color), type: 'P' as PieceType } : pos.board[matched.to];
  const nextBoard = applyMoveToBoard(pos.board, matched, piece);

  // Castling rights update — any king or rook move (or rook capture on its
  // home square) clears the affected right. Simpler to recompute per-square
  // than to enumerate every case.
  const castling: CastlingRights = { ...pos.castling };
  if (piece.type === 'K') {
    if (piece.color === 'w') { castling.wK = false; castling.wQ = false; }
    else { castling.bK = false; castling.bQ = false; }
  }
  if (piece.type === 'R') {
    if (piece.color === 'w' && move.from === sqOf(7, 0)) castling.wQ = false;
    if (piece.color === 'w' && move.from === sqOf(7, 7)) castling.wK = false;
    if (piece.color === 'b' && move.from === sqOf(0, 0)) castling.bQ = false;
    if (piece.color === 'b' && move.from === sqOf(0, 7)) castling.bK = false;
  }
  // Captured rook on its home square also clears the right.
  if (move.to === sqOf(7, 0)) castling.wQ = false;
  if (move.to === sqOf(7, 7)) castling.wK = false;
  if (move.to === sqOf(0, 0)) castling.bQ = false;
  if (move.to === sqOf(0, 7)) castling.bK = false;

  // En passant target: only set on double pawn push, points at the square
  // BEHIND the moved pawn (the square an enemy pawn would capture into).
  let enPassantTarget: Square | null = null;
  if (matched.flag === 'double-pawn') {
    const dir = piece.color === 'w' ? -1 : 1;
    enPassantTarget = sqOf(rankOf(move.from) + dir, fileOf(move.from));
  }

  const halfmoveClock = (piece.type === 'P' || captured) ? 0 : pos.halfmoveClock + 1;
  const fullmoveNumber = pos.turn === 'b' ? pos.fullmoveNumber + 1 : pos.fullmoveNumber;
  const turn: Color = opposite(pos.turn);

  const nextPos: Position = {
    board: nextBoard,
    turn,
    castling,
    enPassantTarget,
    halfmoveClock,
    fullmoveNumber,
    positionHistory: pos.positionHistory,
  };
  const hash = hashPosition(nextPos);
  return { ...nextPos, positionHistory: [...pos.positionHistory, hash] };
}

// K vs K, K+N vs K, K+B vs K, K+B vs K+B (same square color) are all draws.
function isInsufficientMaterial(board: (Piece | null)[]): boolean {
  const minors: { color: Color; type: PieceType; sq: Square }[] = [];
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p) continue;
    if (p.type === 'K') continue;
    if (p.type === 'P' || p.type === 'Q' || p.type === 'R') return false;
    minors.push({ color: p.color, type: p.type, sq: i });
  }
  if (minors.length === 0) return true;
  if (minors.length === 1) return true;
  if (minors.length === 2 && minors[0].type === 'B' && minors[1].type === 'B') {
    // Same-square-color bishops on either side is dead; opposite-color isn't.
    const sqColor = (sq: Square) => (rankOf(sq) + fileOf(sq)) % 2;
    return sqColor(minors[0].sq) === sqColor(minors[1].sq);
  }
  return false;
}

export function gameStatus(pos: Position): GameStatus {
  if (isInsufficientMaterial(pos.board)) return 'draw-insufficient';
  if (pos.halfmoveClock >= 100) return 'draw-50-move';
  // Threefold = current position (counting from any prior identical) has
  // appeared three times. positionHistory includes the current position.
  if (pos.positionHistory.length > 0) {
    const current = pos.positionHistory[pos.positionHistory.length - 1];
    let count = 0;
    for (const h of pos.positionHistory) if (h === current) count++;
    if (count >= 3) return 'draw-threefold';
  }
  const moves = legalMoves(pos);
  const inCheck = isCheck(pos, pos.turn);
  if (moves.length === 0) return inCheck ? 'checkmate' : 'stalemate';
  return inCheck ? 'check' : 'playing';
}
