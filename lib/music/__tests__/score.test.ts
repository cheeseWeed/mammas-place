import { describe, it, expect } from 'vitest';
import {
  INSTRUMENTS,
  FAMILY_ORDER,
  instrumentById,
  scoreOrder,
  soundingMidi,
  writtenMidi,
  outOfRange,
  partBeats,
  alignmentReport,
  padToAlign,
  soundingTimeline,
  extractPart,
  type MultiScore,
  type Part,
} from '../score';
import type { SongNote } from '../sightread';

const n = (midi: number, beats = 1): SongNote => ({ midi, beats });

const part = (id: string, instrumentId: string, notes: SongNote[]): Part => ({
  id, name: instrumentById(instrumentId).name, instrumentId, notes,
});

const score = (parts: Part[]): MultiScore => ({
  id: 's', title: 'Test', bpm: 80, beatsPerBar: 4, parts,
});

describe('the instrument list', () => {
  it('has unique ids', () => {
    const ids = INSTRUMENTS.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every instrument a family that score order knows about', () => {
    for (const i of INSTRUMENTS) {
      expect(FAMILY_ORDER, `${i.id} family is orderable`).toContain(i.family);
    }
  });

  it('gives every instrument a sane range', () => {
    for (const i of INSTRUMENTS) {
      expect(i.low, `${i.id} low`).toBeGreaterThanOrEqual(21);
      expect(i.high, `${i.id} high`).toBeLessThanOrEqual(108);
      expect(i.high, `${i.id} high above low`).toBeGreaterThan(i.low);
    }
  });

  it('falls back to a real instrument rather than crashing on a bad id', () => {
    expect(instrumentById('not-an-instrument').id).toBe(INSTRUMENTS[0]!.id);
  });
});

describe('scoreOrder — the conductor conventions', () => {
  it('puts woodwinds above brass above strings, however they were added', () => {
    const s = [
      part('a', 'cello', []),
      part('b', 'trumpet', []),
      part('c', 'flute', []),
    ];
    expect(scoreOrder(s).map(p => p.instrumentId)).toEqual(['flute', 'trumpet', 'cello']);
  });

  it('puts percussion and keyboard between brass and strings', () => {
    const s = [
      part('a', 'violin', []),
      part('b', 'piano', []),
      part('c', 'timpani', []),
      part('d', 'horn', []),
    ];
    expect(scoreOrder(s).map(p => p.instrumentId)).toEqual(['horn', 'timpani', 'piano', 'violin']);
  });

  it('keeps two of the same family in the order they were added', () => {
    const s = [part('first', 'violin', []), part('second', 'cello', [])];
    expect(scoreOrder(s).map(p => p.id)).toEqual(['first', 'second']);
  });

  it('does not mutate the array it was given', () => {
    const s = [part('a', 'cello', []), part('b', 'flute', [])];
    scoreOrder(s);
    expect(s.map(p => p.id)).toEqual(['a', 'b']);
  });
});

describe('transposing instruments', () => {
  it('a written C on a B-flat trumpet SOUNDS a B-flat, a step lower', () => {
    expect(soundingMidi(60, 'trumpet')).toBe(58); // C4 written -> Bb3 sounding
  });

  it('leaves concert-pitch instruments alone', () => {
    for (const id of ['flute', 'violin', 'cello', 'piano', 'trombone']) {
      expect(soundingMidi(60, id), id).toBe(60);
    }
  });

  it('handles the E-flat alto sax and the F horn', () => {
    expect(soundingMidi(60, 'sax-alto')).toBe(51);
    expect(soundingMidi(60, 'horn')).toBe(53);
  });

  it('a double bass sounds an octave below what it reads', () => {
    expect(soundingMidi(52, 'bass')).toBe(40);
  });

  it('written and sounding are exact inverses — the bug that inverts playback', () => {
    for (const inst of INSTRUMENTS) {
      for (const m of [40, 60, 72]) {
        expect(writtenMidi(soundingMidi(m, inst.id), inst.id), inst.id).toBe(m);
      }
    }
  });

  it('to SOUND a concert C, a trumpet must READ a D', () => {
    expect(writtenMidi(60, 'trumpet')).toBe(62);
  });
});

describe('outOfRange — warn, never block', () => {
  it('flags a note above the instrument', () => {
    expect(outOfRange(n(100), 'cello')).toBe(true);
  });

  it('accepts a note inside the range', () => {
    expect(outOfRange(n(48), 'cello')).toBe(false);
  });

  it('never flags a rest', () => {
    expect(outOfRange({ midi: 200, beats: 1, rest: true }, 'cello')).toBe(false);
  });
});

describe('alignmentReport — do all the players finish together?', () => {
  it('is happy when every part is the same length', () => {
    const s = score([
      part('a', 'flute', [n(72), n(74)]),
      part('b', 'cello', [n(48, 2)]),
    ]);
    const r = alignmentReport(s);
    expect(r.aligned).toBe(true);
    expect(r.short).toHaveLength(0);
  });

  it('names the part that runs out early and by how much', () => {
    const s = score([
      part('a', 'flute', [n(72), n(74), n(76), n(77)]),
      part('b', 'cello', [n(48, 2)]),
    ]);
    const r = alignmentReport(s);
    expect(r.aligned).toBe(false);
    expect(r.longest).toBe(4);
    expect(r.short).toHaveLength(1);
    expect(r.short[0]).toMatchObject({ partId: 'b', missing: 2 });
  });

  it('handles an empty score', () => {
    expect(alignmentReport(score([])).aligned).toBe(true);
  });
});

describe('padToAlign', () => {
  it('pads a short part with a rest so everyone ends together', () => {
    const s = score([
      part('a', 'flute', [n(72), n(74), n(76), n(77)]),
      part('b', 'cello', [n(48, 2)]),
    ]);
    const out = padToAlign(s);
    expect(alignmentReport(out).aligned).toBe(true);
    const cello = out.parts.find(p => p.id === 'b')!;
    expect(cello.notes[cello.notes.length - 1]).toMatchObject({ rest: true, beats: 2 });
  });

  it('pads with a REST, never a sounding note', () => {
    const s = score([part('a', 'flute', [n(72, 4)]), part('b', 'cello', [n(48)])]);
    for (const p of padToAlign(s).parts) {
      for (const note of p.notes.slice(1)) expect(note.rest).toBe(true);
    }
  });

  it('leaves an already-aligned score untouched', () => {
    const s = score([part('a', 'flute', [n(72)]), part('b', 'cello', [n(48)])]);
    expect(padToAlign(s)).toBe(s);
  });

  it('does not mutate the original', () => {
    const s = score([part('a', 'flute', [n(72, 4)]), part('b', 'cello', [n(48)])]);
    padToAlign(s);
    expect(s.parts[1]!.notes).toHaveLength(1);
  });
});

describe('soundingTimeline — what you actually hear', () => {
  it('lines up notes from different parts on the same beat', () => {
    const s = score([
      part('a', 'flute', [n(72), n(74)]),
      part('b', 'cello', [n(48), n(50)]),
    ]);
    const t = soundingTimeline(s);
    expect(t.filter(e => e.beat === 0).map(e => e.midi).sort((x, y) => x - y)).toEqual([48, 72]);
    expect(t.filter(e => e.beat === 1).map(e => e.midi).sort((x, y) => x - y)).toEqual([50, 74]);
  });

  it('applies transposition, so a written trumpet C is heard as a B-flat', () => {
    const s = score([part('t', 'trumpet', [n(60)])]);
    expect(soundingTimeline(s)[0]!.midi).toBe(58);
  });

  it('skips rests but still advances time behind them', () => {
    const s = score([part('a', 'flute', [{ midi: 60, beats: 2, rest: true }, n(72)])]);
    const t = soundingTimeline(s);
    expect(t).toHaveLength(1);
    expect(t[0]!.beat).toBe(2);
  });

  it('is empty for an empty score rather than throwing', () => {
    expect(soundingTimeline(score([]))).toEqual([]);
  });
});

describe('extractPart — making one player their own booklet', () => {
  it('pulls a single line out with the right clef and a naming that says whose it is', () => {
    const s = score([part('a', 'flute', [n(72)]), part('b', 'cello', [n(48)])]);
    const out = extractPart(s, 'b')!;
    expect(out.clef).toBe('bass');
    expect(out.notes).toEqual([n(48)]);
    expect(out.title).toContain('Cello');
  });

  it('carries the score tempo onto the part', () => {
    const s = score([part('a', 'flute', [n(72)])]);
    expect(extractPart(s, 'a')!.bpm).toBe(80);
  });

  it('gives a piano part the grand staff', () => {
    const s = score([part('p', 'piano', [n(60)])]);
    expect(extractPart(s, 'p')!.clef).toBe('grand');
  });

  it('returns null for a part that is not there', () => {
    expect(extractPart(score([]), 'nope')).toBeNull();
  });
});
