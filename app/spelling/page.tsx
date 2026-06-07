'use client';

// Spelling Bee hub — gated landing page. Two flows:
//
//   1) First-time (no placement done yet): show a single big "find your level"
//      CTA pointing at /spelling/placement, with a "Skip and start at L1"
//      escape hatch for kids who just want to start.
//
//   2) Returning: profile card (with inline edit), light stats row, the
//      action cards (Practice / Browse Rules / Placement re-take), and an
//      optional preview of words they've been missing.
//
// Data sources: LearnerSummary (display name, age, grade, spelling.level via
// /api/learner/profile) + SpellingProgress (attempts, misses, lastSession,
// placementCompleted via /api/learner/spelling). Both are read defensively
// since the spelling progress blob is intentionally loose.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import LoginGate from '@/components/LoginGate';
import SabbathGuard from '@/components/SabbathGuard';
import SectionGuard from '@/components/SectionGuard';
import {
  fetchProfile,
  readSpellingProgress,
  updateProfile,
  type LearnerSummary,
  type ProfileUpdates,
  type SpellingProgress,
} from '@/lib/learner/profile';
import { levelLabel, type SpellingLevel } from '@/lib/spelling/engine';
import { speakWord } from '@/lib/spelling/audio';

// Loose attempt shape — the SpellingProgress.attempts array is `unknown[]` at
// the type layer because the section still owns its on-disk format. We pull
// out the bits we care about (word + correctness) with type guards.
type LooseAttempt = {
  word?: unknown;
  correct?: unknown;
};

function isLooseAttempt(value: unknown): value is LooseAttempt {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

// Heuristic "mastered" count: words the learner has attempted at least once
// that are NOT currently in their miss list. This is intentionally generous;
// the real engine has finer-grained mastery once we wire it up.
function computeStats(progress: SpellingProgress): {
  sessions: number;
  attempts: number;
  mastered: number;
} {
  const attemptsRaw = Array.isArray(progress.attempts) ? progress.attempts : [];
  const misses = new Set(
    (Array.isArray(progress.misses) ? progress.misses : []).filter(
      (m): m is string => typeof m === 'string',
    ),
  );

  const attemptedWords = new Set<string>();
  for (const a of attemptsRaw) {
    if (!isLooseAttempt(a)) continue;
    const w = asString(a.word);
    if (w) attemptedWords.add(w);
  }

  let mastered = 0;
  for (const w of attemptedWords) {
    if (!misses.has(w)) mastered += 1;
  }

  const sessionsRaw = progress['sessionsCompleted'];
  const sessions =
    typeof sessionsRaw === 'number' && Number.isFinite(sessionsRaw)
      ? sessionsRaw
      : 0;

  return {
    sessions,
    attempts: attemptsRaw.length,
    mastered,
  };
}

// Clamp a stored level number into the SpellingLevel union so levelLabel()
// always has a valid key. The placement engine only ever returns L1-L7, but
// the DB column starts at 0 for un-placed learners.
function clampToLabelLevel(n: number): SpellingLevel {
  if (n <= 0) return 1;
  if (n >= 7) return 7;
  const rounded = Math.round(n);
  return rounded as SpellingLevel;
}

function placementDone(
  progress: SpellingProgress,
  profileLevel: number,
): boolean {
  // Trust either the explicit flag or, as a safety net, any non-zero level
  // stored on the profile (which only gets set by the placement flow).
  if (progress['placementCompleted'] === true) return true;
  if (profileLevel && profileLevel > 0) return true;
  return false;
}

export default function SpellingHub() {
  return (
    <SabbathGuard label="Spelling">
    <SectionGuard sectionKey="spelling" label="Spelling">
    <LoginGate
      section="spelling"
      loadingFallback={
        <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white py-12 px-4">
          <div className="max-w-3xl mx-auto text-center text-amber-700">
            Loading…
          </div>
        </div>
      }
    >
      <SpellingHubAuthed />
    </LoginGate>
    </SectionGuard>
    </SabbathGuard>
  );
}

function SpellingHubAuthed() {
  const [profile, setProfile] = useState<LearnerSummary | null>(null);
  const [progress, setProgress] = useState<SpellingProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const refresh = useCallback(async () => {
    const [p, sp] = await Promise.all([fetchProfile(), readSpellingProgress()]);
    setProfile(p);
    setProgress(sp);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const stats = useMemo(() => computeStats(progress ?? {}), [progress]);

  const recentMisses = useMemo(() => {
    if (!progress) return [];
    const misses = Array.isArray(progress.misses) ? progress.misses : [];
    return misses
      .filter((m): m is string => typeof m === 'string')
      .slice(-10)
      .reverse();
  }, [progress]);

  const profileLevel = profile?.sections.spelling.level ?? 0;
  const hasPlacement = placementDone(progress ?? {}, profileLevel);
  const displayLevel = clampToLabelLevel(profileLevel);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white py-12 px-4">
        <div className="max-w-3xl mx-auto text-center text-amber-700">
          Loading your bee…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white py-10 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">🐝</div>
          <h1 className="text-4xl md:text-5xl font-black text-amber-900 mb-2">
            Spelling Bee
          </h1>
          <p className="text-lg text-amber-700">
            Listen, type, learn the rules.
          </p>
        </div>

        {!hasPlacement ? (
          <FirstTimePanel />
        ) : (
          <>
            <ProfileCard
              profile={profile}
              level={displayLevel}
              onEdit={() => setEditing(true)}
            />

            <StatsRow
              sessions={stats.sessions}
              attempts={stats.attempts}
              mastered={stats.mastered}
            />

            <ActionGrid />

            {recentMisses.length > 0 && (
              <MissedWordsPreview words={recentMisses} />
            )}

            <div className="text-center mt-8 text-xs text-amber-700">
              <Link
                href="/spelling/placement"
                className="underline hover:text-amber-900"
              >
                Re-take placement
              </Link>
              {' · '}
              <Link href="/" className="underline hover:text-amber-900">
                Back to Mamma&apos;s Place
              </Link>
            </div>
          </>
        )}
      </div>

      {editing && profile && (
        <EditProfileModal
          profile={profile}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

// ---- First-time flow ---------------------------------------------------

function FirstTimePanel() {
  return (
    <div className="bg-white rounded-3xl shadow-xl border-2 border-amber-200 p-8 md:p-12 text-center max-w-2xl mx-auto">
      <div className="text-5xl mb-4">🎯</div>
      <h2 className="text-2xl md:text-3xl font-black text-amber-900 mb-3">
        Let&apos;s find your level first
      </h2>
      <p className="text-amber-800 mb-8">
        A quick listen-and-spell test (about 12 words) picks the perfect
        starting point. Not too easy, not too tricky.
      </p>
      <Link
        href="/spelling/placement"
        className="inline-block bg-amber-600 hover:bg-amber-700 text-white font-bold text-lg px-8 py-4 rounded-2xl shadow-md hover:shadow-lg transition-all"
      >
        Take the placement test →
      </Link>
      <div className="mt-6">
        <Link
          href="/spelling/practice?level=1"
          className="text-sm text-amber-700 hover:text-amber-900 underline"
        >
          Skip and start at Level 1
        </Link>
      </div>
    </div>
  );
}

// ---- Profile card ------------------------------------------------------

function ProfileCard({
  profile,
  level,
  onEdit,
}: {
  profile: LearnerSummary | null;
  level: SpellingLevel;
  onEdit: () => void;
}) {
  if (!profile) return null;

  const ageBits: string[] = [];
  if (profile.ageYears != null) ageBits.push(`Age ${profile.ageYears}`);
  if (profile.gradeLevel) ageBits.push(profile.gradeLevel);

  return (
    <div className="bg-white rounded-2xl shadow-md border-2 border-amber-100 p-5 md:p-6 mb-6 flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
      <div className="flex-shrink-0 w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center text-2xl">
        🐝
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-xl md:text-2xl font-black text-amber-900 truncate">
            {profile.displayName || profile.name}
          </h2>
          {ageBits.length > 0 && (
            <span className="text-sm text-amber-700">{ageBits.join(' · ')}</span>
          )}
        </div>
        <div className="mt-2">
          <span className="inline-block bg-amber-100 text-amber-900 text-xs font-bold uppercase tracking-wide px-3 py-1 rounded-full">
            {levelLabel(level)}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="self-start md:self-center text-sm font-semibold text-amber-800 hover:text-amber-900 underline whitespace-nowrap"
      >
        Edit profile
      </button>
    </div>
  );
}

// ---- Stats row ---------------------------------------------------------

function StatsRow({
  sessions,
  attempts,
  mastered,
}: {
  sessions: number;
  attempts: number;
  mastered: number;
}) {
  const cards: { label: string; value: number; emoji: string }[] = [
    { label: 'Sessions', value: sessions, emoji: '📚' },
    { label: 'Words tried', value: attempts, emoji: '✏️' },
    { label: 'Words mastered', value: mastered, emoji: '⭐' },
  ];
  return (
    <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
      {cards.map((c) => (
        <div
          key={c.label}
          className="bg-white rounded-2xl border-2 border-amber-100 p-4 text-center shadow-sm"
        >
          <div className="text-2xl mb-1">{c.emoji}</div>
          <div className="text-2xl md:text-3xl font-black text-amber-900">
            {c.value}
          </div>
          <div className="text-xs text-amber-700 mt-0.5">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

// ---- Action grid -------------------------------------------------------

function ActionGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* Practice — biggest, primary */}
      <Link
        href="/spelling/practice"
        className="md:col-span-2 group bg-gradient-to-br from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white rounded-2xl p-6 md:p-8 shadow-lg hover:shadow-xl transition-all"
      >
        <div className="text-4xl mb-2">🎯</div>
        <div className="text-2xl md:text-3xl font-black mb-1">Practice</div>
        <p className="text-amber-50 text-sm md:text-base">
          Listen to a word, type it in, get instant feedback.
        </p>
        <div className="mt-4 font-bold text-amber-50 group-hover:translate-x-1 transition-transform">
          Start →
        </div>
      </Link>

      {/* Browse Rules — secondary */}
      <Link
        href="/spelling/rules"
        className="group bg-white border-2 border-amber-200 hover:border-amber-400 hover:shadow-md rounded-2xl p-5 transition-all flex flex-col"
      >
        <div className="text-3xl mb-2">🔍</div>
        <div className="text-lg font-black text-amber-900 mb-1">
          Browse Rules
        </div>
        <p className="text-amber-800 text-sm flex-1">
          Spelling patterns by level — short vowels, blends, silent E, more.
        </p>
        <div className="mt-3 text-sm font-bold text-amber-700 group-hover:text-amber-900">
          Open →
        </div>
      </Link>

      {/* Commonly Confused — drill mode */}
      <Link
        href="/spelling/confused"
        className="group bg-white border-2 border-amber-200 hover:border-amber-400 hover:shadow-md rounded-2xl p-5 transition-all flex flex-col"
      >
        <div className="text-3xl mb-2">🪤</div>
        <div className="text-lg font-black text-amber-900 mb-1">
          Confused Words
        </div>
        <p className="text-amber-800 text-sm flex-1">
          The traps — separate vs seperate, their vs there, and more.
        </p>
        <div className="mt-3 text-sm font-bold text-amber-700 group-hover:text-amber-900">
          Drill →
        </div>
      </Link>

      {/* Weekly Word List — printable */}
      <Link
        href="/spelling/wordlist"
        className="md:col-span-2 group bg-white border-2 border-amber-200 hover:border-amber-400 hover:shadow-md rounded-2xl p-5 transition-all flex flex-col"
      >
        <div className="text-3xl mb-2">🖨️</div>
        <div className="text-lg font-black text-amber-900 mb-1">
          Printable Word List
        </div>
        <p className="text-amber-800 text-sm flex-1">
          Generate a take-home weekly list at any level — 10, 15, or 20 words
          with sentences and signature line.
        </p>
        <div className="mt-3 text-sm font-bold text-amber-700 group-hover:text-amber-900">
          Build & print →
        </div>
      </Link>
    </div>
  );
}

// ---- Missed-words preview ---------------------------------------------

function MissedWordsPreview({ words }: { words: string[] }) {
  const tryThese = `/spelling/practice?mode=review`;
  return (
    <div className="bg-white rounded-2xl border-2 border-amber-100 p-5 md:p-6 mb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-lg font-black text-amber-900">
          Words you&apos;re working on
        </h3>
        <Link
          href={tryThese}
          className="text-sm font-bold text-amber-700 hover:text-amber-900 underline whitespace-nowrap"
        >
          Try these →
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {words.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => speakWord(w)}
            className="bg-amber-50 hover:bg-amber-100 border border-amber-200 hover:border-amber-300 text-amber-900 text-sm font-semibold px-3 py-1.5 rounded-full transition-colors"
            aria-label={`Hear the word ${w}`}
            title="Click to hear"
          >
            🔊 {w}
          </button>
        ))}
      </div>
      <p className="text-xs text-amber-700 mt-3">
        Tap any word to hear it.
      </p>
    </div>
  );
}

// ---- Edit-profile modal ------------------------------------------------

function EditProfileModal({
  profile,
  onClose,
  onSaved,
}: {
  profile: LearnerSummary;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [displayName, setDisplayName] = useState(profile.displayName || '');
  const [ageYears, setAgeYears] = useState<string>(
    profile.ageYears != null ? String(profile.ageYears) : '',
  );
  const [gradeLevel, setGradeLevel] = useState(profile.gradeLevel || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const updates: ProfileUpdates = {};
    const trimmedName = displayName.trim();
    if (trimmedName !== (profile.displayName || '')) {
      updates.displayName = trimmedName;
    }
    const ageTrimmed = ageYears.trim();
    if (ageTrimmed === '') {
      // No-op: API treats explicit null as clear; leave field alone if blank.
    } else {
      const n = Number(ageTrimmed);
      if (Number.isFinite(n) && n >= 0 && n <= 120) {
        updates.ageYears = Math.floor(n);
      }
    }
    const trimmedGrade = gradeLevel.trim();
    if (trimmedGrade !== (profile.gradeLevel || '')) {
      updates.gradeLevel = trimmedGrade;
    }

    try {
      await updateProfile(updates);
    } finally {
      setSaving(false);
      await onSaved();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-profile-title"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border-2 border-amber-200 w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id="edit-profile-title"
          className="text-xl font-black text-amber-900 mb-4"
        >
          Edit profile
        </h3>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label
              htmlFor="ep-name"
              className="block text-sm font-bold text-amber-900 mb-1"
            >
              Display name
            </label>
            <input
              id="ep-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={60}
              placeholder={profile.name}
              className="w-full rounded-xl border-2 border-amber-200 focus:border-amber-500 focus:outline-none bg-amber-50 text-amber-900 px-4 py-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="ep-age"
                className="block text-sm font-bold text-amber-900 mb-1"
              >
                Age
              </label>
              <input
                id="ep-age"
                type="number"
                inputMode="numeric"
                min={0}
                max={120}
                value={ageYears}
                onChange={(e) => setAgeYears(e.target.value)}
                placeholder="e.g. 7"
                className="w-full rounded-xl border-2 border-amber-200 focus:border-amber-500 focus:outline-none bg-amber-50 text-amber-900 px-4 py-2"
              />
            </div>
            <div>
              <label
                htmlFor="ep-grade"
                className="block text-sm font-bold text-amber-900 mb-1"
              >
                Grade
              </label>
              <input
                id="ep-grade"
                type="text"
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                maxLength={16}
                placeholder="e.g. 2nd"
                className="w-full rounded-xl border-2 border-amber-200 focus:border-amber-500 focus:outline-none bg-amber-50 text-amber-900 px-4 py-2"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 font-bold py-3 rounded-xl border-2 border-amber-200 hover:border-amber-300 bg-white text-amber-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 font-bold py-3 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
