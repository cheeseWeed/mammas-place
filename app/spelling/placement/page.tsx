'use client';

// Spelling placement test — 12 questions, ramped easy → hard.
//
// Flow: welcome → question (×12) → results.
// - Auto-speaks each word on load, with manual replay buttons.
// - Kid types the word; case-insensitive trimmed match.
// - Skip counts as wrong.
// - On finish: scorePlacement → write `{ placementCompleted, level, placedAt }`
//   to the learner's spelling progress.
// - SSR-safe: all audio calls live inside useEffect or event handlers.
// - No-audio fallback: if SpeechSynthesis isn't available, the word is shown
//   as plain text (audio IS the test, so no audio = no test possible).
// - Peek-on-demand: a "Hold to peek" button reveals the word only while the
//   pointer/touch is DOWN. Replaces the old 5-second auto-reveal — kids
//   shouldn't be able to just wait for the answer.

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import LoginGate from '@/components/LoginGate';
import wordsData from '@/data/spelling/words.json';
import {
  isAudioSupported,
  speakWord,
  speakWordWithContext,
  spellOutWord,
} from '@/lib/spelling/audio';
import {
  buildPlacementWords,
  levelLabel,
  scorePlacement,
  type AttemptOutcome,
  type SpellingLevel,
  type Word,
} from '@/lib/spelling/engine';
import { writeSpellingProgress } from '@/lib/learner/profile';

// words.json is a superset of the engine's Word type (it also carries
// `audioSpelling`, `homophones`). Cast through `unknown` to satisfy strict mode.
const ALL_WORDS = wordsData as unknown as Word[];

// How long to show the green/red feedback flash before auto-advancing.
const FEEDBACK_MS = 1500;
// Fade transition between questions.
const FADE_MS = 200;

type Phase = 'welcome' | 'question' | 'results';

const LEVEL_DESCRIPTIONS: Record<SpellingLevel, string> = {
  0: 'We’ll start with letters and sounds — the building blocks!',
  1: 'You’ll practice short-vowel words like cat, bed, and sun.',
  2: 'Time for digraphs and blends — ship, frog, stop!',
  3: 'You’re ready for tricky sight words like was, said, and they.',
  4: 'Long vowels and silent-E words — cake, bike, home!',
  5: 'Two-syllable words like happy, rabbit, and dinner.',
  6: 'Suffixes and prefixes — playing, unhappy, jumped.',
  7: 'Tricky words! You’re a spelling pro.',
};

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

export default function SpellingPlacementPage() {
  return (
    <LoginGate section="spelling">
      <PlacementInner />
    </LoginGate>
  );
}

function PlacementInner() {
  const placementWords = useMemo(() => buildPlacementWords(ALL_WORDS), []);

  const [phase, setPhase] = useState<Phase>('welcome');
  const [idx, setIdx] = useState(0);
  const [outcomes, setOutcomes] = useState<AttemptOutcome[]>([]);
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<null | 'right' | 'wrong'>(null);
  const [isPeeking, setIsPeeking] = useState(false);
  const [peekCount, setPeekCount] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);
  const [finalLevel, setFinalLevel] = useState<SpellingLevel | null>(null);
  const [audioOk, setAudioOk] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  const fadeTimerRef = useRef<number | null>(null);

  // SSR-safe audio capability check.
  useEffect(() => {
    setAudioOk(isAudioSupported());
  }, []);

  const currentWord = placementWords[idx];
  const totalQuestions = placementWords.length;

  // Speak whenever the question changes.
  useEffect(() => {
    if (phase !== 'question' || !currentWord) return;

    // Reset per-question UI state.
    setInput('');
    setFeedback(null);
    setIsPeeking(false);
    setFadeIn(false);
    if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = window.setTimeout(() => setFadeIn(true), 20);

    // Speak the word (no-op when audio unsupported).
    if (isAudioSupported()) {
      try {
        speakWord(currentWord.word);
      } catch {
        // ignore — we still let the kid type
      }
    }

    // Focus the input so they can just start typing.
    inputRef.current?.focus();

    return () => {
      if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);
    };
  }, [phase, idx, currentWord]);

  // Clean up feedback timer on unmount.
  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  // ----- handlers -----

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

  // Peek button — pointer DOWN reveals, pointer UP/LEAVE/CANCEL hides.
  const handlePeekDown = useCallback(() => {
    setIsPeeking((wasPeeking) => {
      if (!wasPeeking) setPeekCount((c) => c + 1);
      return true;
    });
  }, []);

  const handlePeekUp = useCallback(() => {
    setIsPeeking(false);
  }, []);

  const advance = useCallback(
    (nextOutcomes: AttemptOutcome[]) => {
      if (idx + 1 >= totalQuestions) {
        const level = scorePlacement(nextOutcomes);
        setFinalLevel(level);
        // Persist placement result. Fire-and-forget; non-blocking.
        void writeSpellingProgress({
          placementCompleted: true,
          level,
          placedAt: Date.now(),
        });
        setPhase('results');
      } else {
        setIdx((i) => i + 1);
      }
    },
    [idx, totalQuestions],
  );

  const submitAttempt = useCallback(
    (typed: string, viaSkip = false) => {
      if (!currentWord || feedback !== null) return;
      const correct = !viaSkip && normalize(typed) === normalize(currentWord.word);
      const outcome: AttemptOutcome = {
        word: currentWord.word,
        level: currentWord.level,
        correct,
        ts: Date.now(),
      };
      const nextOutcomes = [...outcomes, outcome];
      setOutcomes(nextOutcomes);
      setFeedback(correct ? 'right' : 'wrong');
      // If they're holding peek when submitting, drop it.
      setIsPeeking(false);

      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = window.setTimeout(() => {
        advance(nextOutcomes);
      }, FEEDBACK_MS);
    },
    [advance, currentWord, feedback, outcomes],
  );

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    submitAttempt(input);
  };

  const handleSkip = () => {
    submitAttempt('', true);
  };

  const handleStart = () => {
    setPhase('question');
    setIdx(0);
    setOutcomes([]);
    setFinalLevel(null);
  };

  const handleTestAudio = () => {
    if (!isAudioSupported()) {
      setAudioOk(false);
      return;
    }
    try {
      speakWord('Hello! Can you hear me?');
      setAudioOk(true);
    } catch {
      setAudioOk(false);
    }
  };

  const handleRestart = () => {
    setPhase('welcome');
    setIdx(0);
    setOutcomes([]);
    setFinalLevel(null);
  };

  // ----- render -----

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {phase === 'welcome' && (
          <WelcomeScreen onStart={handleStart} onTestAudio={handleTestAudio} />
        )}

        {phase === 'question' && currentWord && (
          <QuestionScreen
            questionNumber={idx + 1}
            total={totalQuestions}
            input={input}
            setInput={setInput}
            feedback={feedback}
            isPeeking={isPeeking}
            peekCount={peekCount}
            audioOk={audioOk}
            fadeIn={fadeIn}
            currentWord={currentWord}
            inputRef={inputRef}
            onListen={handleListen}
            onSentence={handleSentence}
            onSpellOut={handleSpellOut}
            onSubmit={handleFormSubmit}
            onSkip={handleSkip}
            onPeekDown={handlePeekDown}
            onPeekUp={handlePeekUp}
          />
        )}

        {phase === 'results' && finalLevel !== null && (
          <ResultsScreen
            level={finalLevel}
            correctCount={outcomes.filter((o) => o.correct).length}
            total={outcomes.length}
            onRestart={handleRestart}
          />
        )}
      </div>
    </div>
  );
}

// ===== Welcome =====

function WelcomeScreen({
  onStart,
  onTestAudio,
}: {
  onStart: () => void;
  onTestAudio: () => void;
}) {
  return (
    <div className="bg-white rounded-3xl shadow-lg p-8 md:p-10 border-2 border-amber-100 text-center">
      <div className="text-7xl mb-4">🐝</div>
      <h1 className="text-4xl md:text-5xl font-black text-amber-900 mb-4">
        Let&apos;s find your level!
      </h1>
      <p className="text-lg text-amber-800 mb-6 leading-relaxed">
        I&apos;ll say <strong>12 words</strong> out loud — you just type each
        one. Don&apos;t worry if some feel tricky! This helps me pick the
        perfect words for you to practice.
      </p>
      <div className="bg-amber-50 rounded-2xl p-4 mb-8 text-sm text-amber-900">
        <p className="font-semibold mb-2">Before we start:</p>
        <ul className="text-left list-disc pl-6 space-y-1">
          <li>Turn your sound on</li>
          <li>Tap <em>Test audio</em> to check the volume</li>
          <li>It&apos;s OK to skip — just do your best!</li>
        </ul>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <button
          onClick={onTestAudio}
          className="bg-yellow-100 hover:bg-yellow-200 text-amber-900 font-bold py-4 px-6 rounded-2xl border-2 border-yellow-300 transition-colors text-lg"
        >
          🔊 Test audio
        </button>
        <button
          onClick={onStart}
          className="bg-amber-700 hover:bg-amber-800 text-white font-bold py-4 px-6 rounded-2xl transition-colors text-lg shadow"
        >
          Start! →
        </button>
      </div>

      <p className="mt-6 text-xs text-amber-700">
        <Link href="/spelling" className="underline hover:text-amber-900">
          ← Back to Spelling
        </Link>
      </p>
    </div>
  );
}

// ===== Question =====

type QuestionScreenProps = {
  questionNumber: number;
  total: number;
  input: string;
  setInput: (v: string) => void;
  feedback: null | 'right' | 'wrong';
  isPeeking: boolean;
  peekCount: number;
  audioOk: boolean;
  fadeIn: boolean;
  currentWord: Word;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onListen: () => void;
  onSentence: () => void;
  onSpellOut: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onSkip: () => void;
  onPeekDown: () => void;
  onPeekUp: () => void;
};

function QuestionScreen({
  questionNumber,
  total,
  input,
  setInput,
  feedback,
  isPeeking,
  peekCount,
  audioOk,
  fadeIn,
  currentWord,
  inputRef,
  onListen,
  onSentence,
  onSpellOut,
  onSubmit,
  onSkip,
  onPeekDown,
  onPeekUp,
}: QuestionScreenProps) {
  const submitted = feedback !== null;
  // Audio is the test — if it's not working we have to show the word.
  const showNoAudioFallback = !audioOk;
  // Peek reveal: visible while button is held, but only when audio works
  // (no-audio mode already shows the word permanently).
  const showPeekReveal = audioOk && isPeeking && !submitted;

  return (
    <div
      className={`bg-white rounded-3xl shadow-lg p-6 md:p-10 border-2 border-amber-100 transition-opacity duration-${FADE_MS} ${
        fadeIn ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-amber-700 mb-1">
          <span className="font-semibold">
            Question {questionNumber} of {total}
          </span>
          <span>{Math.round((questionNumber / total) * 100)}%</span>
        </div>
        <div className="h-2 bg-amber-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 transition-all duration-300"
            style={{ width: `${(questionNumber / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Listen buttons */}
      <div className="flex flex-col items-center gap-3 mb-4">
        <button
          type="button"
          onClick={onListen}
          disabled={!audioOk || submitted}
          className="bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white font-black py-6 px-10 rounded-full text-2xl shadow-lg transition-all hover:scale-105 active:scale-95"
        >
          🔊 Listen
        </button>
        <div className="flex flex-wrap gap-2 justify-center">
          <button
            type="button"
            onClick={onSentence}
            disabled={!audioOk || submitted}
            className="text-sm bg-amber-50 hover:bg-amber-100 disabled:opacity-50 text-amber-900 font-semibold py-2 px-4 rounded-full border border-amber-200 transition-colors"
          >
            Hear it in a sentence
          </button>
          <button
            type="button"
            onClick={onSpellOut}
            disabled={!audioOk || submitted}
            className="text-sm bg-amber-50 hover:bg-amber-100 disabled:opacity-50 text-amber-900 font-semibold py-2 px-4 rounded-full border border-amber-200 transition-colors"
          >
            Spell it out
          </button>
          {audioOk && (
            <button
              type="button"
              onPointerDown={onPeekDown}
              onPointerUp={onPeekUp}
              onPointerLeave={onPeekUp}
              onPointerCancel={onPeekUp}
              onContextMenu={(e) => e.preventDefault()}
              disabled={submitted}
              aria-label="Hold to peek at the word"
              className="select-none touch-none text-sm bg-yellow-100 hover:bg-yellow-200 disabled:opacity-50 text-amber-900 font-semibold py-2 px-4 rounded-full border-2 border-yellow-300 transition-colors"
              style={{
                WebkitUserSelect: 'none',
                WebkitTouchCallout: 'none',
              }}
            >
              👁 Hold to peek
            </button>
          )}
        </div>
        {audioOk && peekCount > 0 && (
          <p className="text-xs text-amber-600">
            Peeked {peekCount} {peekCount === 1 ? 'time' : 'times'} this test
          </p>
        )}
      </div>

      {/* No-audio fallback: audio IS the test, so without audio show the word. */}
      {showNoAudioFallback && !submitted && (
        <div className="mb-4 text-center">
          <p className="text-xs text-amber-700 mb-1">
            Audio isn&apos;t working — type this word:
          </p>
          <p className="text-3xl font-mono font-bold text-amber-900 bg-amber-50 inline-block px-6 py-2 rounded-xl border-2 border-amber-200">
            {currentWord.word}
          </p>
        </div>
      )}

      {/* Peek reveal card — reserved space (min-height) so layout doesn't jump. */}
      {audioOk && !submitted && (
        <div className="mb-4 flex justify-center items-center" style={{ minHeight: '4.5rem' }}>
          <div
            aria-live="polite"
            className={`inline-block px-6 py-2 rounded-xl border-2 transition-all duration-150 ${
              showPeekReveal
                ? 'bg-sky-50 border-sky-300 opacity-100 blur-0'
                : 'bg-transparent border-transparent opacity-0 blur-sm pointer-events-none'
            }`}
          >
            <p className="text-3xl font-mono font-bold text-sky-900 select-none">
              {currentWord.word}
            </p>
          </div>
        </div>
      )}

      {/* Input + submit */}
      <form onSubmit={onSubmit} className="space-y-4">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={submitted}
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="Type the word…"
          className={`w-full text-3xl md:text-4xl font-mono text-center py-5 px-4 rounded-2xl border-4 focus:outline-none transition-colors ${
            feedback === 'right'
              ? 'border-green-500 bg-green-50 text-green-900'
              : feedback === 'wrong'
                ? 'border-red-500 bg-red-50 text-red-900'
                : 'border-amber-200 bg-amber-50 text-amber-900 focus:border-amber-500'
          }`}
        />

        {feedback === 'right' && (
          <p className="text-center text-2xl font-bold text-green-700">
            ✓ Nice spelling!
          </p>
        )}
        {feedback === 'wrong' && (
          <p className="text-center text-lg font-semibold text-red-700">
            The word was: <span className="font-mono">{currentWord.word}</span>
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
          onClick={onSkip}
          disabled={submitted}
          className="text-sm text-amber-700 hover:text-amber-900 underline disabled:opacity-50"
        >
          Skip this one
        </button>
      </div>
    </div>
  );
}

// ===== Results =====

function ResultsScreen({
  level,
  correctCount,
  total,
  onRestart,
}: {
  level: SpellingLevel;
  correctCount: number;
  total: number;
  onRestart: () => void;
}) {
  return (
    <div className="bg-white rounded-3xl shadow-lg p-8 md:p-10 border-2 border-amber-100 text-center">
      <div className="text-7xl mb-4">🎉</div>
      <h1 className="text-3xl md:text-4xl font-black text-amber-900 mb-2">
        We think you&apos;re at
      </h1>
      <h2 className="text-4xl md:text-5xl font-black text-amber-700 mb-6">
        {levelLabel(level)}!
      </h2>

      <div className="bg-amber-50 rounded-2xl p-5 mb-6">
        <p className="text-amber-900 text-lg mb-2">
          You got <strong>{correctCount}</strong> out of{' '}
          <strong>{total}</strong> right.
        </p>
        <p className="text-amber-800">{LEVEL_DESCRIPTIONS[level]}</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Link
          href="/spelling/practice"
          className="bg-amber-700 hover:bg-amber-800 text-white font-bold py-4 px-6 rounded-2xl text-lg shadow transition-colors"
        >
          Start Practicing →
        </Link>
        <button
          onClick={onRestart}
          className="bg-yellow-100 hover:bg-yellow-200 text-amber-900 font-bold py-4 px-6 rounded-2xl border-2 border-yellow-300 transition-colors text-lg"
        >
          Try test again
        </button>
      </div>

      <p className="mt-6 text-xs text-amber-700">
        <Link href="/spelling" className="underline hover:text-amber-900">
          ← Back to Spelling
        </Link>
      </p>
    </div>
  );
}
