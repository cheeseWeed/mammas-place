// Phase 3.5 — Flag Match.
//
// Two modes, picked at the picker screen:
//   'find-flag'  — prompt is a state name; pick the matching flag from 6 tiles.
//   'name-state' — prompt is a flag; pick the matching state name from 6 buttons.
//
// Three UI states: Picker → In Progress → Results. Mirrors name-quiz /
// capital-quiz so kids feel "the same family of games."
//
// Flag images come from /geography/flags/<postal>.svg. A sibling agent owns
// the data field on states.json; this page doesn't depend on it — the path
// is built from postal directly, so even if the JSON never gains the field,
// the game works as long as the SVG files exist on disk. Missing SVGs
// degrade gracefully via the <img> alt text.
'use client';

import { useState } from 'react';
import Link from 'next/link';
import statesData from '@/data/states.json';
import { FlagMatchEngine } from '@/components/geography';
import type { FlagMatchMode } from '@/components/geography/FlagMatchEngine';
import { readPhase, updatePhase } from '@/lib/geography/progress';

type RoundSize = 5 | 10 | 20 | 50;
type Region = null | 'Northeast' | 'Midwest' | 'South' | 'West';

type Result = {
  size: RoundSize;
  region: Region;
  mode: FlagMatchMode;
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

export default function FlagMatchPage() {
  const [activeSize, setActiveSize] = useState<RoundSize | null>(null);
  const [activeRegion, setActiveRegion] = useState<Region>(null);
  const [activeMode, setActiveMode] = useState<FlagMatchMode>('find-flag');
  const [result, setResult] = useState<Result | null>(null);

  function startRound(size: RoundSize, region: Region, mode: FlagMatchMode) {
    setResult(null);
    setActiveRegion(region);
    setActiveMode(mode);
    setActiveSize(size);
  }

  function handleComplete(roundResult: { score: number; total: number; misses: string[] }) {
    const size = activeSize ?? (roundResult.total as RoundSize);
    const prev = readPhase('flag-match') ?? { attempts: 0, bestScore: 0, misses: [] };
    const newFraction = roundResult.total > 0 ? roundResult.score / roundResult.total : 0;
    const mergedMisses = Array.from(new Set([...prev.misses, ...roundResult.misses])).slice(
      0,
      MAX_STORED_MISSES,
    );
    updatePhase('flag-match', {
      attempts: prev.attempts + 1,
      bestScore: Math.max(prev.bestScore, newFraction),
      misses: mergedMisses,
    });
    setResult({
      size,
      region: activeRegion,
      mode: activeMode,
      score: roundResult.score,
      total: roundResult.total,
      misses: roundResult.misses,
    });
    setActiveSize(null);
  }

  const showOverlay = activeSize === null;
  const inRound = activeSize !== null;
  const effectiveCount = inRound
    ? Math.min(activeSize!, poolSize(activeRegion))
    : null;

  return (
    <div className="w-full h-[calc(100vh-142px)] max-sm:h-[calc(100vh-218px)] flex flex-col bg-gradient-to-b from-emerald-50 via-sky-50 to-white relative">
      {/* IN-ROUND top strip: back link + region + mode badge */}
      {inRound && (
        <div className="shrink-0 bg-white/80 backdrop-blur-sm border-b border-emerald-200 px-3 sm:px-4 py-2 flex items-center gap-x-4 gap-y-1 flex-wrap">
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
          <span className="text-xs font-bold uppercase tracking-wide text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
            {activeMode === 'find-flag' ? 'Find the flag' : 'Name the state'}
          </span>
        </div>
      )}

      {/* IN-ROUND: engine fills the rest */}
      {inRound && (
        <div className="flex-1 min-h-0">
          <FlagMatchEngine
            key={`round-${activeSize}-${activeRegion}-${activeMode}-${Date.now()}`}
            questionCount={effectiveCount as number}
            mode={activeMode}
            region={activeRegion}
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
            <h2 className="text-base sm:text-lg font-black text-emerald-900">Flag Match</h2>
          </div>

          <div className="flex-1 min-h-0 w-full flex items-center justify-center p-3 sm:p-4">
            <div className="w-full max-w-3xl">
              {result === null ? (
                <RoundPicker onStart={startRound} />
              ) : (
                <ResultsCard
                  result={result}
                  onPlayAgain={() => startRound(result.size, result.region, result.mode)}
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

function RoundPicker({
  onStart,
}: {
  onStart: (size: RoundSize, region: Region, mode: FlagMatchMode) => void;
}) {
  const [region, setRegion] = useState<Region>(null);
  const [mode, setMode] = useState<FlagMatchMode>('find-flag');

  const sizeChoices: Array<{ size: RoundSize; label: string; sub: string }> = [
    { size: 5, label: 'Quick 5', sub: 'Warm-up' },
    { size: 10, label: '10', sub: 'Classic' },
    { size: 20, label: '20', sub: 'Going strong' },
    { size: 50, label: 'All', sub: 'Full pool' },
  ];

  const pool = poolSize(region);

  return (
    <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl border border-emerald-100 p-4 md:p-5">
      <h2 className="text-lg md:text-xl font-black text-emerald-900 text-center mb-3">
        Pick a mode, region, then a round size
      </h2>

      {/* Mode toggle */}
      <div className="mb-3">
        <div className="text-[11px] uppercase tracking-wide text-gray-500 font-bold mb-1.5 text-center">
          Mode
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              {
                value: 'find-flag' as const,
                label: 'Find the flag',
                sub: 'Name shown · pick the flag',
              },
              {
                value: 'name-state' as const,
                label: 'Name the state',
                sub: 'Flag shown · pick the name',
              },
            ]
          ).map((m) => {
            const active = mode === m.value;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => setMode(m.value)}
                className={`rounded-lg p-3 text-center transition-all ${
                  active
                    ? 'bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-md'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}
              >
                <div className="text-sm md:text-base font-black leading-tight">{m.label}</div>
                <div
                  className={`text-[10px] md:text-xs leading-tight ${
                    active ? 'text-emerald-50/90' : 'text-gray-500'
                  }`}
                >
                  {m.sub}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Region picker */}
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
                <div
                  className={`text-[10px] leading-tight ${
                    active ? 'text-emerald-50/90' : 'text-gray-500'
                  }`}
                >
                  {r.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Round size — kicks off the round */}
      <div>
        <div className="text-[11px] uppercase tracking-wide text-gray-500 font-bold mb-1.5 text-center">
          How many flags?
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {sizeChoices.map((c) => {
            const effective = Math.min(c.size, pool);
            return (
              <button
                key={c.size}
                type="button"
                onClick={() => onStart(c.size, region, mode)}
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
    ? 'Every single flag — nice work.'
    : pct >= 80
      ? 'Great round!'
      : pct >= 50
        ? 'Nice — keep practicing.'
        : 'Good try — practice makes perfect.';
  const modeLabel = result.mode === 'find-flag' ? 'Find the flag' : 'Name the state';

  return (
    <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl border border-emerald-100 p-5 md:p-6 max-h-[80vh] overflow-y-auto">
      <div className="text-center mb-4">
        <div className="text-4xl md:text-5xl mb-2">{perfect ? '🏆' : '🎉'}</div>
        <h2 className="text-xl md:text-2xl font-black text-emerald-900 mb-1">{headline}</h2>
        <p className="text-sm text-emerald-700">
          {modeLabel}
          {result.region ? ` · ${result.region}` : ''} · {cheer}
        </p>
      </div>

      {result.misses.length > 0 && (
        <div className="bg-emerald-50 rounded-xl p-3 md:p-4 mb-4 border border-emerald-100">
          <h3 className="text-xs font-bold text-emerald-900 mb-2 uppercase tracking-wide">
            Flags to review ({result.misses.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {result.misses.map((postal) => (
              <span
                key={postal}
                className="inline-flex items-center gap-2 bg-white border border-emerald-200 text-emerald-800 text-xs md:text-sm font-medium pl-1 pr-2.5 py-0.5 rounded-full"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/geography/flags/${postal.toLowerCase()}.svg`}
                  alt={`Flag ${postal}`}
                  className="w-6 h-4 object-cover rounded border border-emerald-200"
                />
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
