import { describe, it, expect } from 'vitest';
import { parseFEN, toFEN } from '../fen';
import { initialPosition } from '../engine';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// Kiwipete — standard perft sanity position.
const KIWIPETE = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';
const EMPTY_BOARD = '8/8/8/8/8/8/8/8 w - - 0 1';

describe('FEN round-trip', () => {
  it('initialPosition → toFEN matches the standard starting FEN', () => {
    expect(toFEN(initialPosition())).toBe(STARTING_FEN);
  });
  it('parseFEN(starting) → toFEN round-trips', () => {
    expect(toFEN(parseFEN(STARTING_FEN))).toBe(STARTING_FEN);
  });
  it('Kiwipete round-trips', () => {
    expect(toFEN(parseFEN(KIWIPETE))).toBe(KIWIPETE);
  });
  it('empty board round-trips', () => {
    expect(toFEN(parseFEN(EMPTY_BOARD))).toBe(EMPTY_BOARD);
  });
});

describe('castling field serialization', () => {
  it('full KQkq', () => {
    const fen = '4k3/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
    expect(toFEN(parseFEN(fen))).toBe(fen);
  });
  it('partial Kq', () => {
    const fen = '4k3/8/8/8/8/8/8/R3K2R w Kq - 0 1';
    expect(toFEN(parseFEN(fen))).toBe(fen);
  });
  it('none -', () => {
    const fen = '4k3/8/8/8/8/8/8/R3K2R w - - 0 1';
    expect(toFEN(parseFEN(fen))).toBe(fen);
  });
});

describe('en passant target serialization', () => {
  it('e3 target after white 1.e4', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    expect(toFEN(parseFEN(fen))).toBe(fen);
  });
});

describe('FEN validation', () => {
  it('rejects wrong field count', () => {
    expect(() => parseFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0')).toThrow();
  });
  it('rejects bad piece character', () => {
    expect(() => parseFEN('xxxxxxxx/8/8/8/8/8/8/8 w - - 0 1')).toThrow();
  });
  it('rejects rank that does not sum to 8', () => {
    expect(() => parseFEN('rnbqkbnr/ppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toThrow();
  });
  it('rejects invalid turn', () => {
    expect(() => parseFEN('8/8/8/8/8/8/8/8 x - - 0 1')).toThrow();
  });
});
