// FlagMatchEngine — orchestrates a flag-match round in one of two directions.
//
// Modes:
//   'find-flag' — prompt is a STATE NAME; kid clicks the matching flag tile.
//                 Six tiles below: 1 correct flag + 5 distractor flags (no names).
//   'name-state'— prompt is a single FLAG (big at top); kid clicks the matching
//                 state-name button from 6 options.
//
// State machine (mode-agnostic):
//   ASK    — waiting for the kid to click
//   RIGHT  — green ring + check overlay for 800ms, then advance
//   WRONG  — red border + shake on clicked tile, green ring on correct, 1500ms
//
// Timers tracked in a ref so unmount / re-render cancels pending advances.
//
// Flag images are served from /geography/flags/<postal>.svg. We use a plain
// <img> tag (not next/image) because SVGs are already tiny and Next's optimizer
// would just round-trip them; <img> also degrades gracefully to the alt text
// when a file is missing.
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import statesData from '@/data/states.json';

type StateRecord = {
  postal: string;
  name: string;
  capital: string;
  region?: string;
};

export type FlagMatchMode = 'find-flag' | 'name-state';
export type FlagRegion = null | 'Northeast' | 'Midwest' | 'South' | 'West';

export type FlagMatchEngineProps = {
  questionCount: number;
  mode: FlagMatchMode;
  region?: FlagRegion;
  onComplete: (result: { score: number; total: number; misses: string[] }) => void;
};

// Quiz pool excludes DC for parity with the other quizzes (50 states).
const ALL_STATES = (statesData as StateRecord[]).filter((s) => s.postal !== 'DC');

const RIGHT_DELAY_MS = 800;
const WRONG_DELAY_MS = 1500;
const OPTIONS_PER_QUESTION = 6;

type Phase = 'ask' | 'right' | 'wrong';

// Fisher-Yates over a copy. Pure.
function pickRandom<T>(source: T[], n: number): T[] {
  const copy = source.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

// Build 6 options for one question: the answer + 5 distractors drawn from
// the global 50-state pool (NOT the region pool — distractors from outside
// the region make the game less monotonous when a region filter is on).
function buildOptions(answer: StateRecord): StateRecord[] {
  const distractors = ALL_STATES.filter((s) => s.postal !== answer.postal);
  const picked = pickRandom(distractors, OPTIONS_PER_QUESTION - 1);
  return pickRandom([answer, ...picked], OPTIONS_PER_QUESTION);
}

function flagPath(postal: string): string {
  return `/geography/flags/${postal.toLowerCase()}.svg`;
}

export default function FlagMatchEngine({
  questionCount,
  mode,
  region = null,
  onComplete,
}: FlagMatchEngineProps) {
  // Question queue frozen for the round — no reshuffle on re-render.
  const queue = useMemo(() => {
    const pool = region ? ALL_STATES.filter((s) => s.region === region) : ALL_STATES;
    return pickRandom(pool, questionCount);
  }, [questionCount, region]);

  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<Phase>('ask');
  const [clickedPostal, setClickedPostal] = useState<string | null>(null);
  const missesRef = useRef<string[]>([]);
  const scoreRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const current = queue[index];

  // Options frozen per question (don't reshuffle while user is staring at them).
  const options = useMemo(
    () => (current ? buildOptions(current) : []),
    [current],
  );

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
    setClickedPostal(null);
  }, [index, queue.length, onComplete]);

  const handlePick = useCallback(
    (pickedPostal: string) => {
      // Ignore clicks while a feedback flash is in flight.
      if (phase !== 'ask' || !current) return;
      setClickedPostal(pickedPostal);
      if (pickedPostal === current.postal) {
        scoreRef.current += 1;
        setScore(scoreRef.current);
        setPhase('right');
        if (timerRef.current !== null) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(advance, RIGHT_DELAY_MS);
      } else {
        setPhase('wrong');
        if (!missesRef.current.includes(current.postal)) {
          missesRef.current.push(current.postal);
        }
        if (timerRef.current !== null) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(advance, WRONG_DELAY_MS);
      }
    },
    [phase, current, advance],
  );

  if (!current) return null;

  const progressPct = ((index + (phase === 'ask' ? 0 : 1)) / queue.length) * 100;

  return (
    <div className="h-full w-full flex flex-col">
      {/* Top strip: progress + score + prompt */}
      <div className="shrink-0 bg-white/90 backdrop-blur-sm border-b border-emerald-200 px-3 sm:px-4 py-3">
        <div className="flex items-center justify-between mb-2 text-xs sm:text-sm font-bold text-emerald-800">
          <span>
            Question {index + 1} of {queue.length}
          </span>
          <span>
            Score: {score} / {queue.length}
          </span>
        </div>
        <div className="w-full bg-emerald-100 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-teal-500 to-emerald-600 h-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Prompt area */}
      <div className="shrink-0 flex flex-col items-center justify-center px-3 py-4 sm:py-5">
        {mode === 'find-flag' ? (
          <>
            <div className="text-[11px] uppercase tracking-wide text-emerald-700 font-bold mb-1">
              Find the flag for
            </div>
            <div className="text-3xl sm:text-4xl md:text-5xl font-black text-emerald-900 text-center leading-tight">
              {current.name}
            </div>
          </>
        ) : (
          <>
            <div className="text-[11px] uppercase tracking-wide text-emerald-700 font-bold mb-2">
              Which state is this?
            </div>
            <div
              className={`bg-white border-4 rounded-xl overflow-hidden shadow-md w-44 sm:w-56 md:w-64 transition-all ${
                phase === 'right'
                  ? 'border-emerald-500 ring-4 ring-emerald-300'
                  : 'border-emerald-200'
              }`}
              style={{ aspectRatio: '3 / 2' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={flagPath(current.postal)}
                alt={`Flag of ${current.name}`}
                className="w-full h-full object-cover"
              />
            </div>
          </>
        )}
        {phase === 'wrong' && (
          <div className="mt-3 text-sm sm:text-base font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-full px-3 py-1">
            Answer: {current.name}
          </div>
        )}
        {phase === 'right' && (
          <div className="mt-3 text-sm sm:text-base font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
            Correct!
          </div>
        )}
      </div>

      {/* Options grid */}
      <div className="flex-1 min-h-0 w-full px-3 sm:px-4 pb-4 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {mode === 'find-flag' ? (
            <FlagOptions
              options={options}
              answerPostal={current.postal}
              clickedPostal={clickedPostal}
              phase={phase}
              onPick={handlePick}
            />
          ) : (
            <NameOptions
              options={options}
              answerPostal={current.postal}
              clickedPostal={clickedPostal}
              phase={phase}
              onPick={handlePick}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ----- Option grids -----

type OptionGridProps = {
  options: StateRecord[];
  answerPostal: string;
  clickedPostal: string | null;
  phase: Phase;
  onPick: (postal: string) => void;
};

function FlagOptions({ options, answerPostal, clickedPostal, phase, onPick }: OptionGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
      {options.map((opt) => {
        const isAnswer = opt.postal === answerPostal;
        const isClicked = opt.postal === clickedPostal;
        const ring = ringClass(phase, isAnswer, isClicked);
        const shake = phase === 'wrong' && isClicked ? 'animate-shake' : '';
        const disabled = phase !== 'ask';
        return (
          <button
            key={opt.postal}
            type="button"
            disabled={disabled}
            onClick={() => onPick(opt.postal)}
            className={`relative bg-white border-2 rounded-lg overflow-hidden transition-all
              ${disabled ? 'cursor-default' : 'cursor-pointer hover:scale-105 hover:shadow-lg'}
              ${ring} ${shake}`}
            style={{ aspectRatio: '3 / 2' }}
            aria-label={`Flag option ${opt.postal}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={flagPath(opt.postal)}
              alt={`Flag ${opt.postal}`}
              className="w-full h-full object-cover pointer-events-none"
            />
            {phase === 'right' && isAnswer && (
              <span className="absolute inset-0 flex items-center justify-center text-5xl sm:text-6xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] pointer-events-none">
                ✓
              </span>
            )}
            {phase === 'wrong' && isAnswer && (
              <span className="absolute inset-0 flex items-center justify-center text-4xl sm:text-5xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] pointer-events-none">
                ✓
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function NameOptions({ options, answerPostal, clickedPostal, phase, onPick }: OptionGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
      {options.map((opt) => {
        const isAnswer = opt.postal === answerPostal;
        const isClicked = opt.postal === clickedPostal;
        const disabled = phase !== 'ask';
        const base =
          'rounded-xl px-3 py-3 sm:py-4 text-center font-black text-base sm:text-lg shadow-md border-2 transition-all';
        let style: string;
        if (phase === 'ask') {
          style =
            'bg-gradient-to-br from-teal-500 to-emerald-600 text-white border-emerald-700 hover:from-teal-400 hover:to-emerald-500 hover:scale-105 hover:shadow-lg cursor-pointer';
        } else if (phase === 'right' && isAnswer) {
          style = 'bg-emerald-500 text-white border-emerald-700 ring-4 ring-emerald-300 cursor-default';
        } else if (phase === 'wrong' && isAnswer) {
          style = 'bg-emerald-500 text-white border-emerald-700 ring-4 ring-emerald-300 cursor-default';
        } else if (phase === 'wrong' && isClicked) {
          style = 'bg-rose-500 text-white border-rose-700 animate-shake cursor-default';
        } else {
          style = 'bg-white text-emerald-800 border-emerald-200 opacity-60 cursor-default';
        }
        return (
          <button
            key={opt.postal}
            type="button"
            disabled={disabled}
            onClick={() => onPick(opt.postal)}
            className={`${base} ${style}`}
          >
            {opt.name}
          </button>
        );
      })}
    </div>
  );
}

// Ring style for a flag tile based on phase + role.
function ringClass(phase: Phase, isAnswer: boolean, isClicked: boolean): string {
  if (phase === 'ask') return 'border-gray-300';
  if (phase === 'right' && isAnswer) return 'border-emerald-500 ring-4 ring-emerald-300';
  if (phase === 'wrong' && isAnswer) return 'border-emerald-500 ring-4 ring-emerald-300';
  if (phase === 'wrong' && isClicked) return 'border-rose-500 ring-4 ring-rose-300';
  return 'border-gray-200 opacity-60';
}
