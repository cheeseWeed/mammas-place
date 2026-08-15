'use client';

// Upload your own sheet music.
//
// The whole point of this component is to be HONEST about what happens next,
// because two very different things can happen:
//
//   MusicXML / MIDI  -> the file contains the actual notes, so it is parsed on
//                       upload and playable immediately.
//   PDF              -> a PDF is a picture of music, not the notes. Reading it
//                       automatically means optical music recognition, which
//                       misreads often enough that a kid who played CORRECTLY
//                       would be told they were wrong. So it is queued for a
//                       person to write out, and we say so plainly rather than
//                       pretending it will "just work".

import { useCallback, useEffect, useRef, useState } from 'react';

interface UploadResult {
  ok: true;
  kind: string;
  status: string;
  title: string;
  message: string;
  warnings?: string[];
  song?: { notes: unknown[] };
}

interface PastUpload {
  id: string;
  title: string;
  fileName: string;
  kind: string;
  status: string;
  uploadedAt: string;
  noteCount: number | null;
  warnings: string[];
}

export default function SheetUpload({ onImported }: { onImported?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [past, setPast] = useState<PastUpload[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Show what has already been uploaded. Without this the list was write-only:
  // a kid uploaded a file, saw nothing, and uploaded it again — which is
  // exactly what happened (the same PDF three times in nine minutes).
  const loadPast = useCallback(async () => {
    try {
      const res = await fetch('/api/music/uploads');
      if (!res.ok) return;
      const body = await res.json().catch(() => null);
      if (Array.isArray(body?.uploads)) setPast(body.uploads);
    } catch { /* offline — the upload form still works */ }
  }, []);

  useEffect(() => { void loadPast(); }, [loadPast]);

  const send = useCallback(async (file: File) => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/music/upload', { method: 'POST', body: fd });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? 'That upload did not work.');
        return;
      }
      setResult(body as UploadResult);
      void loadPast();
      // Tell the game to reload its song list right now, so a file that just
      // parsed is immediately playable instead of needing a page refresh.
      try { window.dispatchEvent(new CustomEvent('music:uploads-changed')); } catch { /* ignore */ }
      onImported?.();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }, [onImported, loadPast]);

  return (
    <div className="rounded-2xl border-2 border-purple-200 bg-white p-4 sm:p-6">
      <h2 className="text-lg font-bold text-purple-900">Add your own music</h2>

      <div className="mt-3 rounded-lg bg-purple-50 p-3 text-sm text-purple-900">
        <p className="font-semibold">Best file to upload: MusicXML</p>
        <p className="mt-1">
          A <b>.musicxml</b> or <b>.mid</b> file has the real notes inside it, so it becomes
          playable straight away. You can download MusicXML free from{' '}
          <a href="https://musescore.com" target="_blank" rel="noreferrer" className="underline">
            musescore.com
          </a>{' '}
          for lots of pieces.
        </p>
        <p className="mt-2">
          A <b>.pdf</b> is only a <i>picture</i> of the music — a computer cannot read the notes
          from it reliably, so a person has to write them out first. You can still upload it;
          it just will not be playable right away.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".musicxml,.xml,.mxl,.mid,.midi,.pdf"
          disabled={busy}
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) void send(f);
          }}
          className="block text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-purple-800 file:px-4 file:py-2 file:font-semibold file:text-white"
        />
        {busy && <span className="text-sm text-zinc-600">Reading your file…</span>}
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>
      )}

      {past.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold text-purple-900">Your uploads</p>
          <ul className="mt-2 space-y-1.5">
            {past.map(u => (
              <li
                key={u.id}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
              >
                <span className="font-semibold text-zinc-800">{u.title}</span>
                <span className="text-xs uppercase tracking-wide text-zinc-500">{u.kind}</span>
                {u.status === 'playable' ? (
                  <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                    ✓ ready to play{u.noteCount ? ` — ${u.noteCount} notes` : ''}
                  </span>
                ) : (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                    ⏳ saved — waiting for the notes to be written out
                  </span>
                )}
                <span className="ml-auto text-xs text-zinc-400">
                  {u.uploadedAt ? u.uploadedAt.slice(0, 10) : ''}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-zinc-500">
            A PDF has to be written out by a person before you can play it — it is a picture of
            the music, not the notes themselves. Uploading it again will not speed that up.
          </p>
        </div>
      )}

      {result && (
        <div
          className={`mt-3 rounded-lg p-3 text-sm ${
            result.status === 'playable'
              ? 'bg-green-50 text-green-900'
              : 'bg-amber-50 text-amber-900'
          }`}
        >
          <p className="font-semibold">
            {result.status === 'playable' ? '✓ ' : '⏳ '}
            {result.title}
          </p>
          <p className="mt-1">{result.message}</p>
          {result.warnings?.length ? (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs">
              {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}
