import { describe, it, expect } from 'vitest';
import {
  summarizeByDay,
  buildMonthGrid,
  buildRangeGrid,
  rangeTotals,
  monthTotals,
  challengeMilestones,
  scoreColor,
} from '../calendar';
import type { MusicPiece, MusicChallenge } from '../types';

function piece(over: Partial<MusicPiece> = {}): MusicPiece {
  return {
    id: 'p1', title: 'Test', instrument: 'cello', estLines: 18, difficulty: 'medium',
    addedBy: 'parent', createdAt: '2026-06-01T00:00:00Z', log: [], ...over,
  };
}

describe('summarizeByDay', () => {
  it('rolls multiple pieces on one day into a single summary', () => {
    const pieces = [
      piece({ id: 'a', title: 'Dragon', log: [
        { date: '2026-06-02', qualityScore: 6, linesPracticed: 3, centsEarned: 28 * 100 },
      ] }),
      piece({ id: 'b', title: 'Golden', log: [
        { date: '2026-06-02', qualityScore: 8, linesPracticed: 4, centsEarned: 49 * 100 },
      ] }),
    ];
    const byDay = summarizeByDay(pieces);
    const day = byDay['2026-06-02'];
    expect(day.practicedCount).toBe(2);
    expect(day.totalCents).toBe((28 + 49) * 100);
    expect(day.bestScore).toBe(8);
    expect(day.avgScore).toBe(7); // (6+8)/2
  });

  it('marks pass-off days and flags the matching entry', () => {
    const pieces = [
      piece({ id: 'a', title: 'Dragon', passedOffAt: '2026-06-19T15:00:00Z', log: [
        { date: '2026-06-19', qualityScore: 9, linesPracticed: 18, centsEarned: 55 * 100 },
      ] }),
    ];
    const byDay = summarizeByDay(pieces);
    expect(byDay['2026-06-19'].passOffs).toEqual(['Dragon']);
    expect(byDay['2026-06-19'].entries[0].passedOff).toBe(true);
  });
});

describe('buildRangeGrid (competition window)', () => {
  it('spans start→end across months, padded to whole weeks, Sunday-first', () => {
    const byDay = summarizeByDay([]);
    const { weeks } = buildRangeGrid('2026-06-01', '2026-07-07', byDay);
    // Every row is a full week.
    for (const w of weeks) expect(w).toHaveLength(7);
    // First cell of the whole grid is a Sunday.
    expect(new Date(weeks[0][0].date + 'T00:00:00Z').getUTCDay()).toBe(0);
    // June 1 2026 is a Monday → it should be inRange, and it's the 2nd cell.
    const jun1 = weeks.flat().find((c) => c.date === '2026-06-01')!;
    expect(jun1.inMonth).toBe(true);
    // A padding day before the window is dimmed.
    const may31 = weeks.flat().find((c) => c.date === '2026-05-31');
    if (may31) expect(may31.inMonth).toBe(false);
    // End day present and in range.
    const jul7 = weeks.flat().find((c) => c.date === '2026-07-07')!;
    expect(jul7.inMonth).toBe(true);
  });

  it('weekend flag is set for Sat/Sun', () => {
    const { weeks } = buildRangeGrid('2026-06-01', '2026-06-07', summarizeByDay([]));
    const sat = weeks.flat().find((c) => c.date === '2026-06-06')!; // Saturday
    expect(sat.isWeekend).toBe(true);
    const mon = weeks.flat().find((c) => c.date === '2026-06-01')!; // Monday
    expect(mon.isWeekend).toBe(false);
  });
});

describe('rangeTotals', () => {
  it('counts practice days, MP, and pass-offs in the window only', () => {
    const pieces = [
      piece({ id: 'a', title: 'Dragon', passedOffAt: '2026-06-19T00:00:00Z', log: [
        { date: '2026-06-02', qualityScore: 6, linesPracticed: 3, centsEarned: 2800 },
        { date: '2026-06-19', qualityScore: 9, linesPracticed: 18, centsEarned: 5500 },
        { date: '2026-05-30', qualityScore: 5, linesPracticed: 2, centsEarned: 800 }, // before window
      ] }),
    ];
    const byDay = summarizeByDay(pieces);
    const t = rangeTotals('2026-06-01', '2026-07-07', byDay);
    expect(t.practiceDays).toBe(2);     // 06-02 and 06-19, NOT 05-30
    expect(t.totalCents).toBe(8300);    // 2800 + 5500
    expect(t.passOffs).toBe(1);
  });
});

describe('challengeMilestones', () => {
  it('pins start/end/finish-all/play-all flags onto the right dates', () => {
    const ch: MusicChallenge = {
      id: 'c', name: 'Sprint', startDate: '2026-06-01', endDate: '2026-07-07',
      pieceIds: [], passOffRewardCents: 20000,
      finishAllBy: '2026-07-01', finishAllBonusCents: 50000,
      playAllInOneDayBy: '2026-07-07', playAllInOneDayMinScore: 8, playAllInOneDayBonusCents: 25000,
    };
    const m = challengeMilestones(ch);
    expect(m['2026-06-01']).toContain('🟢 Start');
    expect(m['2026-07-01']).toContain('🏁 All done');
    expect(m['2026-07-07']).toEqual(expect.arrayContaining(['🌟 Play all', '🎪 Camp day']));
  });
});

describe('scoreColor + monthGrid sanity', () => {
  it('bands scores into rough/okay/good/great', () => {
    expect(scoreColor(0).label).toBe('none');
    expect(scoreColor(3).label).toBe('rough');
    expect(scoreColor(6).label).toBe('okay');
    expect(scoreColor(8).label).toBe('good');
    expect(scoreColor(10).label).toBe('great!');
  });

  it('buildMonthGrid returns whole weeks with a label', () => {
    const { weeks, monthLabel } = buildMonthGrid('2026-06', summarizeByDay([]));
    for (const w of weeks) expect(w).toHaveLength(7);
    expect(monthLabel).toBe('June 2026');
    expect(monthTotals('2026-06', summarizeByDay([]))).toEqual({
      practiceDays: 0, totalCents: 0, passOffs: 0, avgScore: 0,
    });
  });
});
