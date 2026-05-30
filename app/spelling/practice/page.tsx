'use client';

// Spelling practice page — wraps SpellingEngine.
//
// Flow:
//   1. LoginGate ensures we have a learner.
//   2. On mount, read spelling progress from the API.
//      - If placementCompleted is falsy, redirect to /spelling/placement with
//        a friendly toast on the placement page (we just navigate; the
//        placement page already says "Let's find your level!").
//      - Otherwise, hand startLevel + initialMisses to SpellingEngine.
//   3. On session end, persist updated progress (merge + cap misses at 100)
//      and show the results screen with replay options.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import LoginGate from '@/components/LoginGate';
import SpellingEngine from '@/components/spelling/SpellingEngine';
import {
  readSpellingProgress,
  writeSpellingProgress,
  type SpellingProgress,
} from '@/lib/learner/profile';
import { levelLabel, type SpellingLevel } from '@/lib/spelling/engine';
import { useLearner } from '@/context/LearnerContext';
import {
  isPending,
  newIdempotencyKey,
  submitEarn,
  type EarnResponse,
} from '@/lib/money/earn-client';
import PendingEarnPrompt from '@/components/PendingEarnPrompt';

const QUESTIONS_PER_SESSION = 15;
const MAX_STORED_MISSES = 100;

// Loose check — engine.ts limits the practice range to 1..7 but progress
// could carry a 0 from an early-bird save. Clamp into the engine's
// expected range without rejecting saved state.
function clampLevel(n: unknown): SpellingLevel {
  const num = typeof n === 'number' && Number.isFinite(n) ? n : 1;
  const rounded = Math.round(num);
  if (rounded < 1) return 1;
  if (rounded > 7) return 7;
  return rounded as SpellingLevel;
}

export default function SpellingPracticePage() {
  return (
    <LoginGate section="spelling">
      <PracticeInner />
    </LoginGate>
  );
}

type PendingEarn = Extract<EarnResponse, { pending: true }>;

type LoadState =
  | { kind: 'loading' }
  | { kind: 'redirecting' }
  | { kind: 'ready'; level: SpellingLevel; misses: string[]; progress: SpellingProgress }
  | {
      kind: 'done';
      summary: SessionSummary;
      startLevel: SpellingLevel;
      earnNote: string | null;
      pendingEarn: PendingEarn | null;
    };

type SessionSummary = {
  correctCount: number;
  missCount: number;
  finalLevel: SpellingLevel;
  missedWords: string[];
};

function PracticeInner() {
  const router = useRouter();
  const { refresh: refreshBalance } = useLearner();
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'loading' });
  // Holds the latest progress so we can merge against it at session end.
  const [progressSnapshot, setProgressSnapshot] = useState<SpellingProgress>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const progress = await readSpellingProgress();
      if (cancelled) return;
      setProgressSnapshot(progress);

      const placementDone = progress.placementCompleted === true;
      if (!placementDone) {
        setLoadState({ kind: 'redirecting' });
        // Small delay so the friendly message paints before we navigate.
        window.setTimeout(() => {
          router.replace('/spelling/placement');
        }, 600);
        return;
      }

      const level = clampLevel(progress.level);
      const misses = Array.isArray(progress.misses)
        ? (progress.misses.filter((m): m is string => typeof m === 'string'))
        : [];
      setLoadState({ kind: 'ready', level, misses, progress });
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Sessions completed counter (defensive default).
  const prevSessions = typeof progressSnapshot.sessionsCompleted === 'number'
    ? progressSnapshot.sessionsCompleted
    : 0;

  const handleSessionEnd = useCallback(
    async (summary: SessionSummary) => {
      // Merge misses: NEW session misses prepended (most recent first),
      // dedup against the existing stored list, then cap.
      const prevMisses = Array.isArray(progressSnapshot.misses)
        ? progressSnapshot.misses.filter((m): m is string => typeof m === 'string')
        : [];
      const seen = new Set<string>();
      const merged: string[] = [];
      for (const w of [...summary.missedWords, ...prevMisses]) {
        if (!seen.has(w)) {
          seen.add(w);
          merged.push(w);
        }
      }
      const cappedMisses = merged.slice(0, MAX_STORED_MISSES);

      try {
        await writeSpellingProgress({
          ...progressSnapshot,
          level: summary.finalLevel,
          misses: cappedMisses,
          sessionsCompleted: prevSessions + 1,
          lastSession: Date.now(),
        });
      } catch {
        // Non-blocking — kid still sees results screen.
      }

      setLoadState((prev) => {
        const startLevel =
          prev.kind === 'ready' ? prev.level : summary.finalLevel;
        return {
          kind: 'done',
          summary,
          startLevel,
          earnNote: null,
          pendingEarn: null,
        };
      });

      // MP earn — server decides cents; we just hand it the session shape.
      // Anon kids get a pending preview so they can claim it after registering.
      const total = summary.correctCount + summary.missCount;
      const key = newIdempotencyKey('spelling-session');
      const res = await submitEarn(
        'spelling',
        'quiz',
        { correct: summary.correctCount, total, level: summary.finalLevel },
        key,
      );
      if ('error' in res) {
        setLoadState((prev) =>
          prev.kind === 'done'
            ? { ...prev, earnNote: `MP didn't record: ${res.error}` }
            : prev,
        );
      } else if (isPending(res)) {
        setLoadState((prev) =>
          prev.kind === 'done'
            ? { ...prev, pendingEarn: res }
            : prev,
        );
      } else if (res.centsEarned > 0) {
        setLoadState((prev) =>
          prev.kind === 'done'
            ? { ...prev, earnNote: `+${(res.centsEarned / 100).toFixed(2)}MP — ${res.reason}` }
            : prev,
        );
        void refreshBalance();
      } else {
        setLoadState((prev) =>
          prev.kind === 'done'
            ? { ...prev, earnNote: res.reason || 'No MP earned this session.' }
            : prev,
        );
      }
    },
    [progressSnapshot, prevSessions, refreshBalance],
  );

  // ===== render =====

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <TopBar
          kind={loadState.kind}
          total={QUESTIONS_PER_SESSION}
          level={
            loadState.kind === 'ready'
              ? loadState.level
              : loadState.kind === 'done'
                ? loadState.summary.finalLevel
                : null
          }
        />

        {loadState.kind === 'loading' && <LoadingCard />}

        {loadState.kind === 'redirecting' && <RedirectingCard />}

        {loadState.kind === 'ready' && (
          <SpellingEngine
            startLevel={loadState.level}
            initialMisses={loadState.misses}
            questionsPerSession={QUESTIONS_PER_SESSION}
            onSessionEnd={handleSessionEnd}
          />
        )}

        {loadState.kind === 'done' && (
          <ResultsScreen
            summary={loadState.summary}
            startLevel={loadState.startLevel}
            earnNote={loadState.earnNote}
            pendingEarn={loadState.pendingEarn}
            onPendingClaimed={(cents) => {
              setLoadState((prev) =>
                prev.kind === 'done'
                  ? {
                      ...prev,
                      pendingEarn: null,
                      earnNote: `+${(cents / 100).toFixed(2)}MP earned (banked!)`,
                    }
                  : prev,
              );
              void refreshBalance();
            }}
            onPracticeAgain={() => {
              // Reload progress so the next session honors the new level/misses.
              setLoadState({ kind: 'loading' });
              (async () => {
                const fresh = await readSpellingProgress();
                setProgressSnapshot(fresh);
                const level = clampLevel(fresh.level);
                const misses = Array.isArray(fresh.misses)
                  ? fresh.misses.filter((m): m is string => typeof m === 'string')
                  : [];
                setLoadState({ kind: 'ready', level, misses, progress: fresh });
              })();
            }}
          />
        )}
      </div>
    </div>
  );
}

// ---- Top bar -------------------------------------------------------------

function TopBar({
  kind,
  total,
  level,
}: {
  kind: LoadState['kind'];
  total: number;
  level: SpellingLevel | null;
}) {
  const sessionLabel =
    kind === 'ready' ? `Session: ${total} questions` : kind === 'done' ? 'Session: complete' : 'Session: —';
  const levelText =
    level !== null ? `Practice: ${levelLabel(level)}` : 'Practice';
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <Link
        href="/spelling"
        className="text-amber-900 hover:text-amber-700 text-sm font-semibold inline-flex items-center gap-1 bg-white border-2 border-amber-100 px-3 py-1.5 rounded-full shadow-sm"
      >
        ← Spelling
      </Link>
      <div className="text-xs md:text-sm text-amber-800 text-right">
        <div className="font-bold text-amber-900 truncate max-w-[16rem] md:max-w-none">
          {levelText}
        </div>
        <div>{sessionLabel}</div>
      </div>
    </div>
  );
}

// ---- States --------------------------------------------------------------

function LoadingCard() {
  return (
    <div className="bg-white rounded-3xl shadow-lg p-8 border-2 border-amber-100 text-center">
      <div className="text-5xl mb-3 animate-pulse">🐝</div>
      <p className="text-amber-900 font-semibold">Loading your practice…</p>
    </div>
  );
}

function RedirectingCard() {
  return (
    <div className="bg-white rounded-3xl shadow-lg p-8 border-2 border-amber-100 text-center">
      <div className="text-5xl mb-3">🐝</div>
      <h2 className="text-2xl font-black text-amber-900 mb-2">
        Let&apos;s find your level first!
      </h2>
      <p className="text-amber-800 mb-4">
        We need to do a quick placement test before practicing.
      </p>
      <Link
        href="/spelling/placement"
        className="inline-block bg-amber-700 hover:bg-amber-800 text-white font-bold py-3 px-6 rounded-2xl shadow transition-colors"
      >
        Take the placement test →
      </Link>
    </div>
  );
}

function ResultsScreen({
  summary,
  startLevel,
  earnNote,
  pendingEarn,
  onPendingClaimed,
  onPracticeAgain,
}: {
  summary: SessionSummary;
  startLevel: SpellingLevel;
  earnNote: string | null;
  pendingEarn: PendingEarn | null;
  onPendingClaimed: (cents: number) => void;
  onPracticeAgain: () => void;
}) {
  const total = summary.correctCount + summary.missCount;
  const pct = total > 0 ? Math.round((summary.correctCount / total) * 100) : 0;
  const levelChanged = summary.finalLevel !== startLevel;
  const wentUp = summary.finalLevel > startLevel;

  return (
    <div className="bg-white rounded-3xl shadow-lg p-8 md:p-10 border-2 border-amber-100 text-center">
      <div className="text-6xl mb-3">{pct >= 80 ? '🏆' : pct >= 50 ? '🎉' : '💪'}</div>
      <h1 className="text-3xl md:text-4xl font-black text-amber-900 mb-2">
        Great practice!
      </h1>
      <p className="text-amber-800 mb-6">
        You got <strong>{summary.correctCount}</strong> of{' '}
        <strong>{total}</strong> right ({pct}%).
      </p>

      {pendingEarn ? (
        <PendingEarnPrompt
          pending={{
            section: pendingEarn.section,
            kind: pendingEarn.kind,
            payload: pendingEarn.payload,
            idempotencyKey: pendingEarn.idempotencyKey,
            centsEarned: pendingEarn.centsEarned,
            reason: pendingEarn.reason,
          }}
          onClaimed={onPendingClaimed}
        />
      ) : earnNote ? (
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-3 mb-4 text-center text-sm font-bold text-yellow-900">
          💰 {earnNote}
        </div>
      ) : null}

      <div className="bg-amber-50 rounded-2xl p-5 mb-6 text-left space-y-2">
        <p className="text-amber-900">
          <span className="font-semibold">Current level:</span>{' '}
          {levelLabel(summary.finalLevel)}
        </p>
        {levelChanged && (
          <p
            className={`font-semibold ${
              wentUp ? 'text-green-700' : 'text-amber-800'
            }`}
          >
            {wentUp ? '⬆ You leveled up!' : '⬇ Dropped a level for some easier wins.'}
          </p>
        )}
        {summary.missedWords.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-amber-900 mb-1">
              Words to review:
            </p>
            <p className="text-sm font-mono text-amber-800 break-words">
              {summary.missedWords.slice(0, 12).join(', ')}
              {summary.missedWords.length > 12 ? '…' : ''}
            </p>
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onPracticeAgain}
          className="bg-amber-700 hover:bg-amber-800 text-white font-bold py-4 px-6 rounded-2xl text-lg shadow transition-colors"
        >
          Practice Again →
        </button>
        <Link
          href="/spelling"
          className="bg-yellow-100 hover:bg-yellow-200 text-amber-900 font-bold py-4 px-6 rounded-2xl border-2 border-yellow-300 transition-colors text-lg"
        >
          Back to Spelling
        </Link>
      </div>
    </div>
  );
}
