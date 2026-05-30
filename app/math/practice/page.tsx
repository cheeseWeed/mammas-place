'use client';

// Math practice — three views in one route:
//
//   1) Config:   kid picks operations (+/−/×/÷ or mix), difficulty (easy/medium/hard),
//                round size, per-question timer (seconds).
//   2) Playing:  one problem at a time, ticking timer, type-the-answer input,
//                Enter to submit. On timer expire: show the correct answer for
//                ~1.5s, mark wrong, auto-advance.
//   3) Results:  score, accuracy, best streak, avg answer speed, MP earned
//                (server-decided), and Play Again / New Settings buttons.
//
// MP earning: server computes from {correct, total, difficulty, speed, streak}.
// Kid client cannot dictate cents. Idempotency key prevents double-credit.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import LoginGate from '@/components/LoginGate';
import { useLearner } from '@/context/LearnerContext';
import {
  DEFAULT_ROUND,
  generateRound,
  operationLabel,
  ROUND_SIZES,
  TIMER_CHOICES,
  type Difficulty,
  type MathProblem,
  type Operation,
  type RoundConfig,
} from '@/lib/math/engine';
import { newIdempotencyKey, submitEarn } from '@/lib/money/earn-client';
import { centsToMP } from '@/lib/money/format';

export default function MathPracticePage() {
  return (
    <LoginGate
      section="math"
      loadingFallback={
        <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white py-12 px-4">
          <div className="max-w-2xl mx-auto text-center text-sky-700">Loading…</div>
        </div>
      }
    >
      <MathPracticeAuthed />
    </LoginGate>
  );
}

type View =
  | { kind: 'config' }
  | { kind: 'playing'; problems: MathProblem[]; config: RoundConfig }
  | { kind: 'results'; summary: RoundSummary };

type RoundSummary = {
  config: RoundConfig;
  correct: number;
  total: number;
  bestStreak: number;
  avgAnswerMs: number;
  mpEarnedCents: number | null;     // null = pending / not authed / failed
  mpReason: string;
  mpCapped: boolean;
};

function MathPracticeAuthed() {
  const [view, setView] = useState<View>({ kind: 'config' });

  const startRound = useCallback((config: RoundConfig) => {
    const problems = generateRound(config.ops, config.difficulty, config.questions);
    setView({ kind: 'playing', problems, config });
  }, []);

  const finishRound = useCallback((summary: RoundSummary) => {
    setView({ kind: 'results', summary });
  }, []);

  const backToConfig = useCallback(() => setView({ kind: 'config' }), []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-cyan-50 to-white py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-6">
          <Link
            href="/math"
            className="text-sky-700 hover:text-sky-900 text-sm font-semibold"
          >
            ← Math Arena
          </Link>
        </div>

        {view.kind === 'config' && <ConfigCard onStart={startRound} />}
        {view.kind === 'playing' && (
          <PlayCard
            problems={view.problems}
            config={view.config}
            onFinish={finishRound}
          />
        )}
        {view.kind === 'results' && (
          <ResultsCard
            summary={view.summary}
            onPlayAgain={() => startRound(view.summary.config)}
            onNewSettings={backToConfig}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 1) CONFIG
// ============================================================================

const ALL_OPS: { key: Operation; label: string; symbol: string }[] = [
  { key: 'add', label: 'Add', symbol: '+' },
  { key: 'sub', label: 'Subtract', symbol: '−' },
  { key: 'mul', label: 'Multiply', symbol: '×' },
  { key: 'div', label: 'Divide', symbol: '÷' },
];

const DIFFICULTIES: { key: Difficulty; label: string; blurb: string }[] = [
  { key: 'easy', label: 'Easy', blurb: 'small numbers' },
  { key: 'medium', label: 'Medium', blurb: 'middle numbers' },
  { key: 'hard', label: 'Hard', blurb: 'bigger numbers' },
];

function ConfigCard({ onStart }: { onStart: (config: RoundConfig) => void }) {
  const [ops, setOps] = useState<Operation[]>(DEFAULT_ROUND.ops);
  const [difficulty, setDifficulty] = useState<Difficulty>(DEFAULT_ROUND.difficulty);
  const [questions, setQuestions] = useState<number>(DEFAULT_ROUND.questions);
  const [perQuestionSeconds, setPerQuestionSeconds] = useState<number>(
    DEFAULT_ROUND.perQuestionSeconds,
  );

  const toggleOp = (op: Operation) => {
    setOps((curr) => {
      if (curr.includes(op)) {
        // Don't allow zero ops.
        if (curr.length === 1) return curr;
        return curr.filter((o) => o !== op);
      }
      return [...curr, op];
    });
  };

  const setMix = () => setOps(['add', 'sub', 'mul', 'div']);
  const isMix = ops.length === 4;

  const handleStart = () => {
    onStart({ ops, difficulty, questions, perQuestionSeconds });
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl border-2 border-sky-200 p-6 md:p-8">
      <div className="text-center mb-6">
        <div className="text-5xl mb-2">⚡</div>
        <h2 className="text-2xl md:text-3xl font-black text-sky-900">Set up your drill</h2>
        <p className="text-sm text-sky-700 mt-1">Pick what to practice. Then beat the clock.</p>
      </div>

      {/* Operations */}
      <fieldset className="mb-6">
        <legend className="block text-sm font-bold text-sky-900 mb-2">Operations</legend>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {ALL_OPS.map((op) => {
            const on = ops.includes(op.key);
            return (
              <button
                key={op.key}
                type="button"
                onClick={() => toggleOp(op.key)}
                className={`rounded-xl border-2 px-3 py-3 font-bold text-sm transition-all ${
                  on
                    ? 'border-sky-600 bg-sky-600 text-white shadow-md'
                    : 'border-sky-200 bg-sky-50 text-sky-900 hover:border-sky-400'
                }`}
              >
                <span className="text-xl mr-1">{op.symbol}</span>
                {op.label}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={setMix}
            className={`underline font-bold ${
              isMix ? 'text-sky-900' : 'text-sky-700 hover:text-sky-900'
            }`}
          >
            🎲 Mix all four
          </button>
          <span className="text-sky-700">Tap to toggle. Pick any combo.</span>
        </div>
      </fieldset>

      {/* Difficulty */}
      <fieldset className="mb-6">
        <legend className="block text-sm font-bold text-sky-900 mb-2">Difficulty</legend>
        <div className="grid grid-cols-3 gap-2">
          {DIFFICULTIES.map((d) => {
            const on = difficulty === d.key;
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => setDifficulty(d.key)}
                className={`rounded-xl border-2 px-3 py-3 font-bold text-sm transition-all ${
                  on
                    ? 'border-sky-600 bg-sky-600 text-white shadow-md'
                    : 'border-sky-200 bg-sky-50 text-sky-900 hover:border-sky-400'
                }`}
              >
                {d.label}
                <div className={`text-[11px] font-medium mt-0.5 ${on ? 'text-sky-100' : 'text-sky-700'}`}>
                  {d.blurb}
                </div>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Questions per round */}
      <fieldset className="mb-6">
        <legend className="block text-sm font-bold text-sky-900 mb-2">
          How many questions?
        </legend>
        <div className="grid grid-cols-4 gap-2">
          {ROUND_SIZES.map((n) => {
            const on = questions === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setQuestions(n)}
                className={`rounded-xl border-2 px-3 py-3 font-bold text-base transition-all ${
                  on
                    ? 'border-sky-600 bg-sky-600 text-white shadow-md'
                    : 'border-sky-200 bg-sky-50 text-sky-900 hover:border-sky-400'
                }`}
              >
                {n}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Timer */}
      <fieldset className="mb-6">
        <legend className="block text-sm font-bold text-sky-900 mb-2">
          Time per question (seconds)
        </legend>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {TIMER_CHOICES.map((s) => {
            const on = perQuestionSeconds === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setPerQuestionSeconds(s)}
                className={`rounded-xl border-2 px-2 py-3 font-bold text-sm transition-all ${
                  on
                    ? 'border-sky-600 bg-sky-600 text-white shadow-md'
                    : 'border-sky-200 bg-sky-50 text-sky-900 hover:border-sky-400'
                }`}
              >
                {s}s
              </button>
            );
          })}
        </div>
        <p className="text-xs text-sky-700 mt-2">
          Faster choices earn more MP per right answer. Pick what feels challenging.
        </p>
      </fieldset>

      <button
        type="button"
        onClick={handleStart}
        className="w-full bg-gradient-to-r from-sky-600 to-cyan-700 hover:from-sky-700 hover:to-cyan-800 text-white font-black text-lg py-4 rounded-2xl shadow-md hover:shadow-lg transition-all"
      >
        Start drill →
      </button>
    </div>
  );
}

// ============================================================================
// 2) PLAY
// ============================================================================

type Answered = {
  problem: MathProblem;
  typed: string;          // what the kid entered (or empty if timed out)
  correct: boolean;
  timedOut: boolean;
  elapsedMs: number;      // time spent on this question
};

const REVEAL_MS = 1200; // brief "the answer was N" flash after expiry/wrong

function PlayCard({
  problems,
  config,
  onFinish,
}: {
  problems: MathProblem[];
  config: RoundConfig;
  onFinish: (summary: RoundSummary) => void;
}) {
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState('');
  const [answered, setAnswered] = useState<Answered[]>([]);
  const [reveal, setReveal] = useState<{ correctAnswer: number; userTyped: string } | null>(null);
  const [remainingMs, setRemainingMs] = useState(config.perQuestionSeconds * 1000);

  const questionStartedAt = useRef<number>(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  const total = problems.length;
  const current = problems[index];
  const totalMs = config.perQuestionSeconds * 1000;

  // Focus the input each time we move to a fresh problem (and we're not in
  // the brief reveal flash, where it would be distracting).
  useEffect(() => {
    if (reveal === null) {
      questionStartedAt.current = Date.now();
      setRemainingMs(totalMs);
      setTyped('');
      // Defer focus so the new problem is in the DOM first
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [index, reveal, totalMs]);

  // Timer tick — 100ms granularity is smooth enough for the bar and cheap.
  useEffect(() => {
    if (reveal !== null) return;
    const tick = setInterval(() => {
      const elapsed = Date.now() - questionStartedAt.current;
      const remaining = Math.max(0, totalMs - elapsed);
      setRemainingMs(remaining);
      if (remaining <= 0) {
        clearInterval(tick);
        handleExpire();
      }
    }, 100);
    return () => clearInterval(tick);
    // handleExpire is stable via the deps below; avoid putting it in to keep
    // the interval from being torn down every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, reveal, totalMs]);

  const advance = useCallback(
    (entry: Answered) => {
      const next = [...answered, entry];
      setAnswered(next);
      setReveal(null);
      if (index + 1 >= total) {
        // Compute summary
        const correct = next.filter((a) => a.correct).length;
        let bestStreak = 0;
        let streak = 0;
        for (const a of next) {
          if (a.correct) {
            streak += 1;
            if (streak > bestStreak) bestStreak = streak;
          } else {
            streak = 0;
          }
        }
        const correctAnswers = next.filter((a) => a.correct);
        const avgAnswerMs = correctAnswers.length
          ? Math.round(
              correctAnswers.reduce((sum, a) => sum + a.elapsedMs, 0) /
                correctAnswers.length,
            )
          : 0;
        onFinish({
          config,
          correct,
          total,
          bestStreak,
          avgAnswerMs,
          mpEarnedCents: null,
          mpReason: '',
          mpCapped: false,
        });
        return;
      }
      setIndex(index + 1);
    },
    [answered, config, index, onFinish, total],
  );

  // On timer expire: reveal the correct answer, mark wrong, then auto-advance.
  function handleExpire() {
    if (reveal !== null) return;
    const elapsedMs = Date.now() - questionStartedAt.current;
    const entry: Answered = {
      problem: current,
      typed: '',
      correct: false,
      timedOut: true,
      elapsedMs,
    };
    setReveal({ correctAnswer: current.answer, userTyped: '' });
    setTimeout(() => advance(entry), REVEAL_MS);
  }

  function handleSubmit() {
    if (reveal !== null) return;
    const trimmed = typed.trim();
    if (trimmed === '') return; // ignore empty submits
    const num = Number(trimmed);
    if (!Number.isInteger(num)) return;

    const elapsedMs = Date.now() - questionStartedAt.current;
    const isCorrect = num === current.answer;
    const entry: Answered = {
      problem: current,
      typed: trimmed,
      correct: isCorrect,
      timedOut: false,
      elapsedMs,
    };
    if (isCorrect) {
      advance(entry);
    } else {
      // Wrong answer — show the reveal flash too, so the kid sees what they
      // should have said. Same timing as expiry.
      setReveal({ correctAnswer: current.answer, userTyped: trimmed });
      setTimeout(() => advance(entry), REVEAL_MS);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  }

  const progressPct = totalMs > 0 ? Math.round((remainingMs / totalMs) * 100) : 0;
  const timerColor =
    remainingMs < totalMs * 0.25
      ? 'bg-red-500'
      : remainingMs < totalMs * 0.5
        ? 'bg-amber-500'
        : 'bg-sky-500';

  const liveStreak = useMemo(() => {
    let s = 0;
    for (let i = answered.length - 1; i >= 0; i--) {
      if (answered[i].correct) s += 1;
      else break;
    }
    return s;
  }, [answered]);

  return (
    <div className="bg-white rounded-3xl shadow-xl border-2 border-sky-200 p-6 md:p-8">
      {/* Header row: Q i/N + streak */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-bold text-sky-700">
          Question {index + 1} of {total}
        </span>
        <span className="text-sm font-bold text-sky-900">
          🔥 Streak: {liveStreak}
        </span>
      </div>

      {/* Timer bar */}
      <div className="h-3 w-full bg-sky-100 rounded-full overflow-hidden mb-6">
        <div
          className={`h-full transition-all duration-100 ${timerColor}`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Problem */}
      <div className="text-center mb-6">
        <div className="text-5xl md:text-6xl font-black text-sky-900 tabular-nums">
          {current.prompt} = ?
        </div>
      </div>

      {/* Reveal flash */}
      {reveal !== null ? (
        <div className="text-center bg-amber-50 border-2 border-amber-200 rounded-2xl p-5">
          <div className="text-sm font-bold text-amber-800 mb-1">
            {reveal.userTyped ? 'Not quite — ' : "Time's up — "}
            the answer is
          </div>
          <div className="text-4xl font-black text-amber-900 tabular-nums">
            {reveal.correctAnswer}
          </div>
        </div>
      ) : (
        <div>
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="-?\d*"
            value={typed}
            onChange={(e) => setTyped(e.target.value.replace(/[^\d-]/g, '').slice(0, 7))}
            onKeyDown={onKeyDown}
            placeholder="Your answer"
            className="w-full text-center text-3xl md:text-4xl font-black tabular-nums rounded-2xl border-2 border-sky-300 focus:border-sky-500 focus:outline-none bg-sky-50 text-sky-900 px-4 py-4"
            aria-label="Your answer"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={typed.trim() === ''}
            className="w-full mt-3 bg-sky-600 hover:bg-sky-700 disabled:bg-sky-300 text-white font-black text-lg py-3 rounded-2xl shadow-md transition-colors"
          >
            Answer (Enter ↵)
          </button>
        </div>
      )}

      <div className="text-center text-xs text-sky-700 mt-4">
        {config.perQuestionSeconds}s per question · {operationsLabel(config.ops)} ·{' '}
        {config.difficulty}
      </div>
    </div>
  );
}

function operationsLabel(ops: Operation[]): string {
  if (ops.length === 4) return 'Mix';
  return ops.map(operationLabel).join(' · ');
}

// ============================================================================
// 3) RESULTS
// ============================================================================

function ResultsCard({
  summary,
  onPlayAgain,
  onNewSettings,
}: {
  summary: RoundSummary;
  onPlayAgain: () => void;
  onNewSettings: () => void;
}) {
  const { refresh } = useLearner();
  const [earnState, setEarnState] = useState<
    | { kind: 'pending' }
    | { kind: 'done'; cents: number; reason: string; capped: boolean }
    | { kind: 'error'; message: string }
  >({ kind: 'pending' });

  // Submit earning ONCE per round. Idempotency key locked to this mount.
  const idempotencyKey = useMemo(() => newIdempotencyKey('math-round'), []);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    (async () => {
      const res = await submitEarn(
        'math',
        'round',
        {
          correct: summary.correct,
          total: summary.total,
          difficulty: summary.config.difficulty,
          perQuestionSeconds: summary.config.perQuestionSeconds,
          avgAnswerMs: summary.avgAnswerMs,
          bestStreak: summary.bestStreak,
          operations: operationsLabel(summary.config.ops),
        },
        idempotencyKey,
      );
      if ('error' in res) {
        setEarnState({ kind: 'error', message: res.error });
        return;
      }
      setEarnState({
        kind: 'done',
        cents: res.centsEarned,
        reason: res.reason,
        capped: res.capped === true,
      });
      // Refresh balance chip in header
      void refresh();
    })();
  }, [summary, idempotencyKey, refresh]);

  const pct = summary.total > 0 ? Math.round((summary.correct / summary.total) * 100) : 0;
  const avgSec = summary.avgAnswerMs > 0 ? (summary.avgAnswerMs / 1000).toFixed(1) : '—';

  return (
    <div className="bg-white rounded-3xl shadow-xl border-2 border-sky-200 p-6 md:p-8">
      <div className="text-center mb-6">
        <div className="text-5xl mb-2">{pct === 100 ? '🏆' : pct >= 80 ? '🎉' : '✏️'}</div>
        <h2 className="text-2xl md:text-3xl font-black text-sky-900">Round complete</h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Score" value={`${summary.correct}/${summary.total}`} emoji="✅" />
        <Stat label="Accuracy" value={`${pct}%`} emoji="🎯" />
        <Stat label="Best streak" value={String(summary.bestStreak)} emoji="🔥" />
        <Stat label="Avg time" value={`${avgSec}s`} emoji="⏱️" />
      </div>

      <div className="rounded-2xl border-2 border-yellow-300 bg-yellow-50 p-4 mb-6 text-center">
        {earnState.kind === 'pending' && (
          <div className="text-yellow-800 font-bold">Calculating MP…</div>
        )}
        {earnState.kind === 'done' && earnState.cents > 0 && (
          <>
            <div className="text-xs uppercase tracking-wide text-yellow-800 font-bold">
              MP earned
            </div>
            <div className="text-4xl font-black text-yellow-900 my-1">
              +{centsToMP(earnState.cents)}
            </div>
            <div className="text-xs text-yellow-800">{earnState.reason}</div>
          </>
        )}
        {earnState.kind === 'done' && earnState.cents === 0 && (
          <div className="text-yellow-900 text-sm">
            {earnState.reason || 'No MP earned this round.'}
          </div>
        )}
        {earnState.kind === 'error' && (
          <div className="text-red-700 text-sm">
            Couldn&apos;t record MP: {earnState.message}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onPlayAgain}
          className="bg-sky-600 hover:bg-sky-700 text-white font-black py-3 rounded-2xl transition-colors"
        >
          Play again (same settings)
        </button>
        <button
          type="button"
          onClick={onNewSettings}
          className="bg-white border-2 border-sky-300 hover:border-sky-500 text-sky-900 font-bold py-3 rounded-2xl transition-colors"
        >
          Change settings
        </button>
      </div>

      <div className="text-center mt-5 text-xs text-sky-700">
        <Link href="/math" className="underline hover:text-sky-900">
          ← Back to Math Arena
        </Link>
        {' · '}
        <Link href="/portal/money" className="underline hover:text-sky-900">
          See my MP
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value, emoji }: { label: string; value: string; emoji: string }) {
  return (
    <div className="bg-sky-50 border border-sky-200 rounded-2xl p-3 text-center">
      <div className="text-2xl mb-1">{emoji}</div>
      <div className="text-xl font-black text-sky-900 tabular-nums">{value}</div>
      <div className="text-xs text-sky-700 mt-0.5">{label}</div>
    </div>
  );
}
