// Shared LearnerProfile helpers.
//
// One user, many learning sections. The underlying row is `DriveUser` (kept
// for back-compat with the existing Drive cookie/auth), but every learning
// section in the app (Drive, Geography, Spelling, ...) reads and writes the
// learner's profile + per-section progress through this module.
//
// Auth model: reuses the existing Drive PIN cookie (`dl_user`). If the
// cookie is present the user is logged in; if not, the section page should
// fall back to the LoginGate (which reuses DriveLoginForm wiring under the
// hood).

'use client';

// -- Section progress shapes (loose by design; sections own their own shape) --

export type DriveSectionSummary = {
  attemptCount: number;
  lastActive?: number;
};

export type GeographySectionSummary = {
  phasesCompleted: number;
  lastActive?: number;
};

export type SpellingSectionSummary = {
  level: number;
  lastActive?: number;
};

export type LearnerSummary = {
  name: string;
  displayName: string;
  ageYears: number | null;
  gradeLevel: string | null;
  sections: {
    drive: DriveSectionSummary;
    geography: GeographySectionSummary;
    spelling: SpellingSectionSummary;
  };
};

export type ProfileUpdates = Partial<{
  displayName: string;
  ageYears: number;
  gradeLevel: string;
}>;

// Spelling progress is intentionally loose for now — the Spelling section is
// still being built. Once it stabilizes, replace `Record<string, unknown>`
// with a concrete shape.
export type SpellingProgress = {
  level?: number;
  attempts?: unknown[];
  misses?: string[];
  lastSession?: number;
  [key: string]: unknown;
};

// -- Cookie / login state (client-side) --

const COOKIE_NAME = 'dl_user';

// Returns the normalized logged-in username, or null if anonymous or
// browsing as `__anon__`. Safe to call during SSR (returns null).
export function getLoggedInName(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  const raw = decodeURIComponent(match.slice(COOKIE_NAME.length + 1));
  if (!raw || raw === '__anon__') return null;
  return raw;
}

// -- Profile API (GET/PUT against /api/learner/profile) --

// Read the full profile summary for the logged-in user. Returns null when
// not logged in or the user record doesn't exist.
export async function fetchProfile(): Promise<LearnerSummary | null> {
  const name = getLoggedInName();
  if (!name) return null;
  try {
    const res = await fetch(
      `/api/learner/profile?user=${encodeURIComponent(name)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    return (await res.json()) as LearnerSummary;
  } catch {
    return null;
  }
}

// Patch profile fields. No-op when not logged in.
export async function updateProfile(updates: ProfileUpdates): Promise<void> {
  const name = getLoggedInName();
  if (!name) return;
  await fetch('/api/learner/profile', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ user: name, ...updates }),
  });
}

// -- Spelling progress (GET/PUT against /api/learner/spelling) --

export async function readSpellingProgress(): Promise<SpellingProgress> {
  const name = getLoggedInName();
  if (!name) return {};
  try {
    const res = await fetch(
      `/api/learner/spelling?user=${encodeURIComponent(name)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return {};
    const body = (await res.json()) as { spelling?: SpellingProgress };
    return body.spelling ?? {};
  } catch {
    return {};
  }
}

export async function writeSpellingProgress(
  updates: SpellingProgress,
): Promise<void> {
  const name = getLoggedInName();
  if (!name) return;
  await fetch('/api/learner/spelling', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ user: name, spelling: updates }),
  });
}
