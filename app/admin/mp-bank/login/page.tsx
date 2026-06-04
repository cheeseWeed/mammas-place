'use client';

// Admin gate for /admin/mp-bank. Alphanumeric PIN (4-12 chars), posts to
// /api/money/parent/login. The seed/first-time PIN lives server-side in
// lib/money/parent.SEED_PARENT_PIN and is intentionally NOT shown on this page.
// Separate from the staff /admin portal — different cookie, different concern.

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Status =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'error'; message: string };

// Mirrors lib/money/parent.isValidParentPin — keep in sync if loosening server-side.
const PIN_RE = /^[A-Za-z0-9]{4,12}$/;

export default function MpBankLoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const pinRef = useRef<HTMLInputElement>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!PIN_RE.test(pin)) {
      setStatus({ kind: 'error', message: 'PIN must be 4-12 letters or digits.' });
      return;
    }
    setStatus({ kind: 'busy' });
    try {
      const res = await fetch('/api/money/parent/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      if (res.ok) {
        router.push('/admin/mp-bank');
        router.refresh();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: unknown };
      const errMsg = typeof data.error === 'string' ? data.error : 'Wrong PIN';
      setStatus({ kind: 'error', message: errMsg });
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Network error',
      });
    }
  };

  const busy = status.kind === 'busy';

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-400 border-4 border-yellow-300 mb-3">
            <span className="text-purple-900 font-black text-xl">MP</span>
          </div>
          <h1 className="text-white font-black text-2xl">Admin · MP Bank</h1>
          <p className="text-yellow-200 text-sm mt-1">Family store-credit admin</p>
        </div>

        <form
          onSubmit={submit}
          className="bg-white rounded-2xl p-6 shadow-2xl border-2 border-purple-100"
        >
          <h2 className="text-purple-900 font-bold text-lg mb-5 text-center">
            Enter admin PIN
          </h2>

          <label
            htmlFor="mp-parent-pin"
            className="block text-sm font-medium text-purple-900 mb-1"
          >
            Admin PIN (4-12 chars)
          </label>
          <input
            id="mp-parent-pin"
            ref={pinRef}
            type="password"
            pattern="[A-Za-z0-9]{4,12}"
            value={pin}
            onChange={(e) =>
              setPin(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 12))
            }
            placeholder="••••••"
            maxLength={12}
            autoComplete="current-password"
            autoFocus
            disabled={busy}
            className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-4 py-3 bg-purple-50 text-purple-900 tracking-[0.3em] text-center text-xl"
          />

          {status.kind === 'error' && (
            <div className="mt-3 rounded-xl bg-yellow-100 border border-yellow-300 text-purple-900 text-sm px-4 py-3">
              {status.message}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-5 w-full bg-purple-900 hover:bg-purple-800 disabled:bg-purple-300 text-white font-bold py-3 rounded-xl transition-colors"
          >
            {busy ? 'Checking…' : 'Unlock MP Bank'}
          </button>
        </form>

        <p className="text-center text-purple-200 text-xs mt-6">
          Mamma&apos;s Place · Admin gate (separate from staff admin)
        </p>
      </div>
    </div>
  );
}
