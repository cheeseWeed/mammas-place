import { describe, it, expect } from 'vitest';
import { parseMusicXml } from '../import';

// Realistic MusicXML as MuseScore actually exports it — full header, DOCTYPE,
// part-list, attributes, the works. The agent's own tests used minimal
// snippets; this checks the parser survives the real thing.
const MUSESCORE_STYLE = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work><work-title>Dragon Dances</work-title></work>
  <identification>
    <creator type="composer">Soon Hee Newbold</creator>
    <encoding><software>MuseScore 4.1</software></encoding>
  </identification>
  <part-list>
    <score-part id="P1"><part-name>Violoncello</part-name>
      <score-instrument id="P1-I1"><instrument-name>Cello</instrument-name></score-instrument>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>480</divisions>
        <key><fifths>1</fifths><mode>major</mode></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>F</sign><line>4</line></clef>
      </attributes>
      <direction placement="above"><sound tempo="100"/></direction>
      <note><pitch><step>D</step><octave>3</octave></pitch><duration>960</duration><voice>1</voice><type>half</type></note>
      <note><pitch><step>B</step><octave>2</octave></pitch><duration>960</duration><voice>1</voice><type>half</type></note>
    </measure>
    <measure number="2">
      <note><pitch><step>G</step><octave>2</octave></pitch><duration>1440</duration><type>half</type><dot/></note>
      <note><pitch><step>F</step><octave>3</octave></pitch><duration>480</duration><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>`;

describe('ADVERSARIAL: real-world MusicXML the agent never saw', () => {
  it('parses a MuseScore-style export with full header and DOCTYPE', () => {
    const r = parseMusicXml(MUSESCORE_STYLE);
    expect(r.ok, r.ok ? '' : r.error).toBe(true);
    if (!r.ok) return;
    expect(r.song.title).toBe('Dragon Dances');
    expect(r.song.clef).toBe('bass');
    expect(r.song.bpm).toBe(100);
  });

  it('applies the 1-sharp key so the written F becomes F# — the load-bearing case', () => {
    const r = parseMusicXml(MUSESCORE_STYLE);
    if (!r.ok) throw new Error(r.error);
    const midis = r.song.notes.map(n => n.midi);
    // D3=50 B2=47 G2=43 F#3=54  (F natural would be 53 — that is the bug we are hunting)
    expect(midis).toEqual([50, 47, 43, 54]);
  });

  it('converts divisions=480 and a DOTTED half correctly', () => {
    const r = parseMusicXml(MUSESCORE_STYLE);
    if (!r.ok) throw new Error(r.error);
    expect(r.song.notes.map(n => n.beats)).toEqual([2, 2, 3, 1]);
  });

  it('never throws on hostile input', () => {
    const nasties = [
      '', '<', '<score-partwise>', '</part>', '\u0000\u0001',
      '<score-partwise><part><measure><note><pitch><step>H</step><octave>99</octave></pitch><duration>-5</duration></note></measure></part></score-partwise>',
      '<score-partwise><part><measure>' + '<note/>'.repeat(5000) + '</measure></part></score-partwise>',
    ];
    for (const n of nasties) {
      expect(() => parseMusicXml(n), `input ${JSON.stringify(n.slice(0,30))}`).not.toThrow();
    }
  });

  it('rejects rather than inventing notes when there is no music', () => {
    const r = parseMusicXml('<score-partwise><part id="P1"><measure number="1"></measure></part></score-partwise>');
    expect(r.ok).toBe(false);
  });
});
