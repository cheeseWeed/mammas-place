'use client';

// Login / register form for the Utah Driver License study tool.
// On success: persist user name to localStorage (for HTML quizzes to read)
// and rely on the server-set dl_user cookie. Redirects to dashboard.
//
// Anonymous fallback: "Skip" button writes dl_user=__anon__ to localStorage
// and goes to the dashboard — all existing localStorage-only behaviour
// keeps working.

import { useEffect, useRef, useState } from 'react';

type Status =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'error'; message: string; offerReset?: boolean };

const DASHBOARD_URL = '/drive-assets/dashboard/index.html';
const COOKIE_NAME = 'dl_user';

// Lazy initial state: reads localStorage once on first client render.
// Safe under SSR because the function only runs on the client (this is a
// 'use client' component, but Next still SSRs it; guard for `window`).
function readSavedUser(): string {
  if (typeof window === 'undefined') return '';
  try {
    const stored = localStorage.getItem('dl_user');
    return stored && stored !== '__anon__' ? stored : '';
  } catch {
    return '';
  }
}

// The authoritative "are you logged in?" signal is the server-set
// `dl_user` cookie, NOT localStorage. localStorage can outlive the
// cookie when the session-cookie expires on window close — in that
// case the kid is logged-out as far as the server is concerned and
// we should NOT skip the login form on /drive.
function readCookieUser(): string | null {
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

export default function DriveLoginForm() {
  const [user, setUser] = useState<string>(readSavedUser);
  const [pin, setPin] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const userInputRef = useRef<HTMLInputElement>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);

  // `null` = haven't checked yet (SSR / first paint), '' = not logged in,
  // string = logged-in cookie user. Cookie is the source of truth — since
  // it's a session cookie, the browser drops it on close.
  const [cookieUser, setCookieUser] = useState<string | null>(null);

  useEffect(() => {
    setCookieUser(readCookieUser() ?? '');
  }, []);

  // Focus: PIN field if name pre-filled (returning user), else name field.
  // Only focus when actually showing the form (not the welcome card).
  useEffect(() => {
    if (cookieUser !== '') return; // skip when welcome card is shown
    if (user) {
      pinInputRef.current?.focus();
    } else {
      userInputRef.current?.focus();
    }
    // Run once after cookie state resolves to "not logged in".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cookieUser]);

  const persistAndGo = (userKey: string) => {
    try {
      localStorage.setItem('dl_user', userKey);
    } catch {
      // ignore
    }
    window.location.href = DASHBOARD_URL;
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
      const res = await fetch(`/api/drive/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user: user.trim(), pin }),
      });
      if (res.ok) {
        const data = (await res.json()) as { user?: string };
        persistAndGo(data.user || user.trim().toLowerCase());
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

  const skipAnonymous = () => {
    try {
      localStorage.setItem('dl_user', '__anon__');
    } catch {
      // ignore
    }
    window.location.href = DASHBOARD_URL;
  };

  const handleReset = async () => {
    if (!user.trim()) return;
    const confirmText = prompt(
      `This will WIPE all saved progress for "${user.trim()}" and let you re-register with a new PIN. Type "reset" to confirm:`,
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
          message: 'Progress wiped. Pick a new PIN and click "I\'m new (register)".',
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

  // Switch user: clear cookie + localStorage, drop back to the form.
  // (Used by the welcome-back card's "Switch user" button.)
  const handleSwitchUser = () => {
    try {
      // Expire the cookie immediately. Path must match the original set.
      document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
    } catch {
      // ignore
    }
    try {
      localStorage.removeItem('dl_user');
    } catch {
      // ignore
    }
    setUser('');
    setPin('');
    setStatus({ kind: 'idle' });
    setCookieUser('');
  };

  // First paint (cookie state unknown) — render nothing to avoid a flash
  // of the form when the kid IS logged in. Short blank moment is fine.
  if (cookieUser === null) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 border-2 border-purple-100 mb-8 min-h-[200px]" />
    );
  }

  // Logged-in path: skip the form, show a welcome-back card.
  if (cookieUser) {
    const prettyName =
      cookieUser.charAt(0).toUpperCase() + cookieUser.slice(1);
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 border-2 border-purple-100 mb-8 text-center">
        <div className="text-4xl mb-3">👋</div>
        <h2 className="text-2xl font-bold text-purple-900 mb-2">
          Welcome back, {prettyName}!
        </h2>
        <p className="text-gray-600 text-sm mb-6">
          Pick up where you left off — your decks, scores, and weak spots are saved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
          <a
            href={DASHBOARD_URL}
            className="flex-1 bg-purple-900 hover:bg-purple-800 text-white font-bold py-3 rounded-xl transition-colors"
          >
            Continue to dashboard →
          </a>
          <button
            type="button"
            onClick={handleSwitchUser}
            className="bg-yellow-100 hover:bg-yellow-200 text-purple-900 font-bold py-3 rounded-xl border-2 border-yellow-300 transition-colors"
          >
            Switch user
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 border-2 border-purple-100 mb-8">
      <h2 className="text-2xl font-bold text-purple-900 mb-2 text-center">
        Who&apos;s studying?
      </h2>
      <p className="text-center text-gray-600 text-sm mb-6">
        Log in to keep your quiz scores and weak spots saved across devices.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit('login');
        }}
        className="max-w-md mx-auto space-y-4"
      >
        <div>
          <label
            htmlFor="dl-user"
            className="block text-sm font-medium text-purple-900 mb-1"
          >
            Your name
          </label>
          <input
            id="dl-user"
            ref={userInputRef}
            type="text"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="e.g. Lilly"
            maxLength={30}
            autoComplete="username"
            disabled={busy}
            className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-4 py-2 bg-purple-50 text-purple-900"
          />
        </div>

        <div>
          <label
            htmlFor="dl-pin"
            className="block text-sm font-medium text-purple-900 mb-1"
          >
            4-digit PIN
          </label>
          <input
            id="dl-pin"
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
            className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-4 py-2 bg-purple-50 text-purple-900 tracking-[0.4em] text-center"
          />
        </div>

        {status.kind === 'error' && (
          <div className="rounded-xl bg-yellow-100 border border-yellow-300 text-purple-900 text-sm px-4 py-3">
            {status.message}
            {status.offerReset && (
              <button
                type="button"
                onClick={handleReset}
                className="ml-2 underline text-purple-700 hover:text-purple-900"
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
            className="bg-purple-900 hover:bg-purple-800 disabled:bg-purple-300 text-white font-bold py-3 rounded-xl transition-colors"
          >
            {busy ? 'Working…' : 'Log in'}
          </button>
          <button
            type="button"
            onClick={() => submit('register')}
            disabled={busy}
            className="bg-yellow-100 hover:bg-yellow-200 disabled:bg-yellow-50 text-purple-900 font-bold py-3 rounded-xl border-2 border-yellow-300 transition-colors"
          >
            I&apos;m new (register)
          </button>
        </div>

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={skipAnonymous}
            className="text-xs text-purple-600 hover:text-purple-900 underline"
          >
            Skip — browse anonymously (progress stays in this browser only)
          </button>
        </div>
      </form>
    </div>
  );
}
