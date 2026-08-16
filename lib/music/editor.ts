// Score editor — PURE logic only.
//
// Everything here takes plain data and returns plain data, so it is fully
// unit-testable (see __tests__/editor.test.ts). No React, no DOM, no audio.
//
// WHY THIS EXISTS: transcription has been the weak link in this whole feature.
// Reading engraved notation off a phone photo failed twice on the same Bach
// minuet, and reading it automatically (OMR) is worse. A kid who can already
// read the page in front of them can enter the notes correctly in less time
// than it takes anyone to argue about a blurry photo — and they KNOW the
// result is right, because they put it there.
//
//   - noteName / parseNoteName  → "A#4" <-> MIDI, both directions
//   - NOTE_VALUES               → the durations you can pick from
//   - insertNote / deleteNote / updateNote / moveNote / transposeNote
//   - parseSpokenNote           → "A sharp 4 whole" -> a note
//   - measureLayout             → where the bar lines fall, and which bars are
//                                 short or overfull

import type { SongNote, Dynamic } from './sightread';

/* ============================================================
   NOTE NAMES
   ============================================================ */

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

/** MIDI -> "A#4". Octave numbering is scientific: middle C (60) is C4. */
export function noteName(midi: number, prefer: 'sharp' | 'flat' = 'sharp'): string {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const table = prefer === 'flat' ? FLAT_NAMES : SHARP_NAMES;
  return `${table[pc]}${octave}`;
}

const LETTER_OFFSET: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/**
 * "A#4" / "Bb3" / "c4" / "F##4" -> MIDI, or null if it is not a note name.
 *
 * Tolerant on purpose: a kid typing into a box will use lower case, will write
 * "s" or "#" for sharp, and will forget the octave. A missing octave defaults
 * to 4 (the octave around middle C) rather than being rejected.
 */
export function parseNoteName(input: string): number | null {
  const t = input.trim().replace(/\s+/g, '');
  if (!t) return null;
  const m = /^([A-Ga-g])([#b♯♭sS]*)(-?\d+)?$/.exec(t);
  if (!m) return null;

  const letter = m[1]!.toUpperCase();
  const base = LETTER_OFFSET[letter];
  if (base === undefined) return null;

  let alter = 0;
  for (const ch of m[2] ?? '') {
    if (ch === '#' || ch === '♯' || ch === 's' || ch === 'S') alter += 1;
    else if (ch === 'b' || ch === '♭') alter -= 1;
  }

  const octave = m[3] === undefined ? 4 : Number(m[3]);
  if (!Number.isFinite(octave)) return null;

  const midi = (octave + 1) * 12 + base + alter;
  if (midi < 0 || midi > 127) return null;
  return midi;
}

/* ============================================================
   NOTE VALUES
   ============================================================ */

export interface NoteValue {
  id: string;
  label: string;
  beats: number;
  /** Drawn hollow (half and whole notes). */
  hollow: boolean;
  /** Number of flags/beams (eighth = 1, sixteenth = 2). */
  flags: number;
  /** Whole notes have no stem. */
  stem: boolean;
}

/** The durations a kid can pick, longest first — the order they are taught. */
export const NOTE_VALUES: NoteValue[] = [
  { id: 'whole',        label: 'Whole (4)',          beats: 4,    hollow: true,  flags: 0, stem: false },
  { id: 'dotted-half',  label: 'Dotted half (3)',    beats: 3,    hollow: true,  flags: 0, stem: true },
  { id: 'half',         label: 'Half (2)',           beats: 2,    hollow: true,  flags: 0, stem: true },
  { id: 'dotted-quarter', label: 'Dotted quarter (1½)', beats: 1.5, hollow: false, flags: 0, stem: true },
  { id: 'quarter',      label: 'Quarter (1)',        beats: 1,    hollow: false, flags: 0, stem: true },
  { id: 'dotted-eighth', label: 'Dotted eighth (¾)', beats: 0.75, hollow: false, flags: 1, stem: true },
  { id: 'eighth',       label: 'Eighth (½)',         beats: 0.5,  hollow: false, flags: 1, stem: true },
  { id: 'sixteenth',    label: 'Sixteenth (¼)',      beats: 0.25, hollow: false, flags: 2, stem: true },
];

/** Closest note value to a raw beat count — used when snapping a dragged note. */
export function nearestNoteValue(beats: number): NoteValue {
  let best = NOTE_VALUES[0]!;
  let bestDiff = Infinity;
  for (const v of NOTE_VALUES) {
    const d = Math.abs(v.beats - beats);
    if (d < bestDiff) { best = v; bestDiff = d; }
  }
  return best;
}

/* ============================================================
   EDITS — every one returns a NEW array, never mutates
   ============================================================ */

export function insertNote(notes: SongNote[], at: number, note: SongNote): SongNote[] {
  const i = Math.max(0, Math.min(Math.floor(at), notes.length));
  return [...notes.slice(0, i), { ...note }, ...notes.slice(i)];
}

export function deleteNote(notes: SongNote[], at: number): SongNote[] {
  if (at < 0 || at >= notes.length) return notes;
  return [...notes.slice(0, at), ...notes.slice(at + 1)];
}

export function updateNote(notes: SongNote[], at: number, patch: Partial<SongNote>): SongNote[] {
  if (at < 0 || at >= notes.length) return notes;
  const next = [...notes];
  next[at] = { ...next[at]!, ...patch };
  return next;
}

/** Move a note to a different position in the sequence (drag to reorder). */
export function moveNote(notes: SongNote[], from: number, to: number): SongNote[] {
  if (from < 0 || from >= notes.length) return notes;
  const clampedTo = Math.max(0, Math.min(Math.floor(to), notes.length - 1));
  if (from === clampedTo) return notes;
  const next = [...notes];
  const [n] = next.splice(from, 1);
  next.splice(clampedTo, 0, n!);
  return next;
}

/**
 * Shift a note by semitones, clamped to a real instrument's range.
 *
 * Clamping rather than wrapping: dragging past the top of the staff should
 * stop, not silently jump the note three octaves down.
 */
export function transposeNote(notes: SongNote[], at: number, semitones: number): SongNote[] {
  if (at < 0 || at >= notes.length) return notes;
  const cur = notes[at]!;
  const midi = Math.max(21, Math.min(108, cur.midi + semitones));
  return updateNote(notes, at, { midi });
}

/** Cycle a marking on or off. */
export function toggleMark(
  notes: SongNote[],
  at: number,
  mark: 'staccato' | 'accent' | 'fermata' | 'slurToNext' | 'rest',
): SongNote[] {
  if (at < 0 || at >= notes.length) return notes;
  const cur = notes[at]!;
  return updateNote(notes, at, { [mark]: !cur[mark] } as Partial<SongNote>);
}

export function setDynamic(notes: SongNote[], at: number, dynamic: Dynamic | undefined): SongNote[] {
  return updateNote(notes, at, { dynamic });
}

/* ============================================================
   SPOKEN / TYPED ENTRY
   ============================================================ */

const SPOKEN_VALUES: [RegExp, number][] = [
  [/\b(whole)\b/i, 4],
  [/\b(dotted[\s-]*half)\b/i, 3],
  [/\b(half)\b/i, 2],
  [/\b(dotted[\s-]*quarter)\b/i, 1.5],
  [/\b(quarter|crotchet)\b/i, 1],
  [/\b(dotted[\s-]*eighth)\b/i, 0.75],
  [/\b(eighth|eigth|quaver)\b/i, 0.5],
  [/\b(sixteenth|16th|semiquaver)\b/i, 0.25],
];

/**
 * Turn something a kid says or types into a note.
 *
 * Handles "A sharp 4 whole note", "a#4 quarter", "b flat 3 half", "rest 2".
 * Returns null when there is no note name to find, so the caller can show a
 * "did not catch that" rather than inventing a pitch.
 */
export function parseSpokenNote(input: string): SongNote | null {
  const raw = input.trim();
  if (!raw) return null;

  // duration: default to a quarter note, which is what "just add a note" means
  let beats = 1;
  for (const [re, b] of SPOKEN_VALUES) {
    if (re.test(raw)) { beats = b; break; }
  }

  if (/\brest\b/i.test(raw)) return { midi: 60, beats, rest: true };

  // Spoken accidentals before we try the compact form: "A sharp 4" -> "A#4"
  const compact = raw
    .replace(/\b([A-Ga-g])\s*(sharp|♯)\b/gi, '$1#')
    .replace(/\b([A-Ga-g])\s*(flat|♭)\b/gi, '$1b')
    .replace(/\s+/g, ' ');

  const m = /\b([A-Ga-g][#b♯♭sS]*)\s*(-?\d+)?\b/.exec(compact);
  if (!m) return null;

  const octaveText = m[2] ?? '';
  const midi = parseNoteName(`${m[1]}${octaveText}`);
  if (midi == null) return null;
  return { midi, beats };
}

/* ============================================================
   MEASURES
   ============================================================ */

export interface MeasureInfo {
  index: number;
  /** Indices of the notes in this bar. */
  noteIndices: number[];
  beats: number;
  /** Does this bar hold exactly the right number of beats? */
  complete: boolean;
}

/**
 * Group notes into measures and flag any that do not add up.
 *
 * This is the check that caught real errors in hand-written transcriptions —
 * a 2-beat bar and a 5-beat bar in 3/4 that both looked fine by eye. Showing
 * it live while editing means a kid sees the problem as they create it.
 */
export function measureLayout(notes: SongNote[], beatsPerBar: number): MeasureInfo[] {
  const out: MeasureInfo[] = [];
  let cur: MeasureInfo = { index: 0, noteIndices: [], beats: 0, complete: false };

  notes.forEach((n, i) => {
    cur.noteIndices.push(i);
    cur.beats += n.beats;
    if (cur.beats >= beatsPerBar) {
      cur.complete = cur.beats === beatsPerBar;
      out.push(cur);
      cur = { index: out.length, noteIndices: [], beats: 0, complete: false };
    }
  });

  // A trailing partial bar is incomplete unless the piece happens to end evenly.
  if (cur.noteIndices.length > 0) {
    cur.complete = false;
    out.push(cur);
  }
  return out;
}

/** Total beats, for a quick "is this piece whole?" check. */
export function totalBeats(notes: SongNote[]): number {
  return notes.reduce((a, n) => a + n.beats, 0);
}
