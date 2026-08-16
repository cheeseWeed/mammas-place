'use client';

// Note Reader — the sight-reading game.
//
// A scrolling staff, notes moving toward a hit line, and the kid plays them on
// their real instrument while the microphone scores it. Sits alongside the
// practice tracker at /music rather than replacing it: this is for READING
// notes, the tracker is for daily practice on assigned pieces.
//
// The songs are hand-transcribed (see lib/music/sightread.ts) because reading
// notes off a PDF automatically is unreliable enough that a kid playing
// CORRECTLY would sometimes be marked wrong — unacceptable in an app where
// production is the family's test environment.

import Link from 'next/link';
import LoginGate from '@/components/LoginGate';
import SectionGuard from '@/components/SectionGuard';
import SheetUpload from '@/components/music/SheetUpload';
import SightReadGame from '@/components/music/SightReadGame';

export default function NoteReaderPage() {
  return (
    <SectionGuard sectionKey="music" label="Note Reader">
      <LoginGate section="music">
        <main className="mx-auto max-w-4xl px-4 py-6">
          <div className="mb-4">
            <Link href="/music" className="text-sm font-semibold text-purple-800 hover:underline">
              &larr; Back to Practice Studio
            </Link>
            <Link href="/music/write" className="ml-4 text-sm font-semibold text-purple-800 hover:underline">
              Music Writer &rarr;
            </Link>
          </div>

          <h1 className="text-2xl font-bold text-purple-900">Note Reader</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Read the notes as they come. Play them on your instrument &mdash; the microphone
            listens and keeps score.
          </p>

          <div className="mt-5">
            <SightReadGame />
          </div>

          <div className="mt-6">
            <SheetUpload />
          </div>

          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">How the two hard modes differ</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li><b>Easy</b> waits for you &mdash; nothing moves until you play the right note. Wrong
                notes are not counted against you, so hunt for it as long as you need.</li>
              <li><b>Hard</b> moves at the song&rsquo;s tempo. A note you miss as it passes counts as a
                miss, and it is worth more MP because playing in time is harder.</li>
              <li><b>Practice</b> keeps no score and earns no MP &mdash; just play.</li>
            </ul>
            <p className="mt-3">
              Being a little sharp or flat still counts as the right note. This game is teaching you
              to <i>read</i>; use the tuner on the{' '}
              <Link href="/music" className="font-semibold underline">Practice Studio</Link> page to
              work on intonation.
            </p>
          </div>
        </main>
      </LoginGate>
    </SectionGuard>
  );
}
