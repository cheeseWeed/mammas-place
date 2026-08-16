import { describe, it, expect } from 'vitest';
import {
  noteName,
  parseNoteName,
  parseSpokenNote,
  NOTE_VALUES,
  nearestNoteValue,
  insertNote,
  deleteNote,
  updateNote,
  moveNote,
  transposeNote,
  toggleMark,
  setDynamic,
  measureLayout,
  totalBeats,
} from '../editor';
import type { SongNote } from '../sightread';

const n = (midi: number, beats = 1): SongNote => ({ midi, beats });

describe('noteName', () => {
  it('names middle C correctly', () => {
    expect(noteName(60)).toBe('C4');
  });

  it('uses scientific octaves — C4 is middle C, cello C2 is 36', () => {
    expect(noteName(36)).toBe('C2');
    expect(noteName(72)).toBe('C5');
    expect(noteName(21)).toBe('A0');
  });

  it('spells black keys as sharps by default and flats on request', () => {
    expect(noteName(61)).toBe('C#4');
    expect(noteName(61, 'flat')).toBe('Db4');
    expect(noteName(70, 'flat')).toBe('Bb4');
  });
});

describe('parseNoteName', () => {
  it('round-trips every note on an 88-key piano', () => {
    for (let m = 21; m <= 108; m++) {
      expect(parseNoteName(noteName(m)), `midi ${m}`).toBe(m);
    }
  });

  it('accepts what a kid actually types', () => {
    expect(parseNoteName('a#4')).toBe(70);
    expect(parseNoteName('A#4')).toBe(70);
    expect(parseNoteName(' A#4 ')).toBe(70);
    expect(parseNoteName('As4')).toBe(70);      // "s" for sharp
    expect(parseNoteName('Bb3')).toBe(58);
    expect(parseNoteName('C')).toBe(60);        // no octave -> the middle one
  });

  it('handles double sharps and flats', () => {
    expect(parseNoteName('F##4')).toBe(67);
    expect(parseNoteName('Bbb4')).toBe(69);
  });

  it('returns null for things that are not notes rather than guessing', () => {
    for (const bad of ['', '  ', 'H4', 'zebra', '4', '#4', 'C4x', '!!']) {
      expect(parseNoteName(bad), `input ${JSON.stringify(bad)}`).toBeNull();
    }
  });

  it('rejects notes outside MIDI range', () => {
    expect(parseNoteName('C-2')).toBeNull();
    expect(parseNoteName('C99')).toBeNull();
  });
});

describe('parseSpokenNote', () => {
  it('understands "A sharp 4 whole note"', () => {
    expect(parseSpokenNote('A sharp 4 whole note')).toEqual({ midi: 70, beats: 4 });
  });

  it('understands the compact form', () => {
    expect(parseSpokenNote('a#4 quarter')).toEqual({ midi: 70, beats: 1 });
  });

  it('understands flats spoken aloud', () => {
    expect(parseSpokenNote('B flat 3 half')).toEqual({ midi: 58, beats: 2 });
  });

  it('defaults to a quarter note when no duration is given', () => {
    expect(parseSpokenNote('G3')).toEqual({ midi: 55, beats: 1 });
  });

  it('picks the DOTTED value when one is named, not the plain one', () => {
    // "dotted half" must not match the bare "half" rule first
    expect(parseSpokenNote('C4 dotted half')?.beats).toBe(3);
    expect(parseSpokenNote('C4 dotted quarter')?.beats).toBe(1.5);
    expect(parseSpokenNote('C4 dotted eighth')?.beats).toBe(0.75);
  });

  it('makes a rest when asked', () => {
    const r = parseSpokenNote('rest half');
    expect(r?.rest).toBe(true);
    expect(r?.beats).toBe(2);
  });

  it('returns null when there is no note to find', () => {
    for (const bad of ['', 'hello there', 'quarter note', '???']) {
      expect(parseSpokenNote(bad), `input ${JSON.stringify(bad)}`).toBeNull();
    }
  });
});

describe('note values', () => {
  it('covers the durations a beginner is taught', () => {
    const beats = NOTE_VALUES.map(v => v.beats);
    expect(beats).toContain(4);
    expect(beats).toContain(1);
    expect(beats).toContain(0.5);
    expect(beats).toContain(0.25);
  });

  it('snaps a rough duration to the nearest real note value', () => {
    expect(nearestNoteValue(0.9).beats).toBe(1);
    expect(nearestNoteValue(2.1).beats).toBe(2);
    expect(nearestNoteValue(0.26).beats).toBe(0.25);
  });
});

describe('edits never mutate the original', () => {
  const base = [n(60), n(62), n(64)];

  it('insert returns a new array and leaves the old one alone', () => {
    const out = insertNote(base, 1, n(61));
    expect(out).toHaveLength(4);
    expect(out[1]!.midi).toBe(61);
    expect(base).toHaveLength(3);
  });

  it('insert clamps an out-of-range position instead of tearing a hole', () => {
    expect(insertNote(base, -5, n(59))[0]!.midi).toBe(59);
    expect(insertNote(base, 99, n(65))[3]!.midi).toBe(65);
  });

  it('delete removes exactly one note', () => {
    const out = deleteNote(base, 1);
    expect(out.map(x => x.midi)).toEqual([60, 64]);
    expect(base).toHaveLength(3);
  });

  it('delete on a bad index is a no-op, not a crash', () => {
    expect(deleteNote(base, -1)).toBe(base);
    expect(deleteNote(base, 99)).toBe(base);
  });

  it('update patches only the fields given', () => {
    const out = updateNote([{ midi: 60, beats: 2, accent: true }], 0, { midi: 62 });
    expect(out[0]).toEqual({ midi: 62, beats: 2, accent: true });
  });

  it('move reorders without losing a note', () => {
    const out = moveNote(base, 0, 2);
    expect(out.map(x => x.midi)).toEqual([62, 64, 60]);
    expect(out).toHaveLength(3);
  });

  it('move to the same place changes nothing', () => {
    expect(moveNote(base, 1, 1)).toBe(base);
  });
});

describe('transposeNote', () => {
  it('shifts by semitones', () => {
    expect(transposeNote([n(60)], 0, 2)[0]!.midi).toBe(62);
    expect(transposeNote([n(60)], 0, -12)[0]!.midi).toBe(48);
  });

  it('CLAMPS at the ends of the keyboard rather than wrapping', () => {
    // Dragging past the top of the staff should stop, not jump octaves.
    expect(transposeNote([n(107)], 0, 12)[0]!.midi).toBe(108);
    expect(transposeNote([n(22)], 0, -12)[0]!.midi).toBe(21);
  });
});

describe('markings', () => {
  it('toggles a mark on and back off', () => {
    let out = toggleMark([n(60)], 0, 'staccato');
    expect(out[0]!.staccato).toBe(true);
    out = toggleMark(out, 0, 'staccato');
    expect(out[0]!.staccato).toBe(false);
  });

  it('sets and clears a dynamic', () => {
    let out = setDynamic([n(60)], 0, 'ff');
    expect(out[0]!.dynamic).toBe('ff');
    out = setDynamic(out, 0, undefined);
    expect(out[0]!.dynamic).toBeUndefined();
  });

  it('marking one note does not touch its neighbours', () => {
    const out = toggleMark([n(60), n(62)], 0, 'accent');
    expect(out[1]!.accent).toBeUndefined();
  });
});

describe('measureLayout', () => {
  it('groups a tidy 4/4 line into whole bars', () => {
    const bars = measureLayout([n(60), n(62), n(64), n(65), n(67), n(69), n(71), n(72)], 4);
    expect(bars).toHaveLength(2);
    expect(bars.every(b => b.complete)).toBe(true);
  });

  it('flags a bar that does not add up — the check that caught real errors', () => {
    // 3/4 with a bar of only 2 beats
    const bars = measureLayout([n(60), n(62), n(64, 2), n(65)], 3);
    expect(bars.some(b => !b.complete)).toBe(true);
  });

  it('flags a trailing partial bar', () => {
    const bars = measureLayout([n(60), n(62), n(64), n(65), n(67)], 4);
    expect(bars[bars.length - 1]!.complete).toBe(false);
  });

  it('handles an empty score without crashing', () => {
    expect(measureLayout([], 4)).toEqual([]);
    expect(totalBeats([])).toBe(0);
  });
});
