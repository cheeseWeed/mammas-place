// Phase W7 — World Physical Features Quiz.
//
// Three UI states (mirroring the US Phase 8 physical-quiz):
//   1. Picker   — mode toggle + continent filter + type bucket + round size.
//   2. In Round — WorldPhysicalQuizEngine renders mid-round.
//   3. Results  — score + missed features + replay.
//
// The picker shows live counts per (continent, bucket) combination so the kid
// can see what's available; combos with no pool (or that can't support Mode B
// decoys) are gated off.
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  WorldPhysicalQuizEngine,
  worldFlatPoolSize,
  worldModeBViable,
  WORLD_TOTAL_FEATURE_COUNT,
  type WorldPhysicalQuizMode,
  type WorldPhysicalTypeBucket,
  type WorldContinent,
} from '@/components/geography';
import { readPhase, updatePhase } from '@/lib/geography/progress';

type RoundSize = 5 | 10 | 20 | 'all';

type Result = {
  size: RoundSize;
  effectiveTotal: number;
  mode: WorldPhysicalQuizMode;
  continent: WorldContinent;
  bucket: WorldPhysicalTypeBucket;
  score: number;
  total: number;
  misses: string[]; // "Feature (Country)" strings from the engine
};

const MAX_STORED_MISSES = 50;

const CONTINENT_CHOICES: Array<{ value: WorldContinent; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'Africa', label: 'Africa' },
  { value: 'Asia', label: 'Asia' },
  { value: 'Europe', label: 'Europe' },
  { value: 'North America', label: 'N. America' },
  { value: 'Oceania', label: 'Oceania' },
  { value: 'South America', label: 'S. America' },
];

const TYPE_BUCKETS: Array<{ value: WorldPhysicalTypeBucket; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'mountains', label: 'Mountains' },
  { value: 'rivers', label: 'Rivers' },
  { value: 'lakes', label: 'Lakes' },
  { value: 'deserts', label: 'Deserts' },
  { value: 'islands', label: 'Islands' },
  { value: 'landmarks', label: 'Landmarks' },
  { value: 'other', label: 'Other' },
];

export default function WorldPhysicalQuizPage() {
  const [activeSize, setActiveSize] = useState<RoundSize | null>(null);
  const [activeMode, setActiveMode] = useState<WorldPhysicalQuizMode>('country');
  const [activeContinent, setActiveContinent] = useState<WorldContinent>('all');
  const [activeBucket, setActiveBucket] = useState<WorldPhysicalTypeBucket>('all');
  const [result, setResult] = useState<Result | null>(null);

  function startRound(size: RoundSize) {
    setResult(null);
    setActiveSize(size);
  }

  function handleComplete(roundResult: { score: number; total: number; misses: string[] }) {
    const size = activeSize ?? 10;
    const prev = readPhase('world-physical-quiz') ?? { attempts: 0, bestScore: 0, misses: [] };
    const newFraction = roundResult.total > 0 ? roundResult.score / roundResult.total : 0;
    const mergedMisses = Array.from(new Set([...prev.misses, ...roundResult.misses])).slice(
      0,
      MAX_STORED_MISSES,
    );
    updatePhase('world-physical-quiz', {
      attempts: prev.attempts + 1,
      bestScore: Math.max(prev.bestScore, newFraction),
      misses: mergedMisses,
    });

    setResult({
      size,
      effectiveTotal: roundResult.total,
      mode: activeMode,
      continent: activeContinent,
      bucket: activeBucket,
      score: roundResult.score,
      total: roundResult.total,
      misses: roundResult.misses,
    });
    setActiveSize(null);
  }

  const showOverlay = activeSize === null;
  const inRound = activeSize !== null;

  // Effective question count: pool may be smaller than the picked size for
  // narrow (continent × bucket) combos. Engine handles undersized pools too,
  // but we clamp here so the progress bar is honest.
  const effectiveCount = useMemo(() => {
    if (!inRound) return null;
    const poolSize = worldFlatPoolSize(activeContinent, activeBucket);
    if (activeSize === 'all') return poolSize;
    return Math.min(activeSize as number, poolSize);
  }, [inRound, activeSize, activeContinent, activeBucket]);

  return (
    <div className="w-full min-h-[calc(100vh-142px)] max-sm:min-h-[calc(100vh-218px)] flex flex-col bg-gradient-to-b from-sky-50 via-indigo-50 to-white relative">
      {/* IN-ROUND top strip */}
      {inRound && (
        <div className="shrink-0 bg-white/80 backdrop-blur-sm border-b border-sky-200 px-3 sm:px-4 py-2 flex items-center gap-x-4 gap-y-1 flex-wrap">
          <Link
            href="/geography"
            className="inline-flex items-center gap-1 text-sm font-semibold text-sky-700 hover:text-sky-500"
          >
            ← Geography
          </Link>
          <span className="text-xs font-bold uppercase tracking-wide text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
            {activeMode === 'country' ? 'Which country?' : 'Which feature?'}
          </span>
          {activeContinent !== 'all' && (
            <span className="text-xs font-bold uppercase tracking-wide text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full">
              {activeContinent}
            </span>
          )}
          {activeBucket !== 'all' && (
            <span className="text-xs font-bold uppercase tracking-wide text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full">
              {TYPE_BUCKETS.find((b) => b.value === activeBucket)?.label}
            </span>
          )}
        </div>
      )}

      {/* IN-ROUND: engine fills the rest */}
      {inRound && (
        <div className="flex-1 min-h-0">
          <WorldPhysicalQuizEngine
            // key forces a fresh round on every restart (state reset).
            key={`round-${activeSize}-${activeMode}-${activeContinent}-${activeBucket}-${Date.now()}`}
            questionCount={effectiveCount ?? 10}
            mode={activeMode}
            continent={activeContinent}
            typeBucket={activeBucket}
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
            <h2 className="text-base sm:text-lg font-black text-sky-900">
              World Features Quiz
            </h2>
          </div>

          {/* Overlay card */}
          <div className="flex-1 min-h-0 w-full flex items-center justify-center p-3 sm:p-4">
            <div className="w-full max-w-3xl">
              {result === null ? (
                <RoundPicker
                  mode={activeMode}
                  continent={activeContinent}
                  bucket={activeBucket}
                  onModeChange={setActiveMode}
                  onContinentChange={setActiveContinent}
                  onBucketChange={setActiveBucket}
                  onPick={startRound}
                />
              ) : (
                <ResultsCard
                  result={result}
                  onPlayAgain={() => startRound(result.size)}
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

function RoundPicker({
  mode,
  continent,
  bucket,
  onModeChange,
  onContinentChange,
  onBucketChange,
  onPick,
}: {
  mode: WorldPhysicalQuizMode;
  continent: WorldContinent;
  bucket: WorldPhysicalTypeBucket;
  onModeChange: (m: WorldPhysicalQuizMode) => void;
  onContinentChange: (c: WorldContinent) => void;
  onBucketChange: (b: WorldPhysicalTypeBucket) => void;
  onPick: (size: RoundSize) => void;
}) {
  const sizeChoices: Array<{ size: RoundSize; label: string; sub: string }> = [
    { size: 5, label: 'Quick 5', sub: 'Warm-up' },
    { size: 10, label: '10', sub: 'Classic' },
    { size: 20, label: '20', sub: 'Going strong' },
    { size: 'all', label: 'All', sub: 'Whole pool' },
  ];

  const pool = worldFlatPoolSize(continent, bucket);
  // Mode B viability depends on BOTH the continent and bucket — gate on it.
  const modeBOk = worldModeBViable(continent, bucket);
  const effectiveMode: WorldPhysicalQuizMode = mode === 'feature' && !modeBOk ? 'country' : mode;
  if (mode === 'feature' && !modeBOk && effectiveMode === 'country') {
    queueMicrotask(() => onModeChange('country'));
  }

  return (
    <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl border border-sky-100 p-4 md:p-5 max-h-[80vh] overflow-y-auto">
      <h2 className="text-lg md:text-xl font-black text-sky-900 text-center mb-3">
        Match features to countries
      </h2>
      <p className="text-xs text-center text-gray-500 mb-3">
        Pool: {WORLD_TOTAL_FEATURE_COUNT} features + landmarks across 195 countries.
      </p>

      {/* Mode toggle */}
      <div className="mb-3">
        <div className="text-[11px] uppercase tracking-wide text-gray-500 font-bold mb-1.5 text-center">
          Mode
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => onModeChange('country')}
            className={`rounded-lg p-2 text-center transition-all ${
              effectiveMode === 'country'
                ? 'bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-md'
                : 'bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200'
            }`}
          >
            <div className="text-xs md:text-sm font-black leading-tight">Which country?</div>
            <div
              className={`text-[10px] leading-tight ${
                effectiveMode === 'country' ? 'text-sky-50/90' : 'text-gray-500'
              }`}
            >
              Name the country that has the feature
            </div>
          </button>
          <button
            type="button"
            onClick={() => modeBOk && onModeChange('feature')}
            disabled={!modeBOk}
            className={`rounded-lg p-2 text-center transition-all ${
              effectiveMode === 'feature'
                ? 'bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-md'
                : modeBOk
                ? 'bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200'
                : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
            }`}
          >
            <div className="text-xs md:text-sm font-black leading-tight">Which feature?</div>
            <div
              className={`text-[10px] leading-tight ${
                effectiveMode === 'feature'
                  ? 'text-sky-50/90'
                  : modeBOk
                  ? 'text-gray-500'
                  : 'text-gray-400'
              }`}
            >
              {modeBOk ? 'Pick the right one for the country' : 'Needs more entries'}
            </div>
          </button>
        </div>
      </div>

      {/* Continent filter */}
      <div className="mb-3">
        <div className="text-[11px] uppercase tracking-wide text-gray-500 font-bold mb-1.5 text-center">
          Continent
        </div>
        <div className="grid grid-cols-4 md:grid-cols-7 gap-1.5">
          {CONTINENT_CHOICES.map((c) => {
            const active = c.value === continent;
            const count = worldFlatPoolSize(c.value, bucket);
            const disabled = count === 0;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => !disabled && onContinentChange(c.value)}
                disabled={disabled}
                className={`rounded-lg p-2 text-center transition-all ${
                  active
                    ? 'bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-md'
                    : disabled
                    ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                    : 'bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200'
                }`}
              >
                <div className="text-[11px] md:text-xs font-black leading-tight">{c.label}</div>
                <div
                  className={`text-[10px] leading-tight ${
                    active ? 'text-sky-50/90' : 'text-gray-500'
                  }`}
                >
                  {count}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Type filter */}
      <div className="mb-3">
        <div className="text-[11px] uppercase tracking-wide text-gray-500 font-bold mb-1.5 text-center">
          Type
        </div>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-1.5">
          {TYPE_BUCKETS.map((b) => {
            const active = b.value === bucket;
            const count = worldFlatPoolSize(continent, b.value);
            const disabled = count === 0;
            return (
              <button
                key={b.value}
                type="button"
                onClick={() => !disabled && onBucketChange(b.value)}
                disabled={disabled}
                className={`rounded-lg p-2 text-center transition-all ${
                  active
                    ? 'bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-md'
                    : disabled
                    ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                    : 'bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200'
                }`}
              >
                <div className="text-[11px] md:text-xs font-black leading-tight">{b.label}</div>
                <div
                  className={`text-[10px] leading-tight ${
                    active ? 'text-sky-50/90' : 'text-gray-500'
                  }`}
                >
                  {count}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Round size */}
      <div>
        <div className="text-[11px] uppercase tracking-wide text-gray-500 font-bold mb-1.5 text-center">
          How many questions?
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {sizeChoices.map((c) => {
            const effective = c.size === 'all' ? pool : Math.min(c.size, pool);
            return (
              <button
                key={c.size}
                type="button"
                onClick={() => onPick(c.size)}
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
  onPlayAgain,
  onBack,
}: {
  result: Result;
  onPlayAgain: () => void;
  onBack: () => void;
}) {
  const pct = result.total > 0 ? Math.round((result.score / result.total) * 100) : 0;
  const perfect = result.score === result.total;
  const headline = perfect
    ? `Perfect! ${result.score} of ${result.total}!`
    : `You got ${result.score} of ${result.total}!`;
  const cheer = perfect
    ? 'Every single one — world-class.'
    : pct >= 80
    ? 'Great round!'
    : pct >= 50
    ? 'Nice — keep practicing.'
    : 'Good try — practice makes perfect.';
  const modeLabel = result.mode === 'country' ? 'Which country?' : 'Which feature?';
  const continentLabel = result.continent === 'all' ? 'All continents' : result.continent;
  const bucketLabel = TYPE_BUCKETS.find((b) => b.value === result.bucket)?.label ?? 'All';

  return (
    <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl border border-sky-100 p-5 md:p-6 max-h-[80vh] overflow-y-auto">
      <div className="text-center mb-4">
        <div className="text-4xl md:text-5xl mb-2">{perfect ? '🏆' : '🎉'}</div>
        <h2 className="text-xl md:text-2xl font-black text-sky-900 mb-1">{headline}</h2>
        <p className="text-sm text-sky-700">
          {modeLabel} · {continentLabel} · {bucketLabel} · {cheer}
        </p>
      </div>

      {result.misses.length > 0 && (
        <div className="bg-sky-50 rounded-xl p-3 md:p-4 mb-4 border border-sky-100">
          <h3 className="text-xs font-bold text-sky-900 mb-2 uppercase tracking-wide">
            Features to review ({result.misses.length})
          </h3>
          <ul className="flex flex-wrap gap-1.5">
            {result.misses.map((label) => (
              <li
                key={label}
                className="inline-block bg-white border border-sky-200 text-sky-800 text-xs md:text-sm font-medium px-2.5 py-0.5 rounded-full"
              >
                {label}
              </li>
            ))}
          </ul>
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
