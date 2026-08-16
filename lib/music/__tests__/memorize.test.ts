import { describe, it, expect } from 'vitest';
import { hashUnit, fadeMask, barsOf, memorizePlan, suggestNextStep } from '../memorize';
import type { SongNote } from '../sightread';

const n = (midi: number, beats = 1): SongNote => ({ midi, beats });
const line = Array.from({ length: 16 }, (_, i) => n(60 + (i % 8)));

describe('hashUnit — the same pattern every time', () => {
  it('is deterministic', () => {
    expect(hashUnit(1, 5)).toBe(hashUnit(1, 5));
    expect(hashUnit(2, 5)).not.toBe(hashUnit(1, 5));
  });

  it('stays inside 0..1', () => {
    for (let i = 0; i < 200; i++) {
      const v = hashUnit(7, i);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('spreads roughly evenly, so a fade is not clustered at one end', () => {
    const first = Array.from({ length: 100 }, (_, i) => hashUnit(3, i)).filter(v => v < 0.5).length;
    expect(first).toBeGreaterThan(30);
    expect(first).toBeLessThan(70);
  });
});

describe('fadeMask', () => {
  it('hides nothing at 0', () => {
    expect(fadeMask(line, 0).size).toBe(0);
  });

  it('hides everything at 1', () => {
    expect(fadeMask(line, 1).size).toBe(line.length);
  });

  it('hides more as the fraction rises', () => {
    const low = fadeMask(line, 0.2).size;
    const high = fadeMask(line, 0.8).size;
    expect(high).toBeGreaterThan(low);
  });

  it('gives the SAME mask on a replay — otherwise "did I improve?" is unanswerable', () => {
    const a = [...fadeMask(line, 0.4, 5)].sort();
    const b = [...fadeMask(line, 0.4, 5)].sort();
    expect(a).toEqual(b);
  });

  it('gives a different mask on a different seed', () => {
    const a = [...fadeMask(line, 0.4, 1)].join();
    const b = [...fadeMask(line, 0.4, 99)].join();
    expect(a).not.toBe(b);
  });

  it('never hides a rest — there is nothing to remember about a rest', () => {
    const withRests: SongNote[] = [n(60), { midi: 60, beats: 1, rest: true }, n(64)];
    const mask = fadeMask(withRests, 1);
    expect(mask.has(1)).toBe(false);
    expect(mask.has(0)).toBe(true);
  });

  it('hides at least one note at any non-zero setting, so the slider visibly does something', () => {
    expect(fadeMask(line, 0.001).size).toBeGreaterThanOrEqual(1);
  });

  it('clamps a nonsense fraction instead of throwing', () => {
    expect(fadeMask(line, -1).size).toBe(0);
    expect(fadeMask(line, 5).size).toBe(line.length);
  });
});

describe('barsOf', () => {
  it('splits an even line into whole bars', () => {
    expect(barsOf(line, 4)).toHaveLength(4);
  });

  it('keeps a trailing partial bar rather than dropping it', () => {
    expect(barsOf([n(60), n(62), n(64)], 4)).toEqual([[0, 1, 2]]);
  });

  it('handles an empty piece', () => {
    expect(barsOf([], 4)).toEqual([]);
  });
});

describe('memorizePlan — fade', () => {
  it('hides some but keeps the rhythm visible', () => {
    const p = memorizePlan(line, 'fade', 50, 4);
    expect(p.hiddenNotes.size).toBeGreaterThan(0);
    expect(p.hiddenNotes.size).toBeLessThan(line.length);
    expect(p.label).toContain('rhythm');
  });

  it('at 0 percent hides nothing', () => {
    expect(memorizePlan(line, 'fade', 0, 4).hiddenNotes.size).toBe(0);
  });
});

describe('memorizePlan — cover', () => {
  it('hides every note', () => {
    const p = memorizePlan(line, 'cover', 0, 4);
    expect(p.hiddenNotes.size).toBe(line.length);
  });
});

describe('memorizePlan — grow', () => {
  it('hides nothing at step 0', () => {
    expect(memorizePlan(line, 'grow', 0, 4).hiddenNotes.size).toBe(0);
  });

  it('hides exactly the first bar at step 1', () => {
    const p = memorizePlan(line, 'grow', 1, 4);
    expect([...p.hiddenNotes].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
  });

  it('says "Bar 1", not "Bars 1-1"', () => {
    expect(memorizePlan(line, 'grow', 1, 4).label).toContain('Bar 1 from memory');
    expect(memorizePlan(line, 'grow', 2, 4).label).toContain('Bars 1–2');
  });

  it('accumulates bar by bar', () => {
    expect(memorizePlan(line, 'grow', 2, 4).hiddenNotes.size).toBe(8);
    expect(memorizePlan(line, 'grow', 3, 4).hiddenNotes.size).toBe(12);
  });

  it('hides the whole piece once step passes the bar count, without going out of range', () => {
    const p = memorizePlan(line, 'grow', 99, 4);
    expect(p.hiddenNotes.size).toBe(line.length);
    expect(p.label).toContain('whole piece');
  });
});

describe('memorizePlan — off and empty', () => {
  it('off hides nothing', () => {
    expect(memorizePlan(line, 'off', 50, 4).hiddenNotes.size).toBe(0);
  });

  it('an empty piece does not crash in any mode', () => {
    for (const mode of ['off', 'fade', 'cover', 'grow'] as const) {
      expect(memorizePlan([], mode, 50, 4).hiddenNotes.size).toBe(0);
    }
  });
});

describe('suggestNextStep — nudges, never leaps', () => {
  it('moves fade up one notch on a strong run', () => {
    expect(suggestNextStep('fade', 30, 95)).toBe(40);
  });

  it('backs fade off after a rough run', () => {
    expect(suggestNextStep('fade', 30, 40)).toBe(20);
  });

  it('holds steady in the middle', () => {
    expect(suggestNextStep('fade', 30, 75)).toBe(30);
  });

  it('never pushes fade past 90 percent or below zero', () => {
    expect(suggestNextStep('fade', 90, 100)).toBe(90);
    expect(suggestNextStep('fade', 0, 10)).toBe(0);
  });

  it('grows one bar at a time and stops at the end of the piece', () => {
    expect(suggestNextStep('grow', 2, 90, 8)).toBe(3);
    expect(suggestNextStep('grow', 8, 100, 8)).toBe(8);
    expect(suggestNextStep('grow', 0, 20, 8)).toBe(0);
  });

  it('leaves cover alone — there is no difficulty dial on it', () => {
    expect(suggestNextStep('cover', 4, 100)).toBe(4);
  });
});
