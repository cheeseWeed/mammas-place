// Note-reading game — PURE logic only.
//
// No browser APIs and no React in this file: everything takes plain data in
// and returns plain data out, so it is unit-testable under vitest (see
// __tests__/sightread.test.ts). The Web Audio / mic wiring reuses the tuner's
// existing chain (getUserMedia -> AnalyserNode -> detectPitch) from
// components/music/TunerPanel.tsx and lib/music/pitch.ts.
//
//   - SONGS                  → hand-transcribed melodies (see note on OMR below)
//   - staffPosition(midi)    → where a note sits on the staff, in half-steps
//   - noteMatches(...)       → did the played pitch hit the target note?
//   - advanceGame(...)       → one tick of the game state machine
//   - scoreRun(...)          → hits/misses -> accuracy, used for the MP earn
//
// WHY THE SONGS ARE HAND-WRITTEN: a PDF of sheet music is pixels, not notes.
// Reading it automatically means optical music recognition, which misreads
// accidentals, beamed groups and multi-voice staves often enough that a kid
// playing CORRECTLY would be marked wrong. In this app that is unacceptable
// (prod is the test environment; a wrong answer erodes trust in the whole
// site), so uploaded PDFs are transcribed by a human into the shape below.

/** One note in a melody. */
export interface SongNote {
  /** MIDI note number. 60 = middle C. */
  midi: number;
  /** Length in beats. 1 = quarter note at 4/4. */
  beats: number;

  /* ---- Optional markings. All display-and-playback only. ----
     These are drawn on the staff and shaped into the play-along, but they are
     NOT scored. A microphone measures loudness where the MIC is, not at the
     instrument — a kid sitting closer, turning slightly, or a laptop with
     auto-gain would swamp the difference between forte and piano. Grading it
     would tell a child who played correctly that they were wrong, which is the
     failure this whole feature exists to avoid. Show it, sound it, coach it;
     do not judge it. */

  /** A rest occupies its beats but sounds nothing and is never scored. */
  rest?: boolean;
  /** Played short and detached. */
  staccato?: boolean;
  /** Attacked harder than its neighbours. */
  accent?: boolean;
  /** Held longer than written. */
  fermata?: boolean;
  /** Slurred into the following note (one bow / one breath). */
  slurToNext?: boolean;
  /** Dynamic mark that STARTS at this note and holds until the next one. */
  dynamic?: Dynamic;
  /** Gradual change beginning at this note. */
  hairpin?: 'cresc' | 'dim';
  /** Fingering digit printed above the note, as on a cello part. */
  finger?: number;
}

/** Standard dynamic marks, quietest to loudest. */
export type Dynamic = 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff';

/** Relative playback volume for each dynamic. Used by the play-along only. */
export const DYNAMIC_GAIN: Record<Dynamic, number> = {
  pp: 0.35, p: 0.5, mp: 0.7, mf: 0.85, f: 1.0, ff: 1.2,
};

export interface Song {
  id: string;
  title: string;
  /** Where the notes came from — shown to the kid so nothing is a black box. */
  source: 'built-in' | 'transcribed';
  /** Suggested tempo for the timed mode. */
  bpm: number;
  /** Treble or bass staff. Drives clef drawing and staff positions. */
  clef: 'treble' | 'bass';
  /** Rough ordering for the song picker. */
  level: 'starter' | 'easy' | 'medium';
  notes: SongNote[];
}

/* ============================================================
   SONG LIBRARY — hand-transcribed, exact.
   Kid-uploaded PDFs get transcribed and appended here.
   ============================================================ */
export const SONGS: Song[] = [
  {
    id: 'c-major-scale',
    title: 'C Major Scale',
    source: 'built-in',
    bpm: 60,
    clef: 'treble',
    level: 'starter',
    notes: [
      { midi: 60, beats: 1 }, { midi: 62, beats: 1 }, { midi: 64, beats: 1 }, { midi: 65, beats: 1 },
      { midi: 67, beats: 1 }, { midi: 69, beats: 1 }, { midi: 71, beats: 1 }, { midi: 72, beats: 1 },
      { midi: 71, beats: 1 }, { midi: 69, beats: 1 }, { midi: 67, beats: 1 }, { midi: 65, beats: 1 },
      { midi: 64, beats: 1 }, { midi: 62, beats: 1 }, { midi: 60, beats: 2 },
    ],
  },
  {
    id: 'mary-had-a-little-lamb',
    title: 'Mary Had a Little Lamb',
    source: 'built-in',
    bpm: 72,
    clef: 'treble',
    level: 'starter',
    notes: [
      { midi: 64, beats: 1 }, { midi: 62, beats: 1 }, { midi: 60, beats: 1 }, { midi: 62, beats: 1 },
      { midi: 64, beats: 1 }, { midi: 64, beats: 1 }, { midi: 64, beats: 2 },
      { midi: 62, beats: 1 }, { midi: 62, beats: 1 }, { midi: 62, beats: 2 },
      { midi: 64, beats: 1 }, { midi: 67, beats: 1 }, { midi: 67, beats: 2 },
      { midi: 64, beats: 1 }, { midi: 62, beats: 1 }, { midi: 60, beats: 1 }, { midi: 62, beats: 1 },
      { midi: 64, beats: 1 }, { midi: 64, beats: 1 }, { midi: 64, beats: 1 }, { midi: 64, beats: 1 },
      { midi: 62, beats: 1 }, { midi: 62, beats: 1 }, { midi: 64, beats: 1 }, { midi: 62, beats: 1 },
      { midi: 60, beats: 4 },
    ],
  },
  {
    id: 'twinkle-twinkle',
    title: 'Twinkle, Twinkle, Little Star',
    source: 'built-in',
    bpm: 76,
    clef: 'treble',
    level: 'easy',
    notes: [
      { midi: 60, beats: 1 }, { midi: 60, beats: 1 }, { midi: 67, beats: 1 }, { midi: 67, beats: 1 },
      { midi: 69, beats: 1 }, { midi: 69, beats: 1 }, { midi: 67, beats: 2 },
      { midi: 65, beats: 1 }, { midi: 65, beats: 1 }, { midi: 64, beats: 1 }, { midi: 64, beats: 1 },
      { midi: 62, beats: 1 }, { midi: 62, beats: 1 }, { midi: 60, beats: 2 },
      { midi: 67, beats: 1 }, { midi: 67, beats: 1 }, { midi: 65, beats: 1 }, { midi: 65, beats: 1 },
      { midi: 64, beats: 1 }, { midi: 64, beats: 1 }, { midi: 62, beats: 2 },
      { midi: 67, beats: 1 }, { midi: 67, beats: 1 }, { midi: 65, beats: 1 }, { midi: 65, beats: 1 },
      { midi: 64, beats: 1 }, { midi: 64, beats: 1 }, { midi: 62, beats: 2 },
    ],
  },
  {
    id: 'ode-to-joy',
    title: 'Ode to Joy',
    source: 'built-in',
    bpm: 80,
    clef: 'treble',
    level: 'medium',
    notes: [
      { midi: 64, beats: 1 }, { midi: 64, beats: 1 }, { midi: 65, beats: 1 }, { midi: 67, beats: 1 },
      { midi: 67, beats: 1 }, { midi: 65, beats: 1 }, { midi: 64, beats: 1 }, { midi: 62, beats: 1 },
      { midi: 60, beats: 1 }, { midi: 60, beats: 1 }, { midi: 62, beats: 1 }, { midi: 64, beats: 1 },
      { midi: 64, beats: 1.5 }, { midi: 62, beats: 0.5 }, { midi: 62, beats: 2 },
      { midi: 64, beats: 1 }, { midi: 64, beats: 1 }, { midi: 65, beats: 1 }, { midi: 67, beats: 1 },
      { midi: 67, beats: 1 }, { midi: 65, beats: 1 }, { midi: 64, beats: 1 }, { midi: 62, beats: 1 },
      { midi: 60, beats: 1 }, { midi: 60, beats: 1 }, { midi: 62, beats: 1 }, { midi: 64, beats: 1 },
      { midi: 62, beats: 1.5 }, { midi: 60, beats: 0.5 }, { midi: 60, beats: 2 },
    ],
  },
  /* ---- Transcribed by hand from Shepherd's actual sheet music.
     Both are bass-clef cello parts in G major (one sharp: every F is F#).
     Only the opening sections are here — enough to practise, short enough to
     finish in a sitting. Double-stops, divisi and D.S. jumps are deliberately
     NOT transcribed: the game listens for one pitch at a time. ---- */
  {
    id: 'dragon-dances-opening',
    title: 'Dragon Dances (opening)',
    source: 'transcribed',
    bpm: 100,
    clef: 'bass',
    level: 'easy',
    // Soon Hee Newbold — cut time, G major. Measures 5-20.
    notes: [
      // m5-8
      { midi: 50, beats: 2 }, { midi: 47, beats: 2 },
      { midi: 43, beats: 3 }, { midi: 47, beats: 1 },
      { midi: 50, beats: 1 }, { midi: 52, beats: 1 }, { midi: 50, beats: 1 }, { midi: 47, beats: 1 },
      { midi: 43, beats: 3 }, { midi: 47, beats: 1 },
      // m9-12
      { midi: 50, beats: 3 }, { midi: 47, beats: 1 },
      { midi: 50, beats: 1 }, { midi: 52, beats: 1 }, { midi: 54, beats: 1 }, { midi: 52, beats: 1 },
      { midi: 50, beats: 1 }, { midi: 47, beats: 1 }, { midi: 50, beats: 1 }, { midi: 47, beats: 1 },
      { midi: 55, beats: 4 },
      // m13-16
      { midi: 54, beats: 2 }, { midi: 52, beats: 2 },
      { midi: 50, beats: 3 }, { midi: 47, beats: 1 },
      { midi: 50, beats: 1 }, { midi: 55, beats: 1 }, { midi: 54, beats: 1 }, { midi: 52, beats: 1 },
      { midi: 50, beats: 3 }, { midi: 50, beats: 1 },
      // m17-20
      { midi: 57, beats: 4 },
      { midi: 55, beats: 4 },
      { midi: 54, beats: 4 },
      { midi: 54, beats: 4 },
    ],
  },
  {
    id: 'one-bow-concerto-opening',
    title: 'The One-Bow Concerto (opening)',
    source: 'transcribed',
    bpm: 88,
    clef: 'bass',
    level: 'easy',
    // Richard Meyer — 4/4, G major, "Andante grazioso", sempre pizz.
    // Measures 2-16 (m1 and the multi-bar rests are skipped).
    notes: [
      // m2-5
      { midi: 43, beats: 1 }, { midi: 50, beats: 1 }, { midi: 50, beats: 2 },
      { midi: 47, beats: 1 }, { midi: 50, beats: 1 }, { midi: 50, beats: 2 },
      { midi: 47, beats: 1 }, { midi: 47, beats: 1 }, { midi: 43, beats: 2 },
      { midi: 50, beats: 1 }, { midi: 50, beats: 1 }, { midi: 43, beats: 2 },
      // m6-9
      { midi: 43, beats: 1 }, { midi: 47, beats: 1 }, { midi: 52, beats: 2 },
      { midi: 43, beats: 1 }, { midi: 47, beats: 1 }, { midi: 50, beats: 2 },
      { midi: 47, beats: 1 }, { midi: 50, beats: 1 }, { midi: 52, beats: 1 }, { midi: 50, beats: 1 },
      { midi: 47, beats: 1 }, { midi: 50, beats: 1 }, { midi: 52, beats: 2 },
      // m11-14
      { midi: 43, beats: 1 }, { midi: 47, beats: 1 }, { midi: 50, beats: 1 }, { midi: 52, beats: 1 },
      { midi: 50, beats: 1 }, { midi: 47, beats: 1 }, { midi: 50, beats: 1 }, { midi: 43, beats: 1 },
      { midi: 47, beats: 1 }, { midi: 50, beats: 1 }, { midi: 52, beats: 1 }, { midi: 50, beats: 1 },
      { midi: 47, beats: 1 }, { midi: 50, beats: 1 }, { midi: 52, beats: 1 }, { midi: 54, beats: 1 },
      // m15-16
      { midi: 55, beats: 2 }, { midi: 52, beats: 2 },
      { midi: 50, beats: 1 }, { midi: 47, beats: 1 }, { midi: 43, beats: 2 },
    ],
  },
  {
    id: 'minuet-in-c-opening',
    title: 'Minuet in C (first 8 bars)',
    source: 'transcribed',
    bpm: 84,
    clef: 'bass',
    level: 'easy',
    // J.S. Bach, Minuet BWV 841 — Suzuki Cello School Book 1, piece #16,
    // "Grazioso". Originally G major, transposed down a fifth to C major for
    // cello. 3/4, bass clef, first position.
    //
    // These notes were verified against the Neue Bach-Ausgabe urtext, NOT read
    // off a photo. Two earlier attempts to eyeball the printed page produced
    // a plausible-sounding stepwise line that was simply not Bach — the second
    // attempt got only measure 1 right. Reading engraved notation from a phone
    // photo is where this keeps going wrong; the source edition is the check.
    //
    // NOTE the m8 cadence is E3, not C3. This is a HALF cadence — the A section
    // ends on the third of the dominant, which is why there is a repeat and a
    // second section. An earlier version "landed on the tonic and held", which
    // would make the repeat musically pointless.
    //
    // Suzuki strips Bach's mordents and grace notes for beginners, so none are
    // expected here.
    notes: [
      // m1: G G G
      { midi: 55, beats: 1 }, { midi: 55, beats: 1 }, { midi: 55, beats: 1 },
      // m2: G | C-B eighths | C     (the leading-tone figure)
      { midi: 55, beats: 1 }, { midi: 60, beats: 0.5 }, { midi: 59, beats: 0.5 },
      { midi: 60, beats: 1 },
      // m3: E | E-F-G-F sixteenths | E   (the piece's characteristic run)
      { midi: 52, beats: 1 },
      { midi: 52, beats: 0.25 }, { midi: 53, beats: 0.25 },
      { midi: 55, beats: 0.25 }, { midi: 53, beats: 0.25 },
      { midi: 52, beats: 1 },
      // m4: E | E-F eighths | D
      { midi: 52, beats: 1 }, { midi: 52, beats: 0.5 }, { midi: 53, beats: 0.5 },
      { midi: 50, beats: 1 },
      // m5: A A A   (the phrase's high point — not a repeat of m1)
      { midi: 57, beats: 1 }, { midi: 57, beats: 1 }, { midi: 57, beats: 1 },
      // m6: A | A-G eighths | F-E eighths
      { midi: 57, beats: 1 }, { midi: 57, beats: 0.5 }, { midi: 55, beats: 0.5 },
      { midi: 53, beats: 0.5 }, { midi: 52, beats: 0.5 },
      // m7: A | G-F eighths | E-F eighths
      { midi: 57, beats: 1 }, { midi: 55, beats: 0.5 }, { midi: 53, beats: 0.5 },
      { midi: 52, beats: 0.5 }, { midi: 53, beats: 0.5 },
      // m8: E, dotted half — HALF cadence, the section is unfinished on purpose
      { midi: 52, beats: 3 },
    ],
  },
  {
    id: 'cello-open-strings',
    title: 'Cello Open Strings',
    source: 'built-in',
    bpm: 50,
    clef: 'bass',
    level: 'starter',
    notes: [
      { midi: 36, beats: 2 }, { midi: 43, beats: 2 }, { midi: 50, beats: 2 }, { midi: 57, beats: 2 },
      { midi: 50, beats: 2 }, { midi: 43, beats: 2 }, { midi: 36, beats: 4 },
    ],
  },
];

/* ============================================================
   STAFF GEOMETRY
   ============================================================ */

// Diatonic step index within an octave (C D E F G A B), used to place a note
// on a staff LINE or SPACE. Sharps sit on the same line as their natural.
const DIATONIC_BY_PITCH_CLASS = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
const IS_SHARP = [false, true, false, true, false, false, true, false, true, false, true, false];

/**
 * Vertical staff position of a MIDI note, in DIATONIC STEPS above the bottom
 * line of the staff. 0 = bottom line, 1 = first space, 2 = second line, ...
 *
 * Treble bottom line = E4 (midi 64). Bass bottom line = G2 (midi 43).
 * Values may be negative or > 8 — those need ledger lines.
 */
export function staffPosition(midi: number, clef: 'treble' | 'bass'): number {
  const octave = Math.floor(midi / 12) - 1;
  const pc = ((midi % 12) + 12) % 12;
  const diatonic = DIATONIC_BY_PITCH_CLASS[pc] + octave * 7;
  // bottom line: E4 -> diatonic index of E(2) + octave 4*7 = 30
  //              G2 -> diatonic index of G(4) + octave 2*7 = 18
  const bottom = clef === 'treble' ? 30 : 18;
  return diatonic - bottom;
}

/** Does this note need a sharp sign drawn in front of it? */
export function isSharp(midi: number): boolean {
  return IS_SHARP[((midi % 12) + 12) % 12];
}

/** Ledger lines needed for a note, as staff positions (even = line). */
export function ledgerLines(pos: number): number[] {
  const out: number[] = [];
  if (pos < 0) for (let p = -2; p >= pos; p -= 2) out.push(p);
  if (pos > 8) for (let p = 10; p <= pos; p += 2) out.push(p);
  return out;
}

/* ============================================================
   MATCHING
   ============================================================ */

export interface MatchOptions {
  /** How far off, in cents, still counts as the right note. Default 60. */
  centsTolerance?: number;
  /** Accept the right pitch class in any octave. Default false. */
  ignoreOctave?: boolean;
}

/**
 * Did the detected pitch hit the target note?
 *
 * `heardMidi` is the rounded MIDI note from frequencyToNote(); `cents` is how
 * far off it was. A generous default tolerance (60 cents) keeps a beginner
 * with slightly-off intonation from being told they played the wrong note —
 * being sharp is a tuning problem, not a reading problem, and this game is
 * teaching reading.
 */
export function noteMatches(
  heardMidi: number,
  cents: number,
  targetMidi: number,
  opts: MatchOptions = {},
): boolean {
  const tol = opts.centsTolerance ?? 60;
  if (Math.abs(cents) > tol) return false;
  if (opts.ignoreOctave) {
    return ((heardMidi % 12) + 12) % 12 === ((targetMidi % 12) + 12) % 12;
  }
  return heardMidi === targetMidi;
}

/* ============================================================
   GAME STATE MACHINE
   ============================================================ */

export type GameMode =
  | 'wait'     // easy: the staff pauses until the right note is played
  | 'tempo'    // harder: notes scroll at the song's BPM, keep up
  | 'practice'; // no scoring, play along freely

/**
 * How a single note turned out.
 *
 * `grade` is deliberately four-valued rather than hit/miss:
 *
 *   great   right note, in tune, on time      -> green
 *   close   right note, but loose in pitch
 *           or timing                          -> amber
 *   wrong   a DIFFERENT note was clearly
 *           played                             -> red
 *   unheard the microphone never caught
 *           anything                           -> grey, NOT red
 *
 * The split between `wrong` and `unheard` is the important one. Mic pitch
 * detection genuinely fails on low notes, repeated notes and quiet bowing, and
 * across music-learning apps that failure is the top complaint — a child gets
 * marked wrong for a note they played correctly. So a note the mic never heard
 * is greyed out and scores zero, but it is never coloured as a mistake: we do
 * not claim to know something we cannot know.
 */
export type NoteGrade = 'great' | 'close' | 'wrong' | 'unheard';

export interface NoteResult {
  index: number;
  hit: boolean;
  grade?: NoteGrade;
  /** Points earned for this note, 0..MAX_NOTE_POINTS. */
  points?: number;
  /** How far off the pitch was, in cents. Absent when nothing was heard. */
  cents?: number;
  /** How far off the beat, in beats. Negative = early. Tempo mode only. */
  beatsOff?: number;
}

/** Best possible score for one note. */
export const MAX_NOTE_POINTS = 100;

/**
 * Points for one note, scaled by how close the pitch and timing were.
 *
 * Pitch is worth 60 and timing 40 — reading the right note matters more than
 * nailing the beat, and this game is teaching reading.
 *
 * The windows are wide on purpose. Children aged 5-8 have a beat-tapping
 * spread of roughly 180ms, which is wider than the entire hit window of most
 * rhythm games, and a bowed cello note has a soft attack that adds tens of
 * milliseconds before anyone can even detect it. Tight windows would punish
 * physics, not playing.
 */
export function gradeNote(input: {
  centsOff: number | null;
  beatsOff: number | null;
  correctPitch: boolean;
}): { grade: NoteGrade; points: number } {
  if (input.centsOff === null) return { grade: 'unheard', points: 0 };
  if (!input.correctPitch) return { grade: 'wrong', points: 0 };

  // --- pitch, out of 60. Dead on = 60, a quarter-tone out = 0.
  const cents = Math.abs(input.centsOff);
  const pitchScore = Math.max(0, Math.round(60 * (1 - cents / 50)));

  // --- timing, out of 40. Wait mode has no beat to be off, so it gets full
  // marks: nothing is being tested there but the notes themselves.
  let timeScore = 40;
  if (input.beatsOff !== null) {
    const off = Math.abs(input.beatsOff);
    timeScore = Math.max(0, Math.round(40 * (1 - off / 1.0)));
  }

  const points = pitchScore + timeScore;
  // "great" needs both close: within a sixth of a tone and a quarter beat.
  const great = cents <= 17 && (input.beatsOff === null || Math.abs(input.beatsOff) <= 0.25);
  return { grade: great ? 'great' : 'close', points };
}

export interface GameState {
  mode: GameMode;
  songId: string;
  /** Index of the note the kid should be playing now. */
  cursor: number;
  results: NoteResult[];
  /** Beats elapsed — only advances in tempo mode. */
  beat: number;
  done: boolean;
  /**
   * Ticks spent waiting on the CURRENT note in wait mode.
   *
   * This exists to break the fixation loop: microphone pitch detection
   * genuinely fails on some notes — low register, repeated notes, a quiet
   * bow — and without an escape a kid who is playing correctly gets walled in
   * forever. Across music-learning apps this is the number-one complaint and
   * a documented reason children quit the instrument. So after a while we
   * assume the DETECTOR is at fault, not the child, and offer a way on.
   */
  stuckTicks: number;
}

/**
 * How many poll ticks on one note before we stop believing the microphone.
 * At the 40 ms poll rate this is about twelve seconds — long enough that a kid
 * genuinely hunting for the note is not rushed, short enough that a mis-heard
 * note does not end the session.
 */
export const STUCK_TICK_LIMIT = 300;

export function initGame(song: Song, mode: GameMode): GameState {
  return {
    mode, songId: song.id, cursor: 0, results: [], beat: 0,
    done: song.notes.length === 0, stuckTicks: 0,
  };
}

/** Has this note been waiting long enough that the microphone is the likely problem? */
export function isStuck(state: GameState): boolean {
  return state.mode === 'wait' && state.stuckTicks >= STUCK_TICK_LIMIT;
}

/**
 * Move past a note the detector will not hear.
 *
 * Deliberately does NOT record a miss: we do not know that the kid played it
 * wrong, only that the microphone never confirmed it. Scoring it against them
 * would be the app asserting something it cannot know.
 */
export function skipStuckNote(state: GameState, song: Song): GameState {
  const cursor = state.cursor + 1;
  return { ...state, cursor, beat: 0, stuckTicks: 0, done: cursor >= song.notes.length };
}

export interface AdvanceInput {
  /** MIDI note currently heard, or null for silence. */
  heardMidi: number | null;
  /** Cents off the heard note. Ignored when heardMidi is null. */
  cents: number;
  /** Beats elapsed since the last tick (tempo mode only). */
  deltaBeats: number;
  matchOpts?: MatchOptions;
}

/**
 * One tick of the game.
 *
 * WAIT mode: nothing moves until the correct note is heard. A wrong note is
 * ignored rather than scored as a miss — a kid hunting for the note on their
 * instrument should not be punished for hunting.
 *
 * TEMPO mode: the cursor advances when the note's beats elapse. Playing the
 * right note before that lands a hit; letting it pass unplayed is a miss.
 */
export function advanceGame(state: GameState, song: Song, input: AdvanceInput): GameState {
  if (state.done) return state;

  const note = song.notes[state.cursor];
  if (!note) return { ...state, done: true };

  const heard = input.heardMidi != null && noteMatches(input.heardMidi, input.cents, note.midi, input.matchOpts);

  if (state.mode === 'wait' || state.mode === 'practice') {
    // Count how long we have been waiting so the UI can offer a way past a
    // note the microphone will not hear. A wrong note is still never a miss —
    // a kid hunting for the note on their instrument is practicing.
    if (!heard) {
      return state.mode === 'wait'
        ? { ...state, stuckTicks: state.stuckTicks + 1 }
        : state;
    }
    const g = gradeNote({ centsOff: input.cents, beatsOff: null, correctPitch: true });
    const results = state.mode === 'practice'
      ? state.results
      : [...state.results, {
          index: state.cursor, hit: true,
          grade: g.grade, points: g.points, cents: input.cents,
        }];
    const cursor = state.cursor + 1;
    return { ...state, cursor, results, beat: 0, stuckTicks: 0, done: cursor >= song.notes.length };
  }

  // tempo mode
  const beat = state.beat + input.deltaBeats;
  const alreadyScored = state.results.some(r => r.index === state.cursor);
  if (heard && !alreadyScored) {
    // The note "should" land at the START of its slot, so however many beats
    // have already elapsed is how LATE the kid was. Negative is impossible
    // here — you cannot play a note before its slot opens.
    const g = gradeNote({ centsOff: input.cents, beatsOff: beat, correctPitch: true });
    const results = [...state.results, {
      index: state.cursor, hit: true,
      grade: g.grade, points: g.points, cents: input.cents, beatsOff: beat,
    }];
    if (beat < note.beats) return { ...state, beat, results };
    const cursor = state.cursor + 1;
    return { ...state, cursor, results, beat: beat - note.beats, done: cursor >= song.notes.length };
  }
  if (beat < note.beats) return { ...state, beat };

  // The note's time is up with nothing heard. Graded 'unheard', not 'wrong':
  // silence might be a kid who missed it, or a microphone that did.
  const results = alreadyScored ? state.results : [...state.results, {
    index: state.cursor, hit: false, grade: 'unheard' as NoteGrade, points: 0,
  }];
  const cursor = state.cursor + 1;
  return { ...state, cursor, results, beat: beat - note.beats, done: cursor >= song.notes.length };
}

/* ============================================================
   SCORING
   ============================================================ */

export interface RunScore {
  total: number;
  hits: number;
  misses: number;
  /** 0-100, rounded. */
  accuracy: number;
  passed: boolean;
  /** Sum of per-note points — rewards precision, not just correctness. */
  points: number;
  maxPoints: number;
  great: number;
  close: number;
  wrong: number;
  unheard: number;
}

/** Accuracy for a finished run. 80% to pass, matching the other sections. */
export function scoreRun(results: NoteResult[]): RunScore {
  const total = results.length;
  const hits = results.filter(r => r.hit).length;
  const misses = total - hits;
  const accuracy = total === 0 ? 0 : Math.round((hits / total) * 100);
  const points = results.reduce((a, r) => a + (r.points ?? (r.hit ? MAX_NOTE_POINTS : 0)), 0);
  const maxPoints = total * MAX_NOTE_POINTS;
  const great = results.filter(r => r.grade === 'great').length;
  const close = results.filter(r => r.grade === 'close').length;
  const wrong = results.filter(r => r.grade === 'wrong').length;
  const unheard = results.filter(r => r.grade === 'unheard').length;
  return {
    total, hits, misses, accuracy, passed: accuracy >= 80,
    points, maxPoints, great, close, wrong, unheard,
  };
}
