import { describe, it, expect } from 'vitest';
import {
  initialPosition,
  legalMoves,
  makeMove,
  isCheck,
  gameStatus,
  squareToAlgebraic,
  algebraicToSquare,
  type Move,
  type Position,
  type Piece,
} from '../engine';
import { parseFEN } from '../fen';

function emptyBoard(): (Piece | null)[] {
  return new Array(64).fill(null);
}

// Build a position from a sparse {square: piece} map. Used so tests can read
// like board diagrams without dragging in 64 nulls.
function buildPosition(args: {
  pieces: Record<string, Piece>;
  turn?: 'w' | 'b';
  castling?: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean };
  enPassantTarget?: number | null;
  halfmoveClock?: number;
  fullmoveNumber?: number;
}): Position {
  const board = emptyBoard();
  for (const [sq, piece] of Object.entries(args.pieces)) {
    board[algebraicToSquare(sq)] = piece;
  }
  return {
    board,
    turn: args.turn ?? 'w',
    castling: args.castling ?? { wK: false, wQ: false, bK: false, bQ: false },
    enPassantTarget: args.enPassantTarget ?? null,
    halfmoveClock: args.halfmoveClock ?? 0,
    fullmoveNumber: args.fullmoveNumber ?? 1,
    positionHistory: [],
  };
}

describe('coordinate helpers', () => {
  it('a8 = 0, h1 = 63', () => {
    expect(algebraicToSquare('a8')).toBe(0);
    expect(algebraicToSquare('h1')).toBe(63);
    expect(squareToAlgebraic(0)).toBe('a8');
    expect(squareToAlgebraic(63)).toBe('h1');
  });
  it('round-trips every square', () => {
    for (let i = 0; i < 64; i++) {
      expect(algebraicToSquare(squareToAlgebraic(i))).toBe(i);
    }
  });
});

describe('initial position', () => {
  it('white has 20 legal moves', () => {
    const pos = initialPosition();
    expect(legalMoves(pos)).toHaveLength(20);
  });
  it('starting status is playing', () => {
    expect(gameStatus(initialPosition())).toBe('playing');
  });
  it('neither side is in check', () => {
    const pos = initialPosition();
    expect(isCheck(pos, 'w')).toBe(false);
    expect(isCheck(pos, 'b')).toBe(false);
  });
});

describe('pawn movement', () => {
  it('white pawn from rank 2 can single-push and double-push', () => {
    const pos = initialPosition();
    const e2 = algebraicToSquare('e2');
    const moves = legalMoves(pos, e2);
    expect(moves).toHaveLength(2);
    const tos = moves.map((m) => squareToAlgebraic(m.to)).sort();
    expect(tos).toEqual(['e3', 'e4']);
  });
  it('pawn cannot push to an occupied square', () => {
    const pos = buildPosition({
      pieces: {
        e2: { color: 'w', type: 'P' },
        e3: { color: 'b', type: 'P' },
        e1: { color: 'w', type: 'K' },
        e8: { color: 'b', type: 'K' },
      },
    });
    const moves = legalMoves(pos, algebraicToSquare('e2'));
    expect(moves).toHaveLength(0);
  });
  it('pawn cannot double-push if intermediate square is occupied', () => {
    const pos = buildPosition({
      pieces: {
        e2: { color: 'w', type: 'P' },
        e3: { color: 'b', type: 'P' },
        e1: { color: 'w', type: 'K' },
        e8: { color: 'b', type: 'K' },
      },
    });
    const moves = legalMoves(pos, algebraicToSquare('e2'));
    expect(moves.map((m) => squareToAlgebraic(m.to))).not.toContain('e4');
  });
});

describe('en passant', () => {
  it('captures the pawn and removes it; window closes after one move', () => {
    // After 1.e4 Nf6 2.e5 d5, white's e5 pawn can capture d5 en passant.
    let pos = initialPosition();
    pos = makeMove(pos, { from: algebraicToSquare('e2'), to: algebraicToSquare('e4') });
    pos = makeMove(pos, { from: algebraicToSquare('g8'), to: algebraicToSquare('f6') });
    pos = makeMove(pos, { from: algebraicToSquare('e4'), to: algebraicToSquare('e5') });
    pos = makeMove(pos, { from: algebraicToSquare('d7'), to: algebraicToSquare('d5') });

    expect(pos.enPassantTarget).toBe(algebraicToSquare('d6'));
    const epMove: Move = {
      from: algebraicToSquare('e5'),
      to: algebraicToSquare('d6'),
      flag: 'enpassant',
    };
    const after = makeMove(pos, epMove);
    expect(after.board[algebraicToSquare('d6')]).toEqual({ color: 'w', type: 'P' });
    expect(after.board[algebraicToSquare('d5')]).toBeNull();
    expect(after.board[algebraicToSquare('e5')]).toBeNull();
    expect(after.enPassantTarget).toBeNull();
  });
});

describe('castling', () => {
  function castleSetup(extra: Record<string, Piece> = {}): Position {
    return buildPosition({
      pieces: {
        e1: { color: 'w', type: 'K' },
        a1: { color: 'w', type: 'R' },
        h1: { color: 'w', type: 'R' },
        e8: { color: 'b', type: 'K' },
        a8: { color: 'b', type: 'R' },
        h8: { color: 'b', type: 'R' },
        ...extra,
      },
      castling: { wK: true, wQ: true, bK: true, bQ: true },
    });
  }
  it('legal kingside and queenside when path is clear', () => {
    const pos = castleSetup();
    const moves = legalMoves(pos, algebraicToSquare('e1'));
    const flags = moves.map((m) => m.flag).filter(Boolean);
    expect(flags).toContain('castle-k');
    expect(flags).toContain('castle-q');
  });
  it('cannot castle through a piece', () => {
    const pos = castleSetup({ f1: { color: 'w', type: 'N' } });
    const moves = legalMoves(pos, algebraicToSquare('e1'));
    expect(moves.find((m) => m.flag === 'castle-k')).toBeUndefined();
  });
  it('cannot castle while in check', () => {
    const pos = castleSetup({ e2: { color: 'b', type: 'R' } });
    const moves = legalMoves(pos, algebraicToSquare('e1'));
    expect(moves.find((m) => m.flag === 'castle-k')).toBeUndefined();
    expect(moves.find((m) => m.flag === 'castle-q')).toBeUndefined();
  });
  it('cannot castle through an attacked square', () => {
    const pos = castleSetup({ f8: { color: 'b', type: 'R' } });
    const moves = legalMoves(pos, algebraicToSquare('e1'));
    expect(moves.find((m) => m.flag === 'castle-k')).toBeUndefined();
  });
  it('cannot castle if rook moved (right cleared)', () => {
    const pos = buildPosition({
      pieces: {
        e1: { color: 'w', type: 'K' },
        a1: { color: 'w', type: 'R' },
        h1: { color: 'w', type: 'R' },
        e8: { color: 'b', type: 'K' },
      },
      castling: { wK: false, wQ: true, bK: false, bQ: false },
    });
    const moves = legalMoves(pos, algebraicToSquare('e1'));
    expect(moves.find((m) => m.flag === 'castle-k')).toBeUndefined();
    expect(moves.find((m) => m.flag === 'castle-q')).toBeDefined();
  });
  it('king move clears both castling rights', () => {
    const pos = castleSetup();
    const after = makeMove(pos, { from: algebraicToSquare('e1'), to: algebraicToSquare('e2') });
    expect(after.castling.wK).toBe(false);
    expect(after.castling.wQ).toBe(false);
  });
});

describe('promotion', () => {
  it('produces 4 moves on the 8th rank', () => {
    const pos = buildPosition({
      pieces: {
        e7: { color: 'w', type: 'P' },
        e1: { color: 'w', type: 'K' },
        h8: { color: 'b', type: 'K' },
      },
    });
    const moves = legalMoves(pos, algebraicToSquare('e7'));
    expect(moves).toHaveLength(4);
    const promos = moves.map((m) => m.promotion).sort();
    expect(promos).toEqual(['B', 'N', 'Q', 'R']);
  });
  it('defaults to queen when promotion omitted', () => {
    const pos = buildPosition({
      pieces: {
        e7: { color: 'w', type: 'P' },
        e1: { color: 'w', type: 'K' },
        h8: { color: 'b', type: 'K' },
      },
    });
    const after = makeMove(pos, {
      from: algebraicToSquare('e7'),
      to: algebraicToSquare('e8'),
    });
    expect(after.board[algebraicToSquare('e8')]).toEqual({ color: 'w', type: 'Q' });
  });
  it('promotion to knight produces a knight of the correct color', () => {
    const pos = buildPosition({
      pieces: {
        e7: { color: 'w', type: 'P' },
        e1: { color: 'w', type: 'K' },
        h8: { color: 'b', type: 'K' },
      },
    });
    const after = makeMove(pos, {
      from: algebraicToSquare('e7'),
      to: algebraicToSquare('e8'),
      promotion: 'N',
    });
    expect(after.board[algebraicToSquare('e8')]).toEqual({ color: 'w', type: 'N' });
  });
});

describe('piece movement', () => {
  it('knight from center has 8 moves', () => {
    const pos = buildPosition({
      pieces: {
        d4: { color: 'w', type: 'N' },
        e1: { color: 'w', type: 'K' },
        h8: { color: 'b', type: 'K' },
      },
    });
    expect(legalMoves(pos, algebraicToSquare('d4'))).toHaveLength(8);
  });
  it('knight from a1 has 2 moves', () => {
    const pos = buildPosition({
      pieces: {
        a1: { color: 'w', type: 'N' },
        h1: { color: 'w', type: 'K' },
        h8: { color: 'b', type: 'K' },
      },
    });
    const tos = legalMoves(pos, algebraicToSquare('a1')).map((m) => squareToAlgebraic(m.to)).sort();
    expect(tos).toEqual(['b3', 'c2']);
  });
  it('knight jumps over friendly pieces', () => {
    const pos = buildPosition({
      pieces: {
        d4: { color: 'w', type: 'N' },
        d5: { color: 'w', type: 'P' },
        e5: { color: 'w', type: 'P' },
        d3: { color: 'w', type: 'P' },
        c4: { color: 'w', type: 'P' },
        e4: { color: 'w', type: 'P' },
        e1: { color: 'w', type: 'K' },
        h8: { color: 'b', type: 'K' },
      },
    });
    expect(legalMoves(pos, algebraicToSquare('d4'))).toHaveLength(8);
  });
  it('rook stops at first piece (capture enemy, blocked by friend)', () => {
    const pos = buildPosition({
      pieces: {
        d4: { color: 'w', type: 'R' },
        d6: { color: 'b', type: 'P' },
        d2: { color: 'w', type: 'P' },
        e1: { color: 'w', type: 'K' },
        h8: { color: 'b', type: 'K' },
      },
    });
    const tos = legalMoves(pos, algebraicToSquare('d4')).map((m) => squareToAlgebraic(m.to)).sort();
    // North: d5, d6 (capture). South: d3 (blocked by d2). West: a4-c4. East: e4-h4.
    expect(tos).toEqual(['a4', 'b4', 'c4', 'd3', 'd5', 'd6', 'e4', 'f4', 'g4', 'h4']);
  });
  it('bishop stops at first piece', () => {
    const pos = buildPosition({
      pieces: {
        d4: { color: 'w', type: 'B' },
        f6: { color: 'b', type: 'P' },
        b2: { color: 'w', type: 'P' },
        e1: { color: 'w', type: 'K' },
        h8: { color: 'b', type: 'K' },
      },
    });
    const tos = legalMoves(pos, algebraicToSquare('d4')).map((m) => squareToAlgebraic(m.to)).sort();
    // NE: e5, f6 (cap). NW: c5, b6, a7. SE: e3, f2, g1. SW: c3 (blocked by b2).
    expect(tos).toEqual(['a7', 'b6', 'c3', 'c5', 'e3', 'e5', 'f2', 'f6', 'g1']);
  });
  it('queen combines bishop + rook movement', () => {
    const pos = buildPosition({
      pieces: {
        d4: { color: 'w', type: 'Q' },
        e1: { color: 'w', type: 'K' },
        h8: { color: 'b', type: 'K' },
      },
    });
    // 7+7+7+6 (rook) + 4+3+3+3 (bishop) directional rays from d4.
    expect(legalMoves(pos, algebraicToSquare('d4'))).toHaveLength(27);
  });
});

describe('king cannot move into check', () => {
  it('blocked by a rook on the rank', () => {
    const pos = buildPosition({
      pieces: {
        e1: { color: 'w', type: 'K' },
        e8: { color: 'b', type: 'R' },
        h8: { color: 'b', type: 'K' },
      },
    });
    const tos = legalMoves(pos, algebraicToSquare('e1')).map((m) => squareToAlgebraic(m.to)).sort();
    // King can't move along the e-file. Can shuffle to d1/f1/d2/f2.
    expect(tos).toEqual(['d1', 'd2', 'f1', 'f2']);
  });
});

describe('pinned piece cannot move out of pin', () => {
  it('absolute pin blocks all but capturing the pinner', () => {
    // White king on e1, white bishop on e4, black rook on e8 — bishop is pinned.
    const pos = buildPosition({
      pieces: {
        e1: { color: 'w', type: 'K' },
        e4: { color: 'w', type: 'B' },
        e8: { color: 'b', type: 'R' },
        h8: { color: 'b', type: 'K' },
      },
    });
    const bishopMoves = legalMoves(pos, algebraicToSquare('e4'));
    expect(bishopMoves).toHaveLength(0);
  });
});

describe('checkmate / stalemate', () => {
  it("fool's mate — 1.f3 e5 2.g4 Qh4# — is checkmate", () => {
    let pos = initialPosition();
    pos = makeMove(pos, { from: algebraicToSquare('f2'), to: algebraicToSquare('f3') });
    pos = makeMove(pos, { from: algebraicToSquare('e7'), to: algebraicToSquare('e5') });
    pos = makeMove(pos, { from: algebraicToSquare('g2'), to: algebraicToSquare('g4') });
    pos = makeMove(pos, { from: algebraicToSquare('d8'), to: algebraicToSquare('h4') });
    expect(gameStatus(pos)).toBe('checkmate');
  });
  it('classic K+Q stalemate', () => {
    // Black king on a8, white queen on c7, white king on c6 — black to move,
    // not in check, no legal moves.
    const pos = buildPosition({
      pieces: {
        a8: { color: 'b', type: 'K' },
        c7: { color: 'w', type: 'Q' },
        c6: { color: 'w', type: 'K' },
      },
      turn: 'b',
    });
    expect(gameStatus(pos)).toBe('stalemate');
  });
});

describe('insufficient material', () => {
  it('K vs K', () => {
    const pos = buildPosition({
      pieces: { e1: { color: 'w', type: 'K' }, e8: { color: 'b', type: 'K' } },
    });
    expect(gameStatus(pos)).toBe('draw-insufficient');
  });
  it('K+N vs K', () => {
    const pos = buildPosition({
      pieces: {
        e1: { color: 'w', type: 'K' },
        b1: { color: 'w', type: 'N' },
        e8: { color: 'b', type: 'K' },
      },
    });
    expect(gameStatus(pos)).toBe('draw-insufficient');
  });
  it('K+B vs K', () => {
    const pos = buildPosition({
      pieces: {
        e1: { color: 'w', type: 'K' },
        c1: { color: 'w', type: 'B' },
        e8: { color: 'b', type: 'K' },
      },
    });
    expect(gameStatus(pos)).toBe('draw-insufficient');
  });
  it('K+B vs K+B same color squares is dead', () => {
    // c1 and f4 are both dark squares.
    const pos = buildPosition({
      pieces: {
        e1: { color: 'w', type: 'K' },
        c1: { color: 'w', type: 'B' },
        e8: { color: 'b', type: 'K' },
        f4: { color: 'b', type: 'B' },
      },
    });
    expect(gameStatus(pos)).toBe('draw-insufficient');
  });
  it('K+B vs K+B opposite color squares is NOT dead', () => {
    // c1 is dark, f5 is light.
    const pos = buildPosition({
      pieces: {
        e1: { color: 'w', type: 'K' },
        c1: { color: 'w', type: 'B' },
        e8: { color: 'b', type: 'K' },
        f5: { color: 'b', type: 'B' },
      },
    });
    expect(gameStatus(pos)).not.toBe('draw-insufficient');
  });
});

describe('50-move rule', () => {
  it('halfmove clock = 100 → draw', () => {
    const pos = parseFEN('4k3/8/8/8/8/8/8/4K2R w K - 100 60');
    expect(gameStatus(pos)).toBe('draw-50-move');
  });
});

describe('threefold repetition', () => {
  it('shuffling knights three times triggers draw', () => {
    let pos = initialPosition();
    // Nb1-c3, Nb8-c6, Nc3-b1, Nc6-b8 — twice — gets us 3 occurrences of start.
    const cycle: Move[] = [
      { from: algebraicToSquare('b1'), to: algebraicToSquare('c3') },
      { from: algebraicToSquare('b8'), to: algebraicToSquare('c6') },
      { from: algebraicToSquare('c3'), to: algebraicToSquare('b1') },
      { from: algebraicToSquare('c6'), to: algebraicToSquare('b8') },
    ];
    for (const m of cycle) pos = makeMove(pos, m);
    for (const m of cycle) pos = makeMove(pos, m);
    expect(gameStatus(pos)).toBe('draw-threefold');
  });
});

describe('makeMove correctness', () => {
  it('returns a new Position; original is not mutated', () => {
    const pos = initialPosition();
    const originalBoard = pos.board.slice();
    makeMove(pos, { from: algebraicToSquare('e2'), to: algebraicToSquare('e4') });
    expect(pos.board).toEqual(originalBoard);
  });
  it('throws on an illegal move', () => {
    const pos = initialPosition();
    expect(() =>
      makeMove(pos, { from: algebraicToSquare('e2'), to: algebraicToSquare('e5') }),
    ).toThrow();
  });
  it('sets en passant target on double pawn push', () => {
    const pos = initialPosition();
    const after = makeMove(pos, {
      from: algebraicToSquare('e2'),
      to: algebraicToSquare('e4'),
    });
    expect(after.enPassantTarget).toBe(algebraicToSquare('e3'));
  });
  it('increments fullmove only after black moves', () => {
    let pos = initialPosition();
    pos = makeMove(pos, { from: algebraicToSquare('e2'), to: algebraicToSquare('e4') });
    expect(pos.fullmoveNumber).toBe(1);
    pos = makeMove(pos, { from: algebraicToSquare('e7'), to: algebraicToSquare('e5') });
    expect(pos.fullmoveNumber).toBe(2);
  });
});
