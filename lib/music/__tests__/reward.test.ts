import { describe, it, expect } from 'vitest';
import { computePracticeReward, computePerformReward, minutesMultiplier, rewardCurve, DAILY_PIECE_CAP_CENTS, clampScore } from '../reward';
import { planForPiece, planForToday, linesLearned, bestScore } from '../plan';
import type { MusicPiece } from '../types';

describe('music practice reward', () => {
  // Default to 30 min (full credit) unless a test is specifically about time.
  const full = (qualityScore: number, linesPracticed = 0) =>
    computePracticeReward({ qualityScore, linesPracticed, minutesPracticed: 30 });

  it('pays the show-up base on a rough day (score 1, 30 min)', () => {
    expect(full(1, 2).cents).toBe(15 * 100); // 15 MP base, no quality bonus
  });

  it('caps at 100 MP for a perfect (10/10) day at 30 min', () => {
    expect(full(10, 5).cents).toBe(DAILY_PIECE_CAP_CENTS);
    expect(full(10, 5).cents).toBe(100 * 100);
  });

  it('is steep — a 10 pays much more than a 6', () => {
    expect(full(10).cents).toBeGreaterThan(full(6).cents * 2);
  });

  it('is monotonic non-decreasing in score', () => {
    let prev = -1;
    for (let s = 1; s <= 10; s++) {
      const c = full(s).cents;
      expect(c).toBeGreaterThanOrEqual(prev);
      prev = c;
    }
  });

  it('clamps out-of-range scores', () => {
    expect(clampScore(0)).toBe(1);
    expect(clampScore(99)).toBe(10);
    expect(clampScore(7.4)).toBe(7);
  });

  it('minutes multiplier tiers: 0 / 25% / 50% / 100% / +25% per 10 min', () => {
    expect(minutesMultiplier(0)).toBe(0);
    expect(minutesMultiplier(9)).toBe(0);
    expect(minutesMultiplier(10)).toBe(0.25);
    expect(minutesMultiplier(19)).toBe(0.25);
    expect(minutesMultiplier(20)).toBe(0.5);
    expect(minutesMultiplier(30)).toBe(1);
    expect(minutesMultiplier(40)).toBe(1.25);
    expect(minutesMultiplier(50)).toBe(1.5);
  });

  it('practice reward scales by minutes: under 10 earns nothing, 20 = half, 40 = 125%', () => {
    expect(computePracticeReward({ qualityScore: 10, linesPracticed: 0, minutesPracticed: 5 }).cents).toBe(0);
    const fullCents = full(10).cents;            // 30 min = 100%
    expect(computePracticeReward({ qualityScore: 10, linesPracticed: 0, minutesPracticed: 20 }).cents)
      .toBe(Math.round(fullCents * 0.5));
    expect(computePracticeReward({ qualityScore: 10, linesPracticed: 0, minutesPracticed: 40 }).cents)
      .toBe(Math.round(fullCents * 1.25));
  });

  it('perform reward: 50 MP per play-through, no cap', () => {
    expect(computePerformReward({ playThroughs: 4, qualityScore: 1 }).cents).toBe(4 * 50 * 100);
    // 10 play-throughs still pays all 10 (no cap).
    expect(computePerformReward({ playThroughs: 10, qualityScore: 1 }).cents).toBe(10 * 50 * 100);
  });

  it('perform reward: quality bonus rides on top of play-throughs', () => {
    // 4 plays = 200 MP; a 10/10 adds the 85 MP bonus → 285 MP.
    expect(computePerformReward({ playThroughs: 4, qualityScore: 10 }).cents).toBe((4 * 50 + 85) * 100);
    // 3 plays = 150 MP; an 8/10 adds 34 MP → 184 MP.
    expect(computePerformReward({ playThroughs: 3, qualityScore: 8 }).cents).toBe((3 * 50 + 34) * 100);
  });

  it('perform reward: zero play-throughs earns nothing (and no bonus)', () => {
    expect(computePerformReward({ playThroughs: 0, qualityScore: 10 }).cents).toBe(0);
  });

  it('reward curve covers scores 1..10 with mp values', () => {
    const curve = rewardCurve();
    expect(curve).toHaveLength(10);
    expect(curve[0]).toEqual({ score: 1, mp: 15 });
    expect(curve[9]).toEqual({ score: 10, mp: 100 });
  });
});

function piece(over: Partial<MusicPiece> = {}): MusicPiece {
  return {
    id: 'p1', title: 'Test', instrument: 'cello', estLines: 18, difficulty: 'medium',
    addedBy: 'parent', createdAt: '2026-06-01T00:00:00Z', log: [], ...over,
  };
}

describe('music plan', () => {
  it('learned = max single-day lines, not sum', () => {
    const p = piece({ log: [
      { date: '2026-06-02', qualityScore: 5, linesPracticed: 4, centsEarned: 0 },
      { date: '2026-06-03', qualityScore: 6, linesPracticed: 8, centsEarned: 0 },
      { date: '2026-06-04', qualityScore: 7, linesPracticed: 6, centsEarned: 0 },
    ] });
    expect(linesLearned(p)).toBe(8);
    expect(bestScore(p)).toBe(7);
  });

  it('spreads remaining lines over practice days to hit target', () => {
    // 18 lines, none learned, target 2 weeks out → a few lines/day, on track.
    const p = piece({ estLines: 18, targetDate: '2026-06-19' });
    const plan = planForPiece(p, '2026-06-05');
    expect(plan.remaining).toBe(18);
    expect(plan.linesPerDayTarget).toBeGreaterThan(0);
    expect(plan.linesPerDayTarget).toBeLessThanOrEqual(18);
    expect(plan.onTrack).toBe(true);
  });

  it('flags off-track when out of runway', () => {
    const p = piece({ estLines: 18, targetDate: '2026-06-06' }); // 1 day, lots left
    const plan = planForPiece(p, '2026-06-05');
    expect(plan.onTrack).toBe(false);
  });

  it('a passed-off piece needs no new lines', () => {
    const p = piece({ passedOffAt: '2026-06-10T00:00:00Z' });
    const plan = planForPiece(p, '2026-06-12');
    expect(plan.passedOff).toBe(true);
    expect(plan.linesPerDayTarget).toBe(0);
  });

  it('polish mode: engages when all lines learned, on Sunday, or manually', () => {
    // All lines learned → polish.
    const done = piece({ estLines: 10, log: [{ date: '2026-06-08', qualityScore: 7, linesPracticed: 10, centsEarned: 0 }] });
    expect(planForPiece(done, '2026-06-08').inPolishMode).toBe(true); // Mon, but fully learned
    // Mid-learning on a weekday → not polish.
    const mid = piece({ estLines: 18, log: [{ date: '2026-06-08', qualityScore: 6, linesPracticed: 5, centsEarned: 0 }] });
    expect(planForPiece(mid, '2026-06-08').inPolishMode).toBe(false);
    // Same mid piece on Sunday → polish (perform day).
    expect(planForPiece(mid, '2026-06-07').inPolishMode).toBe(true);
    // Manual override flips it on any day.
    const manual = piece({ estLines: 18, polishMode: true, log: [{ date: '2026-06-08', qualityScore: 6, linesPracticed: 5, centsEarned: 0 }] });
    expect(planForPiece(manual, '2026-06-08').inPolishMode).toBe(true);
  });

  it('Sunday is the only perform day; Saturday is now a practice day', () => {
    // 2026-06-07 is a Sunday → perform.
    const sun = planForToday([piece()], '2026-06-07');
    expect(sun.isPerformDay).toBe(true);
    // 2026-06-06 is a Saturday → now a practice day.
    const sat = planForToday([piece()], '2026-06-06');
    expect(sat.isPerformDay).toBe(false);
    // 2026-06-08 is a Monday → practice.
    const mon = planForToday([piece()], '2026-06-08');
    expect(mon.isPerformDay).toBe(false);
  });

  it('sums new lines across active pieces for the day', () => {
    const day = planForToday(
      [piece({ id: 'a', estLines: 18, targetDate: '2026-06-19' }),
       piece({ id: 'b', estLines: 12, targetDate: '2026-06-19' })],
      '2026-06-05',
    );
    expect(day.totalNewLinesToday).toBeGreaterThan(0);
  });

  it('spread mode splits the goal across all active pieces', () => {
    const pieces = [piece({ id: 'a' }), piece({ id: 'b' }), piece({ id: 'c' }), piece({ id: 'd' })];
    const day = planForToday(pieces, '2026-06-01', undefined, 4, 'spread');
    expect(day.goalMode).toBe('spread');
    // 4 lines over 4 equal pieces → ~1 each, all active.
    const targets = day.pieces.map((p) => p.linesPerDayTarget);
    expect(targets.reduce((s, t) => s + t, 0)).toBe(4);
    expect(targets.every((t) => t >= 1)).toBe(true);
  });

  it('one-at-a-time mode focuses a single piece and parks the rest', () => {
    const pieces = [piece({ id: 'a', title: 'First' }), piece({ id: 'b', title: 'Second' }), piece({ id: 'c', title: 'Third' })];
    const day = planForToday(pieces, '2026-06-01', undefined, 3.5, 'one-at-a-time');
    expect(day.goalMode).toBe('one-at-a-time');
    expect(day.focusPieceId).toBe('a');
    // Only the focus piece gets a target (rounded 3.5 → 4); the rest are 0.
    expect(day.pieces.find((p) => p.pieceId === 'a')!.linesPerDayTarget).toBe(4);
    expect(day.pieces.find((p) => p.pieceId === 'b')!.linesPerDayTarget).toBe(0);
    expect(day.pieces.find((p) => p.pieceId === 'c')!.linesPerDayTarget).toBe(0);
    expect(day.totalNewLinesToday).toBe(4);
  });

  it('one-at-a-time advances to the next piece once the first is passed off', () => {
    const pieces = [
      piece({ id: 'a', passedOffAt: '2026-06-10T00:00:00Z' }),
      piece({ id: 'b' }),
      piece({ id: 'c' }),
    ];
    const day = planForToday(pieces, '2026-06-12', undefined, 3, 'one-at-a-time');
    expect(day.focusPieceId).toBe('b'); // 'a' done → focus moves on
  });
});
