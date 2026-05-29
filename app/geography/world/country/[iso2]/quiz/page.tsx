// Per-country multiple-choice quiz page (sibling to the Country Deep-Dive at
// /geography/world/country/[iso2]). Kid picks which categories of facts to be
// quizzed on, then takes a multiple-choice quiz. All wrong answers come from
// other countries' real data (not made up) so the kid learns by elimination.
//
// Server component: it handles SEO, static params, lookup, and 404 — then
// hands the entire country record (and the "others" pool) to the
// <CountryQuiz> client component, which owns the picker/in-quiz/results
// state machine.
//
// URL: /geography/world/country/<lowercase iso2>/quiz

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import countriesData from '@/data/countries.json';
import CountryQuiz from '@/components/geography/CountryQuiz';
import type { CountryRecord } from '@/components/geography/CountryQuiz';

const COUNTRIES = countriesData as CountryRecord[];

function findCountry(iso2Param: string): CountryRecord | undefined {
  const iso2 = iso2Param.toUpperCase();
  return COUNTRIES.find((c) => c.iso2 === iso2);
}

// One static page per country at build time (lowercase iso2 in the URL).
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
    return { title: 'Country quiz not found — Geography Explorer' };
  }
  return {
    title: `Quiz: ${country.name} — Geography Explorer`,
    description: `Pick the categories you want to be quizzed on and test what you know about ${country.name}.`,
  };
}

export default async function CountryQuizPage({
  params,
}: {
  params: Promise<{ iso2: string }>;
}) {
  const { iso2 } = await params;
  const country = findCountry(iso2);
  if (!country) notFound();

  // Hand the client component both the target country and the others pool so
  // it can draw wrong-answer decoys from real data. countries.json is ~195
  // records, comparable to states; shipping it once is fine.
  const others = COUNTRIES.filter((c) => c.iso2 !== country.iso2);
  return <CountryQuiz country={country} others={others} />;
}
