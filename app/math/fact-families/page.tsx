'use client';

// Math → Fact Families drill (Phase 2).
//
// One equation at a time with a single blank. Kid types the missing number.
// No timer — fact families are about pattern recognition, not speed.
//
// Three views in one route (mirrors /math/practice and /language-arts/homophones):
//   1) Config:   op family (add/sub, mul/div, mix), difficulty, round size
//   2) Playing:  one prompt at a time, type-the-answer, Enter to submit
//   3) Results:  score, accuracy, MP earned (server-decided)

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import LoginGate from '@/components/LoginGate';
import { useLearner } from '@/context/LearnerContext';
import {
  DEFAULT_FACT_FAMILY_CONFIG,
  FACT_FAMILY_ROUND_SIZES,
  factFamilyOpLabel,
  generateFactRound,
  type FactEquation,
  type FactFamilyConfig,
  type FactFamilyDifficulty,
  type FactFamilyOp,
} from '@/lib/math/fact-families';
import {
  isPending,
  newIdempotencyKey,
  submitEarn,
  type EarnResponse,
} from '@/lib/money/earn-client';
import { centsToMP } from '@/lib/money/format';
import PendingEarnPrompt from '@/components/PendingEarnPrompt';

export default function FactFamiliesPage() {
  return (
    <LoginGate
      section="math"
      loadingFallback={
        <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white py-12 px-4">
          <div className="max-w-2xl mx-auto text-center text-sky-700">Loading…</div>
        </div>
      }
    >
      <FactFamiliesAuthed />
    </LoginGate>
  );
}

type View =
  | { kind: 'config' }
  | { kind: 'playing'; equations: FactEquation[]; config: FactFamilyConfig }
  | { kind: 'results'; summary: RoundSummary };

type RoundSummary = {
  config: FactFamilyConfig;
  correct: number;
  total: number;
  bestStreak: number;
};

function FactFamiliesAuthed() {
  const [view, setView] = useState<View>({ kind: 'config' });

  const startRound = useCallback((config: FactFamilyConfig) => {
    const equations = generateFactRound(config.op, config.difficulty, config.questions);
    setView({ kind: 'playing', equations, config });
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
          <PlayCard
            equations={view.equations}
            config={view.config}
            onFinish={finishRound}
          />
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

const OPS: { key: FactFamilyOp; label: string; sub: string }[] = [
  { key: 'addsub', label: 'Add / Subtract', sub: '+ and −' },
  { key: 'muldiv', label: 'Multiply / Divide', sub: '× and ÷' },
  { key: 'mix',    label: 'Mix', sub: 'all four' },
];

const DIFFICULTIES: { key: FactFamilyDifficulty; label: string; blurb: string }[] = [
  { key: 'easy', label: 'Easy', blurb: 'small numbers' },
  { key: 'medium', label: 'Medium', blurb: 'middle numbers' },
  { key: 'hard', label: 'Hard', blurb: 'bigger numbers' },
];

function ConfigCard({ onStart }: { onStart: (c: FactFamilyConfig) => void }) {
  const [op, setOp] = useState<FactFamilyOp>(DEFAULT_FACT_FAMILY_CONFIG.op);
  const [difficulty, setDifficulty] = useState<FactFamilyDifficulty>(
    DEFAULT_FACT_FAMILY_CONFIG.difficulty,
  );
  const [questions, setQuestions] = useState<number>(DEFAULT_FACT_FAMILY_CONFIG.questions);

  return (
    <div className="bg-white rounded-3xl shadow-xl border-2 border-sky-200 p-6 md:p-8">
      <div className="text-center mb-6">
        <div className="text-5xl mb-2">🔺</div>
        <h2 className="text-2xl md:text-3xl font-black text-sky-900">Fact Families</h2>
        <p className="text-sm text-sky-700 mt-1">
          Three numbers, four equations. Fill in the blank.
        </p>
      </div>

      <fieldset className="mb-6">
        <legend className="block text-sm font-bold text-sky-900 mb-2">Operations</legend>
        <div className="grid grid-cols-3 gap-2">
          {OPS.map((o) => {
            const on = op === o.key;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => setOp(o.key)}
                className={`rounded-xl border-2 px-3 py-3 font-bold text-sm transition-all ${
                  on
                    ? 'border-sky-600 bg-sky-600 text-white shadow-md'
                    : 'border-sky-200 bg-sky-50 text-sky-900 hover:border-sky-400'
                }`}
              >
                {o.label}
                <div className={`text-[11px] font-medium mt-0.5 ${on ? 'text-sky-100' : 'text-sky-700'}`}>
                  {o.sub}
                </div>
              </button>
            );
          })}
        </div>
      </fieldset>

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
        <legend className="block text-sm font-bold text-sky-900 mb-2">
          How many equations?
        </legend>
        <div className="grid grid-cols-4 gap-2">
          {FACT_FAMILY_ROUND_SIZES.map((n) => {
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
        onClick={() => onStart({ op, difficulty, questions })}
        className="w-full bg-gradient-to-r from-sky-600 to-cyan-700 hover:from-sky-700 hover:to-cyan-800 text-white font-black text-lg py-4 rounded-2xl shadow-md hover:shadow-lg transition-all"
      >
        Start drill →
      </button>

      <p className="text-xs text-sky-700 text-center mt-3">
        No timer — take your time. Earn MP for accuracy.
      </p>
    </div>
  );
}

// ============================================================================
// PLAY
// ============================================================================

type Answered = {
  equation: FactEquation;
  typed: string;
  correct: boolean;
};

const REVEAL_MS = 1400;

function PlayCard({
  equations,
  config,
  onFinish,
}: {
  equations: FactEquation[];
  config: FactFamilyConfig;
  onFinish: (s: RoundSummary) => void;
}) {
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState('');
  const [answered, setAnswered] = useState<Answered[]>([]);
  const [reveal, setReveal] = useState<Answered | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const total = equations.length;
  const current = equations[index];

  // Focus the input each time we move to a fresh equation.
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
    const entry: Answered = { equation: current, typed: trimmed, correct: isCorrect };
    if (isCorrect) {
      // Brief tick flash so success still feels celebrated.
      setReveal(entry);
      setTimeout(() => advance(entry), 500);
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

  // Family chip: show the three numbers so the kid can see the pattern.
  const familyTriple = `${current.family.a}, ${current.family.b}, ${current.family.c}`;

  return (
    <div className="bg-white rounded-3xl shadow-xl border-2 border-sky-200 p-6 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-bold text-sky-700">
          Question {index + 1} of {total}
        </span>
        <span className="text-sm font-bold text-sky-900">
          🔥 Streak: {liveStreak}
        </span>
      </div>

      {/* Family triangle/triple chip */}
      <div className="text-center mb-5">
        <div className="inline-block bg-sky-50 border-2 border-sky-200 rounded-full px-4 py-1 text-xs font-bold text-sky-800 uppercase tracking-wide">
          Family: {familyTriple}
        </div>
      </div>

      {/* The equation prompt */}
      <div className="text-center mb-6">
        <div className="text-4xl md:text-5xl font-black text-sky-900 tabular-nums">
          {current.prompt}
        </div>
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
              <div className="text-sm font-bold text-emerald-800 mt-1">Nice!</div>
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
        {factFamilyOpLabel(config.op)} · {config.difficulty}
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

  const idempotencyKey = useMemo(() => newIdempotencyKey('math-ff'), []);
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
          // Fact families have no timer — flat zeros so the server's
          // logged meta is honest. The reward formula only uses
          // correct/total/difficulty meaningfully anyway.
          perQuestionSeconds: 0,
          avgAnswerMs: 0,
          bestStreak: summary.bestStreak,
          operations: `factfamily:${summary.config.op}`,
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
        <div className="text-5xl mb-2">{pct === 100 ? '🏆' : pct >= 80 ? '🎉' : '🔺'}</div>
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
