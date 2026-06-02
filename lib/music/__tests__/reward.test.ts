import { describe, it, expect } from 'vitest';
import { computePracticeReward, rewardCurve, DAILY_PIECE_CAP_CENTS, clampScore } from '../reward';
import { planForPiece, planForToday, linesLearned, bestScore } from '../plan';
import type { MusicPiece } from '../types';

describe('music practice reward', () => {
  it('pays the show-up base on a rough day (score 1)', () => {
    const { cents } = computePracticeReward({ qualityScore: 1, linesPracticed: 2 });
    expect(cents).toBe(15 * 100); // 15 MP base, no quality bonus
  });

  it('caps at 100 MP for a perfect (10/10) day', () => {
    const { cents } = computePracticeReward({ qualityScore: 10, linesPracticed: 5 });
    expect(cents).toBe(DAILY_PIECE_CAP_CENTS);
    expect(cents).toBe(100 * 100);
  });

  it('is steep — a 10 pays much more than a 6', () => {
    const six = computePracticeReward({ qualityScore: 6, linesPracticed: 0 }).cents;
    const ten = computePracticeReward({ qualityScore: 10, linesPracticed: 0 }).cents;
    expect(ten).toBeGreaterThan(six * 2); // steep, not linear
  });

  it('is monotonic non-decreasing in score', () => {
    let prev = -1;
    for (let s = 1; s <= 10; s++) {
      const c = computePracticeReward({ qualityScore: s, linesPracticed: 0 }).cents;
      expect(c).toBeGreaterThanOrEqual(prev);
      prev = c;
    }
  });

  it('clamps out-of-range scores', () => {
    expect(clampScore(0)).toBe(1);
    expect(clampScore(99)).toBe(10);
    expect(clampScore(7.4)).toBe(7);
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

  it('today plan detects weekend perform days (Sat=6, Sun=0)', () => {
    // 2026-06-06 is a Saturday.
    const day = planForToday([piece()], '2026-06-06');
    expect(day.isPerformDay).toBe(true);
    // 2026-06-08 is a Monday.
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
});
