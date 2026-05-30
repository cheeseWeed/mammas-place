// Slide-in drawer that shows rich country details for the World study map.
// Parallel to StateDetailDrawer but reads from data/countries.json (the
// sibling agent's dataset). Opens from the right when `iso2` is non-null;
// closes on backdrop click, ESC, or close button.
//
// Visual palette: sky/indigo (the World section's accent), distinct from the
// emerald/teal used in the US drawer.
//
// Defensive lookup: if a requested iso2 isn't found, the drawer renders an
// empty body — it never throws. Any field missing on a country record
// degrades gracefully.
'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import countriesData from '@/data/countries.json';

export type CountryDetailDrawerProps = {
  iso2: string | null; // when null, drawer is closed
  onClose: () => void;
  // Optional: when supplied, the drawer renders a "View Up Close" button
  // that closes the drawer and fires this with the current iso2 so the
  // parent page can open the CountryZoomView modal. When undefined, the
  // button is hidden — preserves backwards compatibility for any other
  // caller of this drawer.
  onViewUpClose?: (iso2: string) => void;
};

// Shape mirrors data/countries.json (sibling agent's schema). Every field is
// optional so a partial record renders without throwing.
type CountryRecord = {
  iso2?: string;
  iso3?: string;
  name?: string;
  capital?: string;
  continent?: string;
  region?: string;
  population?: number;
  populationYear?: number;
  areaSqKm?: number;
  languages?: string[];
  currency?: string;
  currencyCode?: string;
  funFacts?: string[];
  landmarks?: Array<{
    name: string;
    type?: string;
    description?: string;
    fact?: string;
  }>;
  physicalFeatures?: Array<{
    name: string;
    type?: string;
    description?: string;
    fact?: string;
  }>;
};

const ALL_COUNTRIES = countriesData as CountryRecord[];

function findCountry(iso2: string): CountryRecord | null {
  const key = iso2.toUpperCase();
  return ALL_COUNTRIES.find((c) => (c.iso2 ?? '').toUpperCase() === key) ?? null;
}

function featureEmoji(type: string | undefined): string {
  const t = (type ?? '').toLowerCase();
  if (t.includes('mountain') || t.includes('peak')) return '🏔️';
  if (t.includes('canyon')) return '🏔️';
  if (t.includes('volcano')) return '🌋';
  if (t.includes('glacier')) return '❄️';
  if (t.includes('river')) return '🏞️';
  if (t.includes('lake')) return '💧';
  if (t.includes('desert')) return '🏜️';
  if (t.includes('coast') || t.includes('bay') || t.includes('ocean') || t.includes('sea'))
    return '🌊';
  if (t.includes('valley') || t.includes('plain')) return '🏕️';
  if (t.includes('forest') || t.includes('jungle') || t.includes('rainforest')) return '🌲';
  if (t.includes('wetland') || t.includes('swamp')) return '🦟';
  if (t.includes('island') || t.includes('archipelago')) return '🏝️';
  if (t.includes('reef')) return '🪸';
  return '📍';
}

function landmarkEmoji(type: string | undefined): string {
  const t = (type ?? '').toLowerCase();
  if (t.includes('temple') || t.includes('church') || t.includes('cathedral')) return '⛪';
  if (t.includes('monument')) return '🗿';
  if (t.includes('castle') || t.includes('palace')) return '🏰';
  if (t.includes('ruin') || t.includes('ancient')) return '🏛️';
  if (t.includes('tower')) return '🗼';
  if (t.includes('bridge')) return '🌉';
  if (t.includes('park') || t.includes('falls')) return '🌳';
  if (t.includes('museum')) return '🏛️';
  return '🏛️';
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

function flagPath(c: CountryRecord): string | null {
  if (!c.iso2) return null;
  return `/geography/world/flags/${c.iso2.toLowerCase()}.svg`;
}

function currencyLabel(c: CountryRecord): string | null {
  if (!c.currency && !c.currencyCode) return null;
  if (c.currency && c.currencyCode) return `${c.currency} (${c.currencyCode})`;
  return c.currency ?? c.currencyCode ?? null;
}

export default function CountryDetailDrawer({
  iso2,
  onClose,
  onViewUpClose,
}: CountryDetailDrawerProps) {
  const isOpen = iso2 !== null;
  const country = iso2 ? findCountry(iso2) : null;

  // ESC closes the drawer.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const flag = country ? flagPath(country) : null;
  const currency = country ? currencyLabel(country) : null;

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
        aria-label={country ? `${country.name ?? 'Country'} details` : 'Country details'}
        aria-hidden={!isOpen}
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-[420px] overflow-y-auto bg-white shadow-2xl transition-transform duration-200 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {country && (
          <div className="flex min-h-full flex-col">
            {/* Header */}
            <header className="relative bg-gradient-to-br from-sky-600 to-indigo-600 px-6 pt-6 pb-5 text-white">
              <button
                onClick={onClose}
                aria-label="Close country details"
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

              <div className="flex items-start gap-3 pr-10">
                {flag && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={flag}
                    alt={`Flag of ${country.name ?? 'country'}`}
                    className="h-12 w-16 shrink-0 rounded-sm object-cover shadow ring-1 ring-white/30 bg-white"
                  />
                )}
                <div className="min-w-0">
                  <h2 className="text-2xl font-extrabold tracking-tight">{country.name}</h2>
                  {country.continent && (
                    <p className="mt-0.5 text-sm italic text-sky-50">{country.continent}</p>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-sky-50">
                {country.capital && (
                  <span>
                    <span aria-hidden="true">⭐</span> {country.capital}
                  </span>
                )}
                {country.iso2 && (
                  <>
                    <span className="text-white/60">|</span>
                    <span className="font-mono uppercase">{country.iso2}</span>
                  </>
                )}
              </div>
            </header>

            {/* Primary action buttons */}
            <div className="grid grid-cols-2 gap-2 border-b border-gray-100 bg-white px-6 py-4">
              {country.iso2 && (
                <>
                  <Link
                    href={`/geography/world/country/${country.iso2.toLowerCase()}`}
                    onClick={onClose}
                    className="rounded-xl bg-sky-600 p-3 text-center font-bold text-white shadow-md transition-all hover:bg-sky-500 hover:shadow-lg active:bg-sky-700"
                  >
                    <span aria-hidden="true">📖</span> Country Page
                  </Link>
                  <Link
                    href={`/geography/world/country/${country.iso2.toLowerCase()}/quiz`}
                    onClick={onClose}
                    className="rounded-xl bg-indigo-600 p-3 text-center font-bold text-white shadow-md transition-all hover:bg-indigo-500 hover:shadow-lg active:bg-indigo-700"
                  >
                    <span aria-hidden="true">🎯</span> Quiz Me
                  </Link>
                  {/* "View Up Close" — only when the parent supplied a handler.
                      Spans both columns so it reads as a distinct primary action. */}
                  {onViewUpClose && country.iso2 && (
                    <button
                      type="button"
                      onClick={() => onViewUpClose(country.iso2!)}
                      className="col-span-2 rounded-xl bg-amber-500 p-3 text-center font-bold text-white shadow-md transition-all hover:bg-amber-400 hover:shadow-lg active:bg-amber-600"
                    >
                      <span aria-hidden="true">🔍</span> View Up Close
                    </button>
                  )}
                </>
              )}
            </div>

            <div className="flex-1 space-y-6 px-6 py-6">
              {/* Quick facts */}
              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Quick Facts
                </h3>
                <dl className="space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm">
                  {country.capital && (
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-gray-600">Capital</dt>
                      <dd className="text-right font-semibold text-gray-900">{country.capital}</dd>
                    </div>
                  )}
                  {country.region && (
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-gray-600">Region</dt>
                      <dd className="text-right font-semibold text-gray-900">{country.region}</dd>
                    </div>
                  )}
                  {typeof country.population === 'number' && (
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-gray-600">Population</dt>
                      <dd className="text-right font-semibold text-gray-900">
                        {formatNumber(country.population)}
                        {country.populationYear && (
                          <span className="ml-1 text-xs font-normal text-gray-500">
                            ({country.populationYear})
                          </span>
                        )}
                      </dd>
                    </div>
                  )}
                  {typeof country.areaSqKm === 'number' && (
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-gray-600">Area</dt>
                      <dd className="text-right font-semibold text-gray-900">
                        {formatNumber(country.areaSqKm)} km²
                      </dd>
                    </div>
                  )}
                  {country.languages && country.languages.length > 0 && (
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-gray-600">Languages</dt>
                      <dd className="text-right font-semibold text-gray-900">
                        {country.languages.join(', ')}
                      </dd>
                    </div>
                  )}
                  {currency && (
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-gray-600">Currency</dt>
                      <dd className="text-right font-semibold text-gray-900">{currency}</dd>
                    </div>
                  )}
                </dl>
              </section>

              {/* Fun facts */}
              {country.funFacts && country.funFacts.length > 0 && (
                <section>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Fun Facts
                  </h3>
                  <ul className="space-y-2">
                    {country.funFacts.map((fact, i) => (
                      <li
                        key={i}
                        className="rounded-xl bg-indigo-50 px-4 py-2 text-sm text-gray-700 ring-1 ring-indigo-100"
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

              {/* Landmarks */}
              {country.landmarks && country.landmarks.length > 0 && (
                <section>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Famous Landmarks
                  </h3>
                  <ul className="space-y-3">
                    {country.landmarks.map((l) => (
                      <li
                        key={l.name}
                        className="flex gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm"
                      >
                        <div className="text-2xl leading-none" aria-hidden="true">
                          {landmarkEmoji(l.type)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-gray-900">{l.name}</div>
                          {l.description && (
                            <p className="mt-1 text-sm text-gray-700">{l.description}</p>
                          )}
                          {l.fact && (
                            <p className="mt-1 text-xs italic text-gray-500">{l.fact}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Physical features */}
              {country.physicalFeatures && country.physicalFeatures.length > 0 && (
                <section>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Land &amp; Water
                  </h3>
                  <ul className="space-y-3">
                    {country.physicalFeatures.map((f) => (
                      <li
                        key={f.name}
                        className="flex gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm"
                      >
                        <div className="text-2xl leading-none" aria-hidden="true">
                          {featureEmoji(f.type)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-gray-900">{f.name}</div>
                          {f.description && (
                            <p className="mt-1 text-sm text-gray-700">{f.description}</p>
                          )}
                          {f.fact && (
                            <p className="mt-1 text-xs italic text-gray-500">{f.fact}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {/* Footer */}
            <footer className="mt-auto border-t border-gray-100 bg-gray-50 px-6 py-4">
              <button
                onClick={onClose}
                className="w-full rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-sky-500 active:bg-sky-700"
              >
                ← Back to map
              </button>
            </footer>
          </div>
        )}
      </aside>
    </>
  );
}
