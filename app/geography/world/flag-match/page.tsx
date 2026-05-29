// Phase W4 — Country Flag Match.
//
// Two modes:
//   'find-flag'      — prompt is a country name; pick the matching flag from 6 tiles.
//   'name-country'   — prompt is a flag; pick the matching country name from 6 buttons.
//
// Self-contained — flag images come from /geography/world/flags/<iso2>.svg.
// Modeled on the US flag-match page, swapping postal for iso2 and region for
// continent. The 6 distractors are drawn from the same continent when one is
// active, otherwise from any country globally.
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import countriesData from '@/data/countries.json';
import { readPhase, updatePhase } from '@/lib/geography/progress';

type RoundSize = 5 | 10 | 20 | 50;
type FlagMatchMode = 'find-flag' | 'name-country';
type Continent =
  | null
  | 'Africa'
  | 'Asia'
  | 'Europe'
  | 'North America'
  | 'South America'
  | 'Oceania';

type CountryRecord = {
  iso2: string;
  iso3: string;
  name: string;
  continent: string;
};

const COUNTRIES = (countriesData as CountryRecord[]).filter(
  (c) => c.continent !== 'Antarctica',
);

const MAX_STORED_MISSES = 50;
const TILE_COUNT = 6;
const RIGHT_DELAY_MS = 800;
const WRONG_DELAY_MS = 1500;

type Result = {
  size: RoundSize;
  continent: Continent;
  mode: FlagMatchMode;
  score: number;
  total: number;
  misses: string[];   // iso2 codes
};

function nameForIso2(iso2: string): string {
  return COUNTRIES.find((c) => c.iso2 === iso2)?.name ?? iso2;
}

function poolSize(continent: Continent): number {
  if (!continent) return COUNTRIES.length;
  return COUNTRIES.filter((c) => c.continent === continent).length;
}

function pickRandom<T>(source: T[], n: number): T[] {
  const copy = source.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

export default function WorldFlagMatchPage() {
  const [activeSize, setActiveSize] = useState<RoundSize | null>(null);
  const [activeContinent, setActiveContinent] = useState<Continent>(null);
  const [activeMode, setActiveMode] = useState<FlagMatchMode>('find-flag');
  const [result, setResult] = useState<Result | null>(null);

  function startRound(size: RoundSize, continent: Continent, mode: FlagMatchMode) {
    setResult(null);
    setActiveContinent(continent);
    setActiveMode(mode);
    setActiveSize(size);
  }

  function handleComplete(roundResult: { score: number; total: number; misses: string[] }) {
    const size = activeSize ?? (roundResult.total as RoundSize);
    const prev = readPhase('world-flag-match') ?? { attempts: 0, bestScore: 0, misses: [] };
    const newFraction = roundResult.total > 0 ? roundResult.score / roundResult.total : 0;
    const mergedMisses = Array.from(new Set([...prev.misses, ...roundResult.misses])).slice(
      0,
      MAX_STORED_MISSES,
    );
    updatePhase('world-flag-match', {
      attempts: prev.attempts + 1,
      bestScore: Math.max(prev.bestScore, newFraction),
      misses: mergedMisses,
    });
    setResult({
      size,
      continent: activeContinent,
      mode: activeMode,
      score: roundResult.score,
      total: roundResult.total,
      misses: roundResult.misses,
    });
    setActiveSize(null);
  }

  const showOverlay = activeSize === null;
  const inRound = activeSize !== null;
  const effectiveCount = inRound ? Math.min(activeSize!, poolSize(activeContinent)) : null;

  return (
    <div className="w-full min-h-[calc(100vh-142px)] max-sm:min-h-[calc(100vh-218px)] flex flex-col bg-gradient-to-b from-sky-50 via-indigo-50 to-white">
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
          <span className="text-xs font-bold uppercase tracking-wide text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full">
            {activeMode === 'find-flag' ? 'Find the flag' : 'Name the country'}
          </span>
        </div>
      )}

      {inRound && (
        <div className="flex-1 min-h-0">
          <FlagMatchRound
            key={`round-${activeSize}-${activeContinent}-${activeMode}-${Date.now()}`}
            questionCount={effectiveCount!}
            mode={activeMode}
            continent={activeContinent}
            onComplete={handleComplete}
          />
        </div>
      )}

      {showOverlay && (
        <>
          <div className="shrink-0 bg-white/70 backdrop-blur-sm border-b border-sky-100 px-3 sm:px-4 py-2 flex items-center gap-x-4 flex-wrap">
            <Link
              href="/geography"
              className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-sky-700 hover:text-sky-500"
            >
              ← Geography
            </Link>
            <h2 className="text-base sm:text-lg font-black text-sky-900">Country Flag Match</h2>
          </div>

          <div className="flex-1 min-h-0 w-full flex items-center justify-center p-3 sm:p-4">
            <div className="w-full max-w-3xl">
              {result === null ? (
                <RoundPicker onStart={startRound} />
              ) : (
                <ResultsCard
                  result={result}
                  onPlayAgain={() => startRound(result.size, result.continent, result.mode)}
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

// ----- Round engine -----

type Phase = 'ask' | 'right' | 'wrong';

function FlagMatchRound({
  questionCount,
  mode,
  continent,
  onComplete,
}: {
  questionCount: number;
  mode: FlagMatchMode;
  continent: Continent;
  onComplete: (result: { score: number; total: number; misses: string[] }) => void;
}) {
  // Pool of countries we can ASK about. Distractors are drawn from the same
  // pool (continent-filtered when active) so the choices feel coherent.
  const pool = useMemo(
    () => (continent ? COUNTRIES.filter((c) => c.continent === continent) : COUNTRIES),
    [continent],
  );

  // Frozen queue of correct answers for the round.
  const queue = useMemo(() => pickRandom(pool, questionCount), [pool, questionCount]);

  // For each question we pre-build a tile set: 1 correct + 5 distractors (or
  // however many we can find), shuffled. Frozen once per round so re-renders
  // don't reshuffle.
  const tileSets = useMemo(() => {
    return queue.map((correct) => {
      const otherPool = pool.filter((c) => c.iso2 !== correct.iso2);
      const distractors = pickRandom(otherPool, Math.max(0, TILE_COUNT - 1));
      const tiles = pickRandom([correct, ...distractors], TILE_COUNT);
      return tiles;
    });
  }, [queue, pool]);

  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<Phase>('ask');
  const [clickedIso2, setClickedIso2] = useState<string | null>(null);
  const missesRef = useRef<string[]>([]);
  const scoreRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
  }, []);

  const current = queue[index];
  const tiles = tileSets[index] ?? [];

  const advance = useCallback(() => {
    timerRef.current = null;
    const nextIndex = index + 1;
    if (nextIndex >= queue.length) {
      onComplete({
        score: scoreRef.current,
        total: queue.length,
        misses: missesRef.current.slice(),
      });
      return;
    }
    setIndex(nextIndex);
    setPhase('ask');
    setClickedIso2(null);
  }, [index, queue.length, onComplete]);

  const handleTileClick = useCallback(
    (clicked: CountryRecord) => {
      if (phase !== 'ask' || !current) return;
      setClickedIso2(clicked.iso2);
      if (clicked.iso2 === current.iso2) {
        scoreRef.current += 1;
        setScore(scoreRef.current);
        setPhase('right');
        if (timerRef.current !== null) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(advance, RIGHT_DELAY_MS);
      } else {
        setPhase('wrong');
        if (!missesRef.current.includes(current.iso2)) {
          missesRef.current.push(current.iso2);
        }
        if (timerRef.current !== null) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(advance, WRONG_DELAY_MS);
      }
    },
    [phase, current, advance],
  );

  if (!current) return null;

  const promptText = mode === 'find-flag' ? current.name : null;
  const promptFlag = mode === 'name-country' ? current.iso2 : null;

  // Tile classes — green for correct after a click; red for wrongly-clicked.
  function tileClasses(c: CountryRecord): string {
    if (phase === 'ask') {
      return 'bg-white border-sky-200 hover:border-sky-400 hover:shadow-lg';
    }
    if (c.iso2 === current.iso2) return 'bg-emerald-100 border-emerald-400 ring-2 ring-emerald-400';
    if (c.iso2 === clickedIso2) return 'bg-red-100 border-red-400 ring-2 ring-red-400';
    return 'bg-white border-gray-200 opacity-60';
  }

  return (
    <div className="h-full w-full flex flex-col">
      {/* Prompt strip */}
      <div className="bg-white/85 backdrop-blur-sm border-b-2 border-sky-200 px-3 sm:px-4 py-2 sm:py-3 shadow-sm">
        <div className="flex items-center justify-center gap-3 mb-1">
          <span className="text-xs sm:text-sm uppercase tracking-wider text-sky-600 font-bold">
            {mode === 'find-flag' ? 'Find the flag for:' : 'Name this country:'}
          </span>
          {promptText && (
            <span className="text-2xl sm:text-3xl md:text-4xl font-black text-indigo-700 leading-tight">
              {promptText}
            </span>
          )}
          {promptFlag && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/geography/world/flags/${promptFlag.toLowerCase()}.svg`}
              alt={`Flag of ${current.name}`}
              className="h-12 sm:h-16 md:h-20 w-auto rounded shadow-md ring-1 ring-sky-300 bg-white"
            />
          )}
          {phase === 'right' && (
            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full text-sm font-bold">
              ✓ Correct!
            </span>
          )}
          {phase === 'wrong' && (
            <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 px-2.5 py-1 rounded-full text-sm font-bold">
              ✗ It was {current.name}
            </span>
          )}
        </div>
        <div className="flex items-center justify-center gap-3 sm:gap-4 text-xs sm:text-sm">
          <span className="text-gray-600 font-medium">
            Question <span className="font-bold text-sky-700">{index + 1}</span> of {queue.length}
          </span>
          <span className="font-bold text-sky-700">Score: {score}</span>
        </div>
      </div>

      {/* Tile grid */}
      <div className="flex-1 p-3 sm:p-4 md:p-6 flex items-center justify-center">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 w-full max-w-4xl">
          {tiles.map((c) => {
            return (
              <button
                key={c.iso2}
                type="button"
                disabled={phase !== 'ask'}
                onClick={() => handleTileClick(c)}
                className={`group rounded-2xl border-2 p-3 sm:p-4 text-center shadow-md transition-all ${tileClasses(c)}`}
              >
                {mode === 'find-flag' ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/geography/world/flags/${c.iso2.toLowerCase()}.svg`}
                      alt={`Flag of ${c.name}`}
                      className="w-full h-20 sm:h-24 md:h-28 object-contain"
                    />
                    {/* Reveal the name in feedback phase to teach the answer. */}
                    {phase !== 'ask' && (
                      <div className="mt-2 text-xs sm:text-sm font-semibold text-gray-700">
                        {c.name}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-base sm:text-lg md:text-xl font-bold text-sky-900">
                    {c.name}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ----- Picker -----

const CONTINENTS: Array<{ value: Continent; label: string; desc: string }> = [
  { value: null, label: 'All', desc: 'Whole world' },
  { value: 'Africa', label: 'Africa', desc: `${COUNTRIES.filter((c) => c.continent === 'Africa').length} countries` },
  { value: 'Asia', label: 'Asia', desc: `${COUNTRIES.filter((c) => c.continent === 'Asia').length} countries` },
  { value: 'Europe', label: 'Europe', desc: `${COUNTRIES.filter((c) => c.continent === 'Europe').length} countries` },
  { value: 'North America', label: 'N. America', desc: `${COUNTRIES.filter((c) => c.continent === 'North America').length} countries` },
  { value: 'South America', label: 'S. America', desc: `${COUNTRIES.filter((c) => c.continent === 'South America').length} countries` },
  { value: 'Oceania', label: 'Oceania', desc: `${COUNTRIES.filter((c) => c.continent === 'Oceania').length} countries` },
];

function RoundPicker({
  onStart,
}: {
  onStart: (size: RoundSize, continent: Continent, mode: FlagMatchMode) => void;
}) {
  const [continent, setContinent] = useState<Continent>(null);
  const [mode, setMode] = useState<FlagMatchMode>('find-flag');

  const sizeChoices: Array<{ size: RoundSize; label: string; sub: string }> = [
    { size: 5, label: 'Quick 5', sub: 'Warm-up' },
    { size: 10, label: '10', sub: 'Classic' },
    { size: 20, label: '20', sub: 'Going strong' },
    { size: 50, label: '50', sub: 'Big round' },
  ];

  const pool = poolSize(continent);

  return (
    <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl border border-sky-100 p-4 md:p-5">
      <h2 className="text-lg md:text-xl font-black text-sky-900 text-center mb-3">
        Pick a mode, continent, then a round size
      </h2>

      {/* Mode toggle */}
      <div className="mb-3">
        <div className="text-[11px] uppercase tracking-wide text-gray-500 font-bold mb-1.5 text-center">
          Mode
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {([
            { value: 'find-flag' as const, label: 'Find the flag', sub: 'Name shown · pick the flag' },
            { value: 'name-country' as const, label: 'Name the country', sub: 'Flag shown · pick the name' },
          ]).map((m) => {
            const active = mode === m.value;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => setMode(m.value)}
                className={`rounded-lg p-3 text-center transition-all ${
                  active
                    ? 'bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-md'
                    : 'bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200'
                }`}
              >
                <div className="text-sm md:text-base font-black leading-tight">{m.label}</div>
                <div className={`text-[10px] md:text-xs leading-tight ${active ? 'text-sky-50/90' : 'text-gray-500'}`}>
                  {m.sub}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Continent picker */}
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

      {/* Round size — kicks off */}
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
                onClick={() => onStart(c.size, continent, mode)}
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
    ? 'Every single flag — incredible.'
    : pct >= 80 ? 'Great round!'
    : pct >= 50 ? 'Nice — keep practicing.'
    : 'Good try — practice makes perfect.';
  const modeLabel = result.mode === 'find-flag' ? 'Find the flag' : 'Name the country';

  return (
    <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl border border-sky-100 p-5 md:p-6 max-h-[80vh] overflow-y-auto">
      <div className="text-center mb-4">
        <div className="text-4xl md:text-5xl mb-2">{perfect ? '🏆' : '🎉'}</div>
        <h2 className="text-xl md:text-2xl font-black text-sky-900 mb-1">{headline}</h2>
        <p className="text-sm text-sky-700">
          {modeLabel}
          {result.continent ? ` · ${result.continent}` : ''} · {cheer}
        </p>
      </div>

      {result.misses.length > 0 && (
        <div className="bg-sky-50 rounded-xl p-3 md:p-4 mb-4 border border-sky-100">
          <h3 className="text-xs font-bold text-sky-900 mb-2 uppercase tracking-wide">
            Flags to review ({result.misses.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {result.misses.map((iso2) => (
              <span
                key={iso2}
                className="inline-flex items-center gap-2 bg-white border border-sky-200 text-sky-800 text-xs md:text-sm font-medium pl-1 pr-2.5 py-0.5 rounded-full"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/geography/world/flags/${iso2.toLowerCase()}.svg`}
                  alt={`Flag ${iso2}`}
                  className="w-6 h-4 object-cover rounded border border-sky-200"
                />
                {nameForIso2(iso2)}
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
