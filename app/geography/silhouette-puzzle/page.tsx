// Phase 5 — Silhouette Puzzle.
//
// Three UI states:
//   1. Picker         — round size + region.
//   2. In Progress    — SilhouetteEngine renders mid-round.
//   3. Results        — score + states-to-review + replay.
//
// Mirrors the structure of /geography/name-quiz so the kid encounters the
// same picker/results shell across phases.
'use client';

import { useState } from 'react';
import Link from 'next/link';
import statesData from '@/data/states.json';
import { SilhouetteEngine } from '@/components/geography';
import { readPhase, updatePhase } from '@/lib/geography/progress';
import { newIdempotencyKey, submitEarn } from '@/lib/money/earn-client';
import { useLearner } from '@/context/LearnerContext';

type RoundSize = 5 | 10 | 20 | 50;
type Region = null | 'Northeast' | 'Midwest' | 'South' | 'West';

type Result = {
  size: RoundSize;
  region: Region;
  score: number;
  total: number;
  misses: string[];
};

type StateRecord = { postal: string; name: string; region?: string };
const STATES = statesData as StateRecord[];

const MAX_STORED_MISSES = 50;

function nameForPostal(postal: string): string {
  return STATES.find((s) => s.postal === postal)?.name ?? postal;
}

function poolSize(region: Region): number {
  if (!region) return 50;
  return STATES.filter((s) => s.postal !== 'DC' && s.region === region).length;
}

export default function SilhouettePuzzlePage() {
  const [activeSize, setActiveSize] = useState<RoundSize | null>(null);
  const [activeRegion, setActiveRegion] = useState<Region>(null);
  const [result, setResult] = useState<Result | null>(null);
  // MP earned message for the most recent finished round.
  const [earnNote, setEarnNote] = useState<string | null>(null);
  const { learner, refresh: refreshBalance } = useLearner();

  function startRound(size: RoundSize, region: Region) {
    setResult(null);
    setActiveRegion(region);
    setActiveSize(size);
    setEarnNote(null);
  }

  function handleComplete(roundResult: { score: number; total: number; misses: string[] }) {
    const size = activeSize ?? (roundResult.total as RoundSize);
    const prev = readPhase('silhouette-puzzle') ?? { attempts: 0, bestScore: 0, misses: [] };
    const newFraction = roundResult.total > 0 ? roundResult.score / roundResult.total : 0;
    const mergedMisses = Array.from(new Set([...prev.misses, ...roundResult.misses])).slice(
      0,
      MAX_STORED_MISSES,
    );
    updatePhase('silhouette-puzzle', {
      attempts: prev.attempts + 1,
      bestScore: Math.max(prev.bestScore, newFraction),
      misses: mergedMisses,
    });

    setResult({
      size,
      region: activeRegion,
      score: roundResult.score,
      total: roundResult.total,
      misses: roundResult.misses,
    });
    setActiveSize(null);

    // MP earn — only for logged-in learners. Server decides cents.
    if (learner) {
      const key = newIdempotencyKey('geo-silhouette-puzzle');
      void submitEarn(
        'geography',
        'quiz',
        { correct: roundResult.score, total: roundResult.total, quiz: 'silhouette-puzzle' },
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
    ? Math.min(activeSize!, poolSize(activeRegion))
    : null;

  return (
    <div className="w-full h-[calc(100vh-142px)] max-sm:h-[calc(100vh-218px)] flex flex-col bg-gradient-to-b from-emerald-50 via-sky-50 to-white relative">
      {/* IN-ROUND top strip: back link only — engine owns its own prompt area */}
      {inRound && (
        <div className="shrink-0 bg-white/80 backdrop-blur-sm border-b border-emerald-200 px-3 sm:px-4 py-2 flex items-center gap-x-4 flex-wrap">
          <Link
            href="/geography"
            className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-500"
          >
            ← Geography
          </Link>
          {activeRegion && (
            <span className="text-xs font-bold uppercase tracking-wide text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
              {activeRegion}
            </span>
          )}
        </div>
      )}

      {inRound && (
        <div className="flex-1 min-h-0">
          <SilhouetteEngine
            key={`round-${activeSize}-${activeRegion}-${Date.now()}`}
            questionCount={effectiveCount as number}
            region={activeRegion}
            onComplete={handleComplete}
          />
        </div>
      )}

      {showOverlay && (
        <>
          <div className="shrink-0 bg-white/70 backdrop-blur-sm border-b border-emerald-100 px-3 sm:px-4 py-2 flex items-center gap-x-4 flex-wrap">
            <Link
              href="/geography"
              className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-emerald-700 hover:text-emerald-500"
            >
              ← Geography
            </Link>
            <h2 className="text-base sm:text-lg font-black text-emerald-900">Silhouette Puzzle</h2>
          </div>

          {/* Picker / Results overlay */}
          <div className="absolute inset-0 top-[48px] flex items-center justify-center p-3 sm:p-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-3xl">
              {result === null ? (
                <RoundPicker onPick={startRound} />
              ) : (
                <ResultsCard
                  result={result}
                  earnNote={earnNote}
                  onPlayAgain={() => startRound(result.size, result.region)}
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

const REGIONS: Array<{ value: Region; label: string; desc: string }> = [
  { value: null, label: 'All 50', desc: 'Whole country' },
  { value: 'Northeast', label: 'Northeast', desc: '9 states' },
  { value: 'Midwest', label: 'Midwest', desc: '12 states' },
  { value: 'South', label: 'South', desc: '16 states' },
  { value: 'West', label: 'West', desc: '13 states' },
];

function RoundPicker({ onPick }: { onPick: (size: RoundSize, region: Region) => void }) {
  const [region, setRegion] = useState<Region>(null);
  const sizeChoices: Array<{ size: RoundSize; label: string; sub: string }> = [
    { size: 5, label: 'Quick 5', sub: 'Warm-up' },
    { size: 10, label: '10', sub: 'Classic' },
    { size: 20, label: '20', sub: 'Going strong' },
    { size: 50, label: 'All', sub: 'Full pool' },
  ];

  const pool = poolSize(region);

  return (
    <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl border border-emerald-100 p-4 md:p-5">
      <h2 className="text-lg md:text-xl font-black text-emerald-900 text-center mb-1">
        Silhouette Puzzle
      </h2>
      <p className="text-center text-xs md:text-sm text-emerald-700 mb-3">
        Drag each state shape onto its spot on the map.
      </p>

      <div className="mb-3">
        <div className="text-[11px] uppercase tracking-wide text-gray-500 font-bold mb-1.5 text-center">
          Region
        </div>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-1.5">
          {REGIONS.map((r) => {
            const active = r.value === region;
            return (
              <button
                key={r.label}
                type="button"
                onClick={() => setRegion(r.value)}
                className={`rounded-lg p-2 text-center transition-all ${
                  active
                    ? 'bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-md'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}
              >
                <div className="text-xs md:text-sm font-black leading-tight">{r.label}</div>
                <div className={`text-[10px] leading-tight ${active ? 'text-emerald-50/90' : 'text-gray-500'}`}>
                  {r.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-wide text-gray-500 font-bold mb-1.5 text-center">
          How many shapes?
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {sizeChoices.map((c) => {
            const effective = Math.min(c.size, pool);
            return (
              <button
                key={c.size}
                type="button"
                onClick={() => onPick(c.size, region)}
                className="bg-gradient-to-br from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white rounded-xl p-2 md:p-3 shadow-md hover:shadow-lg transition-all"
              >
                <div className="text-xl md:text-2xl font-black leading-tight">{c.label}</div>
                <div className="text-[10px] text-emerald-50/90 leading-tight">
                  {effective} shape{effective === 1 ? '' : 's'} · {c.sub}
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
    : `You got ${result.score} of ${result.total} on the first try!`;
  const cheer = perfect
    ? 'Every shape, first try — pure puzzle power.'
    : pct >= 80 ? 'Great round!'
    : pct >= 50 ? 'Nice — keep practicing.'
    : 'Good try — these shapes take repetition.';

  return (
    <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl border border-emerald-100 p-5 md:p-6 max-h-[80vh] overflow-y-auto">
      <div className="text-center mb-4">
        <div className="text-4xl md:text-5xl mb-2">{perfect ? '🏆' : '🧩'}</div>
        <h2 className="text-xl md:text-2xl font-black text-emerald-900 mb-1">{headline}</h2>
        <p className="text-sm text-emerald-700">
          {result.region ? `${result.region} round · ` : ''}{cheer}
        </p>
      </div>

      {earnNote && (
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-3 mb-4 text-center text-sm font-bold text-yellow-900">
          💰 {earnNote}
        </div>
      )}

      {result.misses.length > 0 && (
        <div className="bg-emerald-50 rounded-xl p-3 md:p-4 mb-4 border border-emerald-100">
          <h3 className="text-xs font-bold text-emerald-900 mb-2 uppercase tracking-wide">
            Shapes to practice ({result.misses.length})
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {result.misses.map((postal) => (
              <span
                key={postal}
                className="inline-block bg-white border border-emerald-200 text-emerald-800 text-xs md:text-sm font-medium px-2.5 py-0.5 rounded-full"
              >
                {nameForPostal(postal)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        <button
          type="button"
          onClick={onPlayAgain}
          className="bg-gradient-to-br from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-bold px-4 py-2 rounded-full shadow-md hover:shadow-lg transition-all text-sm"
        >
          Play Again
        </button>
        <button
          type="button"
          onClick={onBack}
          className="bg-white border-2 border-emerald-200 hover:border-emerald-400 text-emerald-800 font-bold px-4 py-2 rounded-full transition-colors text-sm"
        >
          Pick again
        </button>
        <Link
          href="/geography"
          className="inline-flex items-center justify-center bg-white border-2 border-emerald-200 hover:border-emerald-400 text-emerald-800 font-bold px-4 py-2 rounded-full transition-colors text-sm"
        >
          ← Back to Geography
        </Link>
      </div>
    </div>
  );
}
