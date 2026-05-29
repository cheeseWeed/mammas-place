// Per-state multiple-choice quiz page (sibling to the state Deep-Dive at
// /geography/state/[postal]). Kid picks which categories of facts to be
// quizzed on, then takes a multiple-choice quiz. All wrong answers come from
// other states' real data (not made up) so the kid learns by elimination.
//
// Server component: it handles SEO, static params, lookup, and 404 — then
// hands the entire state record to the <StateQuiz> client component, which
// owns the picker/in-quiz/results state machine.
//
// URL: /geography/state/<lowercase postal>/quiz

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import statesData from '@/data/states.json';
import StateQuiz from '@/components/geography/StateQuiz';
import type { StateRecord } from '@/components/geography/StateQuiz';

const STATES = statesData as StateRecord[];

function findState(postalParam: string): StateRecord | undefined {
  const postal = postalParam.toUpperCase();
  return STATES.find((s) => s.postal === postal);
}

// One static page per state at build time (lowercase postal in the URL).
export async function generateStaticParams() {
  return STATES.map((s) => ({ postal: s.postal.toLowerCase() }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ postal: string }>;
}): Promise<Metadata> {
  const { postal } = await params;
  const state = findState(postal);
  if (!state) {
    return { title: 'State quiz not found — Geography Explorer' };
  }
  return {
    title: `${state.name} Quiz — Geography Explorer`,
    description: `Pick the categories you want to be quizzed on and test what you know about ${state.name}.`,
  };
}

export default async function StateQuizPage({
  params,
}: {
  params: Promise<{ postal: string }>;
}) {
  const { postal } = await params;
  const state = findState(postal);
  if (!state) notFound();

  // We hand the client component BOTH the target state and the full state
  // table so it can pull wrong-answer decoys from real data for any field.
  // The JSON is small enough (51 records) that shipping it once is fine.
  return <StateQuiz state={state} allStates={STATES} />;
}
