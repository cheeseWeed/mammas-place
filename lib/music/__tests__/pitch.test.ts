import { describe, it, expect } from 'vitest';
import {
  frequencyToNote,
  midiToFrequency,
  centsOff,
  detectPitch,
  CELLO_STRINGS,
} from '../pitch';

describe('frequencyToNote (frequency → note + cents)', () => {
  it('maps concert A (440 Hz) to A4, 0 cents', () => {
    const n = frequencyToNote(440)!;
    expect(n.name).toBe('A');
    expect(n.octave).toBe(4);
    expect(n.midi).toBe(69);
    expect(n.cents).toBeCloseTo(0, 6);
    expect(n.freq).toBeCloseTo(440, 6);
  });

  it('maps middle C (261.63 Hz) to C4', () => {
    const n = frequencyToNote(261.63)!;
    expect(n.name).toBe('C');
    expect(n.octave).toBe(4);
    expect(n.midi).toBe(60);
    expect(Math.abs(n.cents)).toBeLessThan(1);
  });

  it('maps all four open cello strings to their names', () => {
    // C2 ≈ 65.41, G2 ≈ 98.00, D3 ≈ 146.83, A3 = 220 — the preset targets.
    for (const s of CELLO_STRINGS) {
      const n = frequencyToNote(s.freq)!;
      expect(`${n.name}${n.octave}`).toBe(s.note);
      expect(n.midi).toBe(s.midi);
      expect(n.cents).toBeCloseTo(0, 6);
    }
  });

  it('reports sharp readings as positive cents (445 Hz ≈ A4 +19.6¢)', () => {
    const n = frequencyToNote(445)!;
    expect(n.name).toBe('A');
    expect(n.octave).toBe(4);
    expect(n.cents).toBeCloseTo(19.56, 1);
  });

  it('reports flat readings as negative cents (430 Hz ≈ A4 −39.8¢)', () => {
    const n = frequencyToNote(430)!;
    expect(n.name).toBe('A');
    expect(n.cents).toBeCloseTo(-39.83, 1);
  });

  it('cents never exceed ±50 (rounds to the nearest note)', () => {
    // Just above the quarter-tone between A4 and A#4 → snaps to A#4, flat side.
    const justPastQuarter = 440 * Math.pow(2, 0.51 / 12);
    const n = frequencyToNote(justPastQuarter)!;
    expect(n.name).toBe('A#');
    expect(n.cents).toBeCloseTo(-49, 0);
    expect(Math.abs(n.cents)).toBeLessThanOrEqual(50);
  });

  it('rejects invalid input', () => {
    expect(frequencyToNote(0)).toBeNull();
    expect(frequencyToNote(-100)).toBeNull();
    expect(frequencyToNote(NaN)).toBeNull();
    expect(frequencyToNote(Infinity)).toBeNull();
  });
});

describe('centsOff / midiToFrequency', () => {
  it('one octave = +1200 cents, one semitone ≈ +100 cents', () => {
    expect(centsOff(880, 440)).toBeCloseTo(1200, 6);
    expect(centsOff(midiToFrequency(70), 440)).toBeCloseTo(100, 6);
    expect(centsOff(220, 440)).toBeCloseTo(-1200, 6);
  });

  it('midiToFrequency matches the known cello string pitches', () => {
    expect(midiToFrequency(36)).toBeCloseTo(65.406, 2); // C2
    expect(midiToFrequency(43)).toBeCloseTo(97.999, 2); // G2
    expect(midiToFrequency(50)).toBeCloseTo(146.832, 2); // D3
    expect(midiToFrequency(57)).toBeCloseTo(220, 3); // A3
  });
});

describe('detectPitch (autocorrelation)', () => {
  const RATE = 44100;

  /** Synthesize `n` samples of a tone; harmonics = [amp of f, amp of 2f, ...]. */
  function tone(freq: number, n = 4096, harmonics = [0.6]): Float32Array {
    const buf = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let v = 0;
      for (let h = 0; h < harmonics.length; h++) {
        v += harmonics[h] * Math.sin((2 * Math.PI * freq * (h + 1) * i) / RATE);
      }
      buf[i] = v;
    }
    return buf;
  }

  /** Cents between the detected and expected frequency. */
  const errCents = (detected: number, expected: number) => Math.abs(centsOff(detected, expected));

  it('finds a pure 440 Hz sine within a few cents', () => {
    const f = detectPitch(tone(440), RATE);
    expect(f).toBeGreaterThan(0);
    expect(errCents(f, 440)).toBeLessThan(3);
  });

  it('finds every open cello string, including low C2 (≈65.4 Hz)', () => {
    for (const s of CELLO_STRINGS) {
      const f = detectPitch(tone(s.freq), RATE);
      expect(f, `string ${s.note}`).toBeGreaterThan(0);
      expect(errCents(f, s.freq), `string ${s.note}`).toBeLessThan(5);
    }
  });

  it('locks onto the fundamental of a harmonic-rich (cello-like) tone', () => {
    // Fundamental + strong 2nd/3rd harmonics — the octave-error trap.
    const f = detectPitch(tone(146.83, 4096, [0.5, 0.35, 0.2]), RATE);
    expect(f).toBeGreaterThan(0);
    expect(errCents(f, 146.83)).toBeLessThan(6);
  });

  it('returns -1 for silence and for very quiet input', () => {
    expect(detectPitch(new Float32Array(4096), RATE)).toBe(-1);
    const quiet = tone(440).map((v) => v * 0.001);
    expect(detectPitch(quiet, RATE)).toBe(-1);
  });

  it('returns -1 for unpitched noise', () => {
    // Deterministic pseudo-noise (no Math.random → no flaky test).
    const buf = new Float32Array(4096);
    let seed = 1234567;
    for (let i = 0; i < buf.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      buf[i] = (seed / 0x7fffffff) * 0.8 - 0.4;
    }
    expect(detectPitch(buf, RATE)).toBe(-1);
  });
});
