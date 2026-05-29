// Phase W6 — Country Deep-Dive (full-page deep link).
//
// Server component. Statically generates one page per country (~195) at
// build time, keyed by lowercase ISO-2 alpha code. Mirrors the US State
// Deep-Dive (app/geography/state/[postal]/page.tsx) but reads country data
// from data/countries.json and uses the World section's sky/indigo palette.
//
// URL shape: /geography/world/country/jp (lowercase ISO-2). We upper-case at
// lookup time. Anything not in countries.json triggers notFound().

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import countriesData from '@/data/countries.json';

type Landmark = {
  name: string;
  type?: string;
  description?: string;
  fact?: string;
};

type PhysicalFeature = {
  name: string;
  type?: string;
  description?: string;
  fact?: string;
};

type CountryRecord = {
  iso2: string;
  iso3: string;
  name: string;
  capital: string;
  continent: string;
  region?: string;
  population?: number;
  populationYear?: number;
  areaSqKm?: number;
  languages?: string[];
  currency?: string;
  currencyCode?: string;
  drivingSide?: string;
  callingCode?: string;
  funFacts?: string[];
  landmarks?: Landmark[];
  physicalFeatures?: PhysicalFeature[];
};

const COUNTRIES = countriesData as CountryRecord[];

function findCountry(iso2Param: string): CountryRecord | undefined {
  const iso2 = iso2Param.toUpperCase();
  return COUNTRIES.find((c) => c.iso2 === iso2);
}

// Build a static page for every country iso2 at compile time. The URL
// segment is lowercase; the JSON is uppercase — we lowercase on the way out.
export async function generateStaticParams() {
  return COUNTRIES.map((c) => ({ iso2: c.iso2.toLowerCase() }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ iso2: string }>;
}): Promise<Metadata> {
  const { iso2 } = await params;
  const country = findCountry(iso2);
  if (!country) {
    return {
      title: 'Country not found — Geography Explorer',
    };
  }
  const continentPart = country.continent ? ` — ${country.continent}` : '';
  return {
    title: `${country.name} — Geography Explorer`,
    description: `${country.name}${continentPart}. Capital: ${country.capital}. Explore landmarks, physical features, languages, and fun facts.`,
  };
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-2xl border border-sky-100 shadow-sm p-5 sm:p-6">
      <h2 className="text-xl sm:text-2xl font-black text-sky-900 mb-4">{title}</h2>
      {children}
    </section>
  );
}

function FactRow({ label, value }: { label: string; value: string | number | undefined }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-sm font-semibold text-sky-700 min-w-[7.5rem]">{label}</span>
      <span className="text-sm sm:text-base text-gray-800">{value}</span>
    </div>
  );
}

export default async function CountryDeepDivePage({
  params,
}: {
  params: Promise<{ iso2: string }>;
}) {
  const { iso2 } = await params;
  const country = findCountry(iso2);
  if (!country) notFound();

  const flagPath = `/geography/world/flags/${country.iso2.toLowerCase()}.svg`;

  // World "Study Map" is the equivalent of the US "Study Map" — back link
  // points there. (Future: ?focus= hook to auto-open the drawer.)
  const studyHref = `/geography/world/study?focus=${country.iso2}`;

  const populationDisplay =
    country.population !== undefined
      ? `${country.population.toLocaleString()}${country.populationYear ? ` (${country.populationYear})` : ''}`
      : undefined;
  const areaDisplay =
    country.areaSqKm !== undefined ? `${country.areaSqKm.toLocaleString()} km²` : undefined;
  const currencyDisplay = (() => {
    if (country.currency && country.currencyCode) return `${country.currency} (${country.currencyCode})`;
    return country.currency ?? country.currencyCode;
  })();
  const languagesDisplay = country.languages?.length ? country.languages.join(', ') : undefined;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-indigo-50 to-white py-8 sm:py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb / back links */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-6 text-sm">
          <Link
            href="/geography"
            className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:text-sky-500 transition-colors"
          >
            ← Geography
          </Link>
          <span className="text-gray-300">/</span>
          <Link
            href={studyHref}
            className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:text-sky-500 transition-colors"
          >
            World Map
          </Link>
          <span className="text-gray-300">/</span>
          <span className="font-semibold text-gray-700">{country.name}</span>
        </div>

        {/* Header card */}
        <header className="bg-gradient-to-br from-sky-600 to-indigo-600 text-white rounded-2xl shadow-md p-6 sm:p-8 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
                <h1 className="text-3xl sm:text-4xl font-black">{country.name}</h1>
                <span className="text-sm sm:text-base font-bold bg-white/20 px-3 py-1 rounded-full">
                  {country.iso2}
                </span>
              </div>
              {country.continent && (
                <p className="text-sky-50 text-lg sm:text-xl font-semibold italic">
                  {country.continent}
                </p>
              )}
            </div>
            <div className="shrink-0 self-center sm:self-start">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={flagPath}
                alt={`Flag of ${country.name}`}
                className="w-32 sm:w-40 h-auto rounded-md shadow-lg ring-2 ring-white/40 bg-white"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm sm:text-base">
            {country.capital && (
              <div>
                <span className="font-semibold text-sky-100">Capital:</span>{' '}
                <span className="font-medium">{country.capital}</span>
              </div>
            )}
            {country.region && (
              <div>
                <span className="font-semibold text-sky-100">Region:</span>{' '}
                <span className="font-medium">{country.region}</span>
              </div>
            )}
            {populationDisplay && (
              <div>
                <span className="font-semibold text-sky-100">Population:</span>{' '}
                <span className="font-medium">{populationDisplay}</span>
              </div>
            )}
            {areaDisplay && (
              <div>
                <span className="font-semibold text-sky-100">Area:</span>{' '}
                <span className="font-medium">{areaDisplay}</span>
              </div>
            )}
          </div>
        </header>

        {/* Content sections */}
        <div className="space-y-5">
          {/* Quick facts */}
          <SectionCard title="Quick Facts">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4">
              <FactRow label="Capital" value={country.capital} />
              <FactRow label="Continent" value={country.continent} />
              <FactRow label="Region" value={country.region} />
              <FactRow label="Population" value={populationDisplay} />
              <FactRow label="Area" value={areaDisplay} />
              <FactRow label="Languages" value={languagesDisplay} />
              <FactRow label="Currency" value={currencyDisplay} />
              <FactRow label="Driving side" value={country.drivingSide} />
              <FactRow label="Calling code" value={country.callingCode} />
            </div>
          </SectionCard>

          {/* Fun facts */}
          {country.funFacts && country.funFacts.length > 0 && (
            <SectionCard title="Fun Facts">
              <ul className="space-y-2 list-none">
                {country.funFacts.map((fact, i) => (
                  <li key={i} className="flex gap-2 text-sm sm:text-base text-gray-800">
                    <span className="text-sky-600 font-bold mt-0.5">•</span>
                    <span>{fact}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {/* Landmarks */}
          {country.landmarks && country.landmarks.length > 0 && (
            <SectionCard title="Famous Landmarks">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {country.landmarks.map((landmark) => (
                  <div
                    key={landmark.name}
                    className="bg-indigo-50/60 rounded-xl p-3 border border-indigo-100"
                  >
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <h3 className="font-bold text-sky-900">{landmark.name}</h3>
                      {landmark.type && (
                        <span className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                          {landmark.type}
                        </span>
                      )}
                    </div>
                    {landmark.description && (
                      <p className="text-sm text-gray-800">{landmark.description}</p>
                    )}
                    {landmark.fact && (
                      <p className="mt-1 text-sm text-sky-700 italic">{landmark.fact}</p>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Physical features */}
          {country.physicalFeatures && country.physicalFeatures.length > 0 && (
            <SectionCard title="Physical Features">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {country.physicalFeatures.map((feature) => (
                  <div
                    key={feature.name}
                    className="bg-sky-50/60 rounded-xl p-3 border border-sky-100"
                  >
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <h3 className="font-bold text-sky-900">{feature.name}</h3>
                      {feature.type && (
                        <span className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                          {feature.type}
                        </span>
                      )}
                    </div>
                    {feature.description && (
                      <p className="text-sm text-gray-800">{feature.description}</p>
                    )}
                    {feature.fact && (
                      <p className="mt-1 text-sm text-sky-700 italic">{feature.fact}</p>
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
            className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700 hover:text-sky-500 transition-colors"
          >
            ← Back to the World Map
          </Link>
        </div>
      </div>
    </div>
  );
}
