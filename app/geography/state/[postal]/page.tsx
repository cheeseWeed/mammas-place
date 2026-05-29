// Phase 6 — State Deep-Dive (full-page deep link).
//
// Server component. Statically generates one page per state (50 + DC) at build
// time. Renders the same data the StateDetailDrawer shows, but as a full,
// scrollable page with a wider max-w-4xl column.
//
// Trade-off: the drawer component (lives in components/geography/) renders
// essentially the same fields. We chose to rebuild the sections inline here
// for shipping speed (Phase 6 ships today). If/when a third surface needs the
// same layout, extract a shared <StateDetailContent state={record} /> and have
// both the drawer and this page wrap it. Documented in the agent report.
//
// URL shape: /geography/state/ut (lowercase postal). We upper-case at lookup
// time. Anything not in states.json triggers notFound() → Next's 404 page.
//
// The `focus` query param on the back-to-study link is reserved for a future
// drawer→page hand-off (so a kid reading the drawer can jump to the full page
// and the map can re-focus on the same state). We don't act on it yet.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import statesData from '@/data/states.json';

type PhysicalFeature = {
  name: string;
  type: string;
  description: string;
  fact?: string;
};

type Park = {
  name: string;
  type: string;
  description: string;
  yearEstablished?: number;
};

type Quarter = {
  year: number;
  design: string;
};

type StateRecord = {
  postal: string;
  name: string;
  capital: string;
  region: string;
  admittedYear?: number;
  nickname?: string;
  motto?: string;
  stateBird?: string;
  stateFlower?: string;
  stateTree?: string;
  stateAnimal?: string;
  quarter?: Quarter;
  population?: number;
  populationYear?: number;
  areaSqMi?: number;
  largestCity?: string;
  funFacts?: string[];
  physicalFeatures?: PhysicalFeature[];
  parks?: Park[];
};

const STATES = statesData as StateRecord[];

function findState(postalParam: string): StateRecord | undefined {
  const postal = postalParam.toUpperCase();
  return STATES.find((s) => s.postal === postal);
}

// Build a static page for every state postal at compile time. The URL
// segment is lowercase; the JSON is uppercase — we lowercase on the way out.
export async function generateStaticParams() {
  return STATES.map((s) => ({ postal: s.postal.toLowerCase() }));
}

// Per-state SEO metadata. Title and description both include the state name
// and nickname/capital so search results and tab titles are meaningful.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ postal: string }>;
}): Promise<Metadata> {
  const { postal } = await params;
  const state = findState(postal);
  if (!state) {
    return {
      title: 'State not found — Geography Explorer',
    };
  }
  const nicknamePart = state.nickname ? ` — ${state.nickname}` : '';
  return {
    title: `${state.name} — Geography Explorer`,
    description: `${state.name}${nicknamePart}. Capital: ${state.capital}. Explore symbols, physical features, parks, and fun facts.`,
  };
}

// Small presentational helpers kept local to this file. The drawer has its
// own equivalents; if we ever extract a shared content component, these move
// with it.

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-5 sm:p-6">
      <h2 className="text-xl sm:text-2xl font-black text-emerald-900 mb-4">{title}</h2>
      {children}
    </section>
  );
}

function FactRow({ label, value }: { label: string; value: string | number | undefined }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-sm font-semibold text-emerald-700 min-w-[7.5rem]">{label}</span>
      <span className="text-sm sm:text-base text-gray-800">{value}</span>
    </div>
  );
}

export default async function StateDeepDivePage({
  params,
}: {
  params: Promise<{ postal: string }>;
}) {
  const { postal } = await params;
  const state = findState(postal);
  if (!state) notFound();

  // Build the "back to Study Map with focus" URL. The Study Map doesn't act
  // on ?focus= yet — it's a future hook for opening the drawer auto-focused
  // on this state when the user navigates back from here.
  const studyHref = `/geography/study?focus=${state.postal}`;

  const populationDisplay =
    state.population !== undefined
      ? `${state.population.toLocaleString()}${state.populationYear ? ` (${state.populationYear})` : ''}`
      : undefined;
  const areaDisplay =
    state.areaSqMi !== undefined ? `${state.areaSqMi.toLocaleString()} sq mi` : undefined;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-sky-50 to-white py-8 sm:py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb / back links */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-6 text-sm">
          <Link
            href="/geography"
            className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-500 transition-colors"
          >
            ← Geography
          </Link>
          <span className="text-gray-300">/</span>
          <Link
            href={studyHref}
            className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-500 transition-colors"
          >
            Study Map
          </Link>
          <span className="text-gray-300">/</span>
          <span className="font-semibold text-gray-700">{state.name}</span>
        </div>

        {/* Header card */}
        <header className="bg-gradient-to-br from-emerald-600 to-teal-600 text-white rounded-2xl shadow-md p-6 sm:p-8 mb-6">
          <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
            <h1 className="text-3xl sm:text-4xl font-black">{state.name}</h1>
            <span className="text-sm sm:text-base font-bold bg-white/20 px-3 py-1 rounded-full">
              {state.postal}
            </span>
          </div>
          {state.nickname && (
            <p className="text-emerald-50 text-lg sm:text-xl font-semibold italic mb-3">
              {state.nickname}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm sm:text-base">
            <div>
              <span className="font-semibold text-emerald-100">Capital:</span>{' '}
              <span className="font-medium">{state.capital}</span>
            </div>
            {state.largestCity && state.largestCity !== state.capital && (
              <div>
                <span className="font-semibold text-emerald-100">Largest city:</span>{' '}
                <span className="font-medium">{state.largestCity}</span>
              </div>
            )}
            {state.region && (
              <div>
                <span className="font-semibold text-emerald-100">Region:</span>{' '}
                <span className="font-medium">{state.region}</span>
              </div>
            )}
            {state.admittedYear !== undefined && (
              <div>
                <span className="font-semibold text-emerald-100">Admitted:</span>{' '}
                <span className="font-medium">{state.admittedYear}</span>
              </div>
            )}
            {populationDisplay && (
              <div>
                <span className="font-semibold text-emerald-100">Population:</span>{' '}
                <span className="font-medium">{populationDisplay}</span>
              </div>
            )}
            {areaDisplay && (
              <div>
                <span className="font-semibold text-emerald-100">Area:</span>{' '}
                <span className="font-medium">{areaDisplay}</span>
              </div>
            )}
          </div>
          {state.motto && (
            <p className="mt-4 text-emerald-50 text-sm sm:text-base">
              <span className="font-semibold">Motto:</span>{' '}
              <span className="italic">&ldquo;{state.motto}&rdquo;</span>
            </p>
          )}
        </header>

        {/* Content sections */}
        <div className="space-y-5">
          {/* Symbols */}
          {(state.stateBird || state.stateFlower || state.stateTree || state.stateAnimal || state.quarter) && (
            <SectionCard title="State Symbols">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4">
                <FactRow label="Bird" value={state.stateBird} />
                <FactRow label="Flower" value={state.stateFlower} />
                <FactRow label="Tree" value={state.stateTree} />
                <FactRow label="Animal" value={state.stateAnimal} />
              </div>
              {state.quarter && (
                <div className="mt-4 pt-4 border-t border-emerald-100">
                  <div className="text-sm font-semibold text-emerald-700 mb-1">
                    State Quarter ({state.quarter.year})
                  </div>
                  <p className="text-sm sm:text-base text-gray-800">{state.quarter.design}</p>
                </div>
              )}
            </SectionCard>
          )}

          {/* Fun facts */}
          {state.funFacts && state.funFacts.length > 0 && (
            <SectionCard title="Fun Facts">
              <ul className="space-y-2 list-none">
                {state.funFacts.map((fact, i) => (
                  <li key={i} className="flex gap-2 text-sm sm:text-base text-gray-800">
                    <span className="text-emerald-600 font-bold mt-0.5">•</span>
                    <span>{fact}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {/* Physical features */}
          {state.physicalFeatures && state.physicalFeatures.length > 0 && (
            <SectionCard title="Physical Features">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {state.physicalFeatures.map((feature) => (
                  <div
                    key={feature.name}
                    className="bg-emerald-50/60 rounded-xl p-3 border border-emerald-100"
                  >
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <h3 className="font-bold text-emerald-900">{feature.name}</h3>
                      <span className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                        {feature.type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800">{feature.description}</p>
                    {feature.fact && (
                      <p className="mt-1 text-sm text-emerald-700 italic">{feature.fact}</p>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Parks */}
          {state.parks && state.parks.length > 0 && (
            <SectionCard title="Parks & Protected Places">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {state.parks.map((park) => (
                  <div
                    key={park.name}
                    className="bg-teal-50/60 rounded-xl p-3 border border-teal-100"
                  >
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <h3 className="font-bold text-teal-900">{park.name}</h3>
                      <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                        {park.type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800">{park.description}</p>
                    {park.yearEstablished !== undefined && (
                      <p className="mt-1 text-xs text-gray-500">
                        Established {park.yearEstablished}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>

        {/* Footer back link */}
        <div className="mt-8 text-center">
          <Link
            href={studyHref}
            className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-500 transition-colors"
          >
            ← Back to the Study Map
          </Link>
        </div>
      </div>
    </div>
  );
}
