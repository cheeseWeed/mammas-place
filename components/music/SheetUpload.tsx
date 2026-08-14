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

import { useCallback, useRef, useState } from 'react';

interface UploadResult {
  ok: true;
  kind: string;
  status: string;
  title: string;
  message: string;
  warnings?: string[];
  song?: { notes: unknown[] };
}

export default function SheetUpload({ onImported }: { onImported?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

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
      onImported?.();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }, [onImported]);

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
