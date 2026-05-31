// Kid's gift-card redeem page — Phase 6c.
//
// Single input, auto-formatted to UPPERCASE with a hyphen after `MP`. Submit
// hits POST /api/money/gift-card/redeem (kid-authed via dl_user cookie). On
// success, shows a celebratory message + the parent's optional note + the
// new balance. On failure (already redeemed / revoked / not found), shows
// a friendly inline error.
'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import LoginGate from '@/components/LoginGate';
import { useLearner } from '@/context/LearnerContext';
import { centsToMP } from '@/lib/money/format';

export default function RedeemGiftCardPage() {
  // allowAnonymous=false — gift redemption credits a real balance, so a
  // cookie-backed login is required. The LoginGate's section copy is reused
  // from existing options (purple matches the MP/shop aesthetic).
  return (
    <LoginGate section="drive" allowAnonymous={false}>
      <RedeemForm />
    </LoginGate>
  );
}

interface RedeemSuccess {
  cents: number;
  balanceCents: number;
  note: string | null;
}

// Normalize keystrokes → "MP-XXXXXX". Strips non-alphanumerics, uppercases,
// re-inserts the hyphen after the first two letters when there's enough
// material. Keeps the field forgiving of pastes that include extra spaces.
function formatCodeInput(raw: string): string {
  const upper = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (upper.length === 0) return '';
  if (upper.length <= 2) return upper;
  // Drop a leading "MP" so we always render it as the canonical prefix.
  const stripped = upper.startsWith('MP') ? upper.slice(2) : upper;
  return `MP-${stripped.slice(0, 6)}`;
}

function RedeemForm() {
  const { learner, refresh } = useLearner();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<RedeemSuccess | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const trimmed = code.trim();
    if (!trimmed) {
      setError('Enter the code from your card.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/money/gift-card/redeem', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        cents?: number;
        balanceCents?: number;
        note?: string | null;
        kind?: string;
        error?: string;
      };
      if (res.ok && data.ok && typeof data.cents === 'number' && typeof data.balanceCents === 'number') {
        setSuccess({
          cents: data.cents,
          balanceCents: data.balanceCents,
          note: typeof data.note === 'string' ? data.note : null,
        });
        setCode('');
        // Refresh the cached balance in LearnerContext so the chip in the
        // header (and any other consumer) reflects the new total.
        void refresh();
        return;
      }
      // Map the API's `kind` to a friendly inline message.
      switch (data.kind) {
        case 'already_redeemed':
          setError("That code has already been used. Each gift card only works once.");
          break;
        case 'revoked':
          setError("That code is no longer active. Ask the grown-up who gave it to you.");
          break;
        case 'not_found':
          setError("We couldn't find that code. Double-check the letters and numbers.");
          break;
        default:
          setError(data.error || `Something went wrong (HTTP ${res.status}).`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-260px)] px-4 py-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          href="/portal/money"
          className="text-sm text-purple-700 hover:text-purple-900 underline"
        >
          ← Back to MP Money
        </Link>
        <h1 className="text-2xl sm:text-3xl font-black text-purple-900 mt-2">
          Redeem a gift card
        </h1>
        <p className="text-sm text-gray-700 mt-1 max-w-prose">
          Got a printed <span className="font-mono">MP-XXXXXX</span> code? Type
          it in below and we&apos;ll add the MP to your balance.
        </p>
      </div>

      {success ? (
        <div className="bg-gradient-to-br from-yellow-50 to-purple-50 rounded-2xl border-2 border-yellow-300 p-6 sm:p-8 text-center shadow-md">
          <div className="text-5xl mb-2">🎉</div>
          <div className="text-3xl sm:text-4xl font-black text-purple-900 mb-1">
            +{centsToMP(success.cents)} added!
          </div>
          {success.note && (
            <p className="text-purple-800 italic text-sm sm:text-base mt-3">
              &ldquo;{success.note}&rdquo;
            </p>
          )}
          <p className="text-sm text-gray-700 mt-4">
            Your new balance is{' '}
            <span className="font-black text-purple-900">
              {centsToMP(success.balanceCents)}
            </span>
            .
          </p>
          <div className="mt-6 flex flex-wrap gap-3 justify-center">
            <Link
              href="/shop"
              className="bg-yellow-300 hover:bg-yellow-200 text-purple-950 font-black text-sm px-5 py-3 rounded-xl transition-colors"
            >
              🛍️ Spend it in the shop
            </Link>
            <Link
              href="/portal/money"
              className="bg-purple-700 hover:bg-purple-600 text-white font-bold text-sm px-5 py-3 rounded-xl transition-colors"
            >
              See my MP Money
            </Link>
            <button
              type="button"
              onClick={() => setSuccess(null)}
              className="text-purple-700 hover:text-purple-900 underline text-sm"
            >
              Redeem another
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={onSubmit}
          className="bg-white rounded-2xl shadow-sm border-2 border-purple-100 p-6"
        >
          <label
            htmlFor="gift-card-code"
            className="block text-sm font-medium text-purple-900 mb-1"
          >
            Gift card code
          </label>
          <input
            id="gift-card-code"
            type="text"
            value={code}
            onChange={(e) => setCode(formatCodeInput(e.target.value))}
            placeholder="MP-XXXXXX"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={9} // "MP-" + 6 chars
            disabled={busy}
            className="w-full rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none px-4 py-3 bg-purple-50 text-purple-900 font-mono text-xl tracking-[0.2em] text-center uppercase"
          />
          <p className="text-xs text-purple-700 mt-2">
            6 characters after the dash. The letters O and L and the numbers 0
            and 1 are never used on cards — if you see a similar shape, it&apos;s
            probably a different letter.
          </p>

          {error && (
            <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={busy || !learner}
              className="bg-purple-900 hover:bg-purple-800 disabled:bg-purple-300 text-white font-black px-6 py-3 rounded-xl transition-colors"
            >
              {busy ? 'Redeeming…' : '🎁 Redeem'}
            </button>
            <Link
              href="/portal/money"
              className="text-purple-700 hover:text-purple-900 underline self-center text-sm"
            >
              Cancel
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
