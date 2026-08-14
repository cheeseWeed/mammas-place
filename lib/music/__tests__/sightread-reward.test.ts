import { describe, it, expect } from 'vitest';
import {
  computeSightReadReward,
  SIGHTREAD_PER_NOTE_CENTS,
  SIGHTREAD_RUN_CAP_CENTS,
  SIGHTREAD_TEMPO_MULT,
} from '../reward';

const run = (hits: number, total: number, mode: 'wait' | 'tempo' | 'practice' = 'wait') =>
  computeSightReadReward({ hits, total, mode });

describe('computeSightReadReward — the money path', () => {
  it('pays nothing in practice mode, however well the kid plays', () => {
    expect(run(20, 20, 'practice').cents).toBe(0);
    expect(run(20, 20, 'practice').reason).toMatch(/practice/i);
  });

  it('pays nothing for an empty run rather than NaN', () => {
    expect(run(0, 0).cents).toBe(0);
    expect(Number.isFinite(run(0, 0).cents)).toBe(true);
  });

  it('pays the per-note base with no bonus below 80%', () => {
    // 7/10 = 70%, under the bonus threshold
    expect(run(7, 10).cents).toBe(7 * SIGHTREAD_PER_NOTE_CENTS);
  });

  it('starts the accuracy bonus exactly at 80%', () => {
    const under = run(15, 20).cents;  // 75%
    const at = run(16, 20).cents;     // 80%
    expect(at - under).toBeGreaterThan(SIGHTREAD_PER_NOTE_CENTS); // more than one extra note
  });

  it('climbs through every bonus tier', () => {
    const tiers = [80, 85, 90, 95, 100].map(pct => run(pct, 100).cents);
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i], `tier ${i} beats tier ${i - 1}`).toBeGreaterThan(tiers[i - 1]);
    }
  });

  it('pays tempo mode more than wait mode for the same run', () => {
    const wait = run(20, 20, 'wait').cents;
    const tempo = run(20, 20, 'tempo').cents;
    expect(tempo).toBeGreaterThan(wait);
    expect(tempo).toBe(Math.min(Math.round(wait * SIGHTREAD_TEMPO_MULT), SIGHTREAD_RUN_CAP_CENTS));
  });

  it('never pays more than the per-run cap, even on an absurd song', () => {
    expect(run(1000, 1000, 'tempo').cents).toBe(SIGHTREAD_RUN_CAP_CENTS);
    expect(run(500, 500, 'wait').cents).toBeLessThanOrEqual(SIGHTREAD_RUN_CAP_CENTS);
  });

  it('clamps hits above total instead of overpaying', () => {
    // A tampered client claiming 50 hits on a 10-note song must not out-earn a
    // perfect honest run.
    expect(run(50, 10).cents).toBe(run(10, 10).cents);
  });

  it('ignores negative and fractional input', () => {
    expect(run(-5, 10).cents).toBe(0);
    expect(run(5.9, 10).cents).toBe(run(5, 10).cents);
    expect(run(10, -3).cents).toBe(0);
  });

  it('always returns whole cents — money is never fractional', () => {
    for (const [h, t] of [[3, 7], [11, 13], [17, 19], [1, 3]]) {
      for (const m of ['wait', 'tempo'] as const) {
        const c = run(h, t, m).cents;
        expect(Number.isInteger(c), `${h}/${t} ${m} is integer cents`).toBe(true);
      }
    }
  });

  it('never returns negative money', () => {
    for (const [h, t] of [[0, 10], [-1, 10], [0, 0], [5, 4]]) {
      expect(run(h, t).cents).toBeGreaterThanOrEqual(0);
    }
  });

  it('explains itself in the reason string', () => {
    const r = run(9, 10, 'tempo');
    expect(r.reason).toContain('9/10');
    expect(r.reason).toContain('90%');
    expect(r.reason).toMatch(/tempo/i);
  });

  it('is monotonic — more correct notes never pays less', () => {
    let prev = -1;
    for (let h = 0; h <= 20; h++) {
      const c = run(h, 20).cents;
      expect(c, `${h}/20 >= ${h - 1}/20`).toBeGreaterThanOrEqual(prev);
      prev = c;
    }
  });
});
