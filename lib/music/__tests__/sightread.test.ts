import { describe, it, expect } from 'vitest';
import {
  SONGS,
  staffPosition,
  isSharp,
  ledgerLines,
  noteMatches,
  initGame,
  advanceGame,
  scoreRun,
  isStuck,
  skipStuckNote,
  STUCK_TICK_LIMIT,
  gradeNote,
  MAX_NOTE_POINTS,
  staveFor,
  type Song,
} from '../sightread';

const scale = SONGS.find(s => s.id === 'c-major-scale')!;

describe('song library', () => {
  it('every song has notes, a positive bpm and a known clef', () => {
    for (const s of SONGS) {
      expect(s.notes.length, `${s.id} has notes`).toBeGreaterThan(0);
      expect(s.bpm, `${s.id} bpm`).toBeGreaterThan(0);
      expect(['treble', 'bass']).toContain(s.clef);
    }
  });

  it('song ids are unique', () => {
    const ids = SONGS.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every note is a sane MIDI value with a positive duration', () => {
    for (const s of SONGS) {
      for (const n of s.notes) {
        expect(n.midi, `${s.id} midi in range`).toBeGreaterThanOrEqual(21);
        expect(n.midi, `${s.id} midi in range`).toBeLessThanOrEqual(108);
        expect(n.beats, `${s.id} beats positive`).toBeGreaterThan(0);
      }
    }
  });

  it('bass-clef songs stay in a sensible bass range', () => {
    const bass = SONGS.filter(s => s.clef === 'bass');
    expect(bass.length).toBeGreaterThan(0);
    for (const s of bass) {
      for (const n of s.notes) expect(n.midi).toBeLessThan(72);
    }
  });
});

describe('staffPosition', () => {
  it('puts E4 on the bottom line of the treble staff', () => {
    expect(staffPosition(64, 'treble')).toBe(0);
  });

  it('walks up one step per diatonic note', () => {
    expect(staffPosition(65, 'treble')).toBe(1); // F4, first space
    expect(staffPosition(67, 'treble')).toBe(2); // G4, second line
    expect(staffPosition(69, 'treble')).toBe(3); // A4
    expect(staffPosition(76, 'treble')).toBe(7); // E5, fourth space
    expect(staffPosition(77, 'treble')).toBe(8); // F5, top line
  });

  it('puts middle C below the treble staff (needs a ledger line)', () => {
    expect(staffPosition(60, 'treble')).toBe(-2);
    expect(ledgerLines(-2)).toEqual([-2]);
  });

  it('puts G2 on the bottom line of the bass staff', () => {
    expect(staffPosition(43, 'bass')).toBe(0);
  });

  it('places the cello open strings correctly on the bass staff', () => {
    expect(staffPosition(36, 'bass')).toBe(-4); // C2, two ledger lines below
    expect(staffPosition(50, 'bass')).toBe(4);  // D3
    expect(staffPosition(57, 'bass')).toBe(8);  // A3, top line
  });

  it('gives a sharp the same staff position as its natural', () => {
    expect(staffPosition(66, 'treble')).toBe(staffPosition(65, 'treble')); // F#4 sits on F4
    expect(isSharp(66)).toBe(true);
    expect(isSharp(65)).toBe(false);
  });
});

describe('ledgerLines', () => {
  it('returns none for notes inside the staff', () => {
    expect(ledgerLines(0)).toEqual([]);
    expect(ledgerLines(4)).toEqual([]);
    expect(ledgerLines(8)).toEqual([]);
  });

  it('adds lines below for low notes', () => {
    expect(ledgerLines(-4)).toEqual([-2, -4]);
  });

  it('adds lines above for high notes', () => {
    expect(ledgerLines(10)).toEqual([10]);
    expect(ledgerLines(12)).toEqual([10, 12]);
  });
});

describe('noteMatches', () => {
  it('accepts the exact note played in tune', () => {
    expect(noteMatches(60, 0, 60)).toBe(true);
  });

  it('tolerates a beginner being slightly out of tune', () => {
    // Being 40 cents sharp is an intonation problem, not a reading mistake.
    expect(noteMatches(60, 40, 60)).toBe(true);
    expect(noteMatches(60, -40, 60)).toBe(true);
  });

  it('rejects a pitch too far off to be that note', () => {
    expect(noteMatches(60, 80, 60)).toBe(false);
  });

  it('rejects the wrong note', () => {
    expect(noteMatches(62, 0, 60)).toBe(false);
  });

  it('can accept the right pitch class in the wrong octave when asked', () => {
    expect(noteMatches(72, 0, 60, { ignoreOctave: true })).toBe(true);
    expect(noteMatches(72, 0, 60)).toBe(false);
  });

  it('honours a custom tolerance', () => {
    expect(noteMatches(60, 30, 60, { centsTolerance: 20 })).toBe(false);
    expect(noteMatches(60, 15, 60, { centsTolerance: 20 })).toBe(true);
  });
});

describe('advanceGame — wait mode', () => {
  it('does not move on silence', () => {
    const g = initGame(scale, 'wait');
    const next = advanceGame(g, scale, { heardMidi: null, cents: 0, deltaBeats: 1 });
    expect(next.cursor).toBe(0);
    expect(next.results).toHaveLength(0);
  });

  it('does not punish a wrong note — a kid hunting for the note is practising', () => {
    const g = initGame(scale, 'wait');
    const next = advanceGame(g, scale, { heardMidi: 65, cents: 0, deltaBeats: 1 });
    expect(next.cursor).toBe(0);
    expect(next.results).toHaveLength(0); // no miss recorded
  });

  it('advances and records a hit on the right note', () => {
    const g = initGame(scale, 'wait');
    const next = advanceGame(g, scale, { heardMidi: 60, cents: 0, deltaBeats: 0 });
    expect(next.cursor).toBe(1);
    expect(next.results).toHaveLength(1);
    expect(next.results[0]).toMatchObject({ index: 0, hit: true });
  });

  it('finishes the song and marks it done', () => {
    let g = initGame(scale, 'wait');
    for (const n of scale.notes) {
      g = advanceGame(g, scale, { heardMidi: n.midi, cents: 0, deltaBeats: 0 });
    }
    expect(g.done).toBe(true);
    expect(g.results).toHaveLength(scale.notes.length);
    expect(scoreRun(g.results).accuracy).toBe(100);
  });

  it('is a no-op once done', () => {
    let g = initGame(scale, 'wait');
    for (const n of scale.notes) g = advanceGame(g, scale, { heardMidi: n.midi, cents: 0, deltaBeats: 0 });
    const after = advanceGame(g, scale, { heardMidi: 60, cents: 0, deltaBeats: 5 });
    expect(after).toEqual(g);
  });
});

describe('advanceGame — practice mode', () => {
  it('advances but records nothing', () => {
    const g = initGame(scale, 'practice');
    const next = advanceGame(g, scale, { heardMidi: 60, cents: 0, deltaBeats: 0 });
    expect(next.cursor).toBe(1);
    expect(next.results).toHaveLength(0);
  });
});

describe('advanceGame — tempo mode', () => {
  const tiny: Song = {
    id: 't', title: 'T', source: 'built-in', bpm: 60, clef: 'treble', level: 'starter',
    notes: [{ midi: 60, beats: 1 }, { midi: 62, beats: 1 }],
  };

  it('counts a miss when the note goes by unplayed', () => {
    const g = initGame(tiny, 'tempo');
    const next = advanceGame(g, tiny, { heardMidi: null, cents: 0, deltaBeats: 1 });
    expect(next.cursor).toBe(1);
    expect(next.results).toHaveLength(1);
    expect(next.results[0]).toMatchObject({ index: 0, hit: false, grade: 'unheard' });
  });

  it('counts a hit when the note is played in time', () => {
    const g = initGame(tiny, 'tempo');
    const next = advanceGame(g, tiny, { heardMidi: 60, cents: 0, deltaBeats: 0.5 });
    expect(next.results).toHaveLength(1);
    expect(next.results[0]).toMatchObject({ index: 0, hit: true });
    expect(next.cursor).toBe(0); // still on this note until its beats elapse
  });

  it('does not double-score a note held across ticks', () => {
    let g = initGame(tiny, 'tempo');
    g = advanceGame(g, tiny, { heardMidi: 60, cents: 0, deltaBeats: 0.3 });
    g = advanceGame(g, tiny, { heardMidi: 60, cents: 0, deltaBeats: 0.3 });
    expect(g.results.filter(r => r.index === 0)).toHaveLength(1);
  });

  it('carries leftover beats into the next note so timing does not drift', () => {
    const g = initGame(tiny, 'tempo');
    const next = advanceGame(g, tiny, { heardMidi: null, cents: 0, deltaBeats: 1.25 });
    expect(next.cursor).toBe(1);
    expect(next.beat).toBeCloseTo(0.25);
  });
});

describe('scoreRun', () => {
  it('is zero for an empty run rather than NaN', () => {
    expect(scoreRun([])).toMatchObject({ total: 0, hits: 0, misses: 0, accuracy: 0, passed: false, points: 0, maxPoints: 0 });
  });

  it('computes accuracy and the 80% pass mark', () => {
    const mk = (hits: number, misses: number) => [
      ...Array.from({ length: hits }, (_, i) => ({ index: i, hit: true })),
      ...Array.from({ length: misses }, (_, i) => ({ index: hits + i, hit: false })),
    ];
    expect(scoreRun(mk(8, 2)).accuracy).toBe(80);
    expect(scoreRun(mk(8, 2)).passed).toBe(true);
    expect(scoreRun(mk(7, 3)).accuracy).toBe(70);
    expect(scoreRun(mk(7, 3)).passed).toBe(false);
    expect(scoreRun(mk(10, 0)).accuracy).toBe(100);
  });
});

describe('anti-fixation: the microphone is not always right', () => {
  const scaleSong = SONGS.find(s => s.id === 'c-major-scale')!;

  it('counts how long a note has been waiting in wait mode', () => {
    let g = initGame(scaleSong, 'wait');
    expect(g.stuckTicks).toBe(0);
    for (let i = 0; i < 5; i++) {
      g = advanceGame(g, scaleSong, { heardMidi: null, cents: 0, deltaBeats: 0 });
    }
    expect(g.stuckTicks).toBe(5);
  });

  it('a WRONG note still does not count as a miss, but does count as waiting', () => {
    let g = initGame(scaleSong, 'wait');
    g = advanceGame(g, scaleSong, { heardMidi: 71, cents: 0, deltaBeats: 0 });
    expect(g.results).toHaveLength(0);   // never punished for hunting
    expect(g.stuckTicks).toBe(1);        // but we notice they are stuck
  });

  it('resets the wait counter as soon as a note lands', () => {
    let g = initGame(scaleSong, 'wait');
    for (let i = 0; i < 20; i++) g = advanceGame(g, scaleSong, { heardMidi: null, cents: 0, deltaBeats: 0 });
    expect(g.stuckTicks).toBe(20);
    g = advanceGame(g, scaleSong, { heardMidi: 60, cents: 0, deltaBeats: 0 });
    expect(g.stuckTicks).toBe(0);
  });

  it('flags stuck only after the limit, and only in wait mode', () => {
    let g = initGame(scaleSong, 'wait');
    expect(isStuck(g)).toBe(false);
    g = { ...g, stuckTicks: STUCK_TICK_LIMIT };
    expect(isStuck(g)).toBe(true);
    // tempo mode advances on the clock, so it can never fixate
    expect(isStuck({ ...g, mode: 'tempo' })).toBe(false);
  });

  it('skipping a stuck note does NOT record a miss against the child', () => {
    let g = initGame(scaleSong, 'wait');
    g = { ...g, stuckTicks: STUCK_TICK_LIMIT };
    const after = skipStuckNote(g, scaleSong);
    expect(after.cursor).toBe(1);
    expect(after.results).toHaveLength(0); // we do not know they got it wrong
    expect(after.stuckTicks).toBe(0);
  });

  it('skipping the last note finishes the song', () => {
    let g = initGame(scaleSong, 'wait');
    g = { ...g, cursor: scaleSong.notes.length - 1 };
    expect(skipStuckNote(g, scaleSong).done).toBe(true);
  });
});

describe('gradeNote — points scale with how close you were', () => {
  it('a dead-on note scores the maximum', () => {
    const r = gradeNote({ centsOff: 0, beatsOff: 0, correctPitch: true });
    expect(r.grade).toBe('great');
    expect(r.points).toBe(MAX_NOTE_POINTS);
  });

  it('pays LESS the further the pitch drifts', () => {
    const dead = gradeNote({ centsOff: 0, beatsOff: 0, correctPitch: true }).points;
    const near = gradeNote({ centsOff: 15, beatsOff: 0, correctPitch: true }).points;
    const far  = gradeNote({ centsOff: 40, beatsOff: 0, correctPitch: true }).points;
    expect(dead).toBeGreaterThan(near);
    expect(near).toBeGreaterThan(far);
  });

  it('pays LESS the further the timing drifts', () => {
    const onTime = gradeNote({ centsOff: 0, beatsOff: 0, correctPitch: true }).points;
    const late   = gradeNote({ centsOff: 0, beatsOff: 0.5, correctPitch: true }).points;
    const later  = gradeNote({ centsOff: 0, beatsOff: 0.9, correctPitch: true }).points;
    expect(onTime).toBeGreaterThan(late);
    expect(late).toBeGreaterThan(later);
  });

  it('drops from great to close when pitch OR timing slips', () => {
    expect(gradeNote({ centsOff: 30, beatsOff: 0, correctPitch: true }).grade).toBe('close');
    expect(gradeNote({ centsOff: 0, beatsOff: 0.6, correctPitch: true }).grade).toBe('close');
  });

  it('a clearly different note is wrong and scores zero', () => {
    const r = gradeNote({ centsOff: 5, beatsOff: 0, correctPitch: false });
    expect(r.grade).toBe('wrong');
    expect(r.points).toBe(0);
  });

  it('silence is UNHEARD, never wrong — the mic may be at fault, not the child', () => {
    const r = gradeNote({ centsOff: null, beatsOff: null, correctPitch: false });
    expect(r.grade).toBe('unheard');
    expect(r.points).toBe(0);
  });

  it('gives full timing marks in wait mode, where there is no beat to miss', () => {
    const r = gradeNote({ centsOff: 0, beatsOff: null, correctPitch: true });
    expect(r.points).toBe(MAX_NOTE_POINTS);
  });

  it('never returns negative points however far off the note is', () => {
    for (const c of [0, 25, 49, 60, 500]) {
      for (const b of [0, 1, 5, 50]) {
        const r = gradeNote({ centsOff: c, beatsOff: b, correctPitch: true });
        expect(r.points, `cents ${c} beats ${b}`).toBeGreaterThanOrEqual(0);
        expect(r.points).toBeLessThanOrEqual(MAX_NOTE_POINTS);
      }
    }
  });

  it('treats being early and late the same', () => {
    const early = gradeNote({ centsOff: 0, beatsOff: -0.4, correctPitch: true }).points;
    const late  = gradeNote({ centsOff: 0, beatsOff: 0.4, correctPitch: true }).points;
    expect(early).toBe(late);
  });
});

describe('scoreRun — totals for the page', () => {
  it('adds up points and counts each grade', () => {
    const results = [
      { index: 0, hit: true,  grade: 'great' as const,   points: 100 },
      { index: 1, hit: true,  grade: 'close' as const,   points: 62 },
      { index: 2, hit: false, grade: 'wrong' as const,   points: 0 },
      { index: 3, hit: false, grade: 'unheard' as const, points: 0 },
    ];
    const s = scoreRun(results);
    expect(s.points).toBe(162);
    expect(s.maxPoints).toBe(400);
    expect(s.great).toBe(1);
    expect(s.close).toBe(1);
    expect(s.wrong).toBe(1);
    expect(s.unheard).toBe(1);
  });
});

describe('transcription arithmetic — catches a mis-read page', () => {
  // A transcription can look plausible and still be wrong. Measure sums are the
  // cheapest real check available: if the beats in a piece do not divide evenly
  // into its time signature, a note was misread. This caught two errors in the
  // Minuet (a 2-beat bar and a 5-beat bar) that looked fine by eye.
  // EVERY song, not just the one that was wrong at the time. An audit found two
  // more bad bars (a 17-beat "4-bar" scale and a 62-beat "16-bar" piece) that
  // this guard missed purely because those songs were not listed here.
  const EXPECTED: Record<string, { beatsPerBar: number; bars: number }> = {
    'c-major-scale': { beatsPerBar: 4, bars: 4 },
    'mary-had-a-little-lamb': { beatsPerBar: 4, bars: 8 },
    'twinkle-twinkle': { beatsPerBar: 4, bars: 8 },
    'ode-to-joy': { beatsPerBar: 4, bars: 8 },
    'dragon-dances-opening': { beatsPerBar: 4, bars: 16 },
    'one-bow-concerto-opening': { beatsPerBar: 4, bars: 14 },
    'minuet-in-c-opening': { beatsPerBar: 3, bars: 8 },
    'cello-open-strings': { beatsPerBar: 4, bars: 4 },
  };

  for (const [id, spec] of Object.entries(EXPECTED)) {
    it(`${id} totals exactly ${spec.bars} bars`, () => {
      const song = SONGS.find(s => s.id === id)!;
      const total = song.notes.reduce((a, n) => a + n.beats, 0);
      expect(total).toBe(spec.beatsPerBar * spec.bars);
    });
  }

  it('every song in the library is covered by this guard', () => {
    // Without this, adding a song silently opts it out of the bar check.
    for (const s of SONGS) {
      expect(EXPECTED[s.id], `${s.id} has no expected bar count`).toBeDefined();
    }
  });

  it('no transcribed song contains an accidental it should not', () => {
    // The Minuet is C major: no sharps or flats anywhere.
    const song = SONGS.find(s => s.id === 'minuet-in-c-opening')!;
    const sharps = song.notes.filter(n => [1, 3, 6, 8, 10].includes(((n.midi % 12) + 12) % 12));
    expect(sharps).toHaveLength(0);
  });

  it('every transcribed cello piece stays in a playable range', () => {
    const transcribed = SONGS.filter(s => s.source === 'transcribed' && s.clef === 'bass');
    expect(transcribed.length).toBeGreaterThan(0);
    for (const s of transcribed) {
      for (const n of s.notes) {
        expect(n.midi, `${s.id} above cello C2`).toBeGreaterThanOrEqual(36);
        expect(n.midi, `${s.id} within first positions`).toBeLessThanOrEqual(72);
      }
    }
  });
});

describe('grand staff — piano and harp music uses two staves', () => {
  it('a single-stave song always resolves to itself', () => {
    expect(staveFor(60, 'treble')).toBe('treble');
    expect(staveFor(40, 'treble')).toBe('treble');
    expect(staveFor(80, 'bass')).toBe('bass');
  });

  it('splits a grand staff at middle C', () => {
    expect(staveFor(60, 'grand')).toBe('treble');   // middle C sits on treble
    expect(staveFor(72, 'grand')).toBe('treble');
    expect(staveFor(59, 'grand')).toBe('bass');     // one below goes to bass
    expect(staveFor(36, 'grand')).toBe('bass');
  });

  it('keeps ledger lines reasonable across the split', () => {
    // The point of splitting at middle C is that neither stave needs many
    // ledger lines for the range a child actually plays.
    for (const midi of [48, 55, 60, 64, 72]) {
      const pos = staffPosition(midi, staveFor(midi, 'grand'));
      expect(Math.abs(pos), `midi ${midi} sits near its stave`).toBeLessThanOrEqual(10);
    }
  });
});
