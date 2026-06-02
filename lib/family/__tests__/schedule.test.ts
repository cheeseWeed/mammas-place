import { describe, it, expect } from 'vitest';
import { scheduleFor, sortRank, matchesFrequencyBucket, lastCompletion } from '../schedule';
import { roomsOf, DEFAULT_MP_BY_FREQUENCY } from '../types';
import type { FamilyJob, Frequency } from '../types';

function job(over: Partial<FamilyJob> = {}): FamilyJob {
  return {
    id: 'j1', name: 'Make beds', room: 'Boys Bedroom', frequency: 'daily',
    mp: 5, createdAt: '2026-06-01T00:00:00Z', completions: [], ...over,
  };
}

describe('schedule: due / done / overdue', () => {
  it('a never-done job is due today', () => {
    const s = scheduleFor(job(), '2026-06-10');
    expect(s.status).toBe('due');
    expect(s.doneToday).toBe(false);
  });

  it('checked off today → done, and doneToday is true', () => {
    const s = scheduleFor(job({ completions: [{ date: '2026-06-10', by: 'lilly', centsAwarded: 500 }] }), '2026-06-10');
    expect(s.status).toBe('done');
    expect(s.doneToday).toBe(true);
  });

  it('daily job done yesterday is DUE again today (the check disappears)', () => {
    const s = scheduleFor(job({ frequency: 'daily', completions: [{ date: '2026-06-09', by: 'x', centsAwarded: 500 }] }), '2026-06-10');
    expect(s.status).toBe('due');     // next due = 06-09 + 1 day = 06-10
    expect(s.doneToday).toBe(false);  // the prior check no longer counts
  });

  it('weekly job stays DONE for the week, then flips due', () => {
    const j = job({ frequency: 'weekly', completions: [{ date: '2026-06-08', by: 'x', centsAwarded: 1500 }] });
    expect(scheduleFor(j, '2026-06-10').status).toBe('done');   // 2 days later, still done
    expect(scheduleFor(j, '2026-06-15').status).toBe('due');    // 7 days later → due
  });

  it('past the due date and not re-done → OVERDUE', () => {
    const j = job({ frequency: 'daily', completions: [{ date: '2026-06-05', by: 'x', centsAwarded: 500 }] });
    const s = scheduleFor(j, '2026-06-10'); // due was 06-06, 4 days overdue
    expect(s.status).toBe('overdue');
    expect(s.daysUntilDue).toBeLessThan(0);
  });
});

describe('sort: overdue to the top, most-overdue first', () => {
  it('orders overdue < due < done, most overdue first', () => {
    const overdueBad = scheduleFor(job({ frequency: 'daily', completions: [{ date: '2026-06-01', by: 'x', centsAwarded: 0 }] }), '2026-06-10'); // very overdue
    const overdueMild = scheduleFor(job({ frequency: 'daily', completions: [{ date: '2026-06-08', by: 'x', centsAwarded: 0 }] }), '2026-06-10'); // a bit overdue
    const due = scheduleFor(job({ frequency: 'daily' }), '2026-06-10');
    const done = scheduleFor(job({ frequency: 'weekly', completions: [{ date: '2026-06-09', by: 'x', centsAwarded: 0 }] }), '2026-06-10');
    const ranks = [overdueBad, overdueMild, due, done].map(sortRank);
    // strictly increasing in the order we listed them
    expect(ranks[0]).toBeLessThan(ranks[1]);
    expect(ranks[1]).toBeLessThan(ranks[2]);
    expect(ranks[2]).toBeLessThan(ranks[3]);
  });
});

describe('frequency buckets (filter)', () => {
  it('maps frequencies to day/week/month/quarter buckets', () => {
    expect(matchesFrequencyBucket('daily', 'daily')).toBe(true);
    expect(matchesFrequencyBucket('biweekly', 'weekly')).toBe(true); // weekly bucket includes biweekly
    expect(matchesFrequencyBucket('yearly', 'quarterly')).toBe(true); // quarterly bucket includes semiannual+yearly
    expect(matchesFrequencyBucket('monthly', 'weekly')).toBe(false);
    expect(matchesFrequencyBucket('daily', 'all')).toBe(true);
  });
});

describe('helpers', () => {
  it('lastCompletion returns the newest date', () => {
    const j = job({ completions: [
      { date: '2026-06-01', by: 'x', centsAwarded: 0 },
      { date: '2026-06-09', by: 'x', centsAwarded: 0 },
      { date: '2026-06-05', by: 'x', centsAwarded: 0 },
    ] });
    expect(lastCompletion(j)).toBe('2026-06-09');
  });

  it('roomsOf lists distinct non-archived rooms in first-seen order', () => {
    const jobs = [job({ id: 'a', room: 'Kitchen' }), job({ id: 'b', room: 'Cars' }), job({ id: 'c', room: 'Kitchen' }), job({ id: 'd', room: 'Garage', archived: true })];
    expect(roomsOf(jobs)).toEqual(['Kitchen', 'Cars']);
  });

  it('default MP grows with rarity', () => {
    const f: Frequency[] = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];
    const vals = f.map((x) => DEFAULT_MP_BY_FREQUENCY[x]);
    for (let i = 1; i < vals.length; i++) expect(vals[i]).toBeGreaterThan(vals[i - 1]);
  });
});
