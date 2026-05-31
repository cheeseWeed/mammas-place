// Public "Send MP" page — Phase 6b.
//
// A grandparent / family friend enters a kid's 4-digit MP card number + an
// amount and the server credits the kid. NO auth required — the card number
// is receive-only by design (see app/money/PLAN-Phase6-Cards.md). Abuse
// controls (rate limit + per-call cap) live server-side in
// /api/money/give/route.ts.
//
// Visual tone: warm, welcoming, gift-y. Distinct from the kid-styled drill
// UI but reuses the same purple/yellow palette so it still feels like part
// of Mamma's Place.
'use client';

import { useEffect, useState } from 'react';
import Confetti from 'react-confetti';
import { dollarsInputToCents, centsToMP } from '@/lib/money/format';

interface SuccessShape {
  ok: true;
  deposited: number;
  kidDisplay: string;
}

export default function GivePage() {
  const [cardNumber, setCardNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [giverName, setGiverName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessShape | null>(null);

  // Confetti viewport sizing — mirrors the checkout page pattern.
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const handleResize = () =>
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Card-number input: digits only, cap at 4. Friendly handling of paste.
  function onCardChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    setCardNumber(digits);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    // ---- Client-side validation (server is the source of truth) ----
    if (!/^\d{4}$/.test(cardNumber)) {
      setError('Card number must be 4 digits.');
      return;
    }
    const cents = dollarsInputToCents(amount);
    if (cents === null || cents <= 0) {
      setError('Please enter a positive amount (e.g. 5.00).');
      return;
    }
    if (cents > 5000) {
      setError('Single gift cap is 50 MP. Try a smaller amount.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/money/give', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardNumber,
          cents,
          giverName: giverName.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as
        | { ok?: true; deposited?: number; kidDisplay?: string }
        | { error?: string; retryAfterSec?: number };

      if (!res.ok) {
        const msg = (data as { error?: string }).error;
        // 429 — friendlier framing for grandparents who probably aren't
        // griefing, they just clicked submit twice.
        if (res.status === 429) {
          const retry = (data as { retryAfterSec?: number }).retryAfterSec;
          setError(
            msg ??
              `Too many gifts from this address. Please try again ${
                retry ? `in ${Math.ceil(retry / 60)} minutes` : 'later'
              }.`,
          );
        } else if (res.status === 404) {
          setError(msg ?? "We couldn't find a card with that number. Double-check the 4 digits and try again.");
        } else {
          setError(msg ?? 'Something went wrong. Please try again.');
        }
        return;
      }

      // Success path
      const ok = data as SuccessShape;
      if (typeof ok.deposited === 'number' && typeof ok.kidDisplay === 'string') {
        setSuccess({ ok: true, deposited: ok.deposited, kidDisplay: ok.kidDisplay });
        // Clear sensitive-ish fields but keep the giver name so a sender can
        // send to another sibling without re-typing their name.
        setCardNumber('');
        setAmount('');
      } else {
        setError('Unexpected server response. Please try again.');
      }
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function sendAnother() {
    setSuccess(null);
    setError(null);
  }

  return (
    <div className="min-h-[calc(100vh-260px)] px-4 py-10 flex items-start justify-center">
      <div className="w-full max-w-lg">
        {/* Header card — warm + welcoming */}
        <div className="bg-gradient-to-br from-purple-800 to-purple-950 rounded-2xl p-6 sm:p-8 text-white shadow-lg border-2 border-yellow-300/40 mb-6">
          <div className="text-yellow-300 text-3xl mb-2">🎁</div>
          <h1 className="text-2xl sm:text-3xl font-black mb-1">
            Send MP to a Mamma&apos;s Place kid
          </h1>
          <p className="text-purple-100 text-sm sm:text-base">
            Type the kid&apos;s card number and how much MP you&apos;d like to send.
            We&apos;ll drop it straight into their balance.
          </p>
        </div>

        {/* Success view */}
        {success ? (
          <div className="bg-white rounded-2xl border-2 border-yellow-300 shadow-lg p-8 text-center">
            {windowSize.width > 0 && (
              <Confetti
                width={windowSize.width}
                height={windowSize.height}
                recycle={false}
                numberOfPieces={250}
                gravity={0.25}
              />
            )}
            <div className="text-6xl mb-3">✅</div>
            <h2 className="text-2xl font-black text-purple-900 mb-2">
              +{centsToMP(success.deposited)} sent to {success.kidDisplay}!
            </h2>
            <p className="text-sm text-gray-700 mb-6">
              They&apos;ll see it in their MP Money balance next time they log in. Thank you for being awesome.
            </p>
            <button
              type="button"
              onClick={sendAnother}
              className="bg-purple-700 hover:bg-purple-600 text-white font-black px-6 py-3 rounded-xl transition-colors"
            >
              Send another gift
            </button>
          </div>
        ) : (
          /* Form view */
          <form
            onSubmit={onSubmit}
            className="bg-white rounded-2xl border border-purple-200 shadow-sm p-6 sm:p-8 space-y-5"
          >
            {/* Card number */}
            <div>
              <label
                htmlFor="give-card"
                className="block text-sm font-bold text-purple-900 mb-1"
              >
                Their MP card number
              </label>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center h-12 px-3 rounded-xl bg-yellow-100 border-2 border-yellow-300 text-purple-900 font-black tracking-widest text-lg select-none">
                  MP·
                </span>
                <input
                  id="give-card"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={cardNumber}
                  onChange={(e) => onCardChange(e.target.value)}
                  placeholder="1234"
                  maxLength={4}
                  className="flex-1 h-12 px-3 rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none font-mono text-xl tracking-[0.3em] text-purple-900 bg-white"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Ask the kid for the 4 digits on their card.
              </p>
            </div>

            {/* Amount */}
            <div>
              <label
                htmlFor="give-amount"
                className="block text-sm font-bold text-purple-900 mb-1"
              >
                Amount (MP)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="give-amount"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="5.00"
                  className="flex-1 h-12 px-3 rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none font-mono text-xl text-purple-900 bg-white"
                />
                <span className="inline-flex items-center justify-center h-12 px-3 rounded-xl bg-yellow-100 border-2 border-yellow-300 text-purple-900 font-black select-none">
                  MP
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Up to 50 MP per gift. Send more by submitting again.
              </p>
            </div>

            {/* Giver name (optional) */}
            <div>
              <label
                htmlFor="give-from"
                className="block text-sm font-bold text-purple-900 mb-1"
              >
                Your name <span className="font-normal text-gray-500">(optional)</span>
              </label>
              <input
                id="give-from"
                type="text"
                autoComplete="name"
                value={giverName}
                onChange={(e) => setGiverName(e.target.value.slice(0, 30))}
                placeholder="Grandpa"
                maxLength={30}
                className="w-full h-12 px-3 rounded-xl border-2 border-purple-200 focus:border-purple-500 focus:outline-none text-purple-900 bg-white"
              />
              <p className="text-xs text-gray-500 mt-1">
                Shown in the kid&apos;s transaction history so they know who to thank.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-purple-900 hover:bg-purple-800 disabled:bg-purple-300 disabled:cursor-not-allowed text-white font-black px-6 py-4 rounded-xl transition-colors text-lg"
            >
              {submitting ? 'Sending…' : '🎁 Send MP'}
            </button>

            <p className="text-xs text-center text-gray-600 leading-relaxed">
              Card numbers are <strong>safe to share</strong> — they only let you
              <em> send</em> MP to a kid, never spend any of theirs. Spending
              still needs the kid&apos;s PIN.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
