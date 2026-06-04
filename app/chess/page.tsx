'use client';

// Chess hub — the landing page at /chess.
//
// Big "Play" CTA up top, the four phase cards below (only Phase 1 is open
// today; the rest render as "Coming soon"), a theme preview using
// <ThemePicker> (read-only browse here — choice happens on the play config
// screen), and a placeholder Resume slot for Phase 4.
//
// Matches the Math / Geography hub pattern: phase-card grid + "back to
// Mamma's Place" footer.

import { useState } from 'react';
import Link from 'next/link';
import LoginGate from '@/components/LoginGate';
import SabbathGuard from '@/components/SabbathGuard';
import ThemePicker from '@/components/chess/ThemePicker';
import { DEFAULT_THEME_ID, type ChessThemeId } from '@/data/chess-themes';

export default function ChessHubPage() {
  return (
    <SabbathGuard label="Chess">
    <LoginGate
      section="chess"
      loadingFallback={
        <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white py-12 px-4">
          <div className="max-w-3xl mx-auto text-center text-purple-700">Loading…</div>
        </div>
      }
    >
      <ChessHubAuthed />
    </LoginGate>
    </SabbathGuard>
  );
}

function ChessHubAuthed() {
  // Theme preview state — purely cosmetic. The real choice happens on the
  // play config screen and is also persisted there (sessionStorage Phase 2,
  // user record Phase 4).
  const [previewTheme, setPreviewTheme] = useState<ChessThemeId>(DEFAULT_THEME_ID);

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-yellow-50 to-white py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-6xl mb-3">♟️</div>
          <h1 className="text-4xl md:text-5xl font-black text-purple-900 mb-3">Chess</h1>
          <p className="text-lg text-purple-800 max-w-2xl mx-auto">
            Tap a piece, tap where it goes. Real rules, four piece sets, and a
            board that actually feels like a real chess set.
          </p>
        </div>

        {/* Primary CTA + Puzzles + Resume slot */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          <Link
            href="/chess/play"
            className="group md:col-span-2 bg-gradient-to-br from-purple-900 to-purple-700 hover:from-purple-800 hover:to-purple-600 text-white rounded-3xl p-6 md:p-8 shadow-xl transition-all hover:scale-[1.01] flex flex-col justify-between"
          >
            <div>
              <div className="text-yellow-300 text-xs font-black uppercase tracking-wider mb-2">
                Ready to play
              </div>
              <h2 className="text-3xl md:text-4xl font-black mb-2">Start a game</h2>
              <p className="text-purple-100 text-sm md:text-base mb-4">
                Two players on the same device, or play vs Cub / Knight /
                Wizard AI. Tap-to-move, full rules, MP for wins and draws.
              </p>
            </div>
            <div className="text-yellow-300 font-black group-hover:translate-x-1 transition-transform">
              Play →
            </div>
          </Link>

          {/* Puzzles card — drill mode for tactical practice */}
          <Link
            href="/chess/puzzles"
            className="group bg-gradient-to-br from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-purple-900 rounded-3xl p-6 shadow-xl transition-all hover:scale-[1.01] flex flex-col justify-between relative"
          >
            <div className="absolute top-3 right-3 bg-purple-900 text-yellow-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
              Shipped
            </div>
            <div>
              <div className="text-4xl mb-2">🧩</div>
              <h3 className="text-xl md:text-2xl font-black mb-1">Chess Puzzles</h3>
              <p className="text-sm text-purple-900/90">
                Mate in 1, 2, 3. Endgames. Brain food.
              </p>
            </div>
            <div className="text-purple-900 font-black mt-3 group-hover:translate-x-1 transition-transform">
              Solve →
            </div>
          </Link>
        </div>

        {/* Resume + sub-tiles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          <Link
            href="/chess/play"
            className="md:col-span-3 bg-white rounded-3xl p-5 border-2 border-purple-200 hover:border-purple-400 shadow-md hover:shadow-lg transition-all relative group"
          >
            <div className="absolute top-3 right-3 bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
              Shipped
            </div>
            <div className="text-xs font-black uppercase tracking-wide text-purple-600 mb-1">
              Resume
            </div>
            <h3 className="text-lg font-black text-purple-900 mb-1">Pick up a game in progress</h3>
            <p className="text-sm text-purple-700">
              If you have a saved game, you&apos;ll see a Resume button on the Play page.
            </p>
          </Link>
        </div>

        {/* Phase grid */}
        <section className="mb-12">
          <div className="flex items-baseline gap-3 mb-4 border-b-2 border-purple-200 pb-2">
            <span className="text-3xl" aria-hidden="true">♔</span>
            <h2 className="text-2xl md:text-3xl font-black text-purple-900">
              What&apos;s in the game
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <PhaseCard
              phaseLabel="Phase 1"
              title="2-player + rules"
              subtitle="Click-to-move, legal-square highlights, full rules including castling, en passant, promotion, threefold repetition."
              shipped
            />
            <PhaseCard
              phaseLabel="Phase 2"
              title="Themes + polish"
              subtitle="Classic, Storybook, Royal, and Holiday piece sets. Smooth move animation."
              shipped
            />
            <PhaseCard
              phaseLabel="Phase 3"
              title="AI: Cub / Knight / Wizard"
              subtitle="Three difficulties. On Cub mode, the AI explains its move."
              shipped
            />
            <PhaseCard
              phaseLabel="Phase 4"
              title="Save + MP earn"
              subtitle="Resume across devices. Wins and draws earn MP."
              shipped
            />
          </div>
        </section>

        {/* Theme preview */}
        <section className="mb-12">
          <div className="flex items-baseline gap-3 mb-4 border-b-2 border-purple-200 pb-2">
            <span className="text-3xl" aria-hidden="true">🎨</span>
            <h2 className="text-2xl md:text-3xl font-black text-purple-900">
              Pick your set
            </h2>
            <span className="text-sm font-semibold text-purple-700 ml-1">
              · preview — set the real choice in the game
            </span>
          </div>
          <ThemePicker selectedId={previewTheme} onSelect={setPreviewTheme} />
        </section>

        {/* How to play link */}
        <div className="bg-gradient-to-r from-purple-700 to-purple-900 rounded-2xl shadow-lg p-6 md:p-8 text-white text-center mb-6">
          <h3 className="font-black text-yellow-300 text-lg mb-1">
            New to chess?
          </h3>
          <p className="text-purple-100 text-sm mb-3">
            Each piece moves differently. Tap a piece and the legal squares
            light up — the board will only let you do real moves.
          </p>
          <a
            href="https://www.chess.com/learn-how-to-play-chess"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-yellow-400 text-purple-900 hover:bg-yellow-300 font-bold px-5 py-2 rounded-full text-sm transition-colors"
          >
            How the pieces move ↗
          </a>
        </div>

        {/* Footer */}
        <div className="text-center">
          <Link
            href="/"
            className="inline-block text-purple-700 hover:text-purple-900 font-semibold text-sm"
          >
            ← Back to Mamma&apos;s Place
          </Link>
        </div>
      </div>
    </div>
  );
}

function PhaseCard({
  phaseLabel,
  title,
  subtitle,
  shipped,
}: {
  phaseLabel: string;
  title: string;
  subtitle: string;
  shipped?: boolean;
}) {
  if (!shipped) {
    return (
      <div className="bg-gray-100 rounded-2xl border border-gray-200 p-5 opacity-60 relative">
        <div className="absolute top-3 right-3 bg-gray-300 text-gray-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
          Soon
        </div>
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
          {phaseLabel}
        </div>
        <h3 className="text-base font-black text-gray-700 mb-1 leading-tight">
          {title}
        </h3>
        <p className="text-xs text-gray-600 leading-snug">{subtitle}</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl border-2 border-purple-200 p-5 shadow-md relative">
      <div className="absolute top-3 right-3 bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
        Shipped
      </div>
      <div className="text-xs font-bold text-purple-600 uppercase tracking-wide mb-1">
        {phaseLabel}
      </div>
      <h3 className="text-base font-black text-purple-900 mb-1 leading-tight">
        {title}
      </h3>
      <p className="text-xs text-gray-700 leading-snug">{subtitle}</p>
    </div>
  );
}
