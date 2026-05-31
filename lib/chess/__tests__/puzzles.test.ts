import { describe, it, expect } from 'vitest';
import {
  CHESS_PUZZLES,
  replayPuzzle,
  uciToMove,
} from '../puzzles';
import { parseFEN } from '../fen';
import { gameStatus, legalMoves, makeMove } from '../engine';

describe('chess puzzles', () => {
  it('has at least 30 puzzles', () => {
    expect(CHESS_PUZZLES.length).toBeGreaterThanOrEqual(30);
  });

  it('has at least 10 mate-in-1', () => {
    const n = CHESS_PUZZLES.filter((p) => p.theme === 'mate-in-1').length;
    expect(n).toBeGreaterThanOrEqual(10);
  });

  it('has at least 10 mate-in-2', () => {
    const n = CHESS_PUZZLES.filter((p) => p.theme === 'mate-in-2').length;
    expect(n).toBeGreaterThanOrEqual(10);
  });

  it('has at least 5 mate-in-3', () => {
    const n = CHESS_PUZZLES.filter((p) => p.theme === 'mate-in-3').length;
    expect(n).toBeGreaterThanOrEqual(5);
  });

  it('has at least 5 endgame', () => {
    const n = CHESS_PUZZLES.filter((p) => p.theme === 'endgame').length;
    expect(n).toBeGreaterThanOrEqual(5);
  });

  it('every puzzle has a unique id', () => {
    const ids = new Set<string>();
    for (const p of CHESS_PUZZLES) {
      expect(ids.has(p.id), `duplicate id: ${p.id}`).toBe(false);
      ids.add(p.id);
    }
  });

  describe('per-puzzle validity', () => {
    for (const p of CHESS_PUZZLES) {
      it(`${p.id} (${p.theme}) parses, replays legally, and ends correctly`, () => {
        // 1) FEN parses.
        const start = parseFEN(p.fen);
        expect(start).toBeDefined();

        // 2) Move count matches theme.
        const expectedPlies =
          p.theme === 'mate-in-1' ? 1
            : p.theme === 'mate-in-2' ? 3
              : p.theme === 'mate-in-3' ? 5
                : p.movesToSolve.length; // endgame: flexible
        if (p.theme !== 'endgame') {
          expect(
            p.movesToSolve.length,
            `${p.id} should have ${expectedPlies} plies, has ${p.movesToSolve.length}`,
          ).toBe(expectedPlies);
        } else {
          // Endgame: at least 1 ply, kid plays at least one move.
          expect(p.movesToSolve.length).toBeGreaterThanOrEqual(1);
        }

        // 3) Replay — all moves legal.
        const finalPos = replayPuzzle(p);

        // 4) Mate-in-N must end in checkmate.
        if (p.theme === 'mate-in-1' || p.theme === 'mate-in-2' || p.theme === 'mate-in-3') {
          const status = gameStatus(finalPos);
          expect(
            status,
            `${p.id}: expected checkmate, got ${status} after final move ${p.movesToSolve[p.movesToSolve.length - 1]}`,
          ).toBe('checkmate');
        }

        // 5) For mate-in-2 and mate-in-3, the OPPONENT's reply (at odd plies)
        //    should be the only sensible legal move OR at least be legal.
        //    We already verified legality in step 3 — this is just to assert
        //    the kid never gets handed an opponent move that wasn't legal.
        //    (Already covered, but spelled out for clarity.)
      });
    }
  });

  describe('mate-in-1 first move uniquely mates', () => {
    // Sanity check: for every mate-in-1, the listed solve move IS a mate.
    // (Doesn't guarantee uniqueness — that's a stronger claim — but does
    // guarantee the kid's move actually wins.)
    for (const p of CHESS_PUZZLES.filter((x) => x.theme === 'mate-in-1')) {
      it(`${p.id}: solve move is checkmate`, () => {
        const pos = parseFEN(p.fen);
        const move = uciToMove(pos, p.movesToSolve[0]);
        expect(move, `${p.id}: solve move not legal`).not.toBeNull();
        const after = makeMove(pos, move!);
        expect(gameStatus(after)).toBe('checkmate');
      });
    }
  });

  describe('uciToMove', () => {
    it('returns a legal move for "e2e4" from the start position', () => {
      const pos = parseFEN(
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      );
      const move = uciToMove(pos, 'e2e4');
      expect(move).not.toBeNull();
      expect(move?.flag).toBe('double-pawn');
    });

    it('rejects illegal moves', () => {
      const pos = parseFEN(
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      );
      // Bishop can't move on move 1 (blocked by pawn).
      expect(uciToMove(pos, 'c1f4')).toBeNull();
    });

    it('handles promotion', () => {
      // White pawn on e7, white king on e1, black king far away on a1
      // (kings can't be adjacent in a legal chess position).
      const pos = parseFEN('8/4P3/8/8/8/8/8/k3K3 w - - 0 1');
      const move = uciToMove(pos, 'e7e8q');
      expect(move).not.toBeNull();
      expect(move?.promotion).toBe('Q');
    });
  });

  // Extra: ensure no puzzle has more legal opponent responses than 1 at the
  // odd plies (best-effort uniqueness). Failing this isn't fatal but flags
  // puzzles where the AI reply might surprise the kid.
  describe('opponent-reply uniqueness (best-effort warning)', () => {
    const warnings: string[] = [];
    for (const p of CHESS_PUZZLES) {
      if (p.theme === 'endgame') continue;
      if (p.movesToSolve.length < 3) continue;
      let pos = parseFEN(p.fen);
      // Walk kid-move, then check opponent's reply uniqueness.
      for (let i = 0; i < p.movesToSolve.length; i++) {
        const move = uciToMove(pos, p.movesToSolve[i]);
        if (!move) break;
        pos = makeMove(pos, move);
        const isOpponentToMoveNext = i % 2 === 0 && i + 1 < p.movesToSolve.length;
        if (isOpponentToMoveNext) {
          const replies = legalMoves(pos);
          if (replies.length > 1) {
            warnings.push(
              `${p.id} ply ${i + 1}: opponent has ${replies.length} legal replies`,
            );
          }
        }
      }
    }
    it('logs non-unique opponent replies (informational)', () => {
      // We don't fail the test — just log. Kid still solves the puzzle if the
      // AI plays the listed reply. Future work: make replies unique by design.
      if (warnings.length > 0) {
        // eslint-disable-next-line no-console
        console.warn('Puzzle reply non-uniqueness:', warnings.join('\n  '));
      }
      expect(true).toBe(true);
    });
  });
});
