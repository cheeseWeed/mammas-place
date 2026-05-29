// Geography hub — TWO sections (USA + World), each rendering one card per
// phase from its registry. Shipped phases link out; unshipped phases render
// as "Coming soon" cards. USA section uses emerald/teal accents; World
// section uses sky/indigo to feel distinct but consistent.
//
// Server component: data is static, no client state needed.
import type { Metadata } from 'next';
import Link from 'next/link';
import { GEOGRAPHY_PHASES, type GeographyPhase } from '@/data/geography-phases';
import { WORLD_PHASES, type WorldPhase } from '@/data/world-phases';

export const metadata: Metadata = {
  title: "Geography Explorer - Mamma's Place",
  description:
    'Learn the United States and the world, one step at a time. Explore maps and test what you know with quizzes and games.',
};

// Tailwind class palettes per section so the two sections share structure
// but read as visually distinct.
type Palette = {
  cardBorder: string;        // border-{color}-200
  cardHoverBorder: string;   // hover:border-{color}-400
  badgeBg: string;           // bg-{color}-100
  badgeText: string;         // text-{color}-700
  labelText: string;         // text-{color}-600
  titleText: string;         // text-{color}-900
  titleHoverText: string;    // group-hover:text-{color}-700
  ctaText: string;           // text-{color}-700
  ctaHoverText: string;      // group-hover:text-{color}-500
};

const US_PALETTE: Palette = {
  cardBorder: 'border-emerald-200',
  cardHoverBorder: 'hover:border-emerald-400',
  badgeBg: 'bg-emerald-100',
  badgeText: 'text-emerald-700',
  labelText: 'text-emerald-600',
  titleText: 'text-emerald-900',
  titleHoverText: 'group-hover:text-emerald-700',
  ctaText: 'text-emerald-700',
  ctaHoverText: 'group-hover:text-emerald-500',
};

const WORLD_PALETTE: Palette = {
  cardBorder: 'border-sky-200',
  cardHoverBorder: 'hover:border-sky-400',
  badgeBg: 'bg-sky-100',
  badgeText: 'text-sky-700',
  labelText: 'text-sky-600',
  titleText: 'text-sky-900',
  titleHoverText: 'group-hover:text-sky-700',
  ctaText: 'text-sky-700',
  ctaHoverText: 'group-hover:text-sky-500',
};

// One card per phase. Same shape for both sections — phase number/title/
// subtitle pulled from the registry, palette injected per section.
function PhaseCard({
  phase,
  palette,
}: {
  phase: GeographyPhase | WorldPhase;
  palette: Palette;
}) {
  const phaseLabel = `Phase ${phase.number}`;

  if (!phase.shipped) {
    return (
      <div
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

  return (
    <Link
      href={phase.route}
      className={`group bg-white rounded-2xl border-2 ${palette.cardBorder} p-6 shadow-md hover:shadow-xl hover:scale-[1.02] ${palette.cardHoverBorder} transition-all duration-300 relative`}
    >
      <div className={`absolute top-3 right-3 ${palette.badgeBg} ${palette.badgeText} text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide`}>
        Open
      </div>
      <div className={`text-sm font-bold ${palette.labelText} uppercase tracking-wide mb-2`}>
        {phaseLabel}
      </div>
      <h2 className={`text-xl font-black ${palette.titleText} ${palette.titleHoverText} transition-colors mb-2 leading-tight`}>
        {phase.title}
      </h2>
      <p className="text-sm text-gray-700">{phase.subtitle}</p>
      <div className={`mt-4 text-sm font-bold ${palette.ctaText} ${palette.ctaHoverText} transition-colors`}>
        Start exploring →
      </div>
    </Link>
  );
}

export default function GeographyHubPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-sky-50 to-white py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Page header */}
        <div className="text-center mb-10">
          <div className="text-6xl mb-3">🗺️</div>
          <h1 className="text-4xl md:text-5xl font-black text-emerald-900 mb-3">
            Geography Explorer
          </h1>
          <p className="text-lg text-emerald-700 max-w-2xl mx-auto">
            Pick a continent. Start with the United States, then take on the whole world.
          </p>
        </div>

        {/* USA section */}
        <section className="mb-12">
          <div className="flex items-baseline gap-3 mb-4 border-b-2 border-emerald-200 pb-2">
            <span className="text-3xl" aria-hidden="true">🇺🇸</span>
            <h2 className="text-2xl md:text-3xl font-black text-emerald-900">
              United States
            </h2>
            <span className="text-sm font-semibold text-emerald-700 ml-1">
              · 50 states, capitals, regions
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {GEOGRAPHY_PHASES.map((phase) => (
              <PhaseCard key={phase.id} phase={phase} palette={US_PALETTE} />
            ))}
          </div>
        </section>

        {/* World section */}
        <section className="mb-10">
          <div className="flex items-baseline gap-3 mb-4 border-b-2 border-sky-200 pb-2">
            <span className="text-3xl" aria-hidden="true">🌍</span>
            <h2 className="text-2xl md:text-3xl font-black text-sky-900">
              The World
            </h2>
            <span className="text-sm font-semibold text-sky-700 ml-1">
              · 195 countries, capitals, continents
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {WORLD_PHASES.map((phase) => (
              <PhaseCard key={phase.id} phase={phase} palette={WORLD_PALETTE} />
            ))}
          </div>
        </section>

        {/* Footer note */}
        <div className="bg-gradient-to-r from-emerald-600 to-sky-700 rounded-2xl shadow-lg p-6 md:p-8 text-white text-center">
          <p className="text-emerald-50 mb-3 text-sm">
            More phases coming soon — quizzes, drag-and-match games, country deep-dives, and more.
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
