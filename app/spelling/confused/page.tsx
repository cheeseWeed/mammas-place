'use client';

// Commonly-confused spellings drill — a focused practice mode separate from the
// adaptive engine. Shows ONE word at a time as a fill-in-the-blank, with the
// learner typing the correct spelling. After answering they see the tip
// (mnemonic) and can move on. Designed as a low-stakes side activity:
//
//   - No leveling, no MP earn, no progress write — kids can drift in and out.
//   - "Filter by category" chips (silent letters, doubled letters, homophones…)
//     let parents tailor the deck without re-tagging.
//   - Tap the wrong/right pair to hear each one — surfaces the auditory clue
//     when the two words sound the same (its / it's, knew / new).
//
// Wrapped in LoginGate so misses can later persist to the spelling progress
// blob; we don't write yet, but the gate keeps the section's auth consistent.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import LoginGate from '@/components/LoginGate';
import { speakWord } from '@/lib/spelling/audio';
import {
  CATEGORY_EMOJI,
  CATEGORY_LABEL,
  CONFUSED_WORDS,
  filterConfused,
  isAnswerCorrect,
  listCategories,
  pickNextConfused,
  renderSentenceWithBlank,
  type ConfusedCategory,
  type ConfusedWord,
} from '@/lib/spelling/confused';
import type { SpellingLevel } from '@/lib/spelling/engine';

const LEVELS: SpellingLevel[] = [3, 4, 5, 6, 7];

type Feedback =
  | { kind: 'idle' }
  | { kind: 'correct' }
  | { kind: 'wrong'; correctAnswer: string };

export default function ConfusedSpellingsPage() {
  return (
    <LoginGate section="spelling">
      <ConfusedDrill />
    </LoginGate>
  );
}

function ConfusedDrill() {
  const [level, setLevel] = useState<SpellingLevel | 'all'>('all');
  const [category, setCategory] = useState<ConfusedCategory | 'all'>('all');
  const [current, setCurrent] = useState<ConfusedWord | null>(null);
  const [typed, setTyped] = useState('');
  const [feedback, setFeedback] = useState<Feedback>({ kind: 'idle' });
  const [showTip, setShowTip] = useState(false);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);

  const categories = useMemo(() => listCategories(), []);

  const pool = useMemo(
    () => filterConfused({ level, category }),
    [level, category],
  );

  // When filters change or the current card vanishes from the pool, pick a
  // fresh one. Streak is preserved across filter changes — feels less punitive
  // than resetting on every chip tap.
  useEffect(() => {
    if (pool.length === 0) {
      setCurrent(null);
      return;
    }
    const stillInPool =
      current && pool.some((w) => w.id === current.id) ? current : null;
    if (!stillInPool) {
      setCurrent(pickNextConfused(pool, current?.id ?? null));
      setTyped('');
      setFeedback({ kind: 'idle' });
      setShowTip(false);
    }
  }, [pool, current]);

  const next = () => {
    if (pool.length === 0) {
      setCurrent(null);
      return;
    }
    setCurrent(pickNextConfused(pool, current?.id ?? null));
    setTyped('');
    setFeedback({ kind: 'idle' });
    setShowTip(false);
  };

  const submit = () => {
    if (!current) return;
    if (!typed.trim()) return;
    if (isAnswerCorrect(typed, current.right)) {
      setFeedback({ kind: 'correct' });
      setShowTip(true);
      setStreak((s) => {
        const next = s + 1;
        setBestStreak((b) => (next > b ? next : b));
        return next;
      });
    } else {
      setFeedback({ kind: 'wrong', correctAnswer: current.right });
      setShowTip(true);
      setStreak(0);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/spelling"
            className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700 hover:text-amber-900 transition-colors"
          >
            ← Back to Spelling
          </Link>
          <div className="text-xs text-amber-700">
            Streak:{' '}
            <span className="font-bold text-amber-900">{streak}</span>
            {bestStreak > 0 && (
              <>
                {' '}· Best:{' '}
                <span className="font-bold text-amber-900">{bestStreak}</span>
              </>
            )}
          </div>
        </div>

        <header className="text-center mb-6">
          <div className="text-5xl mb-2">🪤</div>
          <h1 className="text-3xl md:text-4xl font-black text-amber-900">
            Commonly Confused Spellings
          </h1>
          <p className="text-amber-700 text-sm mt-2 max-w-md mx-auto">
            The words even grown-ups get wrong. Read the sentence, type the
            right spelling, and learn the trick to remember it.
          </p>
        </header>

        {/* Filters */}
        <div className="bg-white rounded-2xl border-2 border-amber-100 p-4 mb-6 space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-amber-700 mb-2">
              Level
            </p>
            <div className="flex flex-wrap gap-2">
              <FilterChip
                active={level === 'all'}
                label="All levels"
                onClick={() => setLevel('all')}
              />
              {LEVELS.map((lvl) => (
                <FilterChip
                  key={lvl}
                  active={level === lvl}
                  label={`L${lvl}`}
                  onClick={() => setLevel(lvl)}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-amber-700 mb-2">
              Trap type
            </p>
            <div className="flex flex-wrap gap-2">
              <FilterChip
                active={category === 'all'}
                label="All traps"
                onClick={() => setCategory('all')}
              />
              {categories.map((c) => (
                <FilterChip
                  key={c}
                  active={category === c}
                  label={`${CATEGORY_EMOJI[c]} ${CATEGORY_LABEL[c]}`}
                  onClick={() => setCategory(c)}
                />
              ))}
            </div>
          </div>
          <p className="text-xs text-amber-700">
            {pool.length} of {CONFUSED_WORDS.length} traps in this filter.
          </p>
        </div>

        {/* Drill card */}
        {current ? (
          <DrillCard
            word={current}
            typed={typed}
            onType={setTyped}
            onSubmit={submit}
            onNext={next}
            feedback={feedback}
            showTip={showTip}
          />
        ) : (
          <div className="bg-white rounded-2xl border-2 border-amber-100 p-8 text-center">
            <p className="text-amber-900 font-semibold">
              No traps match this filter.
            </p>
            <p className="text-amber-700 text-sm mt-1">
              Try a broader level or different trap type.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Filter chip ----

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-colors ${
        active
          ? 'bg-amber-900 text-white border-amber-900'
          : 'bg-white text-amber-900 border-amber-200 hover:border-amber-400'
      }`}
    >
      {label}
    </button>
  );
}

// ---- Drill card ----

function DrillCard({
  word,
  typed,
  onType,
  onSubmit,
  onNext,
  feedback,
  showTip,
}: {
  word: ConfusedWord;
  typed: string;
  onType: (s: string) => void;
  onSubmit: () => void;
  onNext: () => void;
  feedback: Feedback;
  showTip: boolean;
}) {
  const sentence = renderSentenceWithBlank(word.sentence);
  const idle = feedback.kind === 'idle';

  return (
    <div className="bg-white rounded-3xl shadow-lg border-2 border-amber-200 p-6 md:p-8">
      <div className="flex items-center justify-between mb-3">
        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full">
          <span aria-hidden="true">{CATEGORY_EMOJI[word.category]}</span>
          {CATEGORY_LABEL[word.category]}
        </span>
        <span className="text-xs text-amber-700 font-semibold">
          Level {word.level}
        </span>
      </div>

      <p className="text-xl md:text-2xl text-amber-900 leading-relaxed font-medium">
        {sentence}
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (idle) onSubmit();
          else onNext();
        }}
        className="mt-5 flex flex-wrap gap-2"
      >
        <input
          type="text"
          value={typed}
          onChange={(e) => onType(e.target.value)}
          disabled={!idle}
          placeholder="Type the word that goes in the blank…"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          autoFocus
          className="flex-1 min-w-[180px] rounded-xl border-2 border-amber-200 bg-white focus:outline-none focus:border-amber-500 px-4 py-3 text-lg text-amber-900 placeholder:text-amber-400 disabled:bg-amber-100"
        />
        {idle ? (
          <button
            type="submit"
            className="px-5 py-3 rounded-xl bg-amber-900 text-white font-bold hover:bg-amber-800 transition-colors"
          >
            Check
          </button>
        ) : (
          <button
            type="submit"
            className="px-5 py-3 rounded-xl bg-amber-900 text-white font-bold hover:bg-amber-800 transition-colors"
          >
            Next →
          </button>
        )}
      </form>

      {feedback.kind === 'correct' && (
        <p className="mt-4 text-sm font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          ✓ Nice — <span className="font-mono">{word.right}</span> is right!
        </p>
      )}

      {feedback.kind === 'wrong' && (
        <p className="mt-4 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          ✗ Close — the trap is{' '}
          <span className="font-mono">{word.wrong}</span>; it&apos;s actually{' '}
          <span className="font-mono font-bold">{feedback.correctAnswer}</span>.
        </p>
      )}

      {showTip && (
        <div className="mt-4 bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-700 mb-1">
            Tip
          </p>
          <p className="text-amber-900 leading-snug">{word.tip}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              onClick={() => speakWord(word.right)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border-2 border-amber-300 text-amber-900 text-sm font-semibold hover:bg-amber-50 transition-colors"
              aria-label={`Hear ${word.right}`}
            >
              <span aria-hidden="true">🔊</span> {word.right}
            </button>
            {word.wrong !== word.right && (
              <button
                type="button"
                onClick={() => speakWord(word.wrong)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border-2 border-amber-200 text-amber-700 text-sm font-semibold hover:bg-amber-50 transition-colors"
                aria-label={`Hear the common misspelling ${word.wrong}`}
                title="The common trap"
              >
                <span aria-hidden="true">🔊</span>{' '}
                <span className="line-through">{word.wrong}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
