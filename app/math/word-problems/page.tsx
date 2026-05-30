'use client';

// Math → Word Problems (Phase 3).
//
// Read it, picture it, solve it. Hand-authored item bank in
// lib/math/word-problems. One problem at a time, kid types a number.
//
// No timer — word problems are about reading carefully and reasoning, not
// speed. Config: difficulty + optional op filter + round size.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import LoginGate from '@/components/LoginGate';
import { useLearner } from '@/context/LearnerContext';
import {
  DEFAULT_WORD_PROBLEM_CONFIG,
  pickWordRound,
  wordOpLabel,
  WORD_PROBLEM_ROUND_SIZES,
  type WordDifficulty,
  type WordOp,
  type WordProblem,
  type WordProblemConfig,
} from '@/lib/math/word-problems';
import {
  isPending,
  newIdempotencyKey,
  submitEarn,
  type EarnResponse,
} from '@/lib/money/earn-client';
import { centsToMP } from '@/lib/money/format';
import PendingEarnPrompt from '@/components/PendingEarnPrompt';

export default function WordProblemsPage() {
  return (
    <LoginGate
      section="math"
      loadingFallback={
        <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white py-12 px-4">
          <div className="max-w-2xl mx-auto text-center text-sky-700">Loading…</div>
        </div>
      }
    >
      <WordProblemsAuthed />
    </LoginGate>
  );
}

type View =
  | { kind: 'config' }
  | { kind: 'playing'; items: WordProblem[]; config: WordProblemConfig }
  | { kind: 'results'; summary: RoundSummary };

type RoundSummary = {
  config: WordProblemConfig;
  correct: number;
  total: number;
  bestStreak: number;
};

function WordProblemsAuthed() {
  const [view, setView] = useState<View>({ kind: 'config' });

  const startRound = useCallback((config: WordProblemConfig) => {
    const items = pickWordRound(
      { difficulty: config.difficulty, op: config.op },
      config.questions,
    );
    if (items.length === 0) {
      // No items match the filter — guard so we never render an empty drill.
      // (Shouldn't happen with current item bank but keep the safety net.)
      return;
    }
    setView({ kind: 'playing', items, config });
  }, []);

  const finishRound = useCallback((summary: RoundSummary) => {
    setView({ kind: 'results', summary });
  }, []);

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
          <PlayCard items={view.items} config={view.config} onFinish={finishRound} />
        )}
        {view.kind === 'results' && (
          <ResultsCard
            summary={view.summary}
            onPlayAgain={() => startRound(view.summary.config)}
            onNewSettings={() => setView({ kind: 'config' })}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// CONFIG
// ============================================================================

const DIFFICULTIES: { key: WordDifficulty; label: string; blurb: string }[] = [
  { key: 'easy', label: 'Easy', blurb: 'one step' },
  { key: 'medium', label: 'Medium', blurb: 'bigger numbers' },
  { key: 'hard', label: 'Hard', blurb: 'multi-step' },
];

const OPS: { key: WordOp | 'any'; label: string; symbol: string }[] = [
  { key: 'any', label: 'Any', symbol: '🎲' },
  { key: 'add', label: 'Add', symbol: '+' },
  { key: 'sub', label: 'Subtract', symbol: '−' },
  { key: 'mul', label: 'Multiply', symbol: '×' },
  { key: 'div', label: 'Divide', symbol: '÷' },
  { key: 'mix', label: 'Multi-step', symbol: '🔀' },
];

function ConfigCard({ onStart }: { onStart: (c: WordProblemConfig) => void }) {
  const [difficulty, setDifficulty] = useState<WordDifficulty>(
    DEFAULT_WORD_PROBLEM_CONFIG.difficulty,
  );
  const [op, setOp] = useState<WordOp | 'any'>(DEFAULT_WORD_PROBLEM_CONFIG.op);
  const [questions, setQuestions] = useState<number>(DEFAULT_WORD_PROBLEM_CONFIG.questions);

  return (
    <div className="bg-white rounded-3xl shadow-xl border-2 border-sky-200 p-6 md:p-8">
      <div className="text-center mb-6">
        <div className="text-5xl mb-2">📖</div>
        <h2 className="text-2xl md:text-3xl font-black text-sky-900">Word Problems</h2>
        <p className="text-sm text-sky-700 mt-1">
          Read it, picture it, solve it.
        </p>
      </div>

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

      <fieldset className="mb-6">
        <legend className="block text-sm font-bold text-sky-900 mb-2">Operation</legend>
        <div className="grid grid-cols-3 gap-2">
          {OPS.map((o) => {
            const on = op === o.key;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => setOp(o.key)}
                className={`rounded-xl border-2 px-3 py-2 font-bold text-sm transition-all ${
                  on
                    ? 'border-sky-600 bg-sky-600 text-white shadow-md'
                    : 'border-sky-200 bg-sky-50 text-sky-900 hover:border-sky-400'
                }`}
              >
                <span className="text-base mr-1">{o.symbol}</span>
                {o.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-sky-700 mt-2">
          Pick one to focus, or Any for variety.
        </p>
      </fieldset>

      <fieldset className="mb-6">
        <legend className="block text-sm font-bold text-sky-900 mb-2">
          How many problems?
        </legend>
        <div className="grid grid-cols-3 gap-2">
          {WORD_PROBLEM_ROUND_SIZES.map((n) => {
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

      <button
        type="button"
        onClick={() => onStart({ difficulty, op, questions })}
        className="w-full bg-gradient-to-r from-sky-600 to-cyan-700 hover:from-sky-700 hover:to-cyan-800 text-white font-black text-lg py-4 rounded-2xl shadow-md hover:shadow-lg transition-all"
      >
        Start →
      </button>

      <p className="text-xs text-sky-700 text-center mt-3">
        No timer. Read carefully — earn MP for getting it right.
      </p>
    </div>
  );
}

// ============================================================================
// PLAY
// ============================================================================

type Answered = {
  item: WordProblem;
  typed: string;
  correct: boolean;
};

const REVEAL_MS = 1800;

function PlayCard({
  items,
  config,
  onFinish,
}: {
  items: WordProblem[];
  config: WordProblemConfig;
  onFinish: (s: RoundSummary) => void;
}) {
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState('');
  const [answered, setAnswered] = useState<Answered[]>([]);
  const [reveal, setReveal] = useState<Answered | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const total = items.length;
  const current = items[index];

  useEffect(() => {
    if (reveal === null) {
      setTyped('');
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [index, reveal]);

  const advance = useCallback(
    (entry: Answered) => {
      const next = [...answered, entry];
      setAnswered(next);
      setReveal(null);
      if (index + 1 >= total) {
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
        onFinish({ config, correct, total, bestStreak });
        return;
      }
      setIndex(index + 1);
    },
    [answered, config, index, onFinish, total],
  );

  function handleSubmit() {
    if (reveal !== null) return;
    const trimmed = typed.trim();
    if (trimmed === '') return;
    const num = Number(trimmed);
    if (!Number.isInteger(num)) return;

    const isCorrect = num === current.answer;
    const entry: Answered = { item: current, typed: trimmed, correct: isCorrect };
    if (isCorrect) {
      setReveal(entry);
      setTimeout(() => advance(entry), 600);
    } else {
      setReveal(entry);
      setTimeout(() => advance(entry), REVEAL_MS);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  }

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
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-bold text-sky-700">
          Problem {index + 1} of {total}
        </span>
        <span className="text-sm font-bold text-sky-900">
          🔥 Streak: {liveStreak}
        </span>
      </div>

      {/* The problem text */}
      <div className="bg-sky-50 border-2 border-sky-200 rounded-2xl p-5 mb-6">
        <p className="text-lg md:text-xl text-sky-900 leading-relaxed font-medium">
          {current.text}
        </p>
      </div>

      {reveal !== null ? (
        <div
          className={`text-center rounded-2xl p-5 border-2 ${
            reveal.correct
              ? 'bg-emerald-50 border-emerald-300'
              : 'bg-amber-50 border-amber-200'
          }`}
        >
          {reveal.correct ? (
            <>
              <div className="text-3xl">✓</div>
              <div className="text-sm font-bold text-emerald-800 mt-1">
                That&apos;s right!
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-bold text-amber-800 mb-1">
                Not quite — the answer is
              </div>
              <div className="text-4xl font-black text-amber-900 tabular-nums">
                {current.answer}
              </div>
            </>
          )}
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
        {wordOpLabel(config.op)} · {config.difficulty}
      </div>
    </div>
  );
}

// ============================================================================
// RESULTS
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
    | { kind: 'pendingClaim'; response: Extract<EarnResponse, { pending: true }> }
    | { kind: 'error'; message: string }
  >({ kind: 'pending' });

  const idempotencyKey = useMemo(() => newIdempotencyKey('math-wp'), []);
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
          // Word problems have no timer. Send zeros — server formula
          // ignores these in current spec (correct/total/difficulty only).
          perQuestionSeconds: 0,
          avgAnswerMs: 0,
          bestStreak: summary.bestStreak,
          operations: 'word',
        },
        idempotencyKey,
      );
      if ('error' in res) {
        setEarnState({ kind: 'error', message: res.error });
        return;
      }
      if (isPending(res)) {
        setEarnState({ kind: 'pendingClaim', response: res });
        return;
      }
      setEarnState({
        kind: 'done',
        cents: res.centsEarned,
        reason: res.reason,
        capped: res.capped === true,
      });
      void refresh();
    })();
  }, [summary, idempotencyKey, refresh]);

  const pct = summary.total > 0 ? Math.round((summary.correct / summary.total) * 100) : 0;

  return (
    <div className="bg-white rounded-3xl shadow-xl border-2 border-sky-200 p-6 md:p-8">
      <div className="text-center mb-6">
        <div className="text-5xl mb-2">{pct === 100 ? '🏆' : pct >= 80 ? '🎉' : '📖'}</div>
        <h2 className="text-2xl md:text-3xl font-black text-sky-900">Round complete</h2>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Stat label="Score" value={`${summary.correct}/${summary.total}`} emoji="✅" />
        <Stat label="Accuracy" value={`${pct}%`} emoji="🎯" />
        <Stat label="Best streak" value={String(summary.bestStreak)} emoji="🔥" />
      </div>

      {earnState.kind === 'pendingClaim' ? (
        <PendingEarnPrompt
          pending={{
            section: earnState.response.section,
            kind: earnState.response.kind,
            payload: earnState.response.payload,
            idempotencyKey: earnState.response.idempotencyKey,
            centsEarned: earnState.response.centsEarned,
            reason: earnState.response.reason,
          }}
          onClaimed={(cents) =>
            setEarnState({
              kind: 'done',
              cents,
              reason: earnState.response.reason,
              capped: false,
            })
          }
        />
      ) : (
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
      )}

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
