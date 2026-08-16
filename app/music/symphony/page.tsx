'use client';

// Symphony — writing for more than one instrument.
//
// Teaches the thing the question was really about: is orchestral music on one
// sheet or many? Both, and they are the same music seen two ways. The view
// toggle at the top IS the lesson — flipping it shows a kid that the
// conductor's score and a player's part are one file, not two.

import { useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import LoginGate from '@/components/LoginGate';
import SectionGuard from '@/components/SectionGuard';
import ScoreView, { FamilyLegend } from '@/components/music/ScoreView';
import {
  INSTRUMENTS,
  alignmentReport,
  instrumentById,
  padToAlign,
  scoreOrder,
  soundingTimeline,
  type MultiScore,
} from '@/lib/music/score';
import { parseNoteName, parseSpokenNote } from '@/lib/music/editor';
import { playNote } from '@/lib/music/tone';

const EMPTY: MultiScore = {
  id: 'my-symphony',
  title: 'My Symphony',
  bpm: 84,
  beatsPerBar: 4,
  parts: [],
};

export default function SymphonyPage() {
  const [score, setScore] = useState<MultiScore>(EMPTY);
  const [view, setView] = useState<'score' | string>('score');
  const [adding, setAdding] = useState('violin');
  const [typed, setTyped] = useState('');
  const [activePart, setActivePart] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ partId: string; index: number } | null>(null);
  const [playingBeat, setPlayingBeat] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const stopRef = useRef(false);

  const align = useMemo(() => alignmentReport(score), [score]);
  const ordered = useMemo(() => scoreOrder(score.parts), [score.parts]);
  const current = activePart ?? ordered[0]?.id ?? null;

  const addPart = useCallback(() => {
    const inst = instrumentById(adding);
    setScore(s => {
      const n = s.parts.filter(p => p.instrumentId === adding).length;
      const id = `${adding}-${n + 1}`;
      return {
        ...s,
        parts: [...s.parts, { id, name: n === 0 ? inst.name : `${inst.name} ${n + 1}`, instrumentId: adding, notes: [] }],
      };
    });
    setActivePart(`${adding}-${score.parts.filter(p => p.instrumentId === adding).length + 1}`);
  }, [adding, score.parts]);

  const removePart = useCallback((id: string) => {
    setScore(s => ({ ...s, parts: s.parts.filter(p => p.id !== id) }));
    setSelected(null);
    if (view === id) setView('score');
  }, [view]);

  const addNote = useCallback(() => {
    if (!current) return;
    const note = parseSpokenNote(typed) ?? (parseNoteName(typed) != null ? { midi: parseNoteName(typed)!, beats: 1 } : null);
    if (!note) return;
    setScore(s => ({
      ...s,
      parts: s.parts.map(p => (p.id === current ? { ...p, notes: [...p.notes, note] } : p)),
    }));
    if (!note.rest) playNote(note.midi, { duration: 0.4 });
    setTyped('');
  }, [current, typed]);

  const deleteSelected = useCallback(() => {
    if (!selected) return;
    setScore(s => ({
      ...s,
      parts: s.parts.map(p =>
        p.id === selected.partId ? { ...p, notes: p.notes.filter((_, i) => i !== selected.index) } : p),
    }));
    setSelected(null);
  }, [selected]);

  /** Play the whole score — every part at once, in concert pitch. */
  const play = useCallback(async () => {
    if (playing) { stopRef.current = true; return; }
    const events = soundingTimeline(score);
    if (events.length === 0) return;
    setPlaying(true);
    stopRef.current = false;
    const beatMs = 60000 / score.bpm;
    const start = performance.now();
    const total = Math.max(...events.map(e => e.beat + e.beats));

    let i = 0;
    while (i < events.length && !stopRef.current) {
      const now = (performance.now() - start) / beatMs;
      if (events[i]!.beat <= now) {
        const e = events[i]!;
        playNote(e.midi, { duration: (e.beats * beatMs) / 1000 });
        i++;
      } else {
        setPlayingBeat(now);
        await new Promise(r => setTimeout(r, 25));
      }
    }
    // let the tail ring out
    const tail = total * beatMs - (performance.now() - start);
    if (tail > 0 && !stopRef.current) await new Promise(r => setTimeout(r, Math.min(tail, 4000)));
    setPlaying(false);
    setPlayingBeat(null);
  }, [playing, score]);

  return (
    <SectionGuard sectionKey="music" label="Symphony">
      <LoginGate section="music">
        <main className="mx-auto max-w-5xl px-4 py-6">
          <div className="mb-4 flex flex-wrap gap-4">
            <Link href="/music" className="text-sm font-semibold text-purple-800 hover:underline">
              &larr; Practice Studio
            </Link>
            <Link href="/music/write" className="text-sm font-semibold text-purple-800 hover:underline">
              Music Writer
            </Link>
            <Link href="/music/read" className="text-sm font-semibold text-purple-800 hover:underline">
              Note Reader
            </Link>
          </div>

          <h1 className="text-2xl font-bold text-purple-900">Write for a whole group</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Add instruments, give each one its own line, and hear them play together.
          </p>

          {/* ============ THE LESSON ============ */}
          <section className="mt-5 rounded-2xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white p-4 sm:p-5">
            <h2 className="text-lg font-bold text-purple-900">
              One sheet, or lots of sheets?
            </h2>
            <p className="mt-1 text-sm text-zinc-700">
              <b>Both.</b> They are the same music written out two different ways, for two
              different people — and a real orchestra uses both at the same time.
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-purple-200 bg-white p-3">
                <p className="font-bold text-purple-900">📖 The full score</p>
                <p className="mt-1 text-sm text-zinc-700">
                  Every instrument stacked on one big page, lined up bar by bar. The{' '}
                  <b>conductor</b> reads this so they can see everyone at once. For a big
                  orchestra it can be twenty lines tall.
                </p>
              </div>
              <div className="rounded-xl border border-purple-200 bg-white p-3">
                <p className="font-bold text-purple-900">🎻 The parts</p>
                <p className="mt-1 text-sm text-zinc-700">
                  One small booklet per player, with only their own line in it. Easier to read
                  and easier to turn pages. Your cello music says <b>CELLO</b> at the top
                  because it is a part taken out of a score.
                </p>
              </div>
            </div>

            <p className="mt-3 text-sm text-zinc-700">
              Use the <b>Score / part</b> buttons below to flip between them. It is the same
              song either way — that is the whole idea.
            </p>

            <details className="mt-3 rounded-xl bg-white/70 p-3">
              <summary className="cursor-pointer text-sm font-bold text-purple-900">
                Two things that surprise everybody →
              </summary>
              <div className="mt-2 space-y-3 text-sm text-zinc-700">
                <p>
                  <b>1. The order is always the same.</b> Top to bottom: woodwinds, then brass,
                  then percussion, then keyboards, then singers, then strings. It never changes,
                  so a conductor always knows where to look. Add instruments in any order here
                  and they will sort themselves.
                </p>
                <p>
                  <b>2. Some instruments read a different note than they play.</b> If a trumpet
                  player reads a <b>C</b>, the sound that comes out is a <b>B♭</b> — one step
                  lower. So the trumpet&rsquo;s page and the conductor&rsquo;s page disagree on
                  paper, but agree in the air! Those are called{' '}
                  <b>transposing instruments</b>, and they are marked below. This app does the
                  maths for you when it plays.
                </p>
              </div>
            </details>
          </section>

          {/* ============ INSTRUMENTS ============ */}
          <section className="mt-5 rounded-2xl border-2 border-purple-200 bg-white p-4">
            <h2 className="font-bold text-purple-900">Your instruments</h2>

            <div className="mt-2 flex flex-wrap items-end gap-2">
              <label className="text-sm">
                <span className="block font-semibold text-purple-900">Add an instrument</span>
                <select
                  value={adding}
                  onChange={e => setAdding(e.target.value)}
                  className="mt-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900"
                >
                  {INSTRUMENTS.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.name}{i.transpose !== 0 ? ' — transposing' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <button onClick={addPart} className="rounded-lg bg-purple-800 px-4 py-2 font-semibold text-white">
                ＋ Add
              </button>
            </div>

            {score.parts.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {ordered.map(p => {
                  const inst = instrumentById(p.instrumentId);
                  return (
                    <li
                      key={p.id}
                      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm ${
                        current === p.id ? 'border-purple-500 bg-purple-50' : 'border-zinc-200 bg-white'
                      }`}
                    >
                      <button onClick={() => setActivePart(p.id)} className="font-semibold text-zinc-900">
                        {p.name}
                      </button>
                      <span className="text-xs text-zinc-500">{p.notes.length} notes</span>
                      {inst.transpose !== 0 && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                          transposing
                        </span>
                      )}
                      <button
                        onClick={() => removePart(p.id)}
                        className="text-xs font-bold text-red-600"
                        aria-label={`Remove ${p.name}`}
                      >
                        ✕
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* ============ THE SCORE ============ */}
          {score.parts.length > 0 && (
            <section className="mt-5">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-purple-900">Showing</span>
                <button
                  onClick={() => setView('score')}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                    view === 'score' ? 'bg-purple-800 text-white' : 'border border-purple-300 bg-white text-purple-900'
                  }`}
                >
                  📖 Full score
                </button>
                {ordered.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setView(p.id)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                      view === p.id ? 'bg-purple-800 text-white' : 'border border-purple-300 bg-white text-purple-900'
                    }`}
                  >
                    🎻 {p.name} only
                  </button>
                ))}

                <span className="ml-auto flex gap-2">
                  <button
                    onClick={play}
                    className="rounded-lg bg-green-700 px-4 py-1.5 text-sm font-semibold text-white"
                  >
                    {playing ? '■ Stop' : '▶ Hear it all together'}
                  </button>
                </span>
              </div>

              <ScoreView
                score={score}
                focusPartId={view === 'score' ? null : view}
                playingBeat={playingBeat}
                selected={selected}
                onPickNote={(partId, index) => {
                  setSelected({ partId, index });
                  setActivePart(partId);
                  const p = score.parts.find(x => x.id === partId);
                  const nt = p?.notes[index];
                  if (nt && !nt.rest) playNote(nt.midi, { duration: 0.4 });
                }}
              />
              <FamilyLegend />

              {/* everyone must finish together */}
              {!align.aligned && (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <span>
                    <b>Not everyone finishes together.</b>{' '}
                    {align.short.map(s => `${s.name} is ${s.missing} beat${s.missing === 1 ? '' : 's'} short`).join(', ')}.
                    In real music every part covers the same bars — the quiet players are
                    counting rests.
                  </span>
                  <button
                    onClick={() => setScore(padToAlign)}
                    className="rounded bg-amber-700 px-2.5 py-1 text-xs font-semibold text-white"
                  >
                    Fill with rests
                  </button>
                </div>
              )}
              {align.aligned && score.parts.some(p => p.notes.length > 0) && (
                <p className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">
                  ✓ Every part finishes together
                </p>
              )}
            </section>
          )}

          {/* ============ ADD NOTES ============ */}
          {current && (
            <section className="mt-4 rounded-2xl border-2 border-purple-200 bg-white p-4">
              <h2 className="font-bold text-purple-900">
                Add notes to {score.parts.find(p => p.id === current)?.name}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <input
                  value={typed}
                  onChange={e => setTyped(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addNote(); }}
                  placeholder='e.g. "G4 half" or "rest whole"'
                  className="w-64 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900"
                  aria-label="Type a note to add"
                />
                <button onClick={addNote} className="rounded-lg bg-purple-800 px-4 py-2 font-semibold text-white">
                  Add note
                </button>
                {selected && (
                  <button onClick={deleteSelected} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white">
                    Delete the selected note
                  </button>
                )}
                <span className="text-xs text-zinc-500">
                  Click any note on the score to hear it and select it.
                </span>
              </div>
            </section>
          )}

          <p className="mt-5 text-xs text-zinc-500">
            Red notes are outside what that instrument can comfortably play — a warning, not a
            rule. Write the music you want and let the player tell you.
          </p>
        </main>
      </LoginGate>
    </SectionGuard>
  );
}
