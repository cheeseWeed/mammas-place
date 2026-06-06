'use client';

// Printable certificate of achievement for a passed-off / mastered piece.
//
// The kid reaches this from their own /music page once a piece is
// certificate-worthy (best quality ≥ 9 — i.e. they're earning full points) OR
// once a parent has passed it off. It reads the kid's own music state (cookie-
// scoped), finds the piece by ?piece=, and renders a clean print layout.
// "Print / Save as PDF" calls window.print(); print CSS hides the chrome so
// only the certificate prints.
//
// Self-serve by design (per user): Shepherd prints his own once he's earned it.

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { INSTRUMENTS, type MusicPiece } from '@/lib/music/types';

const CERT_THRESHOLD = 9;

interface MusicState {
  ok: true;
  user: string;
  profile: { pieces: MusicPiece[] };
}

export default function CertificatePage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-indigo-700">Loading…</div>}>
      <CertificateInner />
    </Suspense>
  );
}

function CertificateInner() {
  const params = useSearchParams();
  const pieceId = params.get('piece') ?? '';
  const [state, setState] = useState<MusicState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/music/state', { cache: 'no-store' });
        const data = await res.json();
        if (data.ok) setState(data as MusicState);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="p-10 text-center text-indigo-700">Loading…</div>;

  // Not logged in (state never loaded / 401) — say so instead of the misleading
  // "couldn't find that piece."
  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-center">
        <div>
          <p className="text-gray-700 mb-4">Log in to see your certificate.</p>
          <Link href="/shop/login" className="text-indigo-700 underline">Log in</Link>
          <span className="mx-2 text-gray-400">·</span>
          <Link href="/music" className="text-indigo-700 underline">← Back to Practice Studio</Link>
        </div>
      </div>
    );
  }

  const piece = state.profile.pieces.find((p) => p.id === pieceId);
  if (!piece) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-center">
        <div>
          <p className="text-gray-700 mb-4">Couldn’t find that piece.</p>
          <Link href="/music" className="text-indigo-700 underline">← Back to Practice Studio</Link>
        </div>
      </div>
    );
  }

  const bestScore = piece.log.reduce((m, e) => Math.max(m, e.qualityScore), 0);
  const earned = !!piece.passedOffAt || bestScore >= CERT_THRESHOLD;
  if (!earned) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-center">
        <div>
          <p className="text-gray-700 mb-2 font-semibold">Not quite yet! 🎵</p>
          <p className="text-gray-600 mb-4 text-sm">
            Reach a {CERT_THRESHOLD}/10 run-through (full points) to unlock your certificate.
            Best so far: {bestScore || 0}/10.
          </p>
          <Link href="/music" className="text-indigo-700 underline">← Keep practicing</Link>
        </div>
      </div>
    );
  }

  const name = prettyName(state!.user);
  const instrument = INSTRUMENTS.find((i) => i.value === piece.instrument);
  const sessions = piece.log.length;
  const dateStr = formatDate(piece.passedOffAt ?? new Date().toISOString());

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 print:bg-white print:p-0">
      {/* print controls — hidden when printing */}
      <div className="max-w-3xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <Link href="/music" className="text-indigo-700 underline text-sm">← Back to Practice Studio</Link>
        <button
          onClick={() => window.print()}
          className="bg-indigo-700 hover:bg-indigo-800 text-white font-bold px-5 py-2 rounded-full text-sm"
        >
          🖨️ Print / Save as PDF
        </button>
      </div>

      {/* the certificate */}
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl print:shadow-none print:rounded-none">
        <div className="m-3 print:m-0 border-[6px] border-double border-amber-500 rounded-xl print:rounded-none p-10 text-center relative overflow-hidden">
          {/* corner flourishes */}
          <div className="absolute top-3 left-3 text-3xl opacity-40">🎼</div>
          <div className="absolute top-3 right-3 text-3xl opacity-40">🎵</div>
          <div className="absolute bottom-3 left-3 text-3xl opacity-40">🎶</div>
          <div className="absolute bottom-3 right-3 text-3xl opacity-40">🎻</div>

          <p className="tracking-[0.3em] text-amber-700 text-xs font-bold uppercase mb-2">
            Mamma’s Place Music Studio
          </p>
          <h1 className="text-3xl md:text-4xl font-black text-amber-900 mb-1">
            Certificate of Achievement
          </h1>
          <div className="text-5xl my-4">{instrument?.emoji ?? '🎵'}</div>

          <p className="text-gray-600 text-sm mb-1">This certifies that</p>
          <p className="text-3xl md:text-4xl font-black text-indigo-900 my-2">{name}</p>
          <p className="text-gray-600 text-sm mb-1">has learned and performed</p>
          <p className="text-2xl md:text-3xl font-bold text-amber-800 italic my-2">
            “{piece.title}”
          </p>
          <p className="text-gray-600 text-sm mb-6">
            on the {instrument?.label ?? 'instrument'}
            {piece.passedOffAt ? ' — officially passed off!' : ` with a ${bestScore}/10 performance!`}
          </p>

          <div className="flex justify-center gap-8 text-sm text-gray-700 mb-6 flex-wrap">
            <Stat label="Best score" value={`${bestScore}/10`} />
            <Stat label="Practice days" value={`${sessions}`} />
            <Stat label="Lines mastered" value={`${piece.estLines}`} />
          </div>

          <div className="flex items-end justify-between mt-10 px-2">
            <div className="text-center">
              <div className="w-40 border-t-2 border-gray-400 pt-1 text-xs text-gray-500">Teacher / Parent</div>
            </div>
            <div className="text-amber-600 text-4xl">★</div>
            <div className="text-center">
              <div className="w-40 border-t-2 border-gray-400 pt-1 text-xs text-gray-500">{dateStr}</div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { size: landscape; margin: 0.5in; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-black text-indigo-900">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
    </div>
  );
}

function prettyName(user: string): string {
  return user
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(d);
}
