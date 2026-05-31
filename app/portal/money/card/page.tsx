// Kid's printable MP account card — Phase 6a.
//
// Shows a single big card with the kid's display name + 4-digit MP·#### card
// number. Auto-mints on first visit (GET /api/money/card; falls back to POST
// /api/money/card/issue on 404). Hit "Print this card" to print just the
// card — the @media print block hides every other page chrome.
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import LoginGate from '@/components/LoginGate';
import { useLearner } from '@/context/LearnerContext';

export default function MyMpCardPage() {
  return (
    <LoginGate section="spelling">
      <CardView />
    </LoginGate>
  );
}

function CardView() {
  const { learner } = useLearner();
  const [cardNumber, setCardNumber] = useState<string | null>(null);
  const [formatted, setFormatted] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>('');

  // Fetch (and mint-if-missing) the kid's card. Two requests at worst: GET
  // returns 404 → POST issue. On subsequent visits, GET hits straight away.
  const loadCard = useCallback(async (name: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/money/card?user=${encodeURIComponent(name)}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = (await res.json()) as { cardNumber: string; formatted: string };
        setCardNumber(data.cardNumber);
        setFormatted(data.formatted);
        return;
      }
      if (res.status === 404) {
        // Mint a card.
        const issued = await fetch('/api/money/card/issue', { method: 'POST' });
        if (!issued.ok) {
          throw new Error(`Could not issue card (HTTP ${issued.status})`);
        }
        const data = (await issued.json()) as { cardNumber: string; formatted: string };
        setCardNumber(data.cardNumber);
        setFormatted(data.formatted);
        return;
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your card');
    } finally {
      setLoading(false);
    }
  }, []);

  // Best-effort display-name lookup. Falls back to the cookie name when the
  // profile call fails — the card still renders, just less pretty.
  useEffect(() => {
    if (!learner) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/learner/profile?user=${encodeURIComponent(learner)}`,
          { cache: 'no-store' },
        );
        if (!cancelled && res.ok) {
          const data = (await res.json()) as { displayName?: string; name?: string };
          setDisplayName(data.displayName?.trim() || data.name || learner);
        } else if (!cancelled) {
          setDisplayName(learner);
        }
      } catch {
        if (!cancelled) setDisplayName(learner);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [learner]);

  useEffect(() => {
    if (!learner) return;
    void loadCard(learner);
  }, [learner, loadCard]);

  const onPrint = () => {
    if (typeof window !== 'undefined') window.print();
  };

  return (
    <div className="mp-card-page min-h-[calc(100vh-260px)] px-4 py-8 max-w-3xl mx-auto">
      {/* Print-only stylesheet: hide every other piece of page chrome
          (header/footer/back link/buttons) so the printout is just the card.
          Plain <style> tag (not styled-jsx) — project doesn't configure it. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body * { visibility: hidden; }
              .mp-card-printable, .mp-card-printable * { visibility: visible; }
              .mp-card-printable {
                position: absolute;
                inset: 0;
                margin: 0;
                padding: 2rem;
              }
              .no-print { display: none !important; }
            }
          `,
        }}
      />

      <div className="no-print mb-6">
        <Link
          href="/portal/money"
          className="text-sm text-purple-700 hover:text-purple-900 underline"
        >
          ← Back to MP Money
        </Link>
        <h1 className="text-2xl sm:text-3xl font-black text-purple-900 mt-2">
          Your MP Card
        </h1>
        <p className="text-sm text-gray-700 mt-1 max-w-prose">
          This is your personal card number. You can print it, laminate it, and
          keep it in a play wallet. It&apos;s safe to share with grandparents —
          they can use it to send you MP, but they can&apos;t spend any of yours
          (that still needs your PIN).
        </p>
      </div>

      {loading && (
        <div className="bg-white rounded-2xl border border-purple-100 p-8 text-center text-purple-700">
          Loading your card…
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && cardNumber && (
        <>
          {/* The printable card. Designed to fit ~credit-card aspect on screen,
              centered + larger on the printed page. */}
          <div className="mp-card-printable">
            <div
              className="mx-auto max-w-sm aspect-[1.586/1] rounded-3xl shadow-2xl border-4 border-yellow-300
                         bg-gradient-to-br from-purple-800 to-purple-950 text-white p-6 flex flex-col justify-between
                         relative overflow-hidden"
            >
              {/* Decorative coin in the corner */}
              <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-yellow-300/20 border-2 border-yellow-300/40" />
              <div className="absolute top-3 right-3 w-12 h-12 rounded-full bg-yellow-300 flex items-center justify-center border-2 border-yellow-200 shadow-md">
                <span className="text-purple-900 font-black text-sm">MP</span>
              </div>

              <div>
                <div className="text-yellow-300 text-xs font-bold uppercase tracking-widest">
                  Mamma&apos;s Place
                </div>
                <div className="text-yellow-100 text-[10px] font-semibold uppercase tracking-wider mt-0.5">
                  MP Money Card
                </div>
              </div>

              <div className="text-3xl sm:text-4xl font-black tracking-[0.2em] text-yellow-300 tabular-nums">
                {formatted}
              </div>

              <div>
                <div className="text-yellow-100 text-[10px] font-semibold uppercase tracking-wider">
                  Cardholder
                </div>
                <div className="font-black text-lg leading-tight">
                  {displayName || learner}
                </div>
              </div>
            </div>

            <p className="mt-6 text-center text-xs sm:text-sm text-purple-800 max-w-sm mx-auto font-medium">
              Family + friends can deposit MP at{' '}
              <span className="font-mono font-bold">mammas-place.vercel.app/give</span>{' '}
              using my number ({formatted}). Receive-only — spending requires my PIN.
            </p>
          </div>

          <div className="no-print mt-8 flex flex-wrap gap-3 justify-center">
            <button
              type="button"
              onClick={onPrint}
              className="bg-purple-900 hover:bg-purple-800 text-white font-bold px-5 py-3 rounded-xl transition-colors"
            >
              🖨️ Print this card
            </button>
            <Link
              href="/portal/money"
              className="bg-yellow-100 hover:bg-yellow-200 text-purple-900 font-bold px-5 py-3 rounded-xl border-2 border-yellow-300 transition-colors"
            >
              Back to MP Money
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
