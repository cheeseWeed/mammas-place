// Multi-part scores — writing for more than one instrument.
//
// PURE logic only. No React, no DOM, no audio (see __tests__/score.test.ts).
//
// THE QUESTION THIS ANSWERS: "is a symphony written on one sheet or many?"
// BOTH, and that is not a fudge — they are two VIEWS of the same music:
//
//   FULL SCORE  every instrument stacked on one page, aligned bar by bar.
//               What the conductor reads. Can be 20+ staves tall.
//   PARTS       one booklet per player containing only their own line.
//               What each musician on stage reads.
//
// A real orchestra uses both at once. This is why Shepherd's cello PDFs say
// "CELLO" at the top — they are parts extracted from a score he has never seen.
//
// So the data model holds ONE array of parts, and "score" vs "part" is a
// rendering choice, not a different file. That is how real notation software
// works, and it means a kid cannot get the two out of sync.

import type { SongNote } from './sightread';

/* ============================================================
   INSTRUMENTS
   ============================================================ */

export type Family = 'woodwind' | 'brass' | 'percussion' | 'keyboard' | 'string' | 'voice';

export interface Instrument {
  id: string;
  name: string;
  family: Family;
  /** Which staff this instrument normally reads. */
  clef: 'treble' | 'bass' | 'grand';
  /**
   * TRANSPOSING INSTRUMENTS — the most confusing idea in orchestration.
   *
   * A B-flat trumpet playing a written C sounds a B-flat, a whole step LOWER.
   * So the trumpet's part and the conductor's score disagree on paper while
   * agreeing in the air. This number is how many semitones the SOUND sits
   * from the WRITING: -2 for a B-flat instrument, -9 for an E-flat alto sax,
   * 0 for anything in concert pitch (piano, violin, flute).
   *
   * Playback must apply this or a written trumpet part will sound wrong
   * against everything else.
   */
  transpose: number;
  /** Comfortable written range, for warning a kid they have gone too high. */
  low: number;
  high: number;
}

/**
 * Score order is FIXED by convention: woodwinds, brass, percussion, keyboard,
 * strings, top to bottom. Not arbitrary — a conductor's eye needs to know
 * where to look without hunting.
 */
export const FAMILY_ORDER: Family[] = ['woodwind', 'brass', 'percussion', 'keyboard', 'voice', 'string'];

export const INSTRUMENTS: Instrument[] = [
  { id: 'flute',    name: 'Flute',       family: 'woodwind',   clef: 'treble', transpose: 0,  low: 60, high: 96 },
  { id: 'clarinet', name: 'Clarinet (B♭)', family: 'woodwind', clef: 'treble', transpose: -2, low: 50, high: 91 },
  { id: 'sax-alto', name: 'Alto Sax (E♭)', family: 'woodwind', clef: 'treble', transpose: -9, low: 49, high: 81 },
  { id: 'trumpet',  name: 'Trumpet (B♭)', family: 'brass',     clef: 'treble', transpose: -2, low: 54, high: 82 },
  { id: 'horn',     name: 'French Horn (F)', family: 'brass',  clef: 'treble', transpose: -7, low: 41, high: 77 },
  { id: 'trombone', name: 'Trombone',    family: 'brass',      clef: 'bass',   transpose: 0,  low: 40, high: 72 },
  { id: 'timpani',  name: 'Timpani',     family: 'percussion', clef: 'bass',   transpose: 0,  low: 40, high: 60 },
  { id: 'piano',    name: 'Piano',       family: 'keyboard',   clef: 'grand',  transpose: 0,  low: 21, high: 108 },
  { id: 'voice',    name: 'Voice',       family: 'voice',      clef: 'treble', transpose: 0,  low: 48, high: 81 },
  { id: 'violin',   name: 'Violin',      family: 'string',     clef: 'treble', transpose: 0,  low: 55, high: 96 },
  { id: 'viola',    name: 'Viola',       family: 'string',     clef: 'bass',   transpose: 0,  low: 48, high: 84 },
  { id: 'cello',    name: 'Cello',       family: 'string',     clef: 'bass',   transpose: 0,  low: 36, high: 76 },
  { id: 'bass',     name: 'Double Bass', family: 'string',     clef: 'bass',   transpose: -12, low: 28, high: 67 },
];

export function instrumentById(id: string): Instrument {
  return INSTRUMENTS.find(i => i.id === id) ?? INSTRUMENTS[0]!;
}

/* ============================================================
   PARTS AND SCORES
   ============================================================ */

export interface Part {
  id: string;
  /** What the player sees at the top of their booklet, e.g. "Cello". */
  name: string;
  instrumentId: string;
  notes: SongNote[];
}

export interface MultiScore {
  id: string;
  title: string;
  bpm: number;
  beatsPerBar: number;
  parts: Part[];
}

/** Sort parts into conductor's score order. Stable within a family. */
export function scoreOrder(parts: Part[]): Part[] {
  return parts
    .map((p, i) => ({ p, i, f: FAMILY_ORDER.indexOf(instrumentById(p.instrumentId).family) }))
    .sort((a, b) => (a.f - b.f) || (a.i - b.i))
    .map(x => x.p);
}

/**
 * Written pitch -> sounding pitch. Apply before playback, never before display.
 *
 * Getting this backwards is the classic beginner error: it makes a written
 * trumpet line sound a whole step off against the strings, which reads as
 * "the app is out of tune" rather than "the transposition is inverted".
 */
export function soundingMidi(writtenMidi: number, instrumentId: string): number {
  return writtenMidi + instrumentById(instrumentId).transpose;
}

/** Sounding pitch -> what this player must READ to produce it. */
export function writtenMidi(soundingPitch: number, instrumentId: string): number {
  return soundingPitch - instrumentById(instrumentId).transpose;
}

/**
 * Is this note comfortable for the instrument as WRITTEN?
 *
 * A warning, never a block. Ranges are approximate, players differ, and a kid
 * writing an ambitious horn line should be told, not stopped.
 */
export function outOfRange(note: SongNote, instrumentId: string): boolean {
  if (note.rest) return false;
  const inst = instrumentById(instrumentId);
  return note.midi < inst.low || note.midi > inst.high;
}

/** Total beats in a part. Parts of different lengths do not line up. */
export function partBeats(part: Part): number {
  return part.notes.reduce((a, n) => a + n.beats, 0);
}

/**
 * Do all the parts finish together?
 *
 * In real ensemble music every part spans the same number of bars — a player
 * who runs out early has lost a rest somewhere. This is the multi-part
 * equivalent of the bar-sum check that caught actual transcription errors,
 * and it is the single most useful thing to show a kid writing for a group.
 */
export function alignmentReport(score: MultiScore): {
  aligned: boolean;
  longest: number;
  short: { partId: string; name: string; beats: number; missing: number }[];
} {
  if (score.parts.length === 0) return { aligned: true, longest: 0, short: [] };

  const lengths = score.parts.map(p => ({ p, beats: partBeats(p) }));
  const longest = Math.max(...lengths.map(l => l.beats));
  const short = lengths
    .filter(l => l.beats < longest)
    .map(l => ({ partId: l.p.id, name: l.p.name, beats: l.beats, missing: longest - l.beats }));

  return { aligned: short.length === 0, longest, short };
}

/**
 * Pad every short part with rests so they all end together.
 *
 * The fix for the report above. Rests are the correct filler: silence in a
 * part is real notation, not a placeholder — a player counts those bars.
 */
export function padToAlign(score: MultiScore): MultiScore {
  const { longest, aligned } = alignmentReport(score);
  if (aligned) return score;

  return {
    ...score,
    parts: score.parts.map(p => {
      const missing = longest - partBeats(p);
      if (missing <= 0) return p;
      return { ...p, notes: [...p.notes, { midi: 60, beats: missing, rest: true }] };
    }),
  };
}

/**
 * What sounds at each beat, across every part, in concert pitch.
 *
 * This is the full score collapsed to a timeline — what playback needs, and
 * what makes a chord across instruments audible. Transposition is applied
 * here, which is why a written trumpet C comes out as a B-flat.
 */
export function soundingTimeline(score: MultiScore): { beat: number; midi: number; beats: number; partId: string }[] {
  const events: { beat: number; midi: number; beats: number; partId: string }[] = [];
  for (const part of score.parts) {
    let at = 0;
    for (const n of part.notes) {
      if (!n.rest) {
        events.push({ beat: at, midi: soundingMidi(n.midi, part.instrumentId), beats: n.beats, partId: part.id });
      }
      at += n.beats;
    }
  }
  return events.sort((a, b) => a.beat - b.beat || a.midi - b.midi);
}

/**
 * Pull one part out of a score as a standalone piece — "extracting a part",
 * exactly what a publisher does to make each player's booklet.
 */
export function extractPart(score: MultiScore, partId: string): {
  id: string; title: string; bpm: number; clef: 'treble' | 'bass' | 'grand'; notes: SongNote[];
} | null {
  const part = score.parts.find(p => p.id === partId);
  if (!part) return null;
  return {
    id: `${score.id}-${part.id}`,
    title: `${score.title} — ${part.name}`,
    bpm: score.bpm,
    clef: instrumentById(part.instrumentId).clef,
    notes: part.notes,
  };
}
