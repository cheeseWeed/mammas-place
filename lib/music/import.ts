// MusicXML + MIDI -> Song importer. PURE logic only.
//
// No React, no browser APIs, no network: text/bytes in, plain data out, so the
// whole thing is unit-testable under vitest (see __tests__/import.test.ts).
// The caller is responsible for reading the file (and for unzipping a .mxl
// container down to its XML text) — we only ever see a string or a byte array.
//
// WHY THIS FILE EXISTS AT ALL: sightread.ts explains that PDFs are transcribed
// BY HAND because optical music recognition guesses, and a guess means a kid who
// played CORRECTLY gets told they were wrong. MusicXML and MIDI are different:
// they are not pixels, they are the notes themselves. There is nothing to guess.
// So the same standard applies here in a different form — where the format is
// genuinely unambiguous we read it exactly; where it is ambiguous (polyphony,
// multi-voice staves, chords) we DROP the ambiguous material and say so in
// `warnings`, rather than picking a plausible-looking note. Silence about a
// dropped note is the failure mode we cannot afford.
//
//   parseMusicXml(xml)   -> ImportResult
//   parseMidi(bytes)     -> ImportResult
//
// Neither function ever throws. Malformed input comes back as { ok: false }.

import type { Song, SongNote } from './sightread';

/**
 * Result of an import. Deliberately a discriminated union rather than
 * throw-on-failure: the caller is a UI showing a child what happened, and an
 * exception crossing a route boundary turns into an opaque 500.
 *
 * `song` omits `id` because the ID is assigned by whatever persists it — the
 * parser has no business inventing one.
 */
export type ImportResult =
  | { ok: true; song: Omit<Song, 'id'>; warnings: string[] }
  | { ok: false; error: string };

/** Lowest / highest note on an 88-key piano. Anything outside is a parse bug. */
const MIN_MIDI = 21;
const MAX_MIDI = 108;

/** Fallbacks when the file does not say. */
const DEFAULT_BPM = 90;
const DEFAULT_TITLE = 'Untitled';
const DEFAULT_CLEF: 'treble' | 'bass' = 'treble';

/* ============================================================
   SHARED — validation + assembly
   ============================================================ */

/**
 * Semitone offset of each pitch letter within an octave. C=0 .. B=11.
 * MIDI = (octave + 1) * 12 + offset + alter, so C4 -> 5*12 + 0 = 60.
 */
const STEP_SEMITONES: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

/** Letters in the order sharps are added by a key signature (F# C# G# D# A# E# B#). */
const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
/** Letters in the order flats are added (Bb Eb Ab Db Gb Cb Fb). */
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

/**
 * Drop anything we cannot honestly hand to the game, and explain each drop.
 *
 * A note out of 21..108 or with beats <= 0 means we misread something upstream;
 * emitting it would put an unplayable note in front of a kid. Dropping it loses
 * a note but never asserts a falsehood, and the warning tells the UI to say so.
 */
function sanitize(raw: SongNote[], warnings: string[]): SongNote[] {
  const out: SongNote[] = [];
  let outOfRange = 0;
  let badLength = 0;
  for (const n of raw) {
    if (!Number.isFinite(n.midi) || n.midi < MIN_MIDI || n.midi > MAX_MIDI) {
      outOfRange++;
      continue;
    }
    if (!Number.isFinite(n.beats) || n.beats <= 0) {
      badLength++;
      continue;
    }
    // Round to 1/1000 of a beat. Divisions arithmetic produces values like
    // 0.33333333333333337; the game compares and displays these, so a tidy
    // number avoids both float noise and a "0.9999 beats" rendering.
    out.push({ midi: Math.round(n.midi), beats: Math.round(n.beats * 1000) / 1000 });
  }
  if (outOfRange > 0) {
    warnings.push(
      `${outOfRange} note${outOfRange === 1 ? '' : 's'} fell outside the piano range (A0–C8) and ${outOfRange === 1 ? 'was' : 'were'} skipped.`,
    );
  }
  if (badLength > 0) {
    warnings.push(
      `${badLength} note${badLength === 1 ? '' : 's'} had no readable length and ${badLength === 1 ? 'was' : 'were'} skipped.`,
    );
  }
  return out;
}

/** Pick a starter/easy/medium level from how much there is to play. */
function levelFor(notes: SongNote[]): Song['level'] {
  if (notes.length <= 16) return 'starter';
  if (notes.length <= 48) return 'easy';
  return 'medium';
}

/** Final assembly + the "did we actually get anything?" gate. */
function finish(
  title: string,
  bpm: number,
  clef: 'treble' | 'bass',
  raw: SongNote[],
  warnings: string[],
  emptyMessage: string,
): ImportResult {
  const notes = sanitize(raw, warnings);
  if (notes.length === 0) return { ok: false, error: emptyMessage };
  return {
    ok: true,
    song: {
      title: title.trim() || DEFAULT_TITLE,
      source: 'transcribed',
      bpm: Math.round(bpm),
      clef,
      level: levelFor(notes),
      notes,
    },
    warnings,
  };
}

/* ============================================================
   MUSICXML — a tolerant tag scanner
   ============================================================ */
//
// WHY NO XML PARSER: there is no XML dependency in this project and adding one
// for a single feature is not worth the supply-chain surface. DOMParser is not
// available in a Node/server context either. MusicXML's element vocabulary is
// small and flat enough (part > measure > note > pitch) that a scanner over the
// text is exact for the subset we need — we only ever look for known tag names,
// never try to build a general tree.

/** One scanned element: its tag, its raw attribute text, and its inner text. */
interface XmlElement {
  tag: string;
  attrs: string;
  inner: string;
  /** True for `<rest/>`-style empty elements — inner is '' and there is no close tag. */
  selfClosing: boolean;
}

/** Strip comments, CDATA, the XML declaration and the DOCTYPE (which can carry
 *  a long internal subset full of angle brackets that would confuse scanning). */
function stripNoise(xml: string): string {
  return xml
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<!DOCTYPE[^[>]*(\[[\s\S]*?\])?[^>]*>/gi, '');
}

/** Decode the five XML entities plus numeric refs. Titles routinely contain &amp;. */
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h: string) => safeFromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d: string) => safeFromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** String.fromCodePoint throws on out-of-range values; bad UTF must not kill the parse. */
function safeFromCodePoint(cp: number): string {
  if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return '';
  try {
    return String.fromCodePoint(cp);
  } catch {
    return '';
  }
}

/**
 * Find every direct-or-nested `<tag>` element in `src`, in document order.
 *
 * Handles `<tag/>`, `<tag attr="x">body</tag>` and correctly skips nested
 * same-name elements when finding the matching close tag. Unclosed tags are
 * simply not returned rather than throwing — truncated files are expected input.
 */
function findElements(src: string, tag: string): XmlElement[] {
  const out: XmlElement[] = [];
  // `[\s/>]` guards against matching <notations> when looking for <note>.
  const open = new RegExp(`<${tag}(?=[\\s/>])([^>]*)>`, 'g');
  let m: RegExpExecArray | null;
  while ((m = open.exec(src)) !== null) {
    const attrs = m[1] ?? '';
    if (attrs.trimEnd().endsWith('/')) {
      out.push({ tag, attrs: attrs.replace(/\/\s*$/, ''), inner: '', selfClosing: true });
      continue;
    }
    const bodyStart = open.lastIndex;
    const end = findCloseIndex(src, tag, bodyStart);
    if (end < 0) continue; // truncated — ignore the fragment rather than guess
    out.push({ tag, attrs, inner: src.slice(bodyStart, end), selfClosing: false });
    // Continue scanning AFTER this element so nested same-name elements are not
    // reported twice (they belong to the parent's inner text).
    open.lastIndex = end;
  }
  return out;
}

/** Index of the `</tag>` that closes an element opened just before `from`. */
function findCloseIndex(src: string, tag: string, from: number): number {
  const scan = new RegExp(`<(/?)${tag}(?=[\\s/>])([^>]*)>`, 'g');
  scan.lastIndex = from;
  let depth = 0;
  let m: RegExpExecArray | null;
  while ((m = scan.exec(src)) !== null) {
    const closing = m[1] === '/';
    if (closing) {
      if (depth === 0) return m.index;
      depth--;
    } else if (!(m[2] ?? '').trimEnd().endsWith('/')) {
      depth++;
    }
  }
  return -1;
}

/** First `<tag>` in `src`, or null. */
function firstElement(src: string, tag: string): XmlElement | null {
  return findElements(src, tag)[0] ?? null;
}

/** Decoded text content of the first `<tag>`, or null when absent/empty. */
function textOf(src: string, tag: string): string | null {
  const el = firstElement(src, tag);
  if (!el) return null;
  // Nested markup inside a text element is not something we consume; strip it.
  const t = decodeEntities(el.inner.replace(/<[^>]*>/g, '')).trim();
  return t.length > 0 ? t : null;
}

/** Numeric text content of the first `<tag>`, or null when absent/unparseable. */
function numberOf(src: string, tag: string): number | null {
  const t = textOf(src, tag);
  if (t == null) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Value of an attribute in a raw attribute string. */
function attr(attrs: string, name: string): string | null {
  const m = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"|\\b${name}\\s*=\\s*'([^']*)'`).exec(attrs);
  if (!m) return null;
  return decodeEntities(m[1] ?? m[2] ?? '');
}

/** Does this element contain a `<tag>` (including the self-closing form)? */
function hasTag(src: string, tag: string): boolean {
  return new RegExp(`<${tag}(?=[\\s/>])`).test(src);
}

/* ---- key signatures ---- */

/**
 * Semitone alteration each pitch LETTER carries under a key signature.
 *
 * THIS IS THE SINGLE BIGGEST SOURCE OF WRONG NOTES. A MusicXML `<note>` in G
 * major writes plain `<step>F</step>` with no `<alter>` — the sharp lives in
 * `<key><fifths>1</fifths></key>` at the top of the measure and applies to every
 * F in every octave for the rest of the piece. A parser that only reads
 * `<alter>` silently plays F natural, and the kid who correctly played F# is
 * told they were wrong. Hence: fifths -> per-letter map, applied to every note
 * that does not carry its own accidental.
 */
function keyAlterMap(fifths: number): Record<string, number> {
  const map: Record<string, number> = {};
  const n = Math.max(-7, Math.min(7, Math.trunc(fifths)));
  if (n > 0) for (let i = 0; i < n; i++) map[SHARP_ORDER[i]!] = 1;
  if (n < 0) for (let i = 0; i < -n; i++) map[FLAT_ORDER[i]!] = -1;
  return map;
}

/** In-progress note being built up across tied elements. */
interface PendingTie {
  note: SongNote;
}

/**
 * Parse MusicXML text into a Song.
 *
 * Reads the FIRST melodic part only (the game listens for one pitch at a time),
 * with per-measure `<divisions>`, key-signature and in-measure accidental state
 * tracked exactly as a human reader would.
 */
export function parseMusicXml(xml: string): ImportResult {
  try {
    if (typeof xml !== 'string' || xml.trim().length === 0) {
      return { ok: false, error: 'That file looks empty — there was no music inside it.' };
    }

    const src = stripNoise(xml);

    if (!/<score-partwise|<score-timewise|<part\b/i.test(src)) {
      return {
        ok: false,
        error: "That doesn't look like a MusicXML file. Try exporting again as MusicXML (.musicxml or .mxl).",
      };
    }
    if (/<score-timewise/i.test(src) && !/<score-partwise/i.test(src)) {
      // Timewise files interleave every part measure-by-measure; extracting one
      // melodic line from them is a different algorithm and rare enough in the
      // wild that guessing would be worse than saying so.
      return {
        ok: false,
        error: 'This is a timewise MusicXML file, which this importer cannot read. Re-export it as partwise MusicXML.',
      };
    }

    const warnings: string[] = [];

    /* ---- title ---- */
    const workTitle = textOf(src, 'work-title');
    const movementTitle = textOf(src, 'movement-title');
    const title = workTitle ?? movementTitle ?? DEFAULT_TITLE;

    /* ---- pick the part ---- */
    // "First melodic part" = the first <part> that actually contains pitched
    // notes. Scores often lead with a percussion or chord-symbol part whose
    // notes are all <unpitched> or <rest>, and taking it blindly yields nothing.
    const parts = findElements(src, 'part').filter(p => !p.selfClosing);
    if (parts.length === 0) {
      return { ok: false, error: 'No instrument parts were found in that file.' };
    }
    let part = parts.find(p => hasTag(p.inner, 'pitch'));
    if (!part) part = parts[0]!;
    if (parts.length > 1) {
      warnings.push(
        `This score has ${parts.length} instrument parts. Only the first one with notes was imported — the game plays one line at a time.`,
      );
    }

    /* ---- walk the measures ---- */
    const measures = findElements(part.inner, 'measure').filter(m => !m.selfClosing);
    // A part with no <measure> wrapper is not legal MusicXML but is easy to be
    // tolerant about: treat the whole part as one measure.
    const blocks = measures.length > 0 ? measures.map(m => m.inner) : [part.inner];

    const notes: SongNote[] = [];
    let divisions = 1; // ticks per quarter note; persists until re-stated
    let keyAlter: Record<string, number> = {};
    let clef: 'treble' | 'bass' | null = null;
    let bpm: number | null = null;
    let chordDropped = 0;
    let backupSeen = false;
    let unpitchedDropped = 0;
    let pending: PendingTie | null = null; // note waiting for its tie to close

    for (const block of blocks) {
      // Accidentals apply from where they appear to the END OF THE MEASURE, for
      // that letter in that octave only, then the barline wipes them. Resetting
      // here is what makes "F# in bar 1, plain F in bar 2" read as F natural.
      const measureAlter = new Map<string, number>();

      // <attributes> can appear mid-measure (a mid-bar key or clef change), and
      // there can be several. Applying them all before the notes is a small
      // simplification; mid-measure changes are vanishingly rare in the beginner
      // material this app imports, and getting the START-of-measure key right
      // matters far more than honouring a mid-bar change.
      for (const a of findElements(block, 'attributes')) {
        const d = numberOf(a.inner, 'divisions');
        if (d != null && d > 0) divisions = d;

        const keyEl = firstElement(a.inner, 'key');
        if (keyEl) {
          const fifths = numberOf(keyEl.inner, 'fifths');
          if (fifths != null) keyAlter = keyAlterMap(fifths);
        }

        if (clef == null) {
          const clefEl = firstElement(a.inner, 'clef');
          const sign = clefEl ? textOf(clefEl.inner, 'sign') : null;
          if (sign) {
            const s = sign.toUpperCase();
            if (s === 'F') clef = 'bass';
            else if (s === 'G') clef = 'treble';
            // C clefs (viola/alto) and percussion clefs fall through to the
            // treble default rather than being mapped to something wrong.
          }
        }
      }

      // Tempo: <sound tempo="..."> anywhere, or a metronome's <per-minute>.
      if (bpm == null) {
        for (const s of findElements(block, 'sound')) {
          const t = attr(s.attrs, 'tempo');
          const n = t == null ? NaN : Number(t);
          if (Number.isFinite(n) && n > 0) { bpm = n; break; }
        }
      }
      if (bpm == null) {
        const pm = numberOf(block, 'per-minute');
        if (pm != null && pm > 0) bpm = pm;
      }

      if (hasTag(block, 'backup')) backupSeen = true;

      for (const noteEl of findElements(block, 'note')) {
        const body = noteEl.inner;

        // <rest/>: no sound. The game has no rests, so it is skipped — but its
        // duration is still consumed here (we do not carry a running clock, so
        // "consuming" it just means NOT attaching it to the previous note). A
        // rest also BREAKS a tie chain: nothing can be tied across silence.
        if (hasTag(body, 'rest')) {
          pending = null;
          continue;
        }

        // <chord/> means "sounds together with the previous note". The game is
        // monophonic, so only the chord's first note (the one WITHOUT the chord
        // tag) is kept. Guessing which chord tone is the melody would be exactly
        // the kind of plausible-but-wrong call this app cannot make.
        if (hasTag(body, 'chord')) {
          chordDropped++;
          continue;
        }

        const pitchEl = firstElement(body, 'pitch');
        if (!pitchEl) {
          // <unpitched> percussion, or a malformed note. Either way there is no
          // pitch to play.
          unpitchedDropped++;
          pending = null;
          continue;
        }

        const step = (textOf(pitchEl.inner, 'step') ?? '').toUpperCase();
        const octave = numberOf(pitchEl.inner, 'octave');
        const base = STEP_SEMITONES[step];
        if (base == null || octave == null || !Number.isFinite(octave)) {
          unpitchedDropped++;
          pending = null;
          continue;
        }

        // Accidental resolution, in strict priority order:
        //   1. an explicit <alter> on THIS note        (wins outright, and is
        //      remembered for the rest of the measure)
        //   2. an accidental already seen this measure for this letter+octave
        //   3. the key signature for this letter, any octave
        const key = `${step}${octave}`;
        const explicit = numberOf(pitchEl.inner, 'alter');
        let alter: number;
        if (explicit != null) {
          alter = explicit;
          measureAlter.set(key, explicit);
        } else if (measureAlter.has(key)) {
          alter = measureAlter.get(key)!;
        } else {
          alter = keyAlter[step] ?? 0;
        }

        const midi = (octave + 1) * 12 + base + alter;

        const durTicks = numberOf(body, 'duration');
        const beats = durTicks != null && divisions > 0 ? durTicks / divisions : 0;

        // Ties. `<tie type="start">` (the sounding tie) and `<tied>` (the
        // notation) both appear; either can carry start/stop. A tied group is
        // ONE sound, so its beats are summed into the head note. We check for a
        // stop before a start so a middle-of-chain note (stop AND start) both
        // closes the previous span and keeps the chain open.
        const tieTypes = tieTypesOf(body);
        const stops = tieTypes.has('stop');
        const starts = tieTypes.has('start');

        if (stops && pending && pending.note.midi === midi) {
          pending.note.beats += beats;
          if (!starts) pending = null;
          continue;
        }

        const note: SongNote = { midi, beats };
        notes.push(note);
        pending = starts ? { note } : null;
      }
    }

    if (chordDropped > 0) {
      warnings.push(
        `${chordDropped} chord note${chordDropped === 1 ? '' : 's'} ${chordDropped === 1 ? 'was' : 'were'} dropped — the game listens for one note at a time, so only the top line of each chord was kept.`,
      );
    }
    if (backupSeen) {
      warnings.push(
        'This part has more than one voice written on the same staff. Only the main voice was imported.',
      );
    }
    if (unpitchedDropped > 0) {
      warnings.push(
        `${unpitchedDropped} note${unpitchedDropped === 1 ? '' : 's'} had no readable pitch and ${unpitchedDropped === 1 ? 'was' : 'were'} skipped.`,
      );
    }

    return finish(
      title,
      bpm ?? DEFAULT_BPM,
      clef ?? DEFAULT_CLEF,
      notes,
      warnings,
      'No playable notes were found in that file — it may only contain rests, or the notes may be in a part this importer skipped.',
    );
  } catch {
    // Belt and braces. Nothing above should throw, but a parser that crashes on
    // one weird export takes a page down with it; an honest error message does not.
    return { ok: false, error: "That file couldn't be read as MusicXML. Try exporting it again." };
  }
}

/** Collect every tie/tied `type` on a note. Both spellings, all occurrences. */
function tieTypesOf(body: string): Set<string> {
  const out = new Set<string>();
  for (const m of body.matchAll(/<tie(?:d)?(?=[\s/>])([^>]*)>/g)) {
    const t = attr(m[1] ?? '', 'type');
    if (t) out.add(t.toLowerCase());
  }
  return out;
}

/* ============================================================
   MIDI — standard MIDI file (SMF) reader
   ============================================================ */

/** A note extracted from a MIDI track, in ticks. */
interface MidiNote {
  midi: number;
  startTick: number;
  endTick: number;
}

/** Cursor over the byte array. Every read is bounds-checked; overrun -> null. */
class ByteReader {
  private pos = 0;
  constructor(private readonly b: Uint8Array) {}

  get offset(): number { return this.pos; }
  get remaining(): number { return this.b.length - this.pos; }

  seek(p: number): void { this.pos = p; }

  u8(): number | null {
    if (this.pos >= this.b.length) return null;
    return this.b[this.pos++]!;
  }

  u16(): number | null {
    if (this.pos + 2 > this.b.length) return null;
    const v = (this.b[this.pos]! << 8) | this.b[this.pos + 1]!;
    this.pos += 2;
    return v;
  }

  u32(): number | null {
    if (this.pos + 4 > this.b.length) return null;
    const v =
      (this.b[this.pos]! * 0x1000000) +
      ((this.b[this.pos + 1]! << 16) | (this.b[this.pos + 2]! << 8) | this.b[this.pos + 3]!);
    this.pos += 4;
    return v;
  }

  /** ASCII chunk id ('MThd' / 'MTrk'). */
  ascii(n: number): string | null {
    if (this.pos + n > this.b.length) return null;
    let s = '';
    for (let i = 0; i < n; i++) s += String.fromCharCode(this.b[this.pos + i]!);
    this.pos += n;
    return s;
  }

  skip(n: number): boolean {
    if (n < 0 || this.pos + n > this.b.length) return false;
    this.pos += n;
    return true;
  }

  /**
   * Variable-length quantity: 7 bits per byte, high bit = "more follows".
   * Capped at 4 bytes, which is the spec limit — an uncapped loop on corrupt
   * data reads to the end of the file and produces a nonsense delta.
   */
  vlq(): number | null {
    let v = 0;
    for (let i = 0; i < 4; i++) {
      const b = this.u8();
      if (b == null) return null;
      v = (v << 7) | (b & 0x7f);
      if ((b & 0x80) === 0) return v >>> 0;
    }
    return null;
  }
}

/**
 * Parse a standard MIDI file into a Song.
 *
 * Takes the track with the most notes (in a typical export that is the melody;
 * accompaniment tracks are either sparser or are chords we would drop anyway),
 * pairs note-on/note-off, and reduces any remaining overlap to the highest
 * sounding pitch — the melody convention, and the note a singer or a beginner
 * on a monophonic instrument would actually play.
 */
export function parseMidi(bytes: Uint8Array): ImportResult {
  try {
    if (!bytes || typeof bytes.length !== 'number' || bytes.length < 14) {
      return { ok: false, error: 'That file is too small to be a MIDI file.' };
    }

    const r = new ByteReader(bytes);
    if (r.ascii(4) !== 'MThd') {
      return { ok: false, error: "That doesn't look like a MIDI file — it has no MIDI header." };
    }
    const headerLen = r.u32();
    if (headerLen == null || headerLen < 6) {
      return { ok: false, error: 'This MIDI file has a damaged header.' };
    }
    const format = r.u16();
    const ntrks = r.u16();
    const division = r.u16();
    if (format == null || ntrks == null || division == null) {
      return { ok: false, error: 'This MIDI file has a damaged header.' };
    }
    // Header can legally be longer than 6 bytes; skip whatever is left of it.
    if (!r.skip(headerLen - 6)) {
      return { ok: false, error: 'This MIDI file is truncated.' };
    }

    const warnings: string[] = [];

    // Bit 15 set = SMPTE timecode (frames/second), not ticks-per-quarter. That
    // encoding has no musical beat to convert to, so rather than pretending, we
    // fall back to a plausible resolution and say what happened.
    let ticksPerQuarter: number;
    if ((division & 0x8000) !== 0) {
      ticksPerQuarter = 480;
      warnings.push('This MIDI file uses timecode instead of musical beats, so note lengths are approximate.');
    } else if (division > 0) {
      ticksPerQuarter = division;
    } else {
      ticksPerQuarter = 480;
      warnings.push('This MIDI file did not say how long a beat is, so note lengths are approximate.');
    }

    /* ---- read the tracks ---- */
    const tracks: MidiNote[][] = [];
    let microsPerQuarter: number | null = null;
    let truncated = false;

    while (r.remaining >= 8) {
      const id = r.ascii(4);
      const len = r.u32();
      if (id == null || len == null) { truncated = true; break; }
      const bodyStart = r.offset;
      // A length running past the buffer means the file was cut short; read what
      // is there rather than discarding the whole import.
      const bodyEnd = Math.min(bodyStart + len, bytes.length);
      if (bodyStart + len > bytes.length) truncated = true;

      if (id === 'MTrk') {
        const parsed = readTrack(bytes, bodyStart, bodyEnd);
        tracks.push(parsed.notes);
        if (microsPerQuarter == null && parsed.microsPerQuarter != null) {
          microsPerQuarter = parsed.microsPerQuarter;
        }
        if (parsed.truncated) truncated = true;
      }
      // Unknown chunk types are legal and must be skipped, not treated as errors.
      r.seek(bodyEnd);
      if (bodyEnd <= bodyStart && len === 0 && r.remaining < 8) break;
    }

    if (tracks.length === 0) {
      return { ok: false, error: 'This MIDI file has no music tracks in it.' };
    }
    if (truncated) {
      warnings.push('This MIDI file looks cut short — only the part that could be read was imported.');
    }

    // Most notes wins. Ties go to the earlier track (`>` not `>=`), which in a
    // format-1 file is the one nearer the top of the score — conventionally the
    // melody.
    let best = tracks[0]!;
    let bestCount = best.length;
    for (const t of tracks) {
      if (t.length > bestCount) { best = t; bestCount = t.length; }
    }
    if (tracks.filter(t => t.length > 0).length > 1) {
      warnings.push('This MIDI file has several instrument tracks. The one with the most notes was imported.');
    }

    if (best.length === 0) {
      return { ok: false, error: 'No playable notes were found in that MIDI file.' };
    }

    const { notes: mono, overlaps } = monophonize(best);
    if (overlaps > 0) {
      warnings.push(
        `${overlaps} note${overlaps === 1 ? '' : 's'} ${overlaps === 1 ? 'was' : 'were'} played at the same time as another. The game plays one note at a time, so the highest note was kept.`,
      );
    }

    // Tempo. 0xFF 0x51 gives microseconds per quarter note; BPM is the inverse.
    const bpm = microsPerQuarter != null && microsPerQuarter > 0
      ? 60_000_000 / microsPerQuarter
      : DEFAULT_BPM;

    // Clef from the median pitch. Median, not mean: one stray low note (a pedal
    // tone, a wrong-octave artefact) should not flip the whole staff.
    const sorted = mono.map(n => n.midi).sort((a, b) => a - b);
    const median = sorted.length === 0
      ? 60
      : sorted.length % 2 === 1
        ? sorted[(sorted.length - 1) / 2]!
        : (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2;
    const clef: 'treble' | 'bass' = median < 60 ? 'bass' : 'treble';

    const songNotes: SongNote[] = mono.map(n => ({
      midi: n.midi,
      beats: (n.endTick - n.startTick) / ticksPerQuarter,
    }));

    return finish(
      DEFAULT_TITLE,
      bpm,
      clef,
      songNotes,
      warnings,
      'No playable notes were found in that MIDI file.',
    );
  } catch {
    return { ok: false, error: "That file couldn't be read as a MIDI file. Try exporting it again." };
  }
}

/** What one MTrk chunk yielded. */
interface TrackResult {
  notes: MidiNote[];
  microsPerQuarter: number | null;
  truncated: boolean;
}

/**
 * Read one MTrk chunk into note events.
 *
 * Handles running status (a data byte where a status byte is expected reuses the
 * previous status), all channel-voice message sizes, meta events and sysex.
 * Getting the message SIZES right matters more than it looks: mis-sizing one
 * event desynchronises the byte stream and every note after it is garbage.
 */
function readTrack(bytes: Uint8Array, start: number, end: number): TrackResult {
  const r = new ByteReader(bytes.subarray(start, end));
  const notes: MidiNote[] = [];
  // Sounding notes keyed by channel+pitch. An array per key because a well-formed
  // file can retrigger the same pitch on the same channel before the first ends.
  const open = new Map<number, number[]>();
  let microsPerQuarter: number | null = null;
  let tick = 0;
  let running: number | null = null;
  let truncated = false;

  const closeNote = (channel: number, pitch: number, at: number): void => {
    const k = channel * 128 + pitch;
    const stack = open.get(k);
    if (!stack || stack.length === 0) return;
    const startTick = stack.shift()!;
    notes.push({ midi: pitch, startTick, endTick: at });
  };

  for (;;) {
    if (r.remaining <= 0) break;

    const delta = r.vlq();
    if (delta == null) { truncated = true; break; }
    tick += delta;

    let status = r.u8();
    if (status == null) { truncated = true; break; }

    if (status < 0x80) {
      // Running status: this byte is actually the first data byte.
      if (running == null) { truncated = true; break; }
      r.seek(r.offset - 1);
      status = running;
    } else if (status < 0xf0) {
      running = status;
    } else {
      // System messages cancel running status.
      running = null;
    }

    if (status === 0xff) {
      const type = r.u8();
      const len = r.vlq();
      if (type == null || len == null) { truncated = true; break; }
      if (type === 0x51 && len === 3) {
        const a = r.u8(), b = r.u8(), c = r.u8();
        if (a == null || b == null || c == null) { truncated = true; break; }
        if (microsPerQuarter == null) microsPerQuarter = (a << 16) | (b << 8) | c;
      } else {
        if (!r.skip(len)) { truncated = true; break; }
      }
      if (type === 0x2f) break; // end of track
      continue;
    }

    if (status === 0xf0 || status === 0xf7) {
      const len = r.vlq();
      if (len == null || !r.skip(len)) { truncated = true; break; }
      continue;
    }

    const kind = status & 0xf0;
    const channel = status & 0x0f;

    if (kind === 0x90 || kind === 0x80) {
      const pitch = r.u8();
      const vel = r.u8();
      if (pitch == null || vel == null) { truncated = true; break; }
      // note-on with velocity 0 is the idiomatic note-off — many exporters
      // never emit 0x80 at all.
      if (kind === 0x90 && vel > 0) {
        const k = channel * 128 + pitch;
        const stack = open.get(k) ?? [];
        stack.push(tick);
        open.set(k, stack);
      } else {
        closeNote(channel, pitch, tick);
      }
      continue;
    }

    // Remaining channel-voice messages: 2 data bytes except program-change (0xC0)
    // and channel-pressure (0xD0), which take 1.
    const dataBytes = kind === 0xc0 || kind === 0xd0 ? 1 : 2;
    if (!r.skip(dataBytes)) { truncated = true; break; }
  }

  // Any note still sounding at the end of the track never got its note-off.
  // Give it a quarter-note rather than dropping it — a missing note-off is a
  // sloppy export, not a reason to lose the last note of the piece.
  for (const [k, stack] of open) {
    const pitch = k % 128;
    for (const s of stack) notes.push({ midi: pitch, startTick: s, endTick: s + 1 });
  }

  notes.sort((a, b) => a.startTick - b.startTick || b.midi - a.midi);
  return { notes, microsPerQuarter, truncated };
}

/**
 * Reduce overlapping notes to a single line, keeping the HIGHEST pitch.
 *
 * The rule is deliberately simple and stated out loud in a warning, because any
 * cleverer heuristic (voice-leading, "the loudest", "the longest") would be a
 * guess about which line is the melody — and a guess is what puts a wrong note
 * in front of a kid. Highest-wins is the standard melody convention and it is
 * predictable, which matters more than being occasionally smarter.
 */
function monophonize(input: MidiNote[]): { notes: MidiNote[]; overlaps: number } {
  const sorted = [...input].sort((a, b) => a.startTick - b.startTick || b.midi - a.midi);
  const out: MidiNote[] = [];
  let overlaps = 0;

  for (const n of sorted) {
    const prev = out[out.length - 1];
    if (!prev) { out.push({ ...n }); continue; }

    if (n.startTick < prev.endTick) {
      overlaps++;
      if (n.midi <= prev.midi) {
        // Lower voice under a sounding higher note: drop it entirely.
        continue;
      }
      // Higher note wins from the moment it starts; truncate the one below it.
      prev.endTick = n.startTick;
      if (prev.endTick <= prev.startTick) out.pop(); // it was fully covered
      out.push({ ...n });
      continue;
    }
    out.push({ ...n });
  }

  return { notes: out, overlaps };
}
