'use client';

// PendingEarnPrompt — the "log in to keep your MP" card.
//
// Renders inside a section's results screen when the kid finished a round
// while logged out. Shows the amount they would have earned, then offers
// an inline name+PIN form. On successful login/register we re-submit the
// earn (idempotency key reused) and the server credits the held amount.
//
// Two flows:
//   - "Log in" — existing kid, just claims the held MP into their balance
//   - "I'm new (register)" — new kid, account created with this round as
//     their first earning
//
// Closing the browser before claiming = the earn evaporates. That's the
// trade-off for not requiring an account up front.

import { useRef, useState } from 'react';
import { useLearner } from '@/context/LearnerContext';
import {
  submitEarn,
  type EarnSection,
} from '@/lib/money/earn-client';
import { centsToMP } from '@/lib/money/format';

type Pending = {
  section: EarnSection;
  kind: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  centsEarned: number;
  reason: string;
};

type Status =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'error'; message: string }
  | { kind: 'claimed'; cents: number };

export default function PendingEarnPrompt({
  pending,
  onClaimed,
}: {
  pending: Pending;
  onClaimed?: (cents: number) => void;
}) {
  const { refresh } = useLearner();
  const [user, setUser] = useState('');
  const [pin, setPin] = useState('');
  // Optional pretty-cased display name; only sent on register, ignored on login.
  const [displayName, setDisplayName] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const userInputRef = useRef<HTMLInputElement>(null);

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

    // Step 1: log in or register. Server sets the dl_user cookie.
    try {
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
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (action === 'login' && res.status === 401) {
          setStatus({ kind: 'error', message: 'Wrong name or PIN.' });
          return;
        }
        if (action === 'register' && res.status === 409) {
          setStatus({
            kind: 'error',
            message: data.error || 'Name taken — try Log in instead.',
          });
          return;
        }
        setStatus({
          kind: 'error',
          message: data.error || 'Something went wrong. Try again.',
        });
        return;
      }
      // Also seed localStorage so LearnerContext picks it up quickly.
      try {
        localStorage.setItem('dl_user', user.trim().toLowerCase());
      } catch {
        // ignore
      }
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Network error',
      });
      return;
    }

    // Step 2: re-submit the earn with the same idempotency key. The server
    // now sees the cookie and actually credits.
    const earnRes = await submitEarn(
      pending.section,
      pending.kind,
      pending.payload,
      pending.idempotencyKey,
    );
    if ('error' in earnRes) {
      setStatus({
        kind: 'error',
        message: `Logged in, but MP didn't record: ${earnRes.error}`,
      });
      return;
    }
    // Logged-in response — should have centsEarned (or 0 if duplicate replay).
    const cents = earnRes.centsEarned;
    setStatus({ kind: 'claimed', cents });
    onClaimed?.(cents);
    // Refresh the header chip + balance now.
    void refresh();
  };

  if (status.kind === 'claimed') {
    return (
      <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-5 mb-4 text-center">
        <div className="text-3xl mb-1">✅</div>
        <div className="text-lg font-black text-emerald-900">
          Banked! +{centsToMP(status.cents || pending.centsEarned)} added to your balance.
        </div>
        <div className="text-xs text-emerald-700 mt-1">
          Welcome, {user.trim()}. Your MP follows you across every section now.
        </div>
      </div>
    );
  }

  const busy = status.kind === 'busy';
  return (
    <div className="rounded-2xl border-2 border-yellow-300 bg-yellow-50 p-5 mb-4">
      <div className="text-center mb-3">
        <div className="text-3xl mb-1">🎉</div>
        <div className="text-xl font-black text-yellow-900">
          You earned +{centsToMP(pending.centsEarned)}!
        </div>
        <div className="text-sm text-yellow-800 mt-1">
          Log in or register to keep it.
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit('login');
        }}
        className="space-y-3 max-w-md mx-auto"
      >
        <div className="grid grid-cols-2 gap-2">
          <input
            ref={userInputRef}
            type="text"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="Your name"
            maxLength={30}
            autoComplete="username"
            disabled={busy}
            className="rounded-xl border-2 border-yellow-300 focus:border-yellow-500 focus:outline-none bg-white text-purple-900 px-3 py-2 font-semibold"
          />
          <input
            type="password"
            inputMode="numeric"
            pattern="\d{4}"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="• • • •"
            maxLength={4}
            autoComplete="current-password"
            disabled={busy}
            className="rounded-xl border-2 border-yellow-300 focus:border-yellow-500 focus:outline-none bg-white text-purple-900 px-3 py-2 tracking-[0.4em] text-center font-bold"
          />
        </div>

        {/* Optional display name (only used on register; login ignores it). */}
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Display name (optional — only when registering)"
          maxLength={30}
          autoComplete="off"
          disabled={busy}
          className="w-full rounded-xl border-2 border-yellow-300 focus:border-yellow-500 focus:outline-none bg-white text-purple-900 px-3 py-2"
        />

        {status.kind === 'error' && (
          <div className="text-sm font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {status.message}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="submit"
            disabled={busy}
            className="bg-purple-900 hover:bg-purple-800 disabled:bg-purple-300 text-white font-bold py-2.5 rounded-xl transition-colors"
          >
            {busy ? '…' : 'Log in & claim'}
          </button>
          <button
            type="button"
            onClick={() => submit('register')}
            disabled={busy}
            className="bg-yellow-200 hover:bg-yellow-300 disabled:bg-yellow-100 text-purple-900 font-bold py-2.5 rounded-xl border-2 border-yellow-400 transition-colors"
          >
            {busy ? '…' : "I'm new — register"}
          </button>
        </div>
      </form>
    </div>
  );
}
