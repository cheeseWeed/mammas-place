// Phase W5 — Continent Quiz.
//
// "Which continent is Japan in?" Six big buttons (Antarctica excluded — kids
// rarely have countries there to learn). Prompt is the country name; choices
// are the six populated continents.
//
// Self-contained — no map. Mirrors the engine shape of the other quizzes
// (Picker → In Progress → Results) but the round is just rounds of buttons.
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import countriesData from '@/data/countries.json';
import { readPhase, updatePhase } from '@/lib/geography/progress';
import { newIdempotencyKey, submitEarn } from '@/lib/money/earn-client';
import { useLearner } from '@/context/LearnerContext';

type RoundSize = 5 | 10 | 20 | 50;

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

type Result = {
  size: RoundSize;
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

function nameForIso2(iso2: string): string {
  return COUNTRIES.find((c) => c.iso2 === iso2)?.name ?? iso2;
}

function continentForIso2(iso2: string): string {
  return COUNTRIES.find((c) => c.iso2 === iso2)?.continent ?? '';
}

export default function WorldContinentQuizPage() {
  const [activeSize, setActiveSize] = useState<RoundSize | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  // MP earned message for the most recent finished round.
  const [earnNote, setEarnNote] = useState<string | null>(null);
  const { learner, refresh: refreshBalance } = useLearner();

  function startRound(size: RoundSize) {
    setResult(null);
    setActiveSize(size);
    setEarnNote(null);
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
      score: roundResult.score,
      total: roundResult.total,
      misses: roundResult.misses,
    });
    setActiveSize(null);

    // MP earn — only for logged-in learners. Server decides cents.
    if (learner) {
      const key = newIdempotencyKey('geo-world-continent-quiz');
      void submitEarn(
        'geography',
        'quiz',
        { correct: roundResult.score, total: roundResult.total, quiz: 'world-continent-quiz' },
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
        </div>
      )}

      {inRound && (
        <div className="flex-1 min-h-0">
          <ContinentQuizRound
            key={`round-${activeSize}-${Date.now()}`}
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

// ----- Round engine -----

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

function ContinentQuizRound({
  questionCount,
  onComplete,
}: {
  questionCount: number;
  onComplete: (result: { score: number; total: number; misses: string[] }) => void;
}) {
  const queue = useMemo(() => pickRandom(COUNTRIES, questionCount), [questionCount]);

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

// ----- Picker -----

function RoundPicker({ onPick }: { onPick: (size: RoundSize) => void }) {
  const sizeChoices: Array<{ size: RoundSize; label: string; sub: string }> = [
    { size: 5, label: 'Quick 5', sub: 'Warm-up' },
    { size: 10, label: '10', sub: 'Classic' },
    { size: 20, label: '20', sub: 'Going strong' },
    { size: 50, label: '50', sub: 'Big round' },
  ];

  return (
    <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl border border-sky-100 p-4 md:p-5">
      <h2 className="text-lg md:text-xl font-black text-sky-900 text-center mb-3">
        How many countries should we ask about?
      </h2>
      <p className="text-sm text-center text-gray-600 mb-4">
        We&apos;ll show you a country. You pick which of the six continents it&apos;s in.
      </p>
      <div className="grid grid-cols-4 gap-1.5">
        {sizeChoices.map((c) => (
          <button
            key={c.size}
            type="button"
            onClick={() => onPick(c.size)}
            className="bg-gradient-to-br from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white rounded-xl p-2 md:p-3 shadow-md hover:shadow-lg transition-all"
          >
            <div className="text-xl md:text-2xl font-black leading-tight">{c.label}</div>
            <div className="text-[10px] text-sky-50/90 leading-tight">{c.sub}</div>
          </button>
        ))}
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
    ? 'Continental expert!'
    : pct >= 80 ? 'Great round!'
    : pct >= 50 ? 'Nice — keep practicing.'
    : 'Good try — practice makes perfect.';

  return (
    <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl border border-sky-100 p-5 md:p-6 max-h-[80vh] overflow-y-auto">
      <div className="text-center mb-4">
        <div className="text-4xl md:text-5xl mb-2">{perfect ? '🏆' : '🎉'}</div>
        <h2 className="text-xl md:text-2xl font-black text-sky-900 mb-1">{headline}</h2>
        <p className="text-sm text-sky-700">{cheer}</p>
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
