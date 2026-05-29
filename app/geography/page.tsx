// Geography hub — lists every phase from the phase registry. Shipped phases
// link out; unshipped phases render as "Coming soon" cards (still visible so
// kids see the roadmap). One card per entry in GEOGRAPHY_PHASES.
//
// Server component: data is static, no client state needed.
import type { Metadata } from 'next';
import Link from 'next/link';
import { GEOGRAPHY_PHASES } from '@/data/geography-phases';

export const metadata: Metadata = {
  title: "Geography Explorer - Mamma's Place",
  description:
    'Learn the United States one step at a time. Explore the map, then test what you know with quizzes and games.',
};

export default function GeographyHubPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-sky-50 to-white py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-6xl mb-3">🗺️</div>
          <h1 className="text-4xl md:text-5xl font-black text-emerald-900 mb-3">
            Geography Explorer
          </h1>
          <p className="text-lg text-emerald-700 max-w-2xl mx-auto">
            Learn the United States one step at a time. Start with the map, then test what you know.
          </p>
        </div>

        {/* Phase grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
          {GEOGRAPHY_PHASES.map((phase) => {
            const phaseLabel = `Phase ${phase.number}`;

            // Coming-soon card — grayed out, no link
            if (!phase.shipped) {
              return (
                <div
                  key={phase.id}
                  className="bg-gray-100 rounded-2xl border border-gray-200 p-6 opacity-60 relative"
                >
                  <div className="absolute top-3 right-3 bg-gray-300 text-gray-700 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                    Coming Soon
                  </div>
                  <div className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">
                    {phaseLabel}
                  </div>
                  <h2 className="text-xl font-black text-gray-700 mb-2 leading-tight">
                    {phase.title}
                  </h2>
                  <p className="text-sm text-gray-600">{phase.subtitle}</p>
                </div>
              );
            }

            // Live card — clickable, bright, hover effect
            return (
              <Link
                key={phase.id}
                href={phase.route}
                className="group bg-white rounded-2xl border-2 border-emerald-200 p-6 shadow-md hover:shadow-xl hover:scale-[1.02] hover:border-emerald-400 transition-all duration-300 relative"
              >
                <div className="absolute top-3 right-3 bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                  Open
                </div>
                <div className="text-sm font-bold text-emerald-600 uppercase tracking-wide mb-2">
                  {phaseLabel}
                </div>
                <h2 className="text-xl font-black text-emerald-900 group-hover:text-emerald-700 transition-colors mb-2 leading-tight">
                  {phase.title}
                </h2>
                <p className="text-sm text-gray-700">{phase.subtitle}</p>
                <div className="mt-4 text-sm font-bold text-emerald-700 group-hover:text-emerald-500 transition-colors">
                  Start exploring →
                </div>
              </Link>
            );
          })}
        </div>

        {/* Footer note */}
        <div className="bg-gradient-to-r from-emerald-600 to-sky-700 rounded-2xl shadow-lg p-6 md:p-8 text-white text-center">
          <p className="text-emerald-50 mb-3 text-sm">
            More phases coming soon — quizzes, drag-and-match games, state deep-dives, and more.
          </p>
          <Link
            href="/"
            className="inline-block bg-white/20 hover:bg-white/30 text-white font-medium px-6 py-2 rounded-full transition-colors text-sm"
          >
            ← Back to Mamma&apos;s Place
          </Link>
        </div>
      </div>
    </div>
  );
}
