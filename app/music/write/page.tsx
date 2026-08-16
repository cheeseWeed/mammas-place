'use client';

// Music Writer — build a song by hand.
//
// Start from a blank page, or open one of the songs already in the app and
// change it. Saved songs go straight into the Note Reader picker.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoginGate from '@/components/LoginGate';
import SectionGuard from '@/components/SectionGuard';
import ScoreEditor from '@/components/music/ScoreEditor';
import { SONGS, type Song } from '@/lib/music/sightread';

export default function MusicWriterPage() {
  const [starting, setStarting] = useState<Partial<Song> | null>(null);
  const [uploaded, setUploaded] = useState<Song[]>([]);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Songs a kid already uploaded are editable too — that is the fix path when
  // an imported MIDI comes in with a few notes wrong.
  useEffect(() => {
    fetch('/api/music/uploads')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.songs) setUploaded(d.songs as Song[]); })
      .catch(() => {});
  }, []);

  async function save(song: Omit<Song, 'id'>) {
    setSaving(true);
    setSaved(null);
    try {
      const res = await fetch('/api/music/songs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(song),
      });
      setSaved(res.ok ? `Saved “${song.title}” — it is in the Note Reader list now.` : 'Could not save that song.');
    } catch {
      setSaved('Could not save that song.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionGuard sectionKey="music" label="Music Writer">
      <LoginGate section="music">
        <main className="mx-auto max-w-5xl px-4 py-6">
          <div className="mb-4 flex flex-wrap gap-4">
            <Link href="/music" className="text-sm font-semibold text-purple-800 hover:underline">
              &larr; Practice Studio
            </Link>
            <Link href="/music/read" className="text-sm font-semibold text-purple-800 hover:underline">
              Note Reader
            </Link>
          </div>

          <h1 className="text-2xl font-bold text-purple-900">Music Writer</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Write your own music. Click the staff to add notes, drag them to move them, and save it
            when you like it.
          </p>

          {!starting ? (
            <div className="mt-5 space-y-5">
              {/* ---- START A NEW SONG ---- */}
              <button
                onClick={() => setStarting({ title: 'My song', clef: 'treble', bpm: 80, notes: [] })}
                className="w-full rounded-2xl border-2 border-dashed border-purple-400 bg-purple-50 p-6 text-left transition hover:border-purple-600 hover:bg-purple-100"
              >
                <span className="text-lg font-bold text-purple-900">＋ Start a new song</span>
                <span className="mt-1 block text-sm text-purple-800">
                  A blank page. Pick your staff and time signature, then add notes.
                </span>
              </button>

              {/* ---- OR EDIT ONE THAT EXISTS ---- */}
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500">
                  Or start from a song that already exists
                </h2>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {[...uploaded, ...SONGS].map(s => (
                    <button
                      key={s.id}
                      onClick={() => setStarting(s)}
                      className="rounded-xl border border-zinc-300 bg-white p-3 text-left hover:border-purple-400"
                    >
                      <span className="block font-semibold text-zinc-900">{s.title}</span>
                      <span className="block text-xs text-zinc-600">
                        {s.notes.length} notes · {s.clef} · {s.bpm} bpm
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5">
              <button
                onClick={() => { setStarting(null); setSaved(null); }}
                className="mb-3 text-sm font-semibold text-zinc-600 hover:underline"
              >
                &larr; Pick a different song
              </button>
              <ScoreEditor initial={starting} onSave={save} saving={saving} />
              {saved && (
                <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">
                  {saved}
                </p>
              )}
            </div>
          )}

          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">How to read what you are writing</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Higher on the staff means a higher sound. Drag a note up and listen.</li>
              <li>Every bar has to add up to the same number of beats. If one does not, its bar
                line turns <b>red</b> — that is the check that catches most mistakes.</li>
              <li><b>Both staves</b> is what piano and harp music uses: high notes on top
                (treble), low notes underneath (bass), split at middle C.</li>
            </ul>
          </div>
        </main>
      </LoginGate>
    </SectionGuard>
  );
}
