// Phase 8 — Physical Features Quiz.
//
// Three UI states:
//   1. Picker   — mode toggle (state ↔ feature) + type filter + round size.
//   2. In Round — PhysicalQuizEngine renders mid-round.
//   3. Results  — score + missed features + replay.
//
// The picker shows live counts per type bucket so the kid can see what's
// available and the page can disable Mode B for buckets too thin for decoys.
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  PhysicalQuizEngine,
  USMap,
} from '@/components/geography';
import {
  flatPoolSize,
  modeBViable,
  TOTAL_FEATURE_COUNT,
  type PhysicalQuizMode,
  type PhysicalTypeBucket,
} from '@/components/geography/PhysicalQuizEngine';
import { readPhase, updatePhase } from '@/lib/geography/progress';

type RoundSize = 5 | 10 | 20;

type Result = {
  size: RoundSize;
  mode: PhysicalQuizMode;
  bucket: PhysicalTypeBucket;
  score: number;
  total: number;
  misses: string[]; // "Feature (State)" strings from the engine
};

const MAX_STORED_MISSES = 50;

const TYPE_BUCKETS: Array<{ value: PhysicalTypeBucket; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'rivers', label: 'Rivers' },
  { value: 'lakes', label: 'Lakes' },
  { value: 'mountains', label: 'Mountains' },
  { value: 'landmarks', label: 'Landmarks' },
  { value: 'other', label: 'Other' },
];

export default function PhysicalQuizPage() {
  const [activeSize, setActiveSize] = useState<RoundSize | null>(null);
  const [activeMode, setActiveMode] = useState<PhysicalQuizMode>('state');
  const [activeBucket, setActiveBucket] = useState<PhysicalTypeBucket>('all');
  const [result, setResult] = useState<Result | null>(null);

  function startRound(size: RoundSize) {
    setResult(null);
    setActiveSize(size);
  }

  function handleComplete(roundResult: { score: number; total: number; misses: string[] }) {
    const size = activeSize ?? (roundResult.total as RoundSize);
    const prev = readPhase('physical-quiz') ?? { attempts: 0, bestScore: 0, misses: [] };
    const newFraction = roundResult.total > 0 ? roundResult.score / roundResult.total : 0;
    const mergedMisses = Array.from(new Set([...prev.misses, ...roundResult.misses])).slice(
      0,
      MAX_STORED_MISSES,
    );
    updatePhase('physical-quiz', {
      attempts: prev.attempts + 1,
      bestScore: Math.max(prev.bestScore, newFraction),
      misses: mergedMisses,
    });

    setResult({
      size,
      mode: activeMode,
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
  // narrow buckets. Engine handles undersized pools too, but we clamp here
  // so the progress bar is honest.
  const effectiveCount = useMemo(() => {
    if (!inRound) return null;
    const poolSize = flatPoolSize(activeBucket);
    return Math.min(activeSize!, poolSize);
  }, [inRound, activeSize, activeBucket]);

  return (
    <div className="w-full h-[calc(100vh-142px)] max-sm:h-[calc(100vh-218px)] flex flex-col bg-gradient-to-b from-emerald-50 via-sky-50 to-white relative">
      {/* IN-ROUND top strip */}
      {inRound && (
        <div className="shrink-0 bg-white/80 backdrop-blur-sm border-b border-emerald-200 px-3 sm:px-4 py-2 flex items-center gap-x-4 gap-y-1 flex-wrap">
          <Link
            href="/geography"
            className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-500"
          >
            ← Geography
          </Link>
          <span className="text-xs font-bold uppercase tracking-wide text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
            {activeMode === 'state' ? 'Which state?' : 'Which feature?'}
          </span>
          {activeBucket !== 'all' && (
            <span className="text-xs font-bold uppercase tracking-wide text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              {TYPE_BUCKETS.find((b) => b.value === activeBucket)?.label}
            </span>
          )}
        </div>
      )}

      {/* IN-ROUND: engine fills the rest */}
      {inRound && (
        <div className="flex-1 min-h-0">
          <PhysicalQuizEngine
            // key forces a fresh round on every restart (state reset).
            key={`round-${activeSize}-${activeMode}-${activeBucket}-${Date.now()}`}
            questionCount={effectiveCount as RoundSize}
            mode={activeMode}
            typeBucket={activeBucket}
            onComplete={handleComplete}
          />
        </div>
      )}

      {/* PICKER / RESULTS overlay */}
      {showOverlay && (
        <>
          {/* Top bar (picker mode) */}
          <div className="shrink-0 bg-white/70 backdrop-blur-sm border-b border-emerald-100 px-3 sm:px-4 py-2 flex items-center gap-x-4 flex-wrap">
            <Link
              href="/geography"
              className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-emerald-700 hover:text-emerald-500"
            >
              ← Geography
            </Link>
            <h2 className="text-base sm:text-lg font-black text-emerald-900">
              Physical Features Quiz
            </h2>
          </div>

          {/* Dimmed map preview behind the card */}
          <div
            className="flex-1 min-h-0 w-full px-1 sm:px-2 py-1 pointer-events-none opacity-40"
            aria-hidden
          >
            <USMap showCapitalStars={false} showCapitalNames={false} showStateLabels={false} />
          </div>

          {/* Overlay card */}
          <div className="absolute inset-0 top-[48px] flex items-center justify-center p-3 sm:p-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-3xl">
              {result === null ? (
                <RoundPicker
                  mode={activeMode}
                  bucket={activeBucket}
                  onModeChange={setActiveMode}
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
  bucket,
  onModeChange,
  onBucketChange,
  onPick,
}: {
  mode: PhysicalQuizMode;
  bucket: PhysicalTypeBucket;
  onModeChange: (m: PhysicalQuizMode) => void;
  onBucketChange: (b: PhysicalTypeBucket) => void;
  onPick: (size: RoundSize) => void;
}) {
  const sizeChoices: Array<{ size: RoundSize; label: string; sub: string }> = [
    { size: 5, label: 'Quick 5', sub: 'Warm-up' },
    { size: 10, label: '10', sub: 'Classic' },
    { size: 20, label: '20', sub: 'Going strong' },
  ];

  const pool = flatPoolSize(bucket);
  // Mode B needs ≥4 entries of a single raw type — if the chosen bucket can't
  // sustain that, force the kid back to Mode A and grey out Mode B.
  const modeBOk = modeBViable(bucket);
  const effectiveMode: PhysicalQuizMode = mode === 'feature' && !modeBOk ? 'state' : mode;
  // If we silently overrode mode, surface it so the parent state stays in sync.
  if (mode === 'feature' && !modeBOk && effectiveMode === 'state') {
    // Cheap: schedule a sync to parent so picker labels reflect reality.
    // (Effect-free because React batches and idempotent setState is a no-op.)
    queueMicrotask(() => onModeChange('state'));
  }

  return (
    <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl border border-emerald-100 p-4 md:p-5 max-h-[80vh] overflow-y-auto">
      <h2 className="text-lg md:text-xl font-black text-emerald-900 text-center mb-3">
        Match features to states
      </h2>
      <p className="text-xs text-center text-gray-500 mb-3">
        Pool: {TOTAL_FEATURE_COUNT} features across all states.
      </p>

      {/* Mode toggle */}
      <div className="mb-3">
        <div className="text-[11px] uppercase tracking-wide text-gray-500 font-bold mb-1.5 text-center">
          Mode
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => onModeChange('state')}
            className={`rounded-lg p-2 text-center transition-all ${
              effectiveMode === 'state'
                ? 'bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-md'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
            }`}
          >
            <div className="text-xs md:text-sm font-black leading-tight">Which state?</div>
            <div
              className={`text-[10px] leading-tight ${
                effectiveMode === 'state' ? 'text-emerald-50/90' : 'text-gray-500'
              }`}
            >
              Name the state that has the feature
            </div>
          </button>
          <button
            type="button"
            onClick={() => modeBOk && onModeChange('feature')}
            disabled={!modeBOk}
            className={`rounded-lg p-2 text-center transition-all ${
              effectiveMode === 'feature'
                ? 'bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-md'
                : modeBOk
                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
            }`}
          >
            <div className="text-xs md:text-sm font-black leading-tight">Which feature?</div>
            <div
              className={`text-[10px] leading-tight ${
                effectiveMode === 'feature'
                  ? 'text-emerald-50/90'
                  : modeBOk
                  ? 'text-gray-500'
                  : 'text-gray-400'
              }`}
            >
              {modeBOk ? 'Pick the right one for the state' : 'Needs more entries'}
            </div>
          </button>
        </div>
      </div>

      {/* Type filter */}
      <div className="mb-3">
        <div className="text-[11px] uppercase tracking-wide text-gray-500 font-bold mb-1.5 text-center">
          Type
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5">
          {TYPE_BUCKETS.map((b) => {
            const active = b.value === bucket;
            const count = flatPoolSize(b.value);
            const disabled = count === 0;
            return (
              <button
                key={b.value}
                type="button"
                onClick={() => !disabled && onBucketChange(b.value)}
                disabled={disabled}
                className={`rounded-lg p-2 text-center transition-all ${
                  active
                    ? 'bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-md'
                    : disabled
                    ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}
              >
                <div className="text-xs md:text-sm font-black leading-tight">{b.label}</div>
                <div
                  className={`text-[10px] leading-tight ${
                    active ? 'text-emerald-50/90' : 'text-gray-500'
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
        <div className="grid grid-cols-3 gap-1.5">
          {sizeChoices.map((c) => {
            const effective = Math.min(c.size, pool);
            return (
              <button
                key={c.size}
                type="button"
                onClick={() => onPick(c.size)}
                className="bg-gradient-to-br from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white rounded-xl p-2 md:p-3 shadow-md hover:shadow-lg transition-all"
              >
                <div className="text-xl md:text-2xl font-black leading-tight">{c.label}</div>
                <div className="text-[10px] text-emerald-50/90 leading-tight">
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
    ? 'Every single one — nice work.'
    : pct >= 80
    ? 'Great round!'
    : pct >= 50
    ? 'Nice — keep practicing.'
    : 'Good try — practice makes perfect.';
  const modeLabel = result.mode === 'state' ? 'Which state?' : 'Which feature?';
  const bucketLabel = TYPE_BUCKETS.find((b) => b.value === result.bucket)?.label ?? 'All';

  return (
    <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl border border-emerald-100 p-5 md:p-6 max-h-[80vh] overflow-y-auto">
      <div className="text-center mb-4">
        <div className="text-4xl md:text-5xl mb-2">{perfect ? '🏆' : '🎉'}</div>
        <h2 className="text-xl md:text-2xl font-black text-emerald-900 mb-1">{headline}</h2>
        <p className="text-sm text-emerald-700">
          {modeLabel} · {bucketLabel} · {cheer}
        </p>
      </div>

      {result.misses.length > 0 && (
        <div className="bg-emerald-50 rounded-xl p-3 md:p-4 mb-4 border border-emerald-100">
          <h3 className="text-xs font-bold text-emerald-900 mb-2 uppercase tracking-wide">
            Features to review ({result.misses.length})
          </h3>
          <ul className="flex flex-wrap gap-1.5">
            {result.misses.map((label) => (
              <li
                key={label}
                className="inline-block bg-white border border-emerald-200 text-emerald-800 text-xs md:text-sm font-medium px-2.5 py-0.5 rounded-full"
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
