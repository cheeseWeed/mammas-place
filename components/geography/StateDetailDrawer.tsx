// Slide-in drawer that shows rich state details for Phase 6 (State Deep-Dive).
// Opens from the right when `postal` is non-null; closes on backdrop click or ESC.
'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import statesData from '@/data/states.json';

export type StateDetailDrawerProps = {
  postal: string | null; // when null, drawer is closed
  onClose: () => void;
};

// --- Local types for the bits of states.json this drawer reads ---
type PhysicalFeature = {
  name: string;
  type: string;
  description: string;
  fact: string;
};

type Park = {
  name: string;
  type: string;
  description: string;
  yearEstablished: number | null;
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
  admittedYear: number;
  nickname: string;
  motto: string;
  stateBird: string;
  stateFlower: string;
  stateTree: string;
  stateAnimal: string | null;
  quarter: Quarter | null;
  population: number;
  populationYear: number;
  areaSqMi: number;
  largestCity: string;
  funFacts: string[];
  physicalFeatures: PhysicalFeature[];
  parks: Park[];
};

const STATES = statesData as unknown as StateRecord[];

// Emoji icon for a physical-feature type. Falls back to a pin for unknown types.
function featureEmoji(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('mountain') || t.includes('peak')) return '🏔️';
  if (t.includes('canyon')) return '🏔️';
  if (t.includes('volcano')) return '🌋';
  if (t.includes('glacier')) return '❄️';
  if (t.includes('river')) return '🏞️';
  if (t.includes('lake')) return '💧';
  if (t.includes('desert')) return '🏜️';
  if (t.includes('coast') || t.includes('bay') || t.includes('ocean') || t.includes('sea'))
    return '🌊';
  if (t.includes('valley') || t.includes('plain') || t.includes('prairie')) return '🏕️';
  if (t.includes('forest') || t.includes('wood')) return '🌲';
  if (t.includes('wetland') || t.includes('swamp') || t.includes('marsh')) return '🦟';
  if (t.includes('island')) return '🏝️';
  return '📍';
}

// Visual badge for a park type. National parks get the headline green badge.
function parkBadge(type: string): { label: string; classes: string } {
  const t = type.toLowerCase();
  if (t === 'national')
    return { label: '🏞️ National Park', classes: 'bg-green-100 text-green-800 ring-green-200' };
  if (t === 'state')
    return { label: '🌲 State Park', classes: 'bg-emerald-100 text-emerald-800 ring-emerald-200' };
  if (t === 'monument')
    return { label: '🗿 Monument', classes: 'bg-amber-100 text-amber-800 ring-amber-200' };
  if (t === 'historic' || t === 'historical')
    return { label: '🏛️ Historic Site', classes: 'bg-rose-100 text-rose-800 ring-rose-200' };
  if (t === 'seashore' || t === 'lakeshore')
    return { label: '🌊 Seashore', classes: 'bg-sky-100 text-sky-800 ring-sky-200' };
  if (t === 'recreation' || t === 'recreational')
    return {
      label: '🎣 Recreation Area',
      classes: 'bg-orange-100 text-orange-800 ring-orange-200',
    };
  if (t === 'preserve')
    return { label: '🌿 Preserve', classes: 'bg-teal-100 text-teal-800 ring-teal-200' };
  // Fallback — capitalize and show as-is.
  const label = type.charAt(0).toUpperCase() + type.slice(1);
  return { label, classes: 'bg-gray-100 text-gray-800 ring-gray-200' };
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export default function StateDetailDrawer({ postal, onClose }: StateDetailDrawerProps) {
  const isOpen = postal !== null;
  const state = postal ? STATES.find((s) => s.postal === postal) ?? null : null;

  // ESC closes the drawer.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Symbol cards — collapse the animal card gracefully when null (DC, IN, IA, MN, RI).
  const symbolCards: { icon: string; label: string; value: string }[] = state
    ? [
        { icon: '🐦', label: 'State Bird', value: state.stateBird },
        { icon: '🌸', label: 'State Flower', value: state.stateFlower },
        { icon: '🌳', label: 'State Tree', value: state.stateTree },
        ...(state.stateAnimal
          ? [{ icon: '🦌', label: 'State Animal', value: state.stateAnimal }]
          : []),
      ]
    : [];

  const largestDiffersFromCapital =
    !!state && state.largestCity.trim().toLowerCase() !== state.capital.trim().toLowerCase();

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden={!isOpen}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ease-out ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={state ? `${state.name} details` : 'State details'}
        aria-hidden={!isOpen}
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-[420px] overflow-y-auto bg-white shadow-2xl transition-transform duration-200 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {state && (
          <div className="flex min-h-full flex-col">
            {/* 1. Header */}
            <header className="relative bg-gradient-to-br from-emerald-600 to-teal-600 px-6 pt-6 pb-5 text-white">
              <button
                onClick={onClose}
                aria-label="Close state details"
                className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/20 hover:text-white"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>

              <h2 className="pr-10 text-3xl font-extrabold tracking-tight">{state.name}</h2>
              <p className="mt-1 text-base italic text-emerald-50">{state.nickname}</p>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-emerald-50">
                <span>
                  <span aria-hidden="true">⭐</span> {state.capital}
                </span>
                <span className="text-white/60">|</span>
                <span>{state.region}</span>
                <span className="text-white/60">|</span>
                <span>Admitted {state.admittedYear}</span>
              </div>
            </header>

            {/* 1b. Primary action buttons — Study / Quiz */}
            <div className="grid grid-cols-2 gap-2 border-b border-gray-100 bg-white px-6 py-4">
              <Link
                href={`/geography/state/${state.postal.toLowerCase()}`}
                onClick={onClose}
                className="rounded-xl bg-emerald-600 p-3 text-center font-bold text-white shadow-md transition-all hover:bg-emerald-500 hover:shadow-lg active:bg-emerald-700"
              >
                <span aria-hidden="true">📖</span> Study Full Page
              </Link>
              <Link
                href={`/geography/state/${state.postal.toLowerCase()}/quiz`}
                onClick={onClose}
                className="rounded-xl bg-teal-600 p-3 text-center font-bold text-white shadow-md transition-all hover:bg-teal-500 hover:shadow-lg active:bg-teal-700"
              >
                <span aria-hidden="true">🎯</span> Quiz Me
              </Link>
            </div>

            <div className="flex-1 space-y-6 px-6 py-6">
              {/* 2. Symbols grid */}
              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  State Symbols
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {symbolCards.map((card) => (
                    <div
                      key={card.label}
                      className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3"
                    >
                      <div className="text-2xl" aria-hidden="true">
                        {card.icon}
                      </div>
                      <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                        {card.label}
                      </div>
                      <div className="mt-0.5 text-sm font-medium text-gray-800">{card.value}</div>
                    </div>
                  ))}
                </div>
              </section>

              {/* 3. By the numbers */}
              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  By the Numbers
                </h3>
                <dl className="space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-gray-600">Population</dt>
                    <dd className="text-right font-semibold text-gray-900">
                      {formatNumber(state.population)}{' '}
                      <span className="text-xs font-normal text-gray-500">
                        ({state.populationYear} est.)
                      </span>
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-gray-600">Area</dt>
                    <dd className="text-right font-semibold text-gray-900">
                      {formatNumber(state.areaSqMi)} sq mi
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-gray-600">Largest City</dt>
                    <dd className="text-right font-semibold text-gray-900">
                      {state.largestCity}
                      {largestDiffersFromCapital && (
                        <span className="ml-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-amber-200">
                          Not the capital!
                        </span>
                      )}
                    </dd>
                  </div>
                </dl>
              </section>

              {/* 4. Motto */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Motto
                </h3>
                <blockquote className="border-l-4 border-emerald-400 bg-emerald-50/40 px-4 py-2 italic text-gray-700">
                  &ldquo;{state.motto}&rdquo;
                </blockquote>
              </section>

              {/* 5. Quarter — hidden for DC (null) */}
              {state.quarter && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    State Quarter ({state.quarter.year})
                  </h3>
                  <div className="flex gap-3 rounded-xl border border-amber-100 bg-amber-50/60 p-3">
                    <div className="text-3xl" aria-hidden="true">
                      🪙
                    </div>
                    <p className="text-sm leading-relaxed text-gray-700">{state.quarter.design}</p>
                  </div>
                </section>
              )}

              {/* 6. Fun facts */}
              {state.funFacts.length > 0 && (
                <section>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Fun Facts
                  </h3>
                  <ul className="space-y-2">
                    {state.funFacts.map((fact, i) => (
                      <li
                        key={i}
                        className="rounded-xl bg-teal-50 px-4 py-2 text-sm text-gray-700 ring-1 ring-teal-100"
                      >
                        <span className="mr-1.5" aria-hidden="true">
                          ✨
                        </span>
                        {fact}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* 7. Physical features */}
              {state.physicalFeatures.length > 0 && (
                <section>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Land &amp; Water
                  </h3>
                  <ul className="space-y-3">
                    {state.physicalFeatures.map((f) => (
                      <li
                        key={f.name}
                        className="flex gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm"
                      >
                        <div className="text-2xl leading-none" aria-hidden="true">
                          {featureEmoji(f.type)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-gray-900">{f.name}</div>
                          <p className="mt-1 text-sm text-gray-700">{f.description}</p>
                          <p className="mt-1 text-xs italic text-gray-500">{f.fact}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* 8. Parks */}
              {state.parks.length > 0 && (
                <section>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Parks to Visit
                  </h3>
                  <ul className="space-y-3">
                    {state.parks.map((p) => {
                      const badge = parkBadge(p.type);
                      return (
                        <li
                          key={p.name}
                          className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${badge.classes}`}
                            >
                              {badge.label}
                            </span>
                            {p.yearEstablished !== null && (
                              <span className="text-[11px] text-gray-500">
                                est. {p.yearEstablished}
                              </span>
                            )}
                          </div>
                          <div className="mt-1.5 text-sm font-bold text-gray-900">{p.name}</div>
                          <p className="mt-0.5 text-sm text-gray-700">{p.description}</p>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
            </div>

            {/* 9. Footer */}
            <footer className="mt-auto border-t border-gray-100 bg-gray-50 px-6 py-4">
              <button
                onClick={onClose}
                className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-500 active:bg-emerald-700"
              >
                ← Back to map
              </button>
              <p className="mt-2 text-center text-[10px] text-gray-400">
                Source: Wikipedia + NPS
              </p>
            </footer>
          </div>
        )}
      </aside>
    </>
  );
}
