// Pitch math for the practice-studio tuner — PURE functions only.
//
// No browser APIs in this file: everything here takes numbers/arrays in and
// returns numbers out, so it is unit-testable under vitest (see
// __tests__/pitch.test.ts). The Web Audio wiring (getUserMedia, AnalyserNode)
// lives in components/music/TunerPanel.tsx and calls into these.
//
//   - frequencyToNote(freq)    → nearest note (name/octave/midi) + cents off
//   - centsOff(freq, target)   → signed cents between two frequencies
//   - detectPitch(buf, rate)   → autocorrelation pitch detector (time-domain
//                                samples in, fundamental frequency out)
//   - CELLO_STRINGS            → presets for the C2 G2 D3 A3 open strings

export const A4_FREQ = 440;
export const A4_MIDI = 69;

// Sharps only — matches what a kid sees on a chromatic tuner.
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export interface NoteInfo {
  midi: number;   // nearest MIDI note number (0-127)
  name: string;   // e.g. 'A', 'C#'
  octave: number; // scientific pitch notation — C4 = middle C (midi 60)
  cents: number;  // signed cents from that note, in (-50, +50]
  freq: number;   // the exact frequency of the nearest note, Hz
}

/** Equal-tempered frequency of a MIDI note (A4 = 69 = 440 Hz). */
export function midiToFrequency(midi: number): number {
  return A4_FREQ * Math.pow(2, (midi - A4_MIDI) / 12);
}

/**
 * Map a raw frequency to the nearest equal-tempered note plus how many cents
 * sharp (+) or flat (-) it is. Returns null for non-positive/invalid input or
 * anything outside the MIDI range.
 */
export function frequencyToNote(freq: number): NoteInfo | null {
  if (!Number.isFinite(freq) || freq <= 0) return null;
  const midiFloat = A4_MIDI + 12 * Math.log2(freq / A4_FREQ);
  const midi = Math.round(midiFloat);
  if (midi < 0 || midi > 127) return null;
  return {
    midi,
    name: NOTE_NAMES[((midi % 12) + 12) % 12],
    octave: Math.floor(midi / 12) - 1,
    cents: (midiFloat - midi) * 100,
    freq: midiToFrequency(midi),
  };
}

/** Signed cents from `target` to `freq` (positive = freq is sharp of target). */
export function centsOff(freq: number, target: number): number {
  return 1200 * Math.log2(freq / target);
}

// The four open cello strings, low to high. `label` is what shows on the
// preset button; midi/freq drive the needle target.
export const CELLO_STRINGS: { label: string; note: string; midi: number; freq: number }[] = [
  { label: 'C', note: 'C2', midi: 36, freq: midiToFrequency(36) }, // ≈ 65.41 Hz
  { label: 'G', note: 'G2', midi: 43, freq: midiToFrequency(43) }, // ≈ 98.00 Hz
  { label: 'D', note: 'D3', midi: 50, freq: midiToFrequency(50) }, // ≈ 146.83 Hz
  { label: 'A', note: 'A3', midi: 57, freq: midiToFrequency(57) }, // = 220.00 Hz
];

export interface DetectPitchOptions {
  /** Lowest detectable frequency, Hz. Default 50 (below cello C2 ≈ 65.4). */
  minFreq?: number;
  /** Highest detectable frequency, Hz. Default 1500. */
  maxFreq?: number;
  /** RMS level below which the buffer counts as silence. Default 0.01. */
  rmsGate?: number;
  /** Normalized-autocorrelation peak required to trust a pitch. Default 0.4. */
  clarityGate?: number;
}

/**
 * Time-domain autocorrelation pitch detector (McLeod-style NSDF).
 *
 * Returns the fundamental frequency in Hz, or -1 when no confident pitch is
 * found (silence, noise, or out of range). Pure function — feed it the output
 * of AnalyserNode.getFloatTimeDomainData plus AudioContext.sampleRate.
 *
 * Method: the normalized square difference function
 *     nsdf[lag] = 2·Σ x[j]x[j+lag] / Σ (x[j]² + x[j+lag]²)   ∈ [-1, 1]
 * (numerator and denominator shrink with lag TOGETHER, so — unlike naive
 * energy normalization — there is no systematic tilt that drags the peak
 * toward large lags / octave-low errors). Peak picking is "first local max
 * within 90% of the global max" so the ACF peaks at 2×, 3×… the true period
 * lose to the true one, then parabolic interpolation for sub-sample precision.
 */
export function detectPitch(
  buf: Float32Array,
  sampleRate: number,
  opts: DetectPitchOptions = {},
): number {
  const minFreq = opts.minFreq ?? 50;
  const maxFreq = opts.maxFreq ?? 1500;
  const rmsGate = opts.rmsGate ?? 0.01;
  const clarityGate = opts.clarityGate ?? 0.4;

  const size = buf.length;
  if (size < 32 || sampleRate <= 0) return -1;

  // Prefix energy sums (Float64 — thousands of tiny additions) power both the
  // silence gate and the NSDF denominator below.
  const prefix = new Float64Array(size + 1);
  for (let i = 0; i < size; i++) prefix[i + 1] = prefix[i] + buf[i] * buf[i];
  const energy = prefix[size];
  const rms = Math.sqrt(energy / size);
  if (rms < rmsGate || energy === 0) return -1;

  const minLag = Math.max(2, Math.floor(sampleRate / maxFreq));
  const maxLag = Math.min(Math.floor(sampleRate / minFreq), size - 2);
  if (minLag >= maxLag) return -1;

  // NSDF over the candidate range (±1 so peak tests have neighbors).
  const nsdf = new Float32Array(maxLag + 2);
  for (let lag = minLag - 1; lag <= maxLag + 1; lag++) {
    let r = 0;
    const n = size - lag;
    for (let j = 0; j < n; j++) r += buf[j] * buf[j + lag];
    // Σ x[0..n-1]² + Σ x[lag..size-1]² via the prefix sums.
    const m = prefix[n] + (prefix[size] - prefix[lag]);
    nsdf[lag] = m > 0 ? (2 * r) / m : 0;
  }

  // Global max sets the bar; the FIRST local max clearing 90% of it wins.
  // (All period multiples score ≈ equally, so smallest lag = true period.)
  let globalMax = -Infinity;
  for (let k = minLag; k <= maxLag; k++) if (nsdf[k] > globalMax) globalMax = nsdf[k];
  if (globalMax < clarityGate) return -1;

  const bar = Math.max(clarityGate, 0.9 * globalMax);
  let lag = -1;
  for (let k = minLag; k <= maxLag; k++) {
    if (nsdf[k] >= bar && nsdf[k] >= nsdf[k - 1] && nsdf[k] >= nsdf[k + 1]) {
      lag = k;
      break;
    }
  }
  if (lag < 0) return -1;

  // Parabolic interpolation around the peak for sub-sample precision.
  let refined = lag;
  {
    const x1 = nsdf[lag - 1];
    const x2 = nsdf[lag];
    const x3 = nsdf[lag + 1];
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;
    if (a !== 0) {
      const shift = -b / (2 * a);
      if (Math.abs(shift) < 1) refined = lag + shift;
    }
  }

  const freq = sampleRate / refined;
  if (freq < minFreq * 0.9 || freq > maxFreq * 1.1) return -1;
  return freq;
}
