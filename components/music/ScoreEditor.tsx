'use client';

// Write your own music.
//
// Click an empty spot to add a note, click a note to change or delete it, drag
// it up and down to move it by ear or by eye. Type "A#4 whole" if that is
// faster than clicking.
//
// WHY THIS EXISTS: transcription has been the weak link. The same Bach minuet
// was read wrong twice off a phone photo, and reading notation automatically
// is worse. A kid holding the printed page can enter it correctly in less time
// than anyone can argue about a blurry image — and they know it is right,
// because they put it there.
//
// All the editing rules live in lib/music/editor.ts as pure functions, so they
// are unit-tested away from React. This file is the staff, the pointer
// handling, and the panels.

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  NOTE_VALUES,
  deleteNote,
  insertNote,
  measureLayout,
  moveNote,
  noteName,
  parseNoteName,
  parseSpokenNote,
  setDynamic,
  toggleMark,
  totalBeats,
  transposeNote,
  updateNote,
} from '@/lib/music/editor';
import { staffPosition, staveFor, isSharp, ledgerLines, type Dynamic, type Song, type SongNote } from '@/lib/music/sightread';
import { playNote } from '@/lib/music/tone';

const STEP = 11;            // px between a staff line and the next space
const SPACING = 64;         // px between notes
const LEFT = 60;            // x of the first note
const TOP = 46;             // y of the top staff line
const DYNAMICS: Dynamic[] = ['pp', 'p', 'mp', 'mf', 'f', 'ff'];

export interface ScoreEditorProps {
  initial?: Partial<Song>;
  onSave?: (song: Omit<Song, 'id'>) => void;
  saving?: boolean;
}

export default function ScoreEditor({ initial, onSave, saving }: ScoreEditorProps) {
  const [title, setTitle] = useState(initial?.title ?? 'My song');
  const [clef, setClef] = useState<'treble' | 'bass' | 'grand'>(initial?.clef ?? 'treble');
  const [bpm, setBpm] = useState(initial?.bpm ?? 80);
  const [beatsPerBar, setBeatsPerBar] = useState(4);
  const [notes, setNotes] = useState<SongNote[]>(initial?.notes ?? []);
  const [selected, setSelected] = useState<number | null>(null);
  const [valueId, setValueId] = useState('quarter');
  const [typed, setTyped] = useState('');
  const [drag, setDrag] = useState<{ index: number; y: number; midi: number } | null>(null);

  // Undo: every edit pushes the previous score. Kids experiment, and an editor
  // without undo punishes experimenting.
  const historyRef = useRef<SongNote[][]>([]);
  const commit = useCallback((next: SongNote[]) => {
    historyRef.current.push(notes);
    if (historyRef.current.length > 100) historyRef.current.shift();
    setNotes(next);
  }, [notes]);
  const undo = useCallback(() => {
    const prev = historyRef.current.pop();
    if (prev) { setNotes(prev); setSelected(null); }
  }, []);

  const value = NOTE_VALUES.find(v => v.id === valueId) ?? NOTE_VALUES[4]!;
  const bars = useMemo(() => measureLayout(notes, beatsPerBar), [notes, beatsPerBar]);
  const total = totalBeats(notes);

  const yFor = (pos: number) => TOP + (8 - pos) * STEP;
  // On a grand staff the bass stave is drawn below the treble one.
  const staveOffset = (s: 'treble' | 'bass') => (clef === 'grand' && s === 'bass' ? 9 * STEP + 24 : 0);
  const yOf = (midi: number) => {
    const st = staveFor(midi, clef);
    return yFor(staffPosition(midi, st)) + staveOffset(st);
  };

  /** Turn a y pixel back into the nearest playable pitch. */
  const midiAtY = useCallback((y: number, near: number): number => {
    let best = near, bestDiff = Infinity;
    for (let m = 21; m <= 108; m++) {
      const d = Math.abs(yOf(m) - y);
      if (d < bestDiff) { best = m; bestDiff = d; }
    }
    return best;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clef]);

  const addAt = useCallback((index: number, midi: number) => {
    const next = insertNote(notes, index, { midi, beats: value.beats });
    commit(next);
    setSelected(index);
    playNote(midi, { duration: 0.5 });
  }, [notes, value.beats, commit]);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const pointToSvg = (e: React.PointerEvent | React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    return pt.matrixTransform(ctm.inverse());
  };

  const height = clef === 'grand' ? 9 * STEP + 24 + 9 * STEP + 40 : 9 * STEP + 70;
  const width = Math.max(720, LEFT + (notes.length + 2) * SPACING);

  return (
    <div className="rounded-2xl border-2 border-purple-200 bg-white p-4 sm:p-6">
      <h2 className="text-xl font-bold text-purple-900">Write your own music</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Click a blank spot to add a note. Click a note to change it, or drag it up and down.
      </p>

      {/* ---- piece settings ---- */}
      <div className="mt-4 flex flex-wrap items-end gap-3 text-sm">
        <label>
          <span className="block font-semibold text-purple-900">Title</span>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="mt-1 w-48 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900"
          />
        </label>
        <label>
          <span className="block font-semibold text-purple-900">Staff</span>
          <select
            value={clef}
            onChange={e => setClef(e.target.value as 'treble' | 'bass' | 'grand')}
            className="mt-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900"
          >
            <option value="treble">Treble 𝄞</option>
            <option value="bass">Bass 𝄢</option>
            <option value="grand">Both (piano / harp)</option>
          </select>
        </label>
        <label>
          <span className="block font-semibold text-purple-900">Beats per bar</span>
          <select
            value={beatsPerBar}
            onChange={e => setBeatsPerBar(Number(e.target.value))}
            className="mt-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900"
          >
            <option value={2}>2 (2/4)</option>
            <option value={3}>3 (3/4)</option>
            <option value={4}>4 (4/4)</option>
            <option value={6}>6 (6/8)</option>
          </select>
        </label>
        <label>
          <span className="block font-semibold text-purple-900">Speed</span>
          <input
            type="number" min={30} max={240} value={bpm}
            onChange={e => setBpm(Number(e.target.value))}
            className="mt-1 w-24 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900"
          />
        </label>
      </div>

      {/* ---- which note you are about to add ---- */}
      <div className="mt-3">
        <span className="text-sm font-semibold text-purple-900">Note to add</span>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {NOTE_VALUES.map(v => (
            <button
              key={v.id}
              onClick={() => setValueId(v.id)}
              className={`rounded-lg border-2 px-2.5 py-1.5 text-xs font-semibold ${
                v.id === valueId
                  ? 'border-purple-500 bg-purple-50 text-purple-900'
                  : 'border-zinc-200 text-zinc-600 hover:border-purple-300'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* ---- the staff ---- */}
      <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-[#fbfaff]">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: Math.max(720, width), maxWidth: 'none' }}
          className="block"
          role="img"
          aria-label={`${title} — score editor`}
          onPointerMove={e => {
            if (!drag) return;
            const p = pointToSvg(e);
            if (!p) return;
            setDrag({ ...drag, y: p.y, midi: midiAtY(p.y, drag.midi) });
          }}
          onPointerUp={() => {
            if (drag) {
              commit(updateNote(notes, drag.index, { midi: drag.midi }));
              playNote(drag.midi, { duration: 0.4 });
              setDrag(null);
            }
          }}
          onPointerLeave={() => setDrag(null)}
        >
          {/* click-to-add background */}
          <rect
            x="0" y="0" width={width} height={height} fill="transparent"
            onClick={e => {
              const p = pointToSvg(e);
              if (!p) return;
              const index = Math.max(0, Math.round((p.x - LEFT) / SPACING));
              addAt(Math.min(index, notes.length), midiAtY(p.y, 60));
            }}
          />

          {/* staff lines — one stave, or two for a grand staff */}
          {(clef === 'grand' ? (['treble', 'bass'] as const) : [staveFor(60, clef)]).map(st => (
            <g key={st}>
              {[0, 2, 4, 6, 8].map(pos => (
                <line
                  key={pos}
                  x1="0" y1={yFor(pos) + staveOffset(st)}
                  x2={width} y2={yFor(pos) + staveOffset(st)}
                  stroke="#c9c2d4" strokeWidth="1.5"
                />
              ))}
              <text
                x="12" y={yFor(2) + staveOffset(st) + 10}
                fontSize="46" fill="#581c87" fontFamily="serif"
              >
                {st === 'treble' ? '\u{1D11E}' : '\u{1D122}'}
              </text>
            </g>
          ))}

          {/* bar lines, red when a bar does not add up */}
          {bars.map(b => {
            const last = b.noteIndices[b.noteIndices.length - 1];
            if (last === undefined) return null;
            const x = LEFT + (last + 0.5) * SPACING;
            return (
              <line
                key={`bar${b.index}`}
                x1={x} y1={TOP - 6} x2={x} y2={TOP + 8 * STEP + staveOffset('bass') + 6}
                stroke={b.complete ? '#c9c2d4' : '#dc2626'}
                strokeWidth={b.complete ? 2 : 3}
                strokeDasharray={b.complete ? undefined : '4 3'}
              />
            );
          })}

          {/* the notes */}
          {notes.map((n, i) => {
            const isDragging = drag?.index === i;
            const midi = isDragging ? drag.midi : n.midi;
            const x = LEFT + i * SPACING;
            const y = yOf(midi);
            const st = staveFor(midi, clef);
            const pos = staffPosition(midi, st);
            const sel = selected === i;
            const stemUp = pos < 4;

            return (
              <g key={i}>
                {ledgerLines(pos).map(lp => (
                  <line
                    key={lp} x1={x - 12} y1={yFor(lp) + staveOffset(st)}
                    x2={x + 12} y2={yFor(lp) + staveOffset(st)}
                    stroke="#8f86a0" strokeWidth="1.5"
                  />
                ))}

                {sel && <circle cx={x} cy={y} r="18" fill="#facc15" fillOpacity="0.3" />}

                {n.rest ? (
                  <text x={x - 6} y={yFor(4) + staveOffset(st) + 6} fontSize="26" fill="#581c87">𝄽</text>
                ) : (
                  <>
                    <ellipse
                      cx={x} cy={y} rx="8" ry="6"
                      fill={n.beats >= 2 ? '#fbfaff' : '#1f1235'}
                      stroke="#1f1235" strokeWidth="2"
                      transform={`rotate(-18 ${x} ${y})`}
                      style={{ cursor: 'grab' }}
                      onPointerDown={e => {
                        e.stopPropagation();
                        (e.target as Element).setPointerCapture?.(e.pointerId);
                        setSelected(i);
                        setDrag({ index: i, y, midi: n.midi });
                      }}
                      onClick={e => { e.stopPropagation(); setSelected(i); playNote(n.midi, { duration: 0.5 }); }}
                    />
                    {n.beats < 4 && (
                      <line
                        x1={stemUp ? x + 8 : x - 8} y1={y}
                        x2={stemUp ? x + 8 : x - 8} y2={stemUp ? y - 30 : y + 30}
                        stroke="#1f1235" strokeWidth="2"
                      />
                    )}
                    {isSharp(midi) && <text x={x - 24} y={y + 5} fontSize="16" fill="#1f1235">♯</text>}
                    {n.staccato && <circle cx={x} cy={stemUp ? y + 14 : y - 14} r="2.2" fill="#1f1235" />}
                    {n.accent && (
                      <text x={x - 5} y={stemUp ? y + 22 : y - 18} fontSize="13" fill="#1f1235">&gt;</text>
                    )}
                    {n.dynamic && (
                      <text x={x - 6} y={TOP + 8 * STEP + staveOffset(st) + 22} fontSize="14"
                            fill="#581c87" fontStyle="italic" fontWeight="700">
                        {n.dynamic}
                      </text>
                    )}
                  </>
                )}
              </g>
            );
          })}

          {/* MAGNIFIER — while dragging, show the note big and named, because a
              6px notehead under a fingertip is impossible to place accurately */}
          {drag && (
            <g>
              <rect
                x={LEFT + drag.index * SPACING - 44} y={4}
                width="88" height="38" rx="8"
                fill="#581c87" fillOpacity="0.95"
              />
              <text
                x={LEFT + drag.index * SPACING} y={30}
                fontSize="22" fill="#fff" textAnchor="middle" fontWeight="700"
              >
                {noteName(drag.midi)}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* ---- bar check ---- */}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
        <span className="text-zinc-600">
          {notes.length} note{notes.length === 1 ? '' : 's'} · {total} beat{total === 1 ? '' : 's'}
        </span>
        {bars.some(b => !b.complete) ? (
          <span className="rounded bg-red-50 px-2 py-1 font-semibold text-red-700">
            Some bars don&rsquo;t add up to {beatsPerBar} beats — check the red bar lines
          </span>
        ) : notes.length > 0 ? (
          <span className="rounded bg-green-50 px-2 py-1 font-semibold text-green-800">
            ✓ Every bar adds up
          </span>
        ) : null}
        {historyRef.current.length > 0 && (
          <button onClick={undo} className="rounded border border-zinc-300 px-2 py-1 text-xs font-semibold text-zinc-700">
            ↶ Undo
          </button>
        )}
      </div>

      {/* ---- selected-note panel ---- */}
      {selected !== null && notes[selected] && (
        <div className="mt-3 rounded-xl border-2 border-purple-200 bg-purple-50 p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-lg font-bold text-purple-900">
              {notes[selected]!.rest ? 'Rest' : noteName(notes[selected]!.midi)}
            </span>

            <input
              defaultValue={notes[selected]!.rest ? '' : noteName(notes[selected]!.midi)}
              key={`name-${selected}-${notes[selected]!.midi}`}
              onKeyDown={e => {
                if (e.key !== 'Enter') return;
                const midi = parseNoteName((e.target as HTMLInputElement).value);
                if (midi != null) { commit(updateNote(notes, selected, { midi, rest: false })); playNote(midi); }
              }}
              onBlur={e => {
                const midi = parseNoteName(e.target.value);
                if (midi != null) commit(updateNote(notes, selected, { midi, rest: false }));
              }}
              placeholder="A#4"
              className="w-20 rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-900"
              aria-label="Note name"
            />

            <button onClick={() => commit(transposeNote(notes, selected, 1))}
                    className="rounded border border-zinc-300 bg-white px-2 py-1 font-semibold text-zinc-800">♯ up</button>
            <button onClick={() => commit(transposeNote(notes, selected, -1))}
                    className="rounded border border-zinc-300 bg-white px-2 py-1 font-semibold text-zinc-800">♭ down</button>
            <button onClick={() => commit(transposeNote(notes, selected, 12))}
                    className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-800">8va ↑</button>
            <button onClick={() => commit(transposeNote(notes, selected, -12))}
                    className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-800">8vb ↓</button>

            <span className="mx-1 h-5 w-px bg-purple-200" />

            {NOTE_VALUES.map(v => (
              <button
                key={v.id}
                onClick={() => commit(updateNote(notes, selected, { beats: v.beats }))}
                className={`rounded px-2 py-1 text-xs font-semibold ${
                  notes[selected]!.beats === v.beats
                    ? 'bg-purple-700 text-white' : 'border border-zinc-300 bg-white text-zinc-700'
                }`}
              >
                {v.beats}
              </button>
            ))}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            {(['staccato', 'accent', 'fermata', 'slurToNext', 'rest'] as const).map(mark => (
              <button
                key={mark}
                onClick={() => commit(toggleMark(notes, selected, mark))}
                className={`rounded px-2 py-1 text-xs font-semibold ${
                  notes[selected]![mark]
                    ? 'bg-purple-700 text-white' : 'border border-zinc-300 bg-white text-zinc-700'
                }`}
              >
                {mark === 'slurToNext' ? 'slur' : mark}
              </button>
            ))}

            <span className="mx-1 h-5 w-px bg-purple-200" />
            <span className="text-xs text-zinc-600">loudness:</span>
            {DYNAMICS.map(d => (
              <button
                key={d}
                onClick={() => commit(setDynamic(notes, selected, notes[selected]!.dynamic === d ? undefined : d))}
                className={`rounded px-2 py-1 text-xs font-bold italic ${
                  notes[selected]!.dynamic === d
                    ? 'bg-purple-700 text-white' : 'border border-zinc-300 bg-white text-zinc-700'
                }`}
              >
                {d}
              </button>
            ))}

            <span className="mx-1 h-5 w-px bg-purple-200" />
            <button onClick={() => { commit(moveNote(notes, selected, selected - 1)); setSelected(Math.max(0, selected - 1)); }}
                    className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-800">← earlier</button>
            <button onClick={() => { commit(moveNote(notes, selected, selected + 1)); setSelected(Math.min(notes.length - 1, selected + 1)); }}
                    className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-800">later →</button>
            <button onClick={() => { commit(deleteNote(notes, selected)); setSelected(null); }}
                    className="rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white">delete</button>
          </div>
        </div>
      )}

      {/* ---- typed entry ---- */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <input
          value={typed}
          onChange={e => setTyped(e.target.value)}
          onKeyDown={e => {
            if (e.key !== 'Enter') return;
            const note = parseSpokenNote(typed);
            if (!note) return;
            commit(insertNote(notes, notes.length, note));
            if (!note.rest) playNote(note.midi, { duration: 0.5 });
            setTyped('');
          }}
          placeholder='type a note: "A#4 whole" or "rest half"'
          className="w-72 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900"
          aria-label="Type a note to add"
        />
        <button
          onClick={() => {
            const note = parseSpokenNote(typed);
            if (!note) return;
            commit(insertNote(notes, notes.length, note));
            if (!note.rest) playNote(note.midi, { duration: 0.5 });
            setTyped('');
          }}
          className="rounded-lg bg-purple-800 px-4 py-2 font-semibold text-white"
        >
          Add
        </button>
        {onSave && (
          <button
            onClick={() => onSave({
              title: title.trim() || 'My song',
              source: 'transcribed',
              bpm,
              clef,
              level: notes.length <= 16 ? 'starter' : notes.length <= 48 ? 'easy' : 'medium',
              notes,
            })}
            disabled={notes.length === 0 || saving}
            className="rounded-lg bg-green-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save this song'}
          </button>
        )}
      </div>
    </div>
  );
}
