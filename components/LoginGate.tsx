'use client';

// LoginGate — shared auth wrapper for any learning section page.
//
// - If the learner has a `dl_user` cookie (set by /api/drive/login or
//   /register), render `children`.
// - Otherwise, render an inline login/register card (same PIN flow as Drive)
//   with section-aware messaging.
//
// One user account, many sections: the cookie set by Drive's login is also
// valid for Geography / Spelling / etc., so a learner only signs in once.

import { useEffect, useRef, useState } from 'react';

export type LoginGateSection =
  | 'drive'
  | 'geography'
  | 'spelling'
  | 'math'
  | 'languageArts'
  | 'chess';

const COOKIE_NAME = 'dl_user';

type Status =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'error'; message: string; offerReset?: boolean };

const SECTION_COPY: Record<
  LoginGateSection,
  { headline: string; subhead: string; accent: string }
> = {
  drive: {
    headline: 'Who’s studying?',
    subhead: 'Log in to keep your quiz scores and weak spots saved across devices.',
    accent: 'purple',
  },
  geography: {
    headline: 'Who’s exploring?',
    subhead: 'Log in to track your Geography progress across devices.',
    accent: 'emerald',
  },
  spelling: {
    headline: 'Who’s spelling?',
    subhead: 'Log in to track your Spelling progress and bee streaks.',
    accent: 'amber',
  },
  math: {
    headline: 'Who’s drilling?',
    subhead: 'Log in so the Math Arena can save your scores and pay you in MP.',
    accent: 'sky',
  },
  languageArts: {
    headline: 'Who’s reading?',
    subhead: 'Log in to track your Language Arts progress and earn MP.',
    accent: 'rose',
  },
  chess: {
    headline: 'Who’s playing?',
    subhead: 'Log in so the Chess board can save your game and pay you in MP.',
    accent: 'purple',
  },
};

function readCookieName(): string | null {
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

function readSavedUser(): string {
  if (typeof window === 'undefined') return '';
  try {
    const stored = window.localStorage.getItem('dl_user');
    return stored && stored !== '__anon__' ? stored : '';
  } catch {
    return '';
  }
}

export type LoginGateProps = {
  section: LoginGateSection;
  children: React.ReactNode;
  // Optional: render something custom while the cookie check resolves.
  loadingFallback?: React.ReactNode;
};

export default function LoginGate({
  section,
  children,
  loadingFallback,
}: LoginGateProps) {
  // `null` = checking; string = logged in; '' = not logged in.
  const [authedAs, setAuthedAs] = useState<string | null>(null);

  // Cookie check runs only on the client (avoids SSR/hydration drift).
  useEffect(() => {
    const name = readCookieName();
    setAuthedAs(name ?? '');
  }, []);

  if (authedAs === null) {
    // First paint after hydration — render the fallback (or nothing) so we
    // don't briefly flash the login form to an already-authed learner.
    return <>{loadingFallback ?? null}</>;
  }

  if (authedAs) {
    return <>{children}</>;
  }

  return (
    <SectionLoginCard
      section={section}
      onAuthed={(name) => setAuthedAs(name)}
    />
  );
}

// ---- Inline login/register card (section-aware) -------------------------

function SectionLoginCard({
  section,
  onAuthed,
}: {
  section: LoginGateSection;
  onAuthed: (name: string) => void;
}) {
  const copy = SECTION_COPY[section];
  const [user, setUser] = useState<string>(readSavedUser);
  const [pin, setPin] = useState('');
  // Optional pretty-cased display name; only sent on register, ignored on login.
  const [displayName, setDisplayName] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const userInputRef = useRef<HTMLInputElement>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) pinInputRef.current?.focus();
    else userInputRef.current?.focus();
    // mount-only focus
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistAndAuth = (userKey: string) => {
    try {
      window.localStorage.setItem('dl_user', userKey);
    } catch {
      // ignore
    }
    onAuthed(userKey);
  };

  const submit = async (action: 'login' | 'register') => {
    if (!user.trim()) {
      setStatus({ kind: 'error', message: 'Enter your name.' });
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setStatus({ kind: 'error', message: 'PIN must be exactly 4 digits.' });
      return;
    }
    setStatus({ kind: 'busy' });
    try {
      // We deliberately reuse the existing /api/drive/{login,register}
      // endpoints — there's only one user table and one cookie, so any
      // section's login flow is the same flow.
      const trimmedDisplay = displayName.trim();
      const body: Record<string, string> = { user: user.trim(), pin };
      if (action === 'register' && trimmedDisplay) {
        body.displayName = trimmedDisplay;
      }
      const res = await fetch(`/api/drive/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = (await res.json()) as { user?: string };
        persistAndAuth(data.user || user.trim().toLowerCase());
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (action === 'register' && res.status === 409) {
        setStatus({
          kind: 'error',
          message: data.error || 'Name taken — enter your PIN and click Log in.',
        });
        return;
      }
      if (action === 'login' && res.status === 401) {
        setStatus({
          kind: 'error',
          message: 'Wrong name or PIN.',
          offerReset: true,
        });
        return;
      }
      setStatus({
        kind: 'error',
        message: data.error || 'Something went wrong. Try again.',
      });
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Network error',
      });
    }
  };

  const handleReset = async () => {
    if (!user.trim()) return;
    const confirmText = window.prompt(
      `This will WIPE all saved progress for "${user.trim()}" across every section, and let you re-register with a new PIN. Type "reset" to confirm:`,
    );
    if (confirmText?.toLowerCase() !== 'reset') return;
    setStatus({ kind: 'busy' });
    try {
      const res = await fetch('/api/drive/reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user: user.trim() }),
      });
      if (res.ok || res.status === 404) {
        setPin('');
        setStatus({
          kind: 'error',
          message: 'Progress wiped. Pick a new PIN and click "I’m new (register)".',
        });
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setStatus({
          kind: 'error',
          message: data.error || 'Reset failed. Try again.',
        });
      }
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Network error',
      });
    }
  };

  const busy = status.kind === 'busy';

  // Tailwind doesn't dynamic-class well; map accent to fixed class strings.
  const ACCENT_MAP: Record<string, {
    card: string; heading: string; label: string; inputWrap: string;
    primary: string; secondary: string; link: string; mute: string;
  }> = {
    emerald: {
      card: 'border-emerald-100',
      heading: 'text-emerald-900',
      label: 'text-emerald-900',
      inputWrap: 'border-emerald-200 focus:border-emerald-500 bg-emerald-50 text-emerald-900',
      primary: 'bg-emerald-900 hover:bg-emerald-800 disabled:bg-emerald-300',
      secondary: 'bg-yellow-100 hover:bg-yellow-200 disabled:bg-yellow-50 text-emerald-900 border-yellow-300',
      link: 'text-emerald-700 hover:text-emerald-900',
      mute: 'text-emerald-700',
    },
    amber: {
      card: 'border-amber-100',
      heading: 'text-amber-900',
      label: 'text-amber-900',
      inputWrap: 'border-amber-200 focus:border-amber-500 bg-amber-50 text-amber-900',
      primary: 'bg-amber-900 hover:bg-amber-800 disabled:bg-amber-300',
      secondary: 'bg-yellow-100 hover:bg-yellow-200 disabled:bg-yellow-50 text-amber-900 border-yellow-300',
      link: 'text-amber-700 hover:text-amber-900',
      mute: 'text-amber-700',
    },
    sky: {
      card: 'border-sky-100',
      heading: 'text-sky-900',
      label: 'text-sky-900',
      inputWrap: 'border-sky-200 focus:border-sky-500 bg-sky-50 text-sky-900',
      primary: 'bg-sky-700 hover:bg-sky-800 disabled:bg-sky-300',
      secondary: 'bg-yellow-100 hover:bg-yellow-200 disabled:bg-yellow-50 text-sky-900 border-yellow-300',
      link: 'text-sky-700 hover:text-sky-900',
      mute: 'text-sky-700',
    },
    rose: {
      card: 'border-rose-100',
      heading: 'text-rose-900',
      label: 'text-rose-900',
      inputWrap: 'border-rose-200 focus:border-rose-500 bg-rose-50 text-rose-900',
      primary: 'bg-rose-700 hover:bg-rose-800 disabled:bg-rose-300',
      secondary: 'bg-yellow-100 hover:bg-yellow-200 disabled:bg-yellow-50 text-rose-900 border-yellow-300',
      link: 'text-rose-700 hover:text-rose-900',
      mute: 'text-rose-700',
    },
    purple: {
      card: 'border-purple-100',
      heading: 'text-purple-900',
      label: 'text-purple-900',
      inputWrap: 'border-purple-200 focus:border-purple-500 bg-purple-50 text-purple-900',
      primary: 'bg-purple-900 hover:bg-purple-800 disabled:bg-purple-300',
      secondary: 'bg-yellow-100 hover:bg-yellow-200 disabled:bg-yellow-50 text-purple-900 border-yellow-300',
      link: 'text-purple-700 hover:text-purple-900',
      mute: 'text-purple-600',
    },
  };
  const accentClasses = ACCENT_MAP[copy.accent] ?? ACCENT_MAP.purple;

  return (
    <div
      className={`bg-white rounded-2xl shadow-lg p-6 md:p-8 border-2 mb-8 max-w-2xl mx-auto ${accentClasses.card}`}
    >
      <h2 className={`text-2xl font-bold mb-2 text-center ${accentClasses.heading}`}>
        {copy.headline}
      </h2>
      <p className="text-center text-gray-600 text-sm mb-6">{copy.subhead}</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit('login');
        }}
        className="max-w-md mx-auto space-y-4"
      >
        <div>
          <label
            htmlFor={`gate-${section}-user`}
            className={`block text-sm font-medium mb-1 ${accentClasses.label}`}
          >
            Your name
          </label>
          <input
            id={`gate-${section}-user`}
            ref={userInputRef}
            type="text"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="e.g. Lilly"
            maxLength={30}
            autoComplete="username"
            disabled={busy}
            className={`w-full rounded-xl border-2 focus:outline-none px-4 py-2 ${accentClasses.inputWrap}`}
          />
        </div>

        <div>
          <label
            htmlFor={`gate-${section}-display`}
            className={`block text-sm font-medium mb-1 ${accentClasses.label}`}
          >
            Display name <span className="font-normal opacity-70">(only when registering)</span>
          </label>
          <input
            id={`gate-${section}-display`}
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="How you want it shown (optional)"
            maxLength={30}
            autoComplete="off"
            disabled={busy}
            className={`w-full rounded-xl border-2 focus:outline-none px-4 py-2 ${accentClasses.inputWrap}`}
          />
        </div>

        <div>
          <label
            htmlFor={`gate-${section}-pin`}
            className={`block text-sm font-medium mb-1 ${accentClasses.label}`}
          >
            4-digit PIN
          </label>
          <input
            id={`gate-${section}-pin`}
            ref={pinInputRef}
            type="password"
            inputMode="numeric"
            pattern="\d{4}"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="• • • •"
            maxLength={4}
            autoComplete="current-password"
            disabled={busy}
            className={`w-full rounded-xl border-2 focus:outline-none px-4 py-2 tracking-[0.4em] text-center ${accentClasses.inputWrap}`}
          />
        </div>

        {status.kind === 'error' && (
          <div className="rounded-xl bg-yellow-100 border border-yellow-300 text-purple-900 text-sm px-4 py-3">
            {status.message}
            {status.offerReset && (
              <button
                type="button"
                onClick={handleReset}
                className={`ml-2 underline ${accentClasses.link}`}
              >
                Forgot PIN? Wipe and start over.
              </button>
            )}
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3 pt-2">
          <button
            type="submit"
            disabled={busy}
            className={`text-white font-bold py-3 rounded-xl transition-colors ${accentClasses.primary}`}
          >
            {busy ? 'Working…' : 'Log in'}
          </button>
          <button
            type="button"
            onClick={() => submit('register')}
            disabled={busy}
            className={`font-bold py-3 rounded-xl border-2 transition-colors ${accentClasses.secondary}`}
          >
            I&apos;m new (register)
          </button>
        </div>

        <p className={`text-center text-xs pt-2 ${accentClasses.mute}`}>
          One login works across every learning section (Drive, Geography, Spelling, Math, Language Arts).
        </p>
      </form>
    </div>
  );
}
