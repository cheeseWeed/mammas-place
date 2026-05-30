'use client';

// SpellingEngine — the practice driver.
//
// Flow per question:
//   1. pickNextWord() chooses from the full pool, weighted by current level
//      (with review + stretch buckets handled inside engine.ts).
//   2. Word auto-speaks on mount + on every word change.
//   3. Kid types, hits Enter / Submit, OR Skip (skip counts as wrong).
//   4. Feedback flashes green/red for FEEDBACK_MS, then advances.
//   5. After questionsPerSession questions, onSessionEnd is called.
//
// Rule-card surfacing:
//   - Per-session counter of misses-per-pattern. Once a pattern hits
//     RULE_TRIGGER_THRESHOLD misses, we look up the matching rule (via the
//     PATTERN_TO_RULE_ID map below) and show a friendly modal.
//   - Each rule shows at most once per session (shownRuleIdsRef).
//   - Dismissing the modal advances to the next word.
//
// All audio calls are SSR-safe (audio.ts guards) and live inside event
// handlers / effects, not module top-level.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import wordsData from '@/data/spelling/words.json';
import rulesData from '@/data/spelling/rules.json';
import {
  isAudioSupported,
  speakWord,
  speakWordWithContext,
  spellOutWord,
  stopSpeaking,
} from '@/lib/spelling/audio';
import {
  applyAttempt,
  initLevelState,
  levelLabel,
  pickNextWord,
  type AttemptOutcome,
  type LevelState,
  type SpellingLevel,
  type Word,
} from '@/lib/spelling/engine';

// ---- Types ---------------------------------------------------------------

export type SpellingEngineProps = {
  startLevel: SpellingLevel;
  initialMisses?: string[];
  onSessionEnd?: (summary: {
    correctCount: number;
    missCount: number;
    finalLevel: SpellingLevel;
    missedWords: string[];
  }) => void;
  questionsPerSession?: number;
};

type Phase = 'question' | 'rule-modal' | 'done';

type MiniQuizQ = {
  prompt: string;
  answer: string;
  hint?: string;
};

type RuleExample = {
  word: string;
  explain?: string;
  without?: string;
};

type Rule = {
  id: string;
  level?: number;
  title: string;
  shortRule: string;
  longExplanation?: string;
  examples: RuleExample[];
  exceptions?: string[];
  miniQuiz?: MiniQuizQ[];
  relatedRules?: string[];
};

// ---- Constants -----------------------------------------------------------

const DEFAULT_QUESTIONS = 15;
const FEEDBACK_MS = 1500;
const FADE_MS = 200;
const RULE_TRIGGER_THRESHOLD = 3;
const MAX_INPUT_LEN = 60;

// words.json is a superset of the engine's Word type — cast through unknown.
const ALL_WORDS = wordsData as unknown as Word[];
const ALL_RULES = rulesData as unknown as Rule[];

const RULES_BY_ID: Map<string, Rule> = new Map(
  ALL_RULES.map((r) => [r.id, r]),
);

// Pattern strings appear in words.json `patterns` arrays. Map each pattern
// that has a corresponding rule. Patterns with no rule (e.g. "cvc",
// "intermediate", "advanced", "family-at") are intentionally skipped — we
// only surface rules we actually wrote.
const PATTERN_TO_RULE_ID: Record<string, string> = {
  // digraphs
  'digraph-ch': 'digraph-ch',
  'digraph-sh': 'digraph-sh',
  'digraph-th': 'digraph-th',
  'digraph-wh': 'digraph-wh',
  'digraph-ph': 'digraph-ph',
  // blends — l/r/s families
  'blend-bl': 'blends-l-family',
  'blend-cl': 'blends-l-family',
  'blend-fl': 'blends-l-family',
  'blend-gl': 'blends-l-family',
  'blend-pl': 'blends-l-family',
  'blend-sl': 'blends-l-family',
  'blend-br': 'blends-r-family',
  'blend-cr': 'blends-r-family',
  'blend-dr': 'blends-r-family',
  'blend-fr': 'blends-r-family',
  'blend-gr': 'blends-r-family',
  'blend-pr': 'blends-r-family',
  'blend-tr': 'blends-r-family',
  'blend-sc': 'blends-s-family',
  'blend-sk': 'blends-s-family',
  'blend-sm': 'blends-s-family',
  'blend-sn': 'blends-s-family',
  'blend-sp': 'blends-s-family',
  'blend-st': 'blends-s-family',
  'blend-sw': 'blends-s-family',
  'blend-tw': 'blends-s-family',
  // vowels + silent e
  'silent-e': 'silent-e',
  'long-vowel': 'long-vowels',
  'short-vowel': 'short-vowels',
  // suffixes
  'suffix-ed': 'suffix-ed-ing',
  'suffix-ing': 'suffix-ed-ing',
  'suffix-tion': 'suffix-tion-sion',
  'suffix-sion': 'suffix-tion-sion',
  'suffix-ful': 'suffix-ful-less',
  'suffix-less': 'suffix-ful-less',
  'suffix-ly': 'suffix-ly-ness',
  'suffix-ness': 'suffix-ly-ness',
  'suffix-es': 'plurals-add-es',
  // prefixes
  'prefix-un': 'prefix-un-re',
  'prefix-re': 'prefix-un-re',
  'prefix-pre': 'prefix-pre-dis-mis',
  'prefix-dis': 'prefix-pre-dis-mis',
  'prefix-mis': 'prefix-pre-dis-mis',
  // other
  compound: 'compound-words',
  homophone: 'homophones-to-too-two',
  'sight-word': 'irregular-sight-words',
  'irregular-plural': 'plurals-irregular',
  'double-letter': 'double-consonant',
  'tricky-ie-ei': 'i-before-e',
};

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

// Pick the first pattern on the word that has both (a) a mapped rule id and
// (b) hasn't already been shown this session.
function findTriggerableRule(
  word: Word,
  shownRuleIds: Set<string>,
): Rule | null {
  for (const p of word.patterns) {
    const ruleId = PATTERN_TO_RULE_ID[p];
    if (!ruleId) continue;
    if (shownRuleIds.has(ruleId)) continue;
    const rule = RULES_BY_ID.get(ruleId);
    if (rule) return rule;
  }
  return null;
}

// ---- Component -----------------------------------------------------------

export default function SpellingEngine({
  startLevel,
  initialMisses = [],
  onSessionEnd,
  questionsPerSession = DEFAULT_QUESTIONS,
}: SpellingEngineProps) {
  // ---- state ----
  const [levelState, setLevelState] = useState<LevelState>(() =>
    initLevelState(startLevel),
  );
  const [missedWords, setMissedWords] = useState<string[]>(() => [
    ...initialMisses,
  ]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [currentWord, setCurrentWord] = useState<Word | null>(null);
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<null | 'right' | 'wrong'>(null);
  const [phase, setPhase] = useState<Phase>('question');
  const [activeRule, setActiveRule] = useState<Rule | null>(null);
  const [audioOk, setAudioOk] = useState(false);
  const [fadeIn, setFadeIn] = useState(true);

  // ---- refs (counters / timers that mustn't trigger re-renders) ----
  const patternMissCountsRef = useRef<Map<string, number>>(new Map());
  const shownRuleIdsRef = useRef<Set<string>>(new Set());
  const correctCountRef = useRef(0);
  const missCountRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const sessionEndedRef = useRef(false);

  // ---- helpers ----
  const totalQuestions = Math.max(1, questionsPerSession);

  // SSR-safe audio capability check.
  useEffect(() => {
    setAudioOk(isAudioSupported());
  }, []);

  // Cleanup all timers + speech on unmount.
  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
      if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);
      stopSpeaking();
    };
  }, []);

  // Choose the first word on mount.
  useEffect(() => {
    const first = pickNextWord(
      levelState,
      ALL_WORDS,
      missedWords,
    );
    setCurrentWord(first);
    // We intentionally only run this once; subsequent words are chosen in advance().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-speak + focus whenever the word changes (and we're in question phase).
  useEffect(() => {
    if (phase !== 'question' || !currentWord) return;

    setInput('');
    setFeedback(null);
    setFadeIn(false);
    if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = window.setTimeout(() => setFadeIn(true), 20);

    if (isAudioSupported()) {
      try {
        speakWord(currentWord.word);
      } catch {
        // ignore — kid can still type
      }
    }
    inputRef.current?.focus();
  }, [currentWord, phase]);

  // ---- audio handlers ----
  const handleListen = useCallback(() => {
    if (!currentWord || !isAudioSupported()) return;
    try {
      speakWord(currentWord.word);
    } catch {
      // ignore
    }
  }, [currentWord]);

  const handleSentence = useCallback(() => {
    if (!currentWord || !isAudioSupported()) return;
    void speakWordWithContext(currentWord.word, currentWord.sentence);
  }, [currentWord]);

  const handleSpellOut = useCallback(() => {
    if (!currentWord || !isAudioSupported()) return;
    void spellOutWord(currentWord.word);
  }, [currentWord]);

  // ---- flow ----

  // Finalize the session and notify the parent.
  const finishSession = useCallback(
    (finalLevel: SpellingLevel) => {
      if (sessionEndedRef.current) return;
      sessionEndedRef.current = true;
      setPhase('done');
      stopSpeaking();
      if (onSessionEnd) {
        onSessionEnd({
          correctCount: correctCountRef.current,
          missCount: missCountRef.current,
          finalLevel,
          missedWords: [...missedWords],
        });
      }
    },
    [missedWords, onSessionEnd],
  );

  // Pick the NEXT word and move to it (or end the session).
  const advanceToNextWord = useCallback(
    (
      stateForPick: LevelState,
      missesForPick: string[],
      nextQuestionNum: number,
    ) => {
      if (nextQuestionNum >= totalQuestions) {
        finishSession(stateForPick.current);
        return;
      }
      const next = pickNextWord(stateForPick, ALL_WORDS, missesForPick);
      setQuestionIndex(nextQuestionNum);
      setCurrentWord(next);
      setPhase('question');
    },
    [finishSession, totalQuestions],
  );

  // Handle a submitted attempt (correct/wrong/skip).
  const submitAttempt = useCallback(
    (typed: string, viaSkip = false) => {
      if (!currentWord || feedback !== null) return;

      const correct =
        !viaSkip && normalize(typed) === normalize(currentWord.word);

      const outcome: AttemptOutcome = {
        word: currentWord.word,
        level: currentWord.level,
        correct,
        ts: Date.now(),
      };

      const nextLevelState = applyAttempt(levelState, outcome);
      setLevelState(nextLevelState);

      if (correct) {
        correctCountRef.current += 1;
      } else {
        missCountRef.current += 1;
      }

      setFeedback(correct ? 'right' : 'wrong');

      // Track misses (capped lifetime list maintained by the page).
      const nextMisses = correct
        ? missedWords
        : missedWords.includes(currentWord.word)
          ? missedWords
          : [...missedWords, currentWord.word];
      if (!correct && nextMisses !== missedWords) {
        setMissedWords(nextMisses);
      }

      // Pattern-miss counters → maybe surface a rule modal.
      let triggerRule: Rule | null = null;
      if (!correct) {
        const counts = patternMissCountsRef.current;
        for (const p of currentWord.patterns) {
          const c = (counts.get(p) ?? 0) + 1;
          counts.set(p, c);
        }
        // After updating counts, check if any pattern on THIS word crossed the threshold.
        for (const p of currentWord.patterns) {
          if ((counts.get(p) ?? 0) >= RULE_TRIGGER_THRESHOLD) {
            const ruleId = PATTERN_TO_RULE_ID[p];
            if (ruleId && !shownRuleIdsRef.current.has(ruleId)) {
              const rule = RULES_BY_ID.get(ruleId);
              if (rule) {
                triggerRule = rule;
                break;
              }
            }
          }
        }
      }

      // Schedule the next step: rule modal OR straight to next word.
      const nextQuestionNum = questionIndex + 1;
      if (feedbackTimerRef.current) {
        window.clearTimeout(feedbackTimerRef.current);
      }
      feedbackTimerRef.current = window.setTimeout(() => {
        if (triggerRule) {
          shownRuleIdsRef.current.add(triggerRule.id);
          setActiveRule(triggerRule);
          setPhase('rule-modal');
          stopSpeaking();
        } else {
          advanceToNextWord(nextLevelState, nextMisses, nextQuestionNum);
        }
      }, FEEDBACK_MS);
    },
    [
      advanceToNextWord,
      currentWord,
      feedback,
      levelState,
      missedWords,
      questionIndex,
    ],
  );

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    submitAttempt(input);
  };

  const handleSkip = () => submitAttempt('', true);

  // Modal dismiss → advance to next word.
  const handleRuleClose = useCallback(() => {
    setActiveRule(null);
    const nextQuestionNum = questionIndex + 1;
    advanceToNextWord(levelState, missedWords, nextQuestionNum);
  }, [advanceToNextWord, levelState, missedWords, questionIndex]);

  // ---- derived render values ----
  const score = correctCountRef.current;
  const submitted = feedback !== null;
  const displayQuestionNum = Math.min(questionIndex + 1, totalQuestions);

  const showFallbackWord = !audioOk;

  // Top bar values — read level from CURRENT state (may have shifted up/down).
  const topBar = useMemo(
    () => ({
      level: levelLabel(levelState.current),
      questionNum: displayQuestionNum,
      total: totalQuestions,
      score,
    }),
    [levelState.current, displayQuestionNum, totalQuestions, score],
  );

  return (
    <div className="w-full">
      {/* Top bar */}
      <div className="bg-white rounded-2xl shadow border-2 border-amber-100 px-4 py-3 mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm md:text-base font-bold text-amber-900">
          {topBar.level}
        </div>
        <div className="flex items-center gap-4 text-sm text-amber-800">
          <span className="font-semibold">
            Question {topBar.questionNum}/{topBar.total}
          </span>
          <span className="font-semibold">
            Score: <span className="text-amber-900">{topBar.score}</span>
          </span>
        </div>
      </div>

      {/* Question card */}
      {phase !== 'done' && currentWord && (
        <div
          className="bg-white rounded-3xl shadow-lg p-6 md:p-10 border-2 border-amber-100 transition-opacity"
          style={{
            opacity: fadeIn ? 1 : 0,
            transitionDuration: `${FADE_MS}ms`,
          }}
        >
          {/* Listen buttons */}
          <div className="flex flex-col items-center gap-3 mb-6">
            <button
              type="button"
              onClick={handleListen}
              disabled={!audioOk || submitted}
              className="bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white font-black py-6 px-10 rounded-full text-2xl shadow-lg transition-all hover:scale-105 active:scale-95"
            >
              🔊 Listen
            </button>
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                type="button"
                onClick={handleSentence}
                disabled={!audioOk || submitted}
                className="text-sm bg-amber-50 hover:bg-amber-100 disabled:opacity-50 text-amber-900 font-semibold py-2 px-4 rounded-full border border-amber-200 transition-colors"
              >
                Hear in sentence
              </button>
              <button
                type="button"
                onClick={handleSpellOut}
                disabled={!audioOk || submitted}
                className="text-sm bg-amber-50 hover:bg-amber-100 disabled:opacity-50 text-amber-900 font-semibold py-2 px-4 rounded-full border border-amber-200 transition-colors"
              >
                Spell out
              </button>
            </div>
          </div>

          {/* No-audio fallback: surface the word as text so the kid can play. */}
          {showFallbackWord && !submitted && (
            <div className="mb-4 text-center">
              <p className="text-xs text-amber-700 mb-1">
                Audio isn&apos;t working — type this word:
              </p>
              <p className="text-3xl font-mono font-bold text-amber-900 bg-amber-50 inline-block px-6 py-2 rounded-xl border-2 border-amber-200">
                {currentWord.word}
              </p>
            </div>
          )}

          {/* Input + submit */}
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX_INPUT_LEN))}
              disabled={submitted}
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="Type the word…"
              aria-label="Spell the word"
              className={`w-full text-3xl md:text-4xl font-mono text-center py-5 px-4 rounded-2xl border-4 focus:outline-none transition-colors ${
                feedback === 'right'
                  ? 'border-green-500 bg-green-50 text-green-900'
                  : feedback === 'wrong'
                    ? 'border-red-500 bg-red-50 text-red-900'
                    : 'border-amber-200 bg-amber-50 text-amber-900 focus:border-amber-500'
              }`}
            />

            {feedback === 'right' && (
              <p className="text-center text-2xl font-bold text-green-700 animate-bounce">
                ✓ Nice spelling!
              </p>
            )}
            {feedback === 'wrong' && (
              <p className="text-center text-lg font-semibold text-red-700">
                ✗ The word was:{' '}
                <span className="font-mono">{currentWord.word}</span>
              </p>
            )}

            <button
              type="submit"
              disabled={submitted || !input.trim()}
              className="w-full bg-amber-700 hover:bg-amber-800 disabled:bg-amber-300 text-white font-bold py-4 rounded-2xl text-lg transition-colors shadow"
            >
              Submit
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={handleSkip}
              disabled={submitted}
              className="text-sm text-amber-700 hover:text-amber-900 underline disabled:opacity-50"
            >
              Skip this one
            </button>
          </div>
        </div>
      )}

      {/* Rule modal */}
      {phase === 'rule-modal' && activeRule && (
        <RuleCardModal rule={activeRule} onClose={handleRuleClose} />
      )}
    </div>
  );
}

// ---- Rule modal ----------------------------------------------------------

function RuleCardModal({
  rule,
  onClose,
}: {
  rule: Rule;
  onClose: () => void;
}) {
  const [showQuiz, setShowQuiz] = useState(false);
  const quizQs = (rule.miniQuiz ?? []).slice(0, 2);
  const hasQuiz = quizQs.length > 0;
  const examples = rule.examples.slice(0, 2);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rule-modal-title"
    >
      <div className="bg-white rounded-3xl shadow-2xl border-4 border-amber-200 max-w-xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 md:p-8">
          <div className="text-5xl text-center mb-3">💡</div>
          <h2
            id="rule-modal-title"
            className="text-2xl md:text-3xl font-black text-amber-900 text-center mb-3"
          >
            {rule.title}
          </h2>
          <p className="text-amber-800 text-lg leading-relaxed mb-5 text-center">
            {rule.shortRule}
          </p>

          {examples.length > 0 && (
            <div className="bg-amber-50 rounded-2xl p-4 mb-5 border border-amber-200">
              <p className="text-xs uppercase tracking-wide text-amber-700 font-bold mb-2">
                Examples
              </p>
              <ul className="space-y-2">
                {examples.map((ex) => (
                  <li key={ex.word} className="text-amber-900">
                    <span className="font-mono font-bold text-lg">
                      {ex.word}
                    </span>
                    {ex.explain && (
                      <span className="ml-2 text-sm text-amber-800">
                        — {ex.explain}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {showQuiz && hasQuiz && (
            <MiniQuiz questions={quizQs} onDone={onClose} />
          )}

          {!showQuiz && (
            <div className="grid sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onClose}
                className="bg-amber-700 hover:bg-amber-800 text-white font-bold py-3 px-6 rounded-2xl shadow transition-colors"
              >
                Got it!
              </button>
              {hasQuiz && (
                <button
                  type="button"
                  onClick={() => setShowQuiz(true)}
                  className="bg-yellow-100 hover:bg-yellow-200 text-amber-900 font-bold py-3 px-6 rounded-2xl border-2 border-yellow-300 transition-colors"
                >
                  Try a mini-quiz
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Mini-quiz (inside the modal) ---------------------------------------

function MiniQuiz({
  questions,
  onDone,
}: {
  questions: MiniQuizQ[];
  onDone: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<null | 'right' | 'wrong'>(null);

  const current = questions[idx];
  if (!current) {
    return (
      <button
        type="button"
        onClick={onDone}
        className="w-full bg-amber-700 hover:bg-amber-800 text-white font-bold py-3 px-6 rounded-2xl shadow transition-colors"
      >
        All done — back to practice →
      </button>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const correct = normalize(input) === normalize(current.answer);
    setFeedback(correct ? 'right' : 'wrong');
    window.setTimeout(() => {
      setFeedback(null);
      setInput('');
      setIdx((i) => i + 1);
    }, 1200);
  };

  return (
    <div className="bg-yellow-50 rounded-2xl p-4 border border-yellow-200">
      <p className="text-xs uppercase tracking-wide text-amber-700 font-bold mb-2">
        Mini-quiz · {idx + 1}/{questions.length}
      </p>
      <p className="text-amber-900 mb-3 font-semibold">{current.prompt}</p>
      {current.hint && (
        <p className="text-xs text-amber-700 mb-2 italic">{current.hint}</p>
      )}
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, MAX_INPUT_LEN))}
          disabled={feedback !== null}
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="Your answer"
          className={`w-full text-xl font-mono text-center py-3 px-4 rounded-xl border-2 focus:outline-none transition-colors ${
            feedback === 'right'
              ? 'border-green-500 bg-green-50 text-green-900'
              : feedback === 'wrong'
                ? 'border-red-500 bg-red-50 text-red-900'
                : 'border-amber-200 bg-white text-amber-900 focus:border-amber-500'
          }`}
        />
        {feedback === 'right' && (
          <p className="text-center text-green-700 font-bold">✓ Nice!</p>
        )}
        {feedback === 'wrong' && (
          <p className="text-center text-red-700 font-semibold">
            ✗ Answer: <span className="font-mono">{current.answer}</span>
          </p>
        )}
        <div className="grid sm:grid-cols-2 gap-2">
          <button
            type="submit"
            disabled={feedback !== null || !input.trim()}
            className="bg-amber-700 hover:bg-amber-800 disabled:bg-amber-300 text-white font-bold py-2 px-4 rounded-xl transition-colors"
          >
            Check
          </button>
          <button
            type="button"
            onClick={onDone}
            className="bg-white hover:bg-amber-50 text-amber-900 font-bold py-2 px-4 rounded-xl border-2 border-amber-200 transition-colors"
          >
            Skip quiz
          </button>
        </div>
      </form>
    </div>
  );
}
