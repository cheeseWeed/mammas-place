// game-state tests: new/apply/finish + JSON round-trip.

import { describe, it, expect } from 'vitest';
import {
  STARTING_FEN,
  applyMoveUci,
  emptyProgress,
  finishGame,
  newGame,
  normalizeProgress,
  type ChessProgress,
  type SavedChessGame,
} from '../game-state';

describe('newGame', () => {
  it('produces a valid SavedChessGame at the starting FEN', () => {
    const g = newGame({
      mode: 'local',
      players: { white: 'Alice', black: 'Bob' },
      theme: 'classic',
    });
    expect(g.fen).toBe(STARTING_FEN);
    expect(g.moveHistory).toEqual([]);
    expect(g.mode).toBe('local');
    expect(g.players.white).toBe('Alice');
    expect(g.players.black).toBe('Bob');
    expect(g.theme).toBe('classic');
    expect(g.id.length).toBeGreaterThan(0);
    expect(g.startedAt).toBeGreaterThan(0);
    expect(g.updatedAt).toBe(g.startedAt);
    expect(g.result).toBeUndefined();
  });

  it('AI game requires aiLevel and aiColor', () => {
    expect(() => newGame({
      mode: 'ai',
      players: { white: 'Alice', black: 'Cub' },
      theme: 'classic',
    })).toThrow(/aiLevel/);
    expect(() => newGame({
      mode: 'ai',
      aiLevel: 'cub',
      players: { white: 'Alice', black: 'Cub' },
      theme: 'classic',
    })).toThrow(/aiColor/);
  });

  it('AI game with aiLevel + aiColor succeeds', () => {
    const g = newGame({
      mode: 'ai',
      aiLevel: 'wizard',
      aiColor: 'b',
      players: { white: 'Kid', black: 'Wizard' },
      theme: 'classic',
    });
    expect(g.aiLevel).toBe('wizard');
    expect(g.aiColor).toBe('b');
  });
});

describe('applyMoveUci', () => {
  function fresh(): SavedChessGame {
    return newGame({
      mode: 'local',
      players: { white: 'A', black: 'B' },
      theme: 'classic',
    });
  }

  it('changes FEN correctly for e2e4', () => {
    const g0 = fresh();
    const g1 = applyMoveUci(g0, 'e2e4');
    expect(g1.fen).not.toBe(g0.fen);
    // Side-to-move flips to black.
    expect(g1.fen.split(' ')[1]).toBe('b');
    // Pawn lands on e4 — pre-rank-4 segment of the FEN should now
    // contain a 'P' offset 4 from the right.
    expect(g1.fen.startsWith('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR')).toBe(true);
    expect(g1.moveHistory).toEqual(['e2e4']);
    expect(g1.updatedAt).toBeGreaterThanOrEqual(g0.updatedAt);
  });

  it('rejects illegal moves', () => {
    const g0 = fresh();
    // e2 to e5 is not legal at the start.
    expect(() => applyMoveUci(g0, 'e2e5')).toThrow();
  });

  it('rejects malformed UCI', () => {
    const g0 = fresh();
    expect(() => applyMoveUci(g0, 'foo')).toThrow();
    expect(() => applyMoveUci(g0, 'e2')).toThrow();
    expect(() => applyMoveUci(g0, 'e9e4')).toThrow();
  });

  it('promotion: e7e8q works from a promotion-ready position', () => {
    // Set up a custom position with a white pawn on e7, ready to promote.
    // Use direct construction since newGame always starts at standard.
    // White pawn on e7 ready to promote; kings far apart to keep this legal.
    const promotionFen = '7k/4P3/8/8/8/8/8/4K3 w - - 0 1';
    const g0: SavedChessGame = {
      id: 'test',
      startedAt: 1, updatedAt: 1,
      mode: 'local',
      players: { white: 'A', black: 'B' },
      fen: promotionFen,
      moveHistory: [],
      theme: 'classic',
    };
    const g1 = applyMoveUci(g0, 'e7e8q');
    expect(g1.moveHistory).toEqual(['e7e8q']);
    // FEN should now have a Q on e8 (top rank). Top rank had a king on h8,
    // so after promotion it's "4Q2k" (4 empty + Q + 2 empty + k).
    expect(g1.fen.split(' ')[0].startsWith('4Q2k')).toBe(true);
  });

  it('finishGame sets result; further applyMoveUci throws', () => {
    const g0 = fresh();
    const g1 = applyMoveUci(g0, 'e2e4');
    const finished = finishGame(g1, {
      winner: 'draw',
      reason: 'resignation',
      finalFen: g1.fen,
    });
    expect(finished.result).toBeDefined();
    expect(finished.result?.winner).toBe('draw');
    expect(() => applyMoveUci(finished, 'e7e5')).toThrow(/finished/i);
  });

  it('finishGame is idempotent — second call returns the same game', () => {
    const g0 = fresh();
    const f1 = finishGame(g0, { winner: 'w', reason: 'resignation', finalFen: g0.fen });
    const f2 = finishGame(f1, { winner: 'b', reason: 'checkmate', finalFen: g0.fen });
    expect(f2.result?.winner).toBe('w'); // first result wins.
  });
});

describe('ChessProgress JSON round-trip', () => {
  it('emptyProgress round-trips', () => {
    const p = emptyProgress();
    const json = JSON.stringify(p);
    const parsed = JSON.parse(json) as ChessProgress;
    expect(parsed).toEqual(p);
  });

  it('progress with current + history + totals round-trips', () => {
    const g1 = newGame({ mode: 'local', players: { white: 'a', black: 'b' }, theme: 'classic' });
    const g2 = newGame({ mode: 'ai', aiLevel: 'wizard', aiColor: 'b', players: { white: 'kid', black: 'wiz' }, theme: 'royal' });
    const finished = finishGame(g2, { winner: 'w', reason: 'checkmate', finalFen: g2.fen });
    const p: ChessProgress = {
      current: g1,
      recentGames: [finished],
      totalGames: 1,
      totalWins: { vsHuman: 0, vsCub: 0, vsKnight: 0, vsWizard: 1 },
      totalEarnedCents: 375,
    };
    const json = JSON.stringify(p);
    const parsed = JSON.parse(json) as ChessProgress;
    expect(parsed).toEqual(p);
    // Re-stringify must be byte-identical.
    expect(JSON.stringify(parsed)).toBe(json);
  });

  it('normalizeProgress accepts an empty object (legacy default)', () => {
    expect(normalizeProgress({})).toEqual(emptyProgress());
  });

  it('normalizeProgress accepts null/undefined', () => {
    expect(normalizeProgress(null)).toEqual(emptyProgress());
    expect(normalizeProgress(undefined)).toEqual(emptyProgress());
  });

  it('normalizeProgress preserves a valid blob', () => {
    const blob: ChessProgress = {
      recentGames: [],
      totalGames: 3,
      totalWins: { vsHuman: 1, vsCub: 1, vsKnight: 0, vsWizard: 1 },
      totalEarnedCents: 500,
    };
    const round = normalizeProgress(JSON.parse(JSON.stringify(blob)));
    expect(round).toEqual(blob);
  });
});
