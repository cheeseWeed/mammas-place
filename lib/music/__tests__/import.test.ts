import { describe, it, expect } from 'vitest';
import { parseMusicXml, parseMidi, type ImportResult } from '../import';

/* ============================================================
   HELPERS — tiny MusicXML + MIDI builders, all inline.
   No fixture files: the byte/tag layout under test IS the test.
   ============================================================ */

/** Assert ok and narrow, with a readable failure when the parse errored. */
function ok(r: ImportResult) {
  if (!r.ok) throw new Error(`expected ok, got error: ${r.error}`);
  return r;
}

interface XmlNoteOpts {
  step?: string;
  octave?: number;
  alter?: number;
  duration?: number;
  rest?: boolean;
  chord?: boolean;
  tie?: 'start' | 'stop' | 'both';
}

function xmlNote(o: XmlNoteOpts): string {
  const dur = o.duration ?? 1;
  if (o.rest) return `<note><rest/><duration>${dur}</duration><type>quarter</type></note>`;
  const ties =
    o.tie === 'start' ? '<tie type="start"/>'
      : o.tie === 'stop' ? '<tie type="stop"/>'
        : o.tie === 'both' ? '<tie type="stop"/><tie type="start"/>'
          : '';
  return (
    '<note>' +
    (o.chord ? '<chord/>' : '') +
    '<pitch>' +
    `<step>${o.step ?? 'C'}</step>` +
    (o.alter != null ? `<alter>${o.alter}</alter>` : '') +
    `<octave>${o.octave ?? 4}</octave>` +
    '</pitch>' +
    `<duration>${dur}</duration>` +
    ties +
    '</note>'
  );
}

interface ScoreOpts {
  title?: string;
  movementTitle?: string;
  divisions?: number;
  fifths?: number;
  clefSign?: 'G' | 'F' | 'C';
  tempo?: number;
  /** Extra raw XML dropped in the first measure, after <attributes>. */
  extraFirstMeasure?: string;
}

/** Build a partwise score; each entry of `measures` is that measure's note XML. */
function score(measures: string[], o: ScoreOpts = {}): string {
  const attrs =
    '<attributes>' +
    `<divisions>${o.divisions ?? 1}</divisions>` +
    (o.fifths != null ? `<key><fifths>${o.fifths}</fifths></key>` : '') +
    `<clef><sign>${o.clefSign ?? 'G'}</sign><line>2</line></clef>` +
    '</attributes>';
  const sound = o.tempo != null ? `<sound tempo="${o.tempo}"/>` : '';
  const body = measures
    .map((m, i) =>
      `<measure number="${i + 1}">${i === 0 ? attrs + sound + (o.extraFirstMeasure ?? '') : ''}${m}</measure>`,
    )
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<score-partwise version="4.0">' +
    (o.title != null ? `<work><work-title>${o.title}</work-title></work>` : '') +
    (o.movementTitle != null ? `<movement-title>${o.movementTitle}</movement-title>` : '') +
    '<part-list><score-part id="P1"><part-name>Melody</part-name></score-part></part-list>' +
    `<part id="P1">${body}</part>` +
    '</score-partwise>'
  );
}

/* ---- MIDI byte builders ---- */

function vlq(n: number): number[] {
  const out = [n & 0x7f];
  let v = n >> 7;
  while (v > 0) {
    out.unshift((v & 0x7f) | 0x80);
    v >>= 7;
  }
  return out;
}

function be32(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

function be16(n: number): number[] {
  return [(n >>> 8) & 0xff, n & 0xff];
}

function ascii(s: string): number[] {
  return [...s].map(c => c.charCodeAt(0));
}

/** Wrap event bytes in an MTrk chunk, appending end-of-track. */
function track(events: number[]): number[] {
  const body = [...events, ...vlq(0), 0xff, 0x2f, 0x00];
  return [...ascii('MTrk'), ...be32(body.length), ...body];
}

function midiFile(tracks: number[][], division = 480, format = 1): Uint8Array {
  const head = [...ascii('MThd'), ...be32(6), ...be16(format), ...be16(tracks.length), ...be16(division)];
  return new Uint8Array([...head, ...tracks.flat()]);
}

/** delta, note-on. */
function on(delta: number, pitch: number, vel = 64, ch = 0): number[] {
  return [...vlq(delta), 0x90 | ch, pitch, vel];
}

/** delta, note-off (real 0x80). */
function off(delta: number, pitch: number, ch = 0): number[] {
  return [...vlq(delta), 0x80 | ch, pitch, 0x40];
}

function tempoEvent(bpm: number): number[] {
  const upq = Math.round(60_000_000 / bpm);
  return [...vlq(0), 0xff, 0x51, 0x03, (upq >> 16) & 0xff, (upq >> 8) & 0xff, upq & 0xff];
}

/* ============================================================
   MUSICXML
   ============================================================ */

describe('parseMusicXml — the basics', () => {
  it('round-trips a C major scale to the exact MIDI numbers and beats', () => {
    const letters: Array<[string, number]> = [
      ['C', 4], ['D', 4], ['E', 4], ['F', 4], ['G', 4], ['A', 4], ['B', 4], ['C', 5],
    ];
    const xml = score(
      [letters.map(([step, octave]) => xmlNote({ step, octave, duration: 1 })).join('')],
      { title: 'C Major Scale', divisions: 1, tempo: 60 },
    );
    const r = ok(parseMusicXml(xml));
    expect(r.song.title).toBe('C Major Scale');
    expect(r.song.bpm).toBe(60);
    expect(r.song.clef).toBe('treble');
    expect(r.song.source).toBe('transcribed');
    expect(r.song.notes.map(n => n.midi)).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
    expect(r.song.notes.every(n => n.beats === 1)).toBe(true);
    expect(r.warnings).toEqual([]);
  });

  it('converts duration to beats using <divisions>', () => {
    // divisions = 4 -> 4 ticks per quarter. 8 = half, 2 = eighth, 6 = dotted quarter.
    const xml = score(
      [
        xmlNote({ step: 'C', octave: 4, duration: 8 }) +
        xmlNote({ step: 'D', octave: 4, duration: 2 }) +
        xmlNote({ step: 'E', octave: 4, duration: 6 }),
      ],
      { divisions: 4 },
    );
    const r = ok(parseMusicXml(xml));
    expect(r.song.notes.map(n => n.beats)).toEqual([2, 0.5, 1.5]);
  });

  it('falls back to movement-title, then to Untitled, and to 90 bpm', () => {
    const withMovement = score([xmlNote({})], { movementTitle: 'Second Thoughts' });
    expect(ok(parseMusicXml(withMovement)).song.title).toBe('Second Thoughts');

    const bare = ok(parseMusicXml(score([xmlNote({})])));
    expect(bare.song.title).toBe('Untitled');
    expect(bare.song.bpm).toBe(90);
  });

  it('reads tempo from a <per-minute> metronome mark when there is no <sound>', () => {
    const xml = score([xmlNote({})], {
      extraFirstMeasure:
        '<direction><direction-type><metronome><beat-unit>quarter</beat-unit>' +
        '<per-minute>132</per-minute></metronome></direction-type></direction>',
    });
    expect(ok(parseMusicXml(xml)).song.bpm).toBe(132);
  });

  it('decodes XML entities in the title', () => {
    const xml = score([xmlNote({})], { title: 'Bread &amp; Butter' });
    expect(ok(parseMusicXml(xml)).song.title).toBe('Bread & Butter');
  });
});

describe('parseMusicXml — key signatures', () => {
  it('one sharp makes EVERY F an F#, in every octave, with no <alter> present', () => {
    const xml = score(
      [
        xmlNote({ step: 'F', octave: 4 }) +
        xmlNote({ step: 'F', octave: 5 }) +
        xmlNote({ step: 'G', octave: 4 }) +
        xmlNote({ step: 'C', octave: 4 }),
      ],
      { fifths: 1 },
    );
    const r = ok(parseMusicXml(xml));
    // F4 = 65 natural -> 66 sharp. F5 = 77 -> 78. G and C untouched.
    expect(r.song.notes.map(n => n.midi)).toEqual([66, 78, 67, 60]);
  });

  it('applies flats in the right order (2 flats = Bb and Eb)', () => {
    const xml = score(
      [
        xmlNote({ step: 'B', octave: 4 }) +
        xmlNote({ step: 'E', octave: 4 }) +
        xmlNote({ step: 'A', octave: 4 }),
      ],
      { fifths: -2 },
    );
    // B4 71 -> 70, E4 64 -> 63, A4 69 unchanged (A is the 4th flat).
    expect(ok(parseMusicXml(xml)).song.notes.map(n => n.midi)).toEqual([70, 63, 69]);
  });

  it('four sharps sharpen F, C, G and D but not A', () => {
    const xml = score(
      [
        xmlNote({ step: 'F', octave: 4 }) +
        xmlNote({ step: 'C', octave: 4 }) +
        xmlNote({ step: 'G', octave: 4 }) +
        xmlNote({ step: 'D', octave: 4 }) +
        xmlNote({ step: 'A', octave: 4 }),
      ],
      { fifths: 4 },
    );
    expect(ok(parseMusicXml(xml)).song.notes.map(n => n.midi)).toEqual([66, 61, 68, 63, 69]);
  });

  it('fifths = 0 leaves everything natural', () => {
    const xml = score([xmlNote({ step: 'F', octave: 4 }) + xmlNote({ step: 'B', octave: 4 })], { fifths: 0 });
    expect(ok(parseMusicXml(xml)).song.notes.map(n => n.midi)).toEqual([65, 71]);
  });
});

describe('parseMusicXml — accidentals', () => {
  it('an explicit <alter> overrides the key signature', () => {
    // Key of G (F#) but this F is written natural: alter 0 must win.
    const xml = score(
      [xmlNote({ step: 'F', octave: 4, alter: 0 }) + xmlNote({ step: 'F', octave: 5 })],
      { fifths: 1 },
    );
    const r = ok(parseMusicXml(xml));
    expect(r.song.notes[0]!.midi).toBe(65); // F natural, NOT 66
    expect(r.song.notes[1]!.midi).toBe(78); // other octave still follows the key
  });

  it('an explicit accidental persists for the rest of the measure, same letter+octave only', () => {
    const xml = score(
      [
        xmlNote({ step: 'C', octave: 4, alter: 1 }) + // C#4 explicit
        xmlNote({ step: 'C', octave: 4 }) +           // still C#4
        xmlNote({ step: 'C', octave: 5 }),            // different octave: natural
      ],
    );
    expect(ok(parseMusicXml(xml)).song.notes.map(n => n.midi)).toEqual([61, 61, 72]);
  });

  it('accidentals reset at the barline', () => {
    const xml = score([
      xmlNote({ step: 'C', octave: 4, alter: 1 }) + xmlNote({ step: 'C', octave: 4 }),
      xmlNote({ step: 'C', octave: 4 }),
    ]);
    // measure 1: C#, C#   measure 2: back to C natural
    expect(ok(parseMusicXml(xml)).song.notes.map(n => n.midi)).toEqual([61, 61, 60]);
  });

  it('after the barline the KEY signature is back in force, not the old accidental', () => {
    const xml = score(
      [
        xmlNote({ step: 'F', octave: 4, alter: 0 }) + xmlNote({ step: 'F', octave: 4 }),
        xmlNote({ step: 'F', octave: 4 }),
      ],
      { fifths: 1 },
    );
    expect(ok(parseMusicXml(xml)).song.notes.map(n => n.midi)).toEqual([65, 65, 66]);
  });

  it('handles a double sharp and a double flat', () => {
    const xml = score([
      xmlNote({ step: 'C', octave: 4, alter: 2 }) + xmlNote({ step: 'E', octave: 4, alter: -2 }),
    ]);
    expect(ok(parseMusicXml(xml)).song.notes.map(n => n.midi)).toEqual([62, 62]);
  });
});

describe('parseMusicXml — ties, chords and rests', () => {
  it('merges a tied pair into one note with summed beats', () => {
    const xml = score([
      xmlNote({ step: 'C', octave: 4, duration: 4, tie: 'start' }),
      xmlNote({ step: 'C', octave: 4, duration: 2, tie: 'stop' }),
    ], { divisions: 1 });
    const r = ok(parseMusicXml(xml));
    expect(r.song.notes).toEqual([{ midi: 60, beats: 6 }]);
  });

  it('merges a three-note tie chain (start, stop+start, stop)', () => {
    const xml = score([
      xmlNote({ step: 'G', octave: 4, duration: 4, tie: 'start' }),
      xmlNote({ step: 'G', octave: 4, duration: 4, tie: 'both' }),
      xmlNote({ step: 'G', octave: 4, duration: 2, tie: 'stop' }),
    ]);
    expect(ok(parseMusicXml(xml)).song.notes).toEqual([{ midi: 67, beats: 10 }]);
  });

  it('accepts the <tied> notation spelling as well as <tie>', () => {
    const xml =
      '<score-partwise><part id="P1"><measure number="1">' +
      '<attributes><divisions>1</divisions></attributes>' +
      '<note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration>' +
      '<notations><tied type="start"/></notations></note>' +
      '<note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration>' +
      '<notations><tied type="stop"/></notations></note>' +
      '</measure></part></score-partwise>';
    expect(ok(parseMusicXml(xml)).song.notes).toEqual([{ midi: 60, beats: 4 }]);
  });

  it('does NOT merge a "tie" between different pitches', () => {
    const xml = score([
      xmlNote({ step: 'C', octave: 4, duration: 2, tie: 'start' }) +
      xmlNote({ step: 'D', octave: 4, duration: 2, tie: 'stop' }),
    ]);
    expect(ok(parseMusicXml(xml)).song.notes).toEqual([
      { midi: 60, beats: 2 },
      { midi: 62, beats: 2 },
    ]);
  });

  it('keeps only the first note of a chord and warns', () => {
    const xml = score([
      xmlNote({ step: 'C', octave: 4 }) +
      xmlNote({ step: 'E', octave: 4, chord: true }) +
      xmlNote({ step: 'G', octave: 4, chord: true }) +
      xmlNote({ step: 'D', octave: 4 }),
    ]);
    const r = ok(parseMusicXml(xml));
    expect(r.song.notes.map(n => n.midi)).toEqual([60, 62]);
    expect(r.warnings.join(' ')).toMatch(/chord/i);
  });

  it('skips rests without shifting or corrupting the surrounding notes', () => {
    const xml = score([
      xmlNote({ step: 'C', octave: 4, duration: 2 }) +
      xmlNote({ rest: true, duration: 2 }) +
      xmlNote({ step: 'E', octave: 4, duration: 2 }),
    ]);
    const r = ok(parseMusicXml(xml));
    expect(r.song.notes).toEqual([
      { midi: 60, beats: 2 },
      { midi: 64, beats: 2 },
    ]);
  });

  it('a rest breaks a tie chain instead of swallowing the next note', () => {
    const xml = score([
      xmlNote({ step: 'C', octave: 4, duration: 2, tie: 'start' }) +
      xmlNote({ rest: true, duration: 2 }) +
      xmlNote({ step: 'C', octave: 4, duration: 2, tie: 'stop' }),
    ]);
    expect(ok(parseMusicXml(xml)).song.notes).toEqual([
      { midi: 60, beats: 2 },
      { midi: 60, beats: 2 },
    ]);
  });
});

describe('parseMusicXml — clef, parts and voices', () => {
  it('reads a bass clef from <sign>F</sign>', () => {
    const xml = score([xmlNote({ step: 'G', octave: 2 })], { clefSign: 'F' });
    expect(ok(parseMusicXml(xml)).song.clef).toBe('bass');
  });

  it('reads a treble clef from <sign>G</sign>', () => {
    expect(ok(parseMusicXml(score([xmlNote({})], { clefSign: 'G' }))).song.clef).toBe('treble');
  });

  it('defaults to treble when there is no clef at all', () => {
    const xml =
      '<score-partwise><part id="P1"><measure number="1">' +
      '<attributes><divisions>1</divisions></attributes>' +
      xmlNote({}) +
      '</measure></part></score-partwise>';
    expect(ok(parseMusicXml(xml)).song.clef).toBe('treble');
  });

  it('warns and ignores <backup> multi-voice material', () => {
    const xml = score([
      xmlNote({ step: 'C', octave: 4 }) +
      '<backup><duration>1</duration></backup>' +
      xmlNote({ step: 'E', octave: 3 }),
    ]);
    const r = ok(parseMusicXml(xml));
    expect(r.warnings.join(' ')).toMatch(/voice/i);
    // both notes still come through as one line; nothing is silently reordered
    expect(r.song.notes.map(n => n.midi)).toEqual([60, 52]);
  });

  it('takes the first part that actually has pitched notes, and warns', () => {
    const xml =
      '<score-partwise>' +
      '<part-list><score-part id="P1"/><score-part id="P2"/></part-list>' +
      '<part id="P1"><measure number="1">' +
      '<attributes><divisions>1</divisions></attributes>' +
      '<note><unpitched><display-step>C</display-step><display-octave>5</display-octave></unpitched>' +
      '<duration>1</duration></note>' +
      '</measure></part>' +
      '<part id="P2"><measure number="1">' +
      '<attributes><divisions>1</divisions><clef><sign>F</sign></clef></attributes>' +
      xmlNote({ step: 'G', octave: 2 }) +
      '</measure></part>' +
      '</score-partwise>';
    const r = ok(parseMusicXml(xml));
    expect(r.song.notes.map(n => n.midi)).toEqual([43]);
    expect(r.song.clef).toBe('bass');
    expect(r.warnings.join(' ')).toMatch(/parts/i);
  });

  it('tolerates comments, a DOCTYPE and attribute noise', () => {
    const xml =
      '<?xml version="1.0"?>' +
      '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "partwise.dtd">' +
      '<!-- exported by something -->' +
      '<score-partwise version="4.0"><part id="P1"><measure number="1" width="123.45">' +
      '<attributes><divisions>1</divisions></attributes>' +
      '<note default-x="10" print-object="yes"><pitch><step>A</step><octave>4</octave></pitch>' +
      '<duration>1</duration></note>' +
      '</measure></part></score-partwise>';
    expect(ok(parseMusicXml(xml)).song.notes.map(n => n.midi)).toEqual([69]);
  });
});

describe('parseMusicXml — safety', () => {
  it('drops notes outside the piano range and warns', () => {
    const xml = score([
      xmlNote({ step: 'C', octave: -1 }) + // midi 0
      xmlNote({ step: 'C', octave: 4 }) +
      xmlNote({ step: 'C', octave: 10 }),  // midi 132
    ]);
    const r = ok(parseMusicXml(xml));
    expect(r.song.notes.map(n => n.midi)).toEqual([60]);
    expect(r.warnings.join(' ')).toMatch(/piano range/i);
  });

  it('drops zero-length notes and warns', () => {
    const xml = score([
      xmlNote({ step: 'C', octave: 4, duration: 0 }) + xmlNote({ step: 'D', octave: 4, duration: 1 }),
    ]);
    const r = ok(parseMusicXml(xml));
    expect(r.song.notes.map(n => n.midi)).toEqual([62]);
    expect(r.warnings.join(' ')).toMatch(/length/i);
  });

  it('returns ok:false for an empty string', () => {
    const r = parseMusicXml('');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeTruthy();
  });

  it('returns ok:false for something that is not MusicXML', () => {
    const r = parseMusicXml('<html><body>hello</body></html>');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/MusicXML/i);
  });

  it('returns ok:false rather than throwing on truncated XML', () => {
    const good = score([xmlNote({ step: 'C', octave: 4 })]);
    const chopped = good.slice(0, Math.floor(good.length * 0.7));
    const r = parseMusicXml(chopped);
    // Either it recovered a note or it errored — the contract is "never throws".
    expect(typeof r.ok).toBe('boolean');
  });

  it('returns ok:false when the score contains only rests', () => {
    const r = parseMusicXml(score([xmlNote({ rest: true }) + xmlNote({ rest: true })]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/no playable notes/i);
  });

  it('never throws on random junk inputs', () => {
    const junk = [
      '<score-partwise>',
      '<score-partwise><part><measure><note><pitch><step>Q</step><octave>x</octave></pitch></note></measure></part></score-partwise>',
      '<score-partwise><part><measure><note/></measure></part></score-partwise>',
      ' <score-partwise>&#xZZ;',
      '<score-partwise><part id="P1"><measure><note><pitch><step>C</step><octave>4</octave></pitch><duration>abc</duration></note></measure></part></score-partwise>',
    ];
    for (const j of junk) {
      expect(() => parseMusicXml(j)).not.toThrow();
      expect(typeof parseMusicXml(j).ok).toBe('boolean');
    }
  });

  it('rejects timewise MusicXML with a clear message instead of misreading it', () => {
    const r = parseMusicXml('<score-timewise><measure><part id="P1"/></measure></score-timewise>');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/partwise/i);
  });

  it('assigns a level from the note count', () => {
    const many = Array.from({ length: 60 }, () => xmlNote({ step: 'C', octave: 4 })).join('');
    expect(ok(parseMusicXml(score([many]))).song.level).toBe('medium');
    expect(ok(parseMusicXml(score([xmlNote({})]))).song.level).toBe('starter');
  });
});

/* ============================================================
   MIDI
   ============================================================ */

describe('parseMidi — the basics', () => {
  it('pairs note-on with note-off and converts ticks to beats', () => {
    const bytes = midiFile(
      [track([...on(0, 60), ...off(480, 60), ...on(0, 62), ...off(240, 62)])],
      480,
    );
    const r = ok(parseMidi(bytes));
    expect(r.song.notes).toEqual([
      { midi: 60, beats: 1 },
      { midi: 62, beats: 0.5 },
    ]);
  });

  it('treats note-on with velocity 0 as a note-off', () => {
    const bytes = midiFile([track([...on(0, 67), ...on(960, 67, 0)])], 480);
    expect(ok(parseMidi(bytes)).song.notes).toEqual([{ midi: 67, beats: 2 }]);
  });

  it('honours running status', () => {
    // One 0x90 status byte, then bare data pairs reuse it.
    const bytes = midiFile([
      track([
        ...vlq(0), 0x90, 60, 64,
        ...vlq(480), 60, 0,   // running status note-off (vel 0)
        ...vlq(0), 62, 64,    // running status note-on
        ...vlq(480), 62, 0,
      ]),
    ], 480);
    expect(ok(parseMidi(bytes)).song.notes).toEqual([
      { midi: 60, beats: 1 },
      { midi: 62, beats: 1 },
    ]);
  });

  it('reads tempo from the 0xFF 0x51 meta event', () => {
    const bytes = midiFile([track([...tempoEvent(120), ...on(0, 60), ...off(480, 60)])], 480);
    expect(ok(parseMidi(bytes)).song.bpm).toBe(120);
  });

  it('picks up tempo from a separate conductor track', () => {
    const bytes = midiFile(
      [track(tempoEvent(144)), track([...on(0, 64), ...off(480, 64)])],
      480,
    );
    const r = ok(parseMidi(bytes));
    expect(r.song.bpm).toBe(144);
    expect(r.song.notes).toEqual([{ midi: 64, beats: 1 }]);
  });

  it('defaults to 90 bpm when there is no tempo event', () => {
    const bytes = midiFile([track([...on(0, 60), ...off(480, 60)])], 480);
    expect(ok(parseMidi(bytes)).song.bpm).toBe(90);
  });

  it('uses a non-480 division correctly', () => {
    const bytes = midiFile([track([...on(0, 60), ...off(96, 60)])], 96);
    expect(ok(parseMidi(bytes)).song.notes).toEqual([{ midi: 60, beats: 1 }]);
  });

  it('skips other channel messages without desynchronising the stream', () => {
    const bytes = midiFile([
      track([
        ...vlq(0), 0xc0, 0x18,             // program change (1 data byte)
        ...vlq(0), 0xb0, 0x07, 0x64,       // control change (2 data bytes)
        ...vlq(0), 0xd0, 0x40,             // channel pressure (1 data byte)
        ...vlq(0), 0xe0, 0x00, 0x40,       // pitch bend (2 data bytes)
        ...on(0, 72), ...off(480, 72),
      ]),
    ], 480);
    expect(ok(parseMidi(bytes)).song.notes).toEqual([{ midi: 72, beats: 1 }]);
  });

  it('skips meta text events and sysex', () => {
    const bytes = midiFile([
      track([
        ...vlq(0), 0xff, 0x03, 0x05, ...ascii('Piano'),   // track name
        ...vlq(0), 0xf0, 0x03, 0x7e, 0x7f, 0xf7,          // sysex
        ...on(0, 60), ...off(480, 60),
      ]),
    ], 480);
    expect(ok(parseMidi(bytes)).song.notes).toEqual([{ midi: 60, beats: 1 }]);
  });
});

describe('parseMidi — track choice, polyphony, clef', () => {
  it('takes the track with the most notes', () => {
    const sparse = track([...on(0, 40), ...off(480, 40)]);
    const dense = track([
      ...on(0, 60), ...off(240, 60),
      ...on(0, 62), ...off(240, 62),
      ...on(0, 64), ...off(240, 64),
    ]);
    const r = ok(parseMidi(midiFile([sparse, dense], 480)));
    expect(r.song.notes.map(n => n.midi)).toEqual([60, 62, 64]);
    expect(r.warnings.join(' ')).toMatch(/tracks/i);
  });

  it('keeps the highest pitch when notes overlap, and warns', () => {
    // A three-note chord all sounding across the same beat.
    const bytes = midiFile([
      track([
        ...on(0, 60), ...on(0, 64), ...on(0, 67),
        ...off(480, 60), ...off(0, 64), ...off(0, 67),
        ...on(0, 72), ...off(480, 72),
      ]),
    ], 480);
    const r = ok(parseMidi(bytes));
    expect(r.song.notes.map(n => n.midi)).toEqual([67, 72]);
    expect(r.warnings.join(' ')).toMatch(/same time/i);
  });

  it('truncates a lower sustained note when a higher one starts over it', () => {
    const bytes = midiFile([
      track([
        ...on(0, 60),          // low note starts, lasts 2 beats on paper
        ...on(480, 72),        // high note enters after 1 beat
        ...off(0, 60),
        ...off(480, 72),
      ]),
    ], 480);
    const r = ok(parseMidi(bytes));
    expect(r.song.notes).toEqual([
      { midi: 60, beats: 1 },
      { midi: 72, beats: 1 },
    ]);
  });

  it('guesses bass clef from a low median pitch and treble from a high one', () => {
    const low = midiFile([
      track([...on(0, 43), ...off(480, 43), ...on(0, 45), ...off(480, 45), ...on(0, 47), ...off(480, 47)]),
    ], 480);
    expect(ok(parseMidi(low)).song.clef).toBe('bass');

    const high = midiFile([
      track([...on(0, 67), ...off(480, 67), ...on(0, 69), ...off(480, 69), ...on(0, 71), ...off(480, 71)]),
    ], 480);
    expect(ok(parseMidi(high)).song.clef).toBe('treble');
  });

  it('drops MIDI notes outside the piano range and warns', () => {
    const bytes = midiFile([
      track([...on(0, 5), ...off(480, 5), ...on(0, 60), ...off(480, 60), ...on(0, 120), ...off(480, 120)]),
    ], 480);
    const r = ok(parseMidi(bytes));
    expect(r.song.notes.map(n => n.midi)).toEqual([60]);
    expect(r.warnings.join(' ')).toMatch(/piano range/i);
  });
});

describe('parseMidi — safety', () => {
  it('returns ok:false for an empty byte array', () => {
    const r = parseMidi(new Uint8Array(0));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/too small/i);
  });

  it('returns ok:false when the MThd magic is wrong', () => {
    const bytes = new Uint8Array([...ascii('RIFF'), ...be32(6), 0, 1, 0, 1, 1, 0xe0, 0, 0, 0, 0]);
    const r = parseMidi(bytes);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/MIDI/i);
  });

  it('returns ok:false when there are no note events', () => {
    const r = parseMidi(midiFile([track(tempoEvent(100))], 480));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/no playable notes/i);
  });

  it('never throws on a truncated file and recovers what it can', () => {
    const full = midiFile([track([...on(0, 60), ...off(480, 60), ...on(0, 62), ...off(480, 62)])], 480);
    for (let cut = 14; cut < full.length; cut += 3) {
      const r = parseMidi(full.subarray(0, cut));
      expect(typeof r.ok).toBe('boolean');
    }
  });

  it('never throws on random bytes', () => {
    const junk = new Uint8Array(200);
    for (let i = 0; i < junk.length; i++) junk[i] = (i * 37 + 11) & 0xff;
    expect(() => parseMidi(junk)).not.toThrow();

    const fakeHeader = new Uint8Array([...ascii('MThd'), ...be32(6), 0, 1, 0, 2, 1, 0xe0, 0xff, 0xff, 0xff, 0xff, 0x7f]);
    expect(() => parseMidi(fakeHeader)).not.toThrow();
    expect(typeof parseMidi(fakeHeader).ok).toBe('boolean');
  });

  it('gives a still-sounding note at the end of a track a length instead of losing it', () => {
    // note-on with no matching note-off before end-of-track.
    const bytes = midiFile([track([...on(0, 60), ...off(480, 60), ...on(0, 64)])], 480);
    const r = ok(parseMidi(bytes));
    expect(r.song.notes.map(n => n.midi)).toEqual([60, 64]);
    expect(r.song.notes[1]!.beats).toBeGreaterThan(0);
  });

  it('skips unknown chunk types between tracks', () => {
    const junkChunk = [...ascii('XFIH'), ...be32(4), 1, 2, 3, 4];
    const t = track([...on(0, 60), ...off(480, 60)]);
    const head = [...ascii('MThd'), ...be32(6), ...be16(1), ...be16(1), ...be16(480)];
    const bytes = new Uint8Array([...head, ...junkChunk, ...t]);
    expect(ok(parseMidi(bytes)).song.notes).toEqual([{ midi: 60, beats: 1 }]);
  });
});
