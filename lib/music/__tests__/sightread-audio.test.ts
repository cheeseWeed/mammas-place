import { describe, it, expect } from 'vitest';
import { detectPitch, frequencyToNote, midiToFrequency } from '../pitch';
import { SONGS, initGame, advanceGame, scoreRun } from '../sightread';

/** Synthesize one note as a buffer, the way a real instrument would arrive. */
function tone(midi: number, sampleRate = 44100, n = 4096): Float32Array {
  const f = midiToFrequency(midi);
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    // fundamental + a couple of harmonics, like a real string
    const t = i / sampleRate;
    buf[i] = 0.6 * Math.sin(2*Math.PI*f*t) + 0.25 * Math.sin(4*Math.PI*f*t) + 0.1 * Math.sin(6*Math.PI*f*t);
  }
  return buf;
}

describe('END-TO-END: synthesized instrument -> detector -> game', () => {
  it('detects every note of the C major scale from raw audio', () => {
    const scale = SONGS.find(s => s.id === 'c-major-scale')!;
    for (const n of scale.notes) {
      const freq = detectPitch(tone(n.midi), 44100);
      expect(freq, `midi ${n.midi} produced a pitch`).toBeGreaterThan(0);
      const info = frequencyToNote(freq)!;
      expect(info.midi, `midi ${n.midi} detected correctly`).toBe(n.midi);
    }
  });

  it('detects low cello notes from raw audio (C2 is the hard case)', () => {
    const cello = SONGS.find(s => s.id === 'cello-open-strings')!;
    for (const n of cello.notes) {
      const freq = detectPitch(tone(n.midi), 44100);
      const info = frequencyToNote(freq)!;
      expect(info.midi, `cello midi ${n.midi}`).toBe(n.midi);
    }
  });

  it('plays a whole song through the game using only detected audio', () => {
    const song = SONGS.find(s => s.id === 'mary-had-a-little-lamb')!;
    let g = initGame(song, 'wait');
    let guard = 0;
    while (!g.done && guard++ < 500) {
      const target = song.notes[g.cursor];
      const freq = detectPitch(tone(target.midi), 44100);
      const info = frequencyToNote(freq)!;
      g = advanceGame(g, song, { heardMidi: info.midi, cents: info.cents, deltaBeats: 0 });
    }
    expect(g.done).toBe(true);
    const s = scoreRun(g.results);
    expect(s.total).toBe(song.notes.length);
    expect(s.accuracy).toBe(100);
    expect(s.passed).toBe(true);
  });

  it('a kid playing the WRONG note does not advance the game', () => {
    const song = SONGS.find(s => s.id === 'c-major-scale')!;
    const g = initGame(song, 'wait');
    const wrong = frequencyToNote(detectPitch(tone(71), 44100))!; // B4 when C4 is wanted
    const after = advanceGame(g, song, { heardMidi: wrong.midi, cents: wrong.cents, deltaBeats: 0 });
    expect(after.cursor).toBe(0);
    expect(after.results).toHaveLength(0);
  });

  it('a slightly out-of-tune kid still passes — reading, not intonation', () => {
    const song = SONGS.find(s => s.id === 'c-major-scale')!;
    // 30 cents sharp: audibly sharp, but the right note on the page
    const sharpFreq = midiToFrequency(60) * Math.pow(2, 30 / 1200);
    const info = frequencyToNote(sharpFreq)!;
    expect(Math.abs(info.cents)).toBeGreaterThan(20);
    const g = initGame(song, 'wait');
    const after = advanceGame(g, song, { heardMidi: info.midi, cents: info.cents, deltaBeats: 0 });
    expect(after.cursor).toBe(1); // advanced: it counted
  });
});
