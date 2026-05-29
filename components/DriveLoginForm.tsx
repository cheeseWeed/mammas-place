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

export default function DriveLoginForm() {
  const [user, setUser] = useState<string>(readSavedUser);
  const [pin, setPin] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const userInputRef = useRef<HTMLInputElement>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);

  // Focus: PIN field if name pre-filled (returning user), else name field.
  useEffect(() => {
    if (user) {
      pinInputRef.current?.focus();
    } else {
      userInputRef.current?.focus();
    }
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
