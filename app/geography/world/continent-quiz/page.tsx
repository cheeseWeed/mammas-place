// Phase W5 — Continent Quiz.
//
// Two modes:
//   1. country-to-continent (default): "Which continent is Japan in?" → six
//      big continent buttons.
//   2. continent-to-country: "Which of these is in Africa?" → four country
//      buttons (one correct, three decoys from OTHER continents). Mirrors
//      the two-mode pattern flag-match uses.
//
// Country-to-continent mode also supports a continent filter — drill a
// specific continent's countries (matches name-quiz / capital-quiz UX).
//
// Self-contained — no map. Mirrors the engine shape of the other quizzes
// (Picker → In Progress → Results).
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import countriesData from '@/data/countries.json';
import { readPhase, updatePhase } from '@/lib/geography/progress';
import {
  isPending,
  newIdempotencyKey,
  submitEarn,
  type EarnResponse,
} from '@/lib/money/earn-client';
import { useLearner } from '@/context/LearnerContext';
import PendingEarnPrompt from '@/components/PendingEarnPrompt';

type PendingEarn = Extract<EarnResponse, { pending: true }>;

type RoundSize = 5 | 10 | 20 | 50;
type QuizMode = 'country-to-continent' | 'continent-to-country';

type CountryRecord = {
  iso2: string;
  iso3: string;
  name: string;
  continent: string;
};

const CONTINENT_CHOICES = [
  'Africa',
  'Asia',
  'Europe',
  'North America',
  'South America',
  'Oceania',
] as const;

type ContinentChoice = (typeof CONTINENT_CHOICES)[number];

const COUNTRIES = (countriesData as CountryRecord[]).filter(
  (c): c is CountryRecord & { continent: ContinentChoice } =>
    (CONTINENT_CHOICES as readonly string[]).includes(c.continent),
);

const MAX_STORED_MISSES = 50;
const RIGHT_DELAY_MS = 800;
const WRONG_DELAY_MS = 1500;

// Filter is optional and only applies to country-to-continent mode. null = all.
type ContinentFilter = ContinentChoice | null;

type Result = {
  size: RoundSize;
  mode: QuizMode;
  continentFilter: ContinentFilter;
  score: number;
  total: number;
  misses: string[];  // iso2 codes
};

function pickRandom<T>(source: T[], n: number): T[] {
  const copy = source.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

function shuffle<T>(source: T[]): T[] {
  return pickRandom(source, source.length);
}

function nameForIso2(iso2: string): string {
  return COUNTRIES.find((c) => c.iso2 === iso2)?.name ?? iso2;
}

function continentForIso2(iso2: string): string {
  return COUNTRIES.find((c) => c.iso2 === iso2)?.continent ?? '';
}

function poolForFilter(filter: ContinentFilter): typeof COUNTRIES {
  if (!filter) return COUNTRIES;
  return COUNTRIES.filter((c) => c.continent === filter);
}

// Quiz id sent to the earn API. Different modes log distinctly so we can
// see per-mode mastery in MpEarning history without changing the formula.
function quizIdFor(mode: QuizMode): string {
  return mode === 'continent-to-country'
    ? 'world-continent-quiz-reverse'
    : 'world-continent-quiz';
}

export default function WorldContinentQuizPage() {
  const [activeSize, setActiveSize] = useState<RoundSize | null>(null);
  const [activeMode, setActiveMode] = useState<QuizMode>('country-to-continent');
  const [activeFilter, setActiveFilter] = useState<ContinentFilter>(null);
  const [result, setResult] = useState<Result | null>(null);
  // MP earned message for the most recent finished round.
  const [earnNote, setEarnNote] = useState<string | null>(null);
  // Anon-kid pending earn — populated when the server returns a pending preview.
  const [pendingEarn, setPendingEarn] = useState<PendingEarn | null>(null);
  const { refresh: refreshBalance } = useLearner();

  function startRound(size: RoundSize, mode: QuizMode, filter: ContinentFilter) {
    setResult(null);
    setActiveSize(size);
    setActiveMode(mode);
    // Filter only applies to country-to-continent mode. Reverse mode needs
    // a mix of continents to make the prompt meaningful.
    setActiveFilter(mode === 'country-to-continent' ? filter : null);
    setEarnNote(null);
    setPendingEarn(null);
  }

  function handleComplete(roundResult: { score: number; total: number; misses: string[] }) {
    const size = activeSize ?? (roundResult.total as RoundSize);
    const prev = readPhase('world-continent-quiz') ?? { attempts: 0, bestScore: 0, misses: [] };
    const newFraction = roundResult.total > 0 ? roundResult.score / roundResult.total : 0;
    const mergedMisses = Array.from(new Set([...prev.misses, ...roundResult.misses])).slice(
      0,
      MAX_STORED_MISSES,
    );
    updatePhase('world-continent-quiz', {
      attempts: prev.attempts + 1,
      bestScore: Math.max(prev.bestScore, newFraction),
      misses: mergedMisses,
    });
    setResult({
      size,
      mode: activeMode,
      continentFilter: activeFilter,
      score: roundResult.score,
      total: roundResult.total,
      misses: roundResult.misses,
    });
    setActiveSize(null);

    // MP earn — server decides cents. Anon kids get a pending preview they
    // can claim by registering/logging in from the results card.
    const key = newIdempotencyKey(`geo-${quizIdFor(activeMode)}`);
    void submitEarn(
      'geography',
      'quiz',
      { correct: roundResult.score, total: roundResult.total, quiz: quizIdFor(activeMode) },
      key,
    ).then((res) => {
      if ('error' in res) {
        setEarnNote(`MP didn't record: ${res.error}`);
        return;
      }
      if (isPending(res)) {
        setPendingEarn(res);
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

  const showOverlay = activeSize === null;
  const inRound = activeSize !== null;

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
          <span className="text-base sm:text-lg font-black text-sky-900">Continent Quiz</span>
          <span className="text-xs font-bold uppercase tracking-wide text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
            {activeMode === 'continent-to-country' ? 'Continent → Country' : 'Country → Continent'}
          </span>
          {activeFilter && activeMode === 'country-to-continent' && (
            <span className="text-xs font-bold uppercase tracking-wide text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full">
              {activeFilter}
            </span>
          )}
        </div>
      )}

      {inRound && activeMode === 'country-to-continent' && (
        <div className="flex-1 min-h-0">
          <ForwardRound
            key={`fwd-${activeSize}-${activeFilter ?? 'all'}-${Date.now()}`}
            questionCount={activeSize!}
            continentFilter={activeFilter}
            onComplete={handleComplete}
          />
        </div>
      )}

      {inRound && activeMode === 'continent-to-country' && (
        <div className="flex-1 min-h-0">
          <ReverseRound
            key={`rev-${activeSize}-${Date.now()}`}
            questionCount={activeSize!}
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
            <h2 className="text-base sm:text-lg font-black text-sky-900">Continent Quiz</h2>
          </div>

          <div className="flex-1 min-h-0 w-full flex items-center justify-center p-3 sm:p-4">
            <div className="w-full max-w-3xl">
              {result === null ? (
                <RoundPicker onPick={startRound} />
              ) : (
                <ResultsCard
                  result={result}
                  earnNote={earnNote}
                  pendingEarn={pendingEarn}
                  onPendingClaimed={(cents) => {
                    setPendingEarn(null);
                    setEarnNote(`+${(cents / 100).toFixed(2)}MP earned (banked!)`);
                    void refreshBalance();
                  }}
                  onPlayAgain={() => startRound(result.size, result.mode, result.continentFilter)}
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

// ----- Round engine: country → continent (six-button) -----

type Phase = 'ask' | 'right' | 'wrong';

// Per-continent button color, kid-friendly distinct hues. Mirror the
// CONTINENT_TINTS hue family from WorldMap (orange/amber/sky/emerald/violet/pink)
// but darker so the button reads as a clickable surface.
const CONTINENT_BTN: Record<ContinentChoice, { idle: string; hover: string }> = {
  Africa:           { idle: 'bg-orange-200 text-orange-900',   hover: 'hover:bg-orange-300' },
  Asia:             { idle: 'bg-amber-200 text-amber-900',     hover: 'hover:bg-amber-300' },
  Europe:           { idle: 'bg-sky-200 text-sky-900',         hover: 'hover:bg-sky-300' },
  'North America':  { idle: 'bg-emerald-200 text-emerald-900', hover: 'hover:bg-emerald-300' },
  'South America':  { idle: 'bg-violet-200 text-violet-900',   hover: 'hover:bg-violet-300' },
  Oceania:          { idle: 'bg-pink-200 text-pink-900',       hover: 'hover:bg-pink-300' },
};

function ForwardRound({
  questionCount,
  continentFilter,
  onComplete,
}: {
  questionCount: number;
  continentFilter: ContinentFilter;
  onComplete: (result: { score: number; total: number; misses: string[] }) => void;
}) {
  const queue = useMemo(
    () => pickRandom(poolForFilter(continentFilter), questionCount),
    [questionCount, continentFilter],
  );

  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<Phase>('ask');
  const [clickedContinent, setClickedContinent] = useState<ContinentChoice | null>(null);
  const missesRef = useRef<string[]>([]);
  const scoreRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
  }, []);

  const current = queue[index];

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
    setClickedContinent(null);
  }, [index, queue.length, onComplete]);

  const handleClick = useCallback(
    (continent: ContinentChoice) => {
      if (phase !== 'ask' || !current) return;
      setClickedContinent(continent);
      if (continent === current.continent) {
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

  function buttonClasses(c: ContinentChoice): string {
    const colors = CONTINENT_BTN[c];
    if (phase === 'ask') return `${colors.idle} ${colors.hover} border-transparent`;
    if (c === current!.continent) return 'bg-emerald-200 text-emerald-900 ring-4 ring-emerald-400 border-emerald-500';
    if (c === clickedContinent) return 'bg-red-200 text-red-900 ring-4 ring-red-400 border-red-500';
    return `${colors.idle} opacity-50 border-transparent`;
  }

  return (
    <div className="h-full w-full flex flex-col">
      {/* Prompt */}
      <div className="bg-white/85 backdrop-blur-sm border-b-2 border-sky-200 px-3 sm:px-4 py-2 sm:py-3 shadow-sm">
        <div className="flex items-center justify-center gap-3 mb-1 flex-wrap">
          <span className="text-xs sm:text-sm uppercase tracking-wider text-sky-600 font-bold">
            Which continent is
          </span>
          <span className="text-2xl sm:text-3xl md:text-4xl font-black text-indigo-700 leading-tight">
            {current.name}
          </span>
          <span className="text-xs sm:text-sm uppercase tracking-wider text-sky-600 font-bold">
            in?
          </span>
          {phase === 'right' && (
            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full text-sm font-bold">
              ✓ Correct!
            </span>
          )}
          {phase === 'wrong' && (
            <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 px-2.5 py-1 rounded-full text-sm font-bold">
              ✗ It&apos;s in {current.continent}
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

      {/* Six big continent buttons */}
      <div className="flex-1 p-4 sm:p-6 md:p-8 flex items-center justify-center">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 w-full max-w-3xl">
          {CONTINENT_CHOICES.map((c) => (
            <button
              key={c}
              type="button"
              disabled={phase !== 'ask'}
              onClick={() => handleClick(c)}
              className={`rounded-2xl border-2 p-6 sm:p-8 font-black text-lg sm:text-xl md:text-2xl shadow-md transition-all ${buttonClasses(c)}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ----- Round engine: continent → country (four-choice multiple choice) -----
//
// Each question:
//   - Pick a target continent (round-robin-ish, so kid sees variety).
//   - Pick one correct country from that continent.
//   - Pick three decoy countries from OTHER continents.
//   - Shuffle and present as four buttons.
//
// Miss is stored as the iso2 of the correct country (what the kid should have
// clicked), matching the forward mode's miss semantics so the results card
// is consistent.

type ReverseQuestion = {
  continent: ContinentChoice;
  correct: CountryRecord;
  choices: CountryRecord[];   // length 4, shuffled, includes correct
};

function buildReverseQueue(n: number): ReverseQuestion[] {
  // Walk continents in shuffled order, then repeat until we have n questions.
  // This guarantees rough continent balance even on a 5-question round.
  const cycle = shuffle([...CONTINENT_CHOICES]);
  const out: ReverseQuestion[] = [];
  const usedCorrect = new Set<string>();
  let i = 0;
  let safety = 0;
  while (out.length < n && safety < n * 10) {
    safety += 1;
    const continent = cycle[i % cycle.length];
    i += 1;
    const onContinent = COUNTRIES.filter(
      (c) => c.continent === continent && !usedCorrect.has(c.iso2),
    );
    if (onContinent.length === 0) continue;
    const correct = pickRandom(onContinent, 1)[0];
    usedCorrect.add(correct.iso2);
    const otherContinents = COUNTRIES.filter(
      (c) => c.continent !== continent && c.iso2 !== correct.iso2,
    );
    const decoys = pickRandom(otherContinents, 3);
    if (decoys.length < 3) continue;
    out.push({
      continent,
      correct,
      choices: shuffle([correct, ...decoys]),
    });
  }
  return out;
}

function ReverseRound({
  questionCount,
  onComplete,
}: {
  questionCount: number;
  onComplete: (result: { score: number; total: number; misses: string[] }) => void;
}) {
  const queue = useMemo(() => buildReverseQueue(questionCount), [questionCount]);

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

  const handleClick = useCallback(
    (country: CountryRecord) => {
      if (phase !== 'ask' || !current) return;
      setClickedIso2(country.iso2);
      if (country.iso2 === current.correct.iso2) {
        scoreRef.current += 1;
        setScore(scoreRef.current);
        setPhase('right');
        if (timerRef.current !== null) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(advance, RIGHT_DELAY_MS);
      } else {
        setPhase('wrong');
        if (!missesRef.current.includes(current.correct.iso2)) {
          missesRef.current.push(current.correct.iso2);
        }
        if (timerRef.current !== null) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(advance, WRONG_DELAY_MS);
      }
    },
    [phase, current, advance],
  );

  if (!current) return null;

  // Color hint: the continent name in the prompt gets the same tint family
  // as its forward-mode button so kids associate "this orange means Africa"
  // across modes.
  const promptTint = CONTINENT_BTN[current.continent];

  function buttonClasses(country: CountryRecord): string {
    if (phase === 'ask') {
      // Choices are all neutral-white during the ask — the prompt provides
      // the only color cue. Keeps the kid focused on country names rather
      // than scanning for color hints in the choices.
      return 'bg-white border-sky-200 hover:bg-sky-50 hover:border-sky-400 text-sky-900';
    }
    if (country.iso2 === current!.correct.iso2) {
      return 'bg-emerald-200 text-emerald-900 ring-4 ring-emerald-400 border-emerald-500';
    }
    if (country.iso2 === clickedIso2) {
      return 'bg-red-200 text-red-900 ring-4 ring-red-400 border-red-500';
    }
    return 'bg-white border-sky-200 text-sky-900 opacity-50';
  }

  return (
    <div className="h-full w-full flex flex-col">
      {/* Prompt */}
      <div className="bg-white/85 backdrop-blur-sm border-b-2 border-sky-200 px-3 sm:px-4 py-2 sm:py-3 shadow-sm">
        <div className="flex items-center justify-center gap-3 mb-1 flex-wrap">
          <span className="text-xs sm:text-sm uppercase tracking-wider text-sky-600 font-bold">
            Which country is in
          </span>
          <span
            className={`text-2xl sm:text-3xl md:text-4xl font-black leading-tight px-3 py-0.5 rounded-xl ${promptTint.idle}`}
          >
            {current.continent}
          </span>
          <span className="text-xs sm:text-sm uppercase tracking-wider text-sky-600 font-bold">
            ?
          </span>
          {phase === 'right' && (
            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full text-sm font-bold">
              ✓ Correct!
            </span>
          )}
          {phase === 'wrong' && (
            <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 px-2.5 py-1 rounded-full text-sm font-bold">
              ✗ {current.correct.name} is in {current.continent}
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

      {/* Four country choices */}
      <div className="flex-1 p-4 sm:p-6 md:p-8 flex items-center justify-center">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full max-w-3xl">
          {current.choices.map((c) => (
            <button
              key={c.iso2}
              type="button"
              disabled={phase !== 'ask'}
              onClick={() => handleClick(c)}
              className={`rounded-2xl border-2 p-4 sm:p-6 font-black text-lg sm:text-xl md:text-2xl shadow-md transition-all ${buttonClasses(c)}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ----- Picker -----

const CONTINENT_FILTERS: Array<{ value: ContinentFilter; label: string }> = [
  { value: null, label: 'All' },
  { value: 'Africa', label: 'Africa' },
  { value: 'Asia', label: 'Asia' },
  { value: 'Europe', label: 'Europe' },
  { value: 'North America', label: 'N. America' },
  { value: 'South America', label: 'S. America' },
  { value: 'Oceania', label: 'Oceania' },
];

function RoundPicker({
  onPick,
}: {
  onPick: (size: RoundSize, mode: QuizMode, filter: ContinentFilter) => void;
}) {
  const [mode, setMode] = useState<QuizMode>('country-to-continent');
  const [filter, setFilter] = useState<ContinentFilter>(null);

  const sizeChoices: Array<{ size: RoundSize; label: string; sub: string }> = [
    { size: 5, label: 'Quick 5', sub: 'Warm-up' },
    { size: 10, label: '10', sub: 'Classic' },
    { size: 20, label: '20', sub: 'Going strong' },
    { size: 50, label: '50', sub: 'Big round' },
  ];

  // Effective pool size for the chosen mode/filter, used to clamp size labels.
  const pool =
    mode === 'country-to-continent' ? poolForFilter(filter).length : COUNTRIES.length;

  // Filter only matters in country-to-continent mode. In reverse mode the
  // continent IS the prompt, so a "filter to Asia" round would just ask
  // "which is in Asia?" every question.
  const showFilter = mode === 'country-to-continent';

  return (
    <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl border border-sky-100 p-4 md:p-5">
      <h2 className="text-lg md:text-xl font-black text-sky-900 text-center mb-3">
        Pick a mode, then a round size
      </h2>

      {/* Mode selector */}
      <div className="mb-3">
        <div className="text-[11px] uppercase tracking-wide text-gray-500 font-bold mb-1.5 text-center">
          Mode
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setMode('country-to-continent')}
            className={`rounded-lg p-2.5 text-center transition-all ${
              mode === 'country-to-continent'
                ? 'bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-md'
                : 'bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200'
            }`}
          >
            <div className="text-sm md:text-base font-black leading-tight">
              Country → Continent
            </div>
            <div
              className={`text-[10px] md:text-[11px] leading-tight ${
                mode === 'country-to-continent' ? 'text-sky-50/90' : 'text-gray-500'
              }`}
            >
              See a country, pick its continent
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMode('continent-to-country')}
            className={`rounded-lg p-2.5 text-center transition-all ${
              mode === 'continent-to-country'
                ? 'bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-md'
                : 'bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200'
            }`}
          >
            <div className="text-sm md:text-base font-black leading-tight">
              Continent → Country
            </div>
            <div
              className={`text-[10px] md:text-[11px] leading-tight ${
                mode === 'continent-to-country' ? 'text-sky-50/90' : 'text-gray-500'
              }`}
            >
              See a continent, pick a country in it
            </div>
          </button>
        </div>
      </div>

      {/* Continent filter (only meaningful in forward mode) */}
      {showFilter && (
        <div className="mb-3">
          <div className="text-[11px] uppercase tracking-wide text-gray-500 font-bold mb-1.5 text-center">
            Drill a continent (optional)
          </div>
          <div className="grid grid-cols-4 md:grid-cols-7 gap-1.5">
            {CONTINENT_FILTERS.map((c) => {
              const active = c.value === filter;
              const count =
                c.value === null
                  ? COUNTRIES.length
                  : COUNTRIES.filter((x) => x.continent === c.value).length;
              return (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => setFilter(c.value)}
                  className={`rounded-lg p-1.5 md:p-2 text-center transition-all ${
                    active
                      ? 'bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-md'
                      : 'bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200'
                  }`}
                >
                  <div className="text-xs md:text-sm font-black leading-tight">{c.label}</div>
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
      )}

      <p className="text-sm text-center text-gray-600 mb-3">
        {mode === 'country-to-continent'
          ? 'We’ll show you a country. You pick which of the six continents it’s in.'
          : 'We’ll show you a continent. You pick which of four countries is in it.'}
      </p>

      <div>
        <div className="text-[11px] uppercase tracking-wide text-gray-500 font-bold mb-1.5 text-center">
          How many questions?
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {sizeChoices.map((c) => {
            const effective = Math.min(c.size, pool);
            return (
              <button
                key={c.size}
                type="button"
                onClick={() => onPick(c.size, mode, filter)}
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
  pendingEarn,
  onPendingClaimed,
  onPlayAgain,
  onBack,
}: {
  result: Result;
  earnNote: string | null;
  pendingEarn: PendingEarn | null;
  onPendingClaimed: (cents: number) => void;
  onPlayAgain: () => void;
  onBack: () => void;
}) {
  const pct = result.total > 0 ? Math.round((result.score / result.total) * 100) : 0;
  const perfect = result.score === result.total;
  const headline = perfect
    ? `Perfect! ${result.score} of ${result.total}!`
    : `You got ${result.score} of ${result.total}!`;
  const cheer = perfect
    ? 'Continental expert!'
    : pct >= 80 ? 'Great round!'
    : pct >= 50 ? 'Nice — keep practicing.'
    : 'Good try — practice makes perfect.';

  const modeLabel = result.mode === 'continent-to-country'
    ? 'Continent → Country'
    : 'Country → Continent';
  const subline = [modeLabel];
  if (result.continentFilter && result.mode === 'country-to-continent') {
    subline.push(`${result.continentFilter} only`);
  }

  return (
    <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl border border-sky-100 p-5 md:p-6 max-h-[80vh] overflow-y-auto">
      <div className="text-center mb-4">
        <div className="text-4xl md:text-5xl mb-2">{perfect ? '🏆' : '🎉'}</div>
        <h2 className="text-xl md:text-2xl font-black text-sky-900 mb-1">{headline}</h2>
        <p className="text-sm text-sky-700">
          {subline.join(' · ')} — {cheer}
        </p>
      </div>

      {pendingEarn ? (
        <PendingEarnPrompt
          pending={{
            section: pendingEarn.section,
            kind: pendingEarn.kind,
            payload: pendingEarn.payload,
            idempotencyKey: pendingEarn.idempotencyKey,
            centsEarned: pendingEarn.centsEarned,
            reason: pendingEarn.reason,
          }}
          onClaimed={onPendingClaimed}
        />
      ) : earnNote ? (
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-3 mb-4 text-center text-sm font-bold text-yellow-900">
          💰 {earnNote}
        </div>
      ) : null}

      {result.misses.length > 0 && (
        <div className="bg-sky-50 rounded-xl p-3 md:p-4 mb-4 border border-sky-100">
          <h3 className="text-xs font-bold text-sky-900 mb-2 uppercase tracking-wide">
            Countries to review ({result.misses.length})
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {result.misses.map((iso2) => (
              <span
                key={iso2}
                className="inline-block bg-white border border-sky-200 text-sky-800 text-xs md:text-sm font-medium px-2.5 py-0.5 rounded-full"
              >
                {nameForIso2(iso2)}
                <span className="ml-1 text-gray-500">({continentForIso2(iso2)})</span>
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
