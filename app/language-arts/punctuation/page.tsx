'use client';

// Language Arts → Punctuation drill (Phase L3).
//
// Same three-view shape as Homophones (config → playing → results) and the
// same MP wiring (server-decided cents via /api/money/earn, idempotency-keyed,
// anon kids get the PendingEarnPrompt claim flow).
//
// Items come in TWO modes:
//   - 'fill': sentence shows a `___` blank; choices are single punctuation
//             marks like `,` `;` `:` `'` `.` `?` `!`.
//   - 'fix' : prompt is a question; choices are full sentence options and
//             the kid picks the correctly-punctuated one.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import LoginGate from '@/components/LoginGate';
import { useLearner } from '@/context/LearnerContext';
import {
  pickRoundItems,
  ALL_SKILLS,
  SKILL_LABELS,
  type PunctuationItem,
  type PunctuationSkill,
  type PunctuationTier,
} from '@/lib/languageArts/punctuation';
import {
  isPending,
  newIdempotencyKey,
  submitEarn,
  type EarnResponse,
} from '@/lib/money/earn-client';
import { centsToMP } from '@/lib/money/format';
import PendingEarnPrompt from '@/components/PendingEarnPrompt';

export default function PunctuationPage() {
  return (
    <LoginGate
      section="languageArts"
      loadingFallback={
        <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white py-12 px-4">
          <div className="max-w-2xl mx-auto text-center text-rose-700">Loading…</div>
        </div>
      }
    >
      <PunctuationAuthed />
    </LoginGate>
  );
}

type Config = {
  tier: PunctuationTier;
  questions: number;
  // Empty array = "all skills allowed for this tier".
  skills: PunctuationSkill[];
};

const DEFAULT_CONFIG: Config = { tier: 'easy', questions: 10, skills: [] };
const ROUND_SIZES = [5, 10, 15, 20] as const;

type View =
  | { kind: 'config' }
  | { kind: 'playing'; items: PunctuationItem[]; config: Config }
  | { kind: 'results'; summary: RoundSummary };

type RoundSummary = {
  config: Config;
  correct: number;
  total: number;
};

function PunctuationAuthed() {
  const [view, setView] = useState<View>({ kind: 'config' });

  const startRound = useCallback((config: Config) => {
    const items = pickRoundItems(
      { tier: config.tier, skills: config.skills },
      config.questions,
    );
    if (items.length === 0) return; // shouldn't happen with curated dataset
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

const TIERS: { key: PunctuationTier; label: string; blurb: string }[] = [
  { key: 'easy', label: 'Easy', blurb: 'end marks, contractions' },
  { key: 'medium', label: 'Medium', blurb: 'commas, possessives, quotes' },
  { key: 'hard', label: 'Hard', blurb: 'semicolons, colons, dashes' },
];

function ConfigCard({ onStart }: { onStart: (c: Config) => void }) {
  const [tier, setTier] = useState<PunctuationTier>(DEFAULT_CONFIG.tier);
  const [questions, setQuestions] = useState<number>(DEFAULT_CONFIG.questions);
  const [skills, setSkills] = useState<PunctuationSkill[]>(DEFAULT_CONFIG.skills);

  function toggleSkill(skill: PunctuationSkill) {
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill],
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-xl border-2 border-rose-200 p-6 md:p-8">
      <div className="text-center mb-6">
        <div className="text-5xl mb-2">✏️</div>
        <h2 className="text-2xl md:text-3xl font-black text-rose-900">Punctuation drill</h2>
        <p className="text-sm text-rose-700 mt-1">
          Find the right comma, period, apostrophe — and more.
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
                <div
                  className={`text-[11px] font-medium mt-0.5 ${
                    on ? 'text-rose-100' : 'text-rose-700'
                  }`}
                >
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

      <fieldset className="mb-6">
        <legend className="block text-sm font-bold text-rose-900 mb-2">
          Skills (optional — leave blank for all)
        </legend>
        <div className="flex flex-wrap gap-2">
          {ALL_SKILLS.map((s) => {
            const on = skills.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleSkill(s)}
                className={`rounded-full border-2 px-3 py-1.5 font-semibold text-xs transition-all ${
                  on
                    ? 'border-rose-600 bg-rose-600 text-white'
                    : 'border-rose-200 bg-rose-50 text-rose-900 hover:border-rose-400'
                }`}
              >
                {SKILL_LABELS[s]}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-rose-700 mt-2">
          Pick none for a mixed round. Pick one or more to focus practice.
        </p>
      </fieldset>

      <button
        type="button"
        onClick={() => onStart({ tier, questions, skills })}
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
  item: PunctuationItem;
  picked: string;
  correct: boolean;
};

const REVEAL_MS = 1800;

function PlayCard({
  items,
  config,
  onFinish,
}: {
  items: PunctuationItem[];
  config: Config;
  onFinish: (s: RoundSummary) => void;
}) {
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState<Answered[]>([]);
  const [reveal, setReveal] = useState<Answered | null>(null);

  const current = items[index];

  function pick(choice: string) {
    if (reveal !== null) return;
    const isCorrect = choice === current.answer;
    const entry: Answered = { item: current, picked: choice, correct: isCorrect };

    if (isCorrect) {
      setReveal(entry);
      setTimeout(() => advance(entry), 550);
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

  // For 'fill' items, split the sentence around the literal `___` token.
  const fillParts = current.mode === 'fill' ? current.prompt.split('___') : null;

  return (
    <div className="bg-white rounded-3xl shadow-xl border-2 border-rose-200 p-6 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-bold text-rose-700">
          Question {index + 1} of {items.length}
        </span>
        <span className="text-xs font-semibold text-rose-700 uppercase tracking-wide">
          {config.tier} · {SKILL_LABELS[current.skill]}
        </span>
      </div>

      {current.mode === 'fill' && fillParts ? (
        <div className="text-center mb-6">
          <div className="text-xl md:text-2xl font-bold text-rose-900 leading-relaxed">
            {fillParts.map((part, i) => (
              <span key={i}>
                {part}
                {i < fillParts.length - 1 && (
                  <span className="inline-block mx-1 px-3 py-0.5 bg-rose-100 border-b-4 border-rose-400 rounded text-rose-700 font-black">
                    ___
                  </span>
                )}
              </span>
            ))}
          </div>
          <div className="text-xs text-rose-600 mt-2 italic">
            Pick the right mark for the blank.
          </div>
        </div>
      ) : (
        <div className="text-center mb-6">
          <div className="text-lg md:text-xl font-bold text-rose-900 leading-relaxed">
            {current.prompt}
          </div>
        </div>
      )}

      <div
        className={`grid gap-3 ${
          current.mode === 'fill'
            ? current.choices.length >= 4
              ? 'grid-cols-2 sm:grid-cols-4'
              : 'grid-cols-3'
            : 'grid-cols-1'
        }`}
      >
        {current.choices.map((choice, i) => {
          const isPickedRight =
            reveal !== null && reveal.picked === choice && reveal.correct;
          const isPickedWrong =
            reveal !== null && reveal.picked === choice && !reveal.correct;
          const isCorrectAnswer =
            reveal !== null && !reveal.correct && choice === current.answer;
          let cls = 'bg-rose-50 hover:bg-rose-100 border-rose-300 text-rose-900';
          if (isPickedRight) cls = 'bg-emerald-100 border-emerald-500 text-emerald-900';
          else if (isPickedWrong) cls = 'bg-red-100 border-red-400 text-red-900';
          else if (isCorrectAnswer) cls = 'bg-emerald-100 border-emerald-500 text-emerald-900';

          // 'fill' choices are short punctuation marks → big bold centered.
          // 'fix' choices are full sentences → left-aligned multi-line.
          const sizing =
            current.mode === 'fill'
              ? 'font-black text-3xl py-5 text-center'
              : 'font-semibold text-base md:text-lg py-3 px-4 text-left';

          return (
            <button
              key={`${choice}-${i}`}
              type="button"
              onClick={() => pick(choice)}
              disabled={reveal !== null}
              className={`rounded-2xl border-2 transition-all ${cls} ${sizing} disabled:cursor-not-allowed`}
            >
              <span className="block">
                {choice}
                {isPickedRight && <span className="ml-2">✓</span>}
                {isPickedWrong && <span className="ml-2">✗</span>}
                {isCorrectAnswer && <span className="ml-2">(correct)</span>}
              </span>
            </button>
          );
        })}
      </div>

      {reveal !== null && !reveal.correct && (current.rule || current.hint) && (
        <div className="mt-5 rounded-2xl bg-amber-50 border-2 border-amber-200 p-4">
          {current.rule && (
            <>
              <div className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-1">
                Rule
              </div>
              <div className="text-sm text-amber-900">{current.rule}</div>
            </>
          )}
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

  const idempotencyKey = useMemo(() => newIdempotencyKey('la-punct'), []);
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
