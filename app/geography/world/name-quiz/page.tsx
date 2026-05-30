// Phase W2 — Name the Country quiz.
//
// Three UI states:
//   1. Picker      — round size + continent filter.
//   2. In Progress — WorldQuizEngine renders mid-round.
//   3. Results     — score + missed countries + replay.
//
// Same engine pattern as the US name-quiz, but uses WorldQuizEngine which
// fires ISO-3 codes through WorldMap. Pool is filtered by continent rather
// than US region.
'use client';

import { useState } from 'react';
import Link from 'next/link';
import countriesData from '@/data/countries.json';
import { WorldQuizEngine, WorldMap, defaultContinentTints } from '@/components/geography';
import type { WorldQuizContinent } from '@/components/geography/WorldQuizEngine';
import { readPhase, updatePhase } from '@/lib/geography/progress';
import { newIdempotencyKey, submitEarn } from '@/lib/money/earn-client';
import { useLearner } from '@/context/LearnerContext';

type RoundSize = 5 | 10 | 20 | 50 | 195;

type Result = {
  size: RoundSize;
  continent: WorldQuizContinent;
  score: number;
  total: number;
  misses: string[];  // ISO-3 codes
};

type CountryRecord = {
  iso2: string;
  iso3: string;
  name: string;
  continent: string;
};
const COUNTRIES = countriesData as CountryRecord[];
const PLAYABLE = COUNTRIES.filter((c) => c.continent !== 'Antarctica');

const MAX_STORED_MISSES = 50;

function nameForIso3(iso3: string): string {
  return COUNTRIES.find((c) => c.iso3 === iso3)?.name ?? iso3;
}

function poolSize(continent: WorldQuizContinent): number {
  if (!continent) return PLAYABLE.length;
  return PLAYABLE.filter((c) => c.continent === continent).length;
}

export default function WorldNameQuizPage() {
  const [activeSize, setActiveSize] = useState<RoundSize | null>(null);
  const [activeContinent, setActiveContinent] = useState<WorldQuizContinent>(null);
  const [result, setResult] = useState<Result | null>(null);
  // MP earned message for the most recent finished round.
  const [earnNote, setEarnNote] = useState<string | null>(null);
  const { learner, refresh: refreshBalance } = useLearner();

  function startRound(size: RoundSize, continent: WorldQuizContinent) {
    setResult(null);
    setActiveContinent(continent);
    setActiveSize(size);
    setEarnNote(null);
  }

  function handleComplete(roundResult: { score: number; total: number; misses: string[] }) {
    const size = activeSize ?? (roundResult.total as RoundSize);
    const prev = readPhase('world-name-quiz') ?? { attempts: 0, bestScore: 0, misses: [] };
    const newFraction = roundResult.total > 0 ? roundResult.score / roundResult.total : 0;
    const mergedMisses = Array.from(new Set([...prev.misses, ...roundResult.misses])).slice(
      0,
      MAX_STORED_MISSES,
    );
    updatePhase('world-name-quiz', {
      attempts: prev.attempts + 1,
      bestScore: Math.max(prev.bestScore, newFraction),
      misses: mergedMisses,
    });

    setResult({
      size,
      continent: activeContinent,
      score: roundResult.score,
      total: roundResult.total,
      misses: roundResult.misses,
    });
    setActiveSize(null);

    // MP earn — only for logged-in learners. Server decides cents.
    if (learner) {
      const key = newIdempotencyKey('geo-world-name-quiz');
      void submitEarn(
        'geography',
        'quiz',
        { correct: roundResult.score, total: roundResult.total, quiz: 'world-name-quiz' },
        key,
      ).then((res) => {
        if ('error' in res) {
          setEarnNote(`MP didn't record: ${res.error}`);
          return;
        }
        if (res.centsEarned > 0) {
          setEarnNote(`+${(res.centsEarned / 100).toFixed(2)}MP earned — ${res.reason}`);
          void refreshBalance();
        } else {
          setEarnNote(res.reason || 'No MP this round.');
        }
      });
    }
  }

  const showOverlay = activeSize === null;
  const inRound = activeSize !== null;

  const effectiveCount = inRound
    ? Math.min(activeSize!, poolSize(activeContinent))
    : null;

  return (
    <div className="w-full h-[calc(100vh-142px)] max-sm:h-[calc(100vh-218px)] flex flex-col bg-gradient-to-b from-sky-50 via-indigo-50 to-white relative">
      {/* IN-ROUND top strip */}
      {inRound && (
        <div className="shrink-0 bg-white/80 backdrop-blur-sm border-b border-sky-200 px-3 sm:px-4 py-2 flex items-center gap-x-4 gap-y-1 flex-wrap">
          <Link
            href="/geography"
            className="inline-flex items-center gap-1 text-sm font-semibold text-sky-700 hover:text-sky-500"
          >
            ← Geography
          </Link>
          {activeContinent && (
            <span className="text-xs font-bold uppercase tracking-wide text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
              {activeContinent}
            </span>
          )}
        </div>
      )}

      {/* IN-ROUND: engine fills the rest */}
      {inRound && (
        <div className="flex-1 min-h-0">
          <WorldQuizEngine
            key={`round-${activeSize}-${activeContinent}-${Date.now()}`}
            questionCount={effectiveCount!}
            continent={activeContinent}
            mode="name"
            onComplete={handleComplete}
          />
        </div>
      )}

      {/* PICKER / RESULTS overlay */}
      {showOverlay && (
        <>
          {/* Top bar (picker mode) */}
          <div className="shrink-0 bg-white/70 backdrop-blur-sm border-b border-sky-100 px-3 sm:px-4 py-2 flex items-center gap-x-4 flex-wrap">
            <Link
              href="/geography"
              className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-sky-700 hover:text-sky-500"
            >
              ← Geography
            </Link>
            <h2 className="text-base sm:text-lg font-black text-sky-900">Name the Country</h2>
          </div>

          {/* Dimmed map preview */}
          <div className="flex-1 min-h-0 w-full px-1 sm:px-2 py-1 pointer-events-none opacity-40" aria-hidden>
            <WorldMap continentTints={defaultContinentTints()} />
          </div>

          {/* Overlay card */}
          <div className="absolute inset-0 top-[48px] flex items-center justify-center p-3 sm:p-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-3xl">
              {result === null ? (
                <RoundPicker onPick={startRound} />
              ) : (
                <ResultsCard
                  result={result}
                  earnNote={earnNote}
                  onPlayAgain={() => startRound(result.size, result.continent)}
                  onBack={() => setResult(null)}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ----- Picker -----

const CONTINENTS: Array<{ value: WorldQuizContinent; label: string; desc: string }> = [
  { value: null, label: 'All', desc: 'Whole world' },
  { value: 'Africa', label: 'Africa', desc: `${PLAYABLE.filter((c) => c.continent === 'Africa').length} countries` },
  { value: 'Asia', label: 'Asia', desc: `${PLAYABLE.filter((c) => c.continent === 'Asia').length} countries` },
  { value: 'Europe', label: 'Europe', desc: `${PLAYABLE.filter((c) => c.continent === 'Europe').length} countries` },
  { value: 'North America', label: 'N. America', desc: `${PLAYABLE.filter((c) => c.continent === 'North America').length} countries` },
  { value: 'South America', label: 'S. America', desc: `${PLAYABLE.filter((c) => c.continent === 'South America').length} countries` },
  { value: 'Oceania', label: 'Oceania', desc: `${PLAYABLE.filter((c) => c.continent === 'Oceania').length} countries` },
];

function RoundPicker({ onPick }: { onPick: (size: RoundSize, continent: WorldQuizContinent) => void }) {
  const [continent, setContinent] = useState<WorldQuizContinent>(null);
  const sizeChoices: Array<{ size: RoundSize; label: string; sub: string }> = [
    { size: 5, label: 'Quick 5', sub: 'Warm-up' },
    { size: 10, label: '10', sub: 'Classic' },
    { size: 20, label: '20', sub: 'Going strong' },
    { size: 195, label: 'All', sub: 'Full pool' },
  ];

  const pool = poolSize(continent);

  return (
    <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl border border-sky-100 p-4 md:p-5">
      <h2 className="text-lg md:text-xl font-black text-sky-900 text-center mb-3">
        Pick a continent, then a round size
      </h2>

      <div className="mb-3">
        <div className="text-[11px] uppercase tracking-wide text-gray-500 font-bold mb-1.5 text-center">
          Continent
        </div>
        <div className="grid grid-cols-3 md:grid-cols-7 gap-1.5">
          {CONTINENTS.map((c) => {
            const active = c.value === continent;
            return (
              <button
                key={c.label}
                type="button"
                onClick={() => setContinent(c.value)}
                className={`rounded-lg p-2 text-center transition-all ${
                  active
                    ? 'bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-md'
                    : 'bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200'
                }`}
              >
                <div className="text-xs md:text-sm font-black leading-tight">{c.label}</div>
                <div className={`text-[10px] leading-tight ${active ? 'text-sky-50/90' : 'text-gray-500'}`}>
                  {c.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-wide text-gray-500 font-bold mb-1.5 text-center">
          How many countries?
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {sizeChoices.map((c) => {
            const effective = Math.min(c.size, pool);
            return (
              <button
                key={c.size}
                type="button"
                onClick={() => onPick(c.size, continent)}
                className="bg-gradient-to-br from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white rounded-xl p-2 md:p-3 shadow-md hover:shadow-lg transition-all"
              >
                <div className="text-xl md:text-2xl font-black leading-tight">{c.label}</div>
                <div className="text-[10px] text-sky-50/90 leading-tight">
                  {effective} q&apos;s · {c.sub}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ----- Results -----

function ResultsCard({
  result,
  earnNote,
  onPlayAgain,
  onBack,
}: {
  result: Result;
  earnNote: string | null;
  onPlayAgain: () => void;
  onBack: () => void;
}) {
  const pct = result.total > 0 ? Math.round((result.score / result.total) * 100) : 0;
  const perfect = result.score === result.total;
  const headline = perfect
    ? `Perfect! ${result.score} of ${result.total}!`
    : `You got ${result.score} of ${result.total}!`;
  const cheer = perfect
    ? 'Every single country — incredible.'
    : pct >= 80 ? 'Great round!'
    : pct >= 50 ? 'Nice — keep practicing.'
    : 'Good try — practice makes perfect.';

  return (
    <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl border border-sky-100 p-5 md:p-6 max-h-[80vh] overflow-y-auto">
      <div className="text-center mb-4">
        <div className="text-4xl md:text-5xl mb-2">{perfect ? '🏆' : '🎉'}</div>
        <h2 className="text-xl md:text-2xl font-black text-sky-900 mb-1">{headline}</h2>
        <p className="text-sm text-sky-700">
          {result.continent ? `${result.continent} round · ` : ''}{cheer}
        </p>
      </div>

      {earnNote && (
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-3 mb-4 text-center text-sm font-bold text-yellow-900">
          💰 {earnNote}
        </div>
      )}

      {result.misses.length > 0 && (
        <div className="bg-sky-50 rounded-xl p-3 md:p-4 mb-4 border border-sky-100">
          <h3 className="text-xs font-bold text-sky-900 mb-2 uppercase tracking-wide">
            Countries to review ({result.misses.length})
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {result.misses.map((iso3) => (
              <span
                key={iso3}
                className="inline-block bg-white border border-sky-200 text-sky-800 text-xs md:text-sm font-medium px-2.5 py-0.5 rounded-full"
              >
                {nameForIso3(iso3)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        <button
          type="button"
          onClick={onPlayAgain}
          className="bg-gradient-to-br from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold px-4 py-2 rounded-full shadow-md hover:shadow-lg transition-all text-sm"
        >
          Play Again
        </button>
        <button
          type="button"
          onClick={onBack}
          className="bg-white border-2 border-sky-200 hover:border-sky-400 text-sky-800 font-bold px-4 py-2 rounded-full transition-colors text-sm"
        >
          Pick again
        </button>
        <Link
          href="/geography"
          className="inline-flex items-center justify-center bg-white border-2 border-sky-200 hover:border-sky-400 text-sky-800 font-bold px-4 py-2 rounded-full transition-colors text-sm"
        >
          ← Back to Geography
        </Link>
      </div>
    </div>
  );
}
