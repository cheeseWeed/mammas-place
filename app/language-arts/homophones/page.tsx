'use client';

// Language Arts → Homophones drill (Phase L1).
//
// Three views in one route:
//   1) Config:   pick tier (easy/medium/hard), round size.
//   2) Playing:  one sentence at a time with a `____` blank; choices below.
//                On wrong: show the rule for the set and the right answer
//                for ~1.5s, then advance.
//   3) Results:  score, accuracy, MP earned, Play Again / New Settings.
//
// Same MP wiring as Math: server-decided cents via /api/money/earn,
// idempotency-keyed, no daily cap.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import LoginGate from '@/components/LoginGate';
import { useLearner } from '@/context/LearnerContext';
import {
  getSet,
  pickRoundItems,
  type HomophoneItem,
  type HomophoneTier,
} from '@/lib/languageArts/homophones';
import { isPending, newIdempotencyKey, submitEarn, type EarnResponse } from '@/lib/money/earn-client';
import { centsToMP } from '@/lib/money/format';
import PendingEarnPrompt from '@/components/PendingEarnPrompt';

export default function HomophonesPage() {
  return (
    <LoginGate
      section="languageArts"
      loadingFallback={
        <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white py-12 px-4">
          <div className="max-w-2xl mx-auto text-center text-rose-700">Loading…</div>
        </div>
      }
    >
      <HomophonesAuthed />
    </LoginGate>
  );
}

type Config = {
  tier: HomophoneTier;
  questions: number;
};

const DEFAULT_CONFIG: Config = { tier: 'easy', questions: 10 };
const ROUND_SIZES = [5, 10, 15, 20] as const;

type View =
  | { kind: 'config' }
  | { kind: 'playing'; items: HomophoneItem[]; config: Config }
  | { kind: 'results'; summary: RoundSummary };

type RoundSummary = {
  config: Config;
  correct: number;
  total: number;
};

function HomophonesAuthed() {
  const [view, setView] = useState<View>({ kind: 'config' });

  const startRound = useCallback((config: Config) => {
    const items = pickRoundItems({ tier: config.tier }, config.questions);
    if (items.length === 0) {
      // Tier with zero items shouldn't happen with current dataset, but
      // guard anyway so we don't render an empty drill.
      return;
    }
    setView({ kind: 'playing', items, config });
  }, []);

  const finishRound = useCallback((summary: RoundSummary) => {
    setView({ kind: 'results', summary });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-pink-50 to-white py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-6">
          <Link
            href="/language-arts"
            className="text-rose-700 hover:text-rose-900 text-sm font-semibold"
          >
            ← Language Arts
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

const TIERS: { key: HomophoneTier; label: string; blurb: string }[] = [
  { key: 'easy', label: 'Easy', blurb: '2-word pairs' },
  { key: 'medium', label: 'Medium', blurb: '3-word sets' },
  { key: 'hard', label: 'Hard', blurb: 'subtle differences' },
];

function ConfigCard({ onStart }: { onStart: (c: Config) => void }) {
  const [tier, setTier] = useState<HomophoneTier>(DEFAULT_CONFIG.tier);
  const [questions, setQuestions] = useState<number>(DEFAULT_CONFIG.questions);

  return (
    <div className="bg-white rounded-3xl shadow-xl border-2 border-rose-200 p-6 md:p-8">
      <div className="text-center mb-6">
        <div className="text-5xl mb-2">🔤</div>
        <h2 className="text-2xl md:text-3xl font-black text-rose-900">Homophones drill</h2>
        <p className="text-sm text-rose-700 mt-1">
          Fill in the blank with the right word.
        </p>
      </div>

      <fieldset className="mb-6">
        <legend className="block text-sm font-bold text-rose-900 mb-2">Difficulty</legend>
        <div className="grid grid-cols-3 gap-2">
          {TIERS.map((t) => {
            const on = tier === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTier(t.key)}
                className={`rounded-xl border-2 px-3 py-3 font-bold text-sm transition-all ${
                  on
                    ? 'border-rose-600 bg-rose-600 text-white shadow-md'
                    : 'border-rose-200 bg-rose-50 text-rose-900 hover:border-rose-400'
                }`}
              >
                {t.label}
                <div className={`text-[11px] font-medium mt-0.5 ${on ? 'text-rose-100' : 'text-rose-700'}`}>
                  {t.blurb}
                </div>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mb-6">
        <legend className="block text-sm font-bold text-rose-900 mb-2">
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
                    ? 'border-rose-600 bg-rose-600 text-white shadow-md'
                    : 'border-rose-200 bg-rose-50 text-rose-900 hover:border-rose-400'
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
        onClick={() => onStart({ tier, questions })}
        className="w-full bg-gradient-to-r from-rose-600 to-pink-700 hover:from-rose-700 hover:to-pink-800 text-white font-black text-lg py-4 rounded-2xl shadow-md hover:shadow-lg transition-all"
      >
        Start drill →
      </button>
    </div>
  );
}

// ============================================================================
// PLAY
// ============================================================================

type Answered = {
  item: HomophoneItem;
  picked: string;
  correct: boolean;
};

const REVEAL_MS = 1600;

function PlayCard({
  items,
  config,
  onFinish,
}: {
  items: HomophoneItem[];
  config: Config;
  onFinish: (s: RoundSummary) => void;
}) {
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState<Answered[]>([]);
  const [reveal, setReveal] = useState<Answered | null>(null);

  const current = items[index];
  const set = useMemo(() => getSet(current.setId), [current.setId]);
  const choices = set?.words ?? [];

  function pick(word: string) {
    if (reveal !== null) return;
    const isCorrect = word === current.answer;
    const entry: Answered = { item: current, picked: word, correct: isCorrect };

    if (isCorrect) {
      // Brief "✓" flash so the correct pick still feels celebrated.
      setReveal(entry);
      setTimeout(() => advance(entry), 500);
    } else {
      setReveal(entry);
      setTimeout(() => advance(entry), REVEAL_MS);
    }
  }

  function advance(entry: Answered) {
    const next = [...answered, entry];
    setAnswered(next);
    setReveal(null);
    if (index + 1 >= items.length) {
      const correct = next.filter((a) => a.correct).length;
      onFinish({ config, correct, total: items.length });
      return;
    }
    setIndex(index + 1);
  }

  // Render the sentence with the blank highlighted.
  const sentenceParts = current.sentence.split('____');

  return (
    <div className="bg-white rounded-3xl shadow-xl border-2 border-rose-200 p-6 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-bold text-rose-700">
          Question {index + 1} of {items.length}
        </span>
        <span className="text-xs font-semibold text-rose-700 uppercase tracking-wide">
          {config.tier}
        </span>
      </div>

      <div className="text-center mb-6">
        <div className="text-2xl md:text-3xl font-bold text-rose-900 leading-relaxed">
          {sentenceParts.map((part, i) => (
            <span key={i}>
              {part}
              {i < sentenceParts.length - 1 && (
                <span className="inline-block mx-1 px-3 py-0.5 bg-rose-100 border-b-4 border-rose-400 rounded text-rose-700 font-black">
                  ____
                </span>
              )}
            </span>
          ))}
        </div>
      </div>

      <div className={`grid gap-3 ${choices.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
        {choices.map((word) => {
          const isPickedRight =
            reveal !== null && reveal.picked === word && reveal.correct;
          const isPickedWrong =
            reveal !== null && reveal.picked === word && !reveal.correct;
          const isCorrectAnswer =
            reveal !== null && !reveal.correct && word === current.answer;
          let cls = 'bg-rose-50 hover:bg-rose-100 border-rose-300 text-rose-900';
          if (isPickedRight) cls = 'bg-emerald-100 border-emerald-500 text-emerald-900';
          else if (isPickedWrong) cls = 'bg-red-100 border-red-400 text-red-900';
          else if (isCorrectAnswer) cls = 'bg-emerald-100 border-emerald-500 text-emerald-900';

          return (
            <button
              key={word}
              type="button"
              onClick={() => pick(word)}
              disabled={reveal !== null}
              className={`rounded-2xl border-2 px-4 py-4 font-black text-lg transition-all ${cls} disabled:cursor-not-allowed`}
            >
              {word}
              {isPickedRight && <span className="ml-2">✓</span>}
              {isPickedWrong && <span className="ml-2">✗</span>}
              {isCorrectAnswer && <span className="ml-2">(correct)</span>}
            </button>
          );
        })}
      </div>

      {reveal !== null && !reveal.correct && set && (
        <div className="mt-5 rounded-2xl bg-amber-50 border-2 border-amber-200 p-4">
          <div className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-1">
            Rule
          </div>
          <div className="text-sm text-amber-900">{set.rule}</div>
          {current.hint && (
            <div className="text-xs text-amber-800 mt-1 italic">{current.hint}</div>
          )}
        </div>
      )}
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

  const idempotencyKey = useMemo(() => newIdempotencyKey('la-hom'), []);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    (async () => {
      const res = await submitEarn(
        'languageArts',
        'drill',
        {
          correct: summary.correct,
          total: summary.total,
          tier: summary.config.tier,
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
    <div className="bg-white rounded-3xl shadow-xl border-2 border-rose-200 p-6 md:p-8">
      <div className="text-center mb-6">
        <div className="text-5xl mb-2">{pct === 100 ? '🏆' : pct >= 80 ? '🎉' : '📖'}</div>
        <h2 className="text-2xl md:text-3xl font-black text-rose-900">Drill complete</h2>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <Stat label="Score" value={`${summary.correct}/${summary.total}`} emoji="✅" />
        <Stat label="Accuracy" value={`${pct}%`} emoji="🎯" />
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
            setEarnState({ kind: 'done', cents, reason: earnState.response.reason, capped: false })
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
          className="bg-rose-600 hover:bg-rose-700 text-white font-black py-3 rounded-2xl transition-colors"
        >
          Play again
        </button>
        <button
          type="button"
          onClick={onNewSettings}
          className="bg-white border-2 border-rose-300 hover:border-rose-500 text-rose-900 font-bold py-3 rounded-2xl transition-colors"
        >
          Change settings
        </button>
      </div>

      <div className="text-center mt-5 text-xs text-rose-700">
        <Link href="/language-arts" className="underline hover:text-rose-900">
          ← Back to Language Arts
        </Link>
        {' · '}
        <Link href="/portal/money" className="underline hover:text-rose-900">
          See my MP
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value, emoji }: { label: string; value: string; emoji: string }) {
  return (
    <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-center">
      <div className="text-2xl mb-1">{emoji}</div>
      <div className="text-xl font-black text-rose-900 tabular-nums">{value}</div>
      <div className="text-xs text-rose-700 mt-0.5">{label}</div>
    </div>
  );
}
