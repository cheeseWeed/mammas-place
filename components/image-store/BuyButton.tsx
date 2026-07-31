'use client';

// Buy / Download control for one image.
//
// The button is a THIN CLIENT over an authoritative server: it sends only the
// image id, and every outcome it renders (bought, already owned, not enough MP,
// closed for the Sabbath, not logged in) comes back from /api/image-store/buy.
// Nothing here decides whether a purchase is allowed, and nothing here computes
// a price — the copy just repeats what the server said.
//
// The DOWNLOAD button only appears once the server has confirmed ownership,
// either because this page loaded with `initiallyOwned` (an ImagePurchase row
// exists) or because the buy call just succeeded. It is a plain link — the
// route sets Content-Disposition: attachment, so the browser saves the file.

import { useState } from 'react';
import Link from 'next/link';
import { useLearner } from '@/context/LearnerContext';
import { centsToMP } from '@/lib/money/format';

type Tone = 'info' | 'error' | 'success';

interface BuyResponse {
  ok?: boolean;
  status?: string;
  message?: string;
  error?: string;
  alreadyOwned?: boolean;
  sabbath?: boolean;
  shortfallCents?: number;
  soldOut?: boolean;
  editionNumber?: number;
  editionSize?: number;
}

export default function BuyButton({
  imageId,
  title,
  priceCents,
  initiallyOwned = false,
}: {
  imageId: string;
  title: string;
  priceCents: number;
  initiallyOwned?: boolean;
}) {
  const { learner, balanceCents, refresh } = useLearner();
  const [owned, setOwned] = useState(initiallyOwned);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; tone: Tone } | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [shortOfFunds, setShortOfFunds] = useState(false);
  // Set when the server says the run sold out under us — the Buy button is
  // retired, because pressing it again can only fail.
  const [soldOut, setSoldOut] = useState(false);
  const [rookie, setRookie] = useState(false);

  const downloadUrl = `/api/image-store/download/${encodeURIComponent(imageId)}`;

  async function handleBuy() {
    if (busy || owned) return;
    setBusy(true);
    setNote(null);
    setNeedsLogin(false);
    setShortOfFunds(false);
    setSoldOut(false);
    try {
      const res = await fetch('/api/image-store/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId }),
      });
      const data = (await res.json().catch(() => ({}))) as BuyResponse;

      if (res.ok && data.ok) {
        setOwned(true);
        if (data.editionNumber === 1) setRookie(true);
        setNote({ text: data.message ?? `${title} is yours!`, tone: 'success' });
        void refresh(); // balance changed — update the header chip
        return;
      }
      // 410 Gone — the last copy went while this page was open. Nothing was
      // charged; the button must stop offering a purchase that cannot succeed.
      if (res.status === 410 || data.soldOut) {
        setSoldOut(true);
        setNote({ text: data.message ?? `${title} is sold out.`, tone: 'error' });
        void refresh();
        return;
      }
      if (res.status === 409 || data.alreadyOwned) {
        // Not an error state: they own it, so flip to the download view.
        setOwned(true);
        setNote({ text: data.message ?? `You already own ${title}.`, tone: 'info' });
        return;
      }
      if (res.status === 401) {
        setNeedsLogin(true);
        setNote({ text: 'Log in first so we know whose collection it goes in.', tone: 'info' });
        return;
      }
      if (res.status === 402) {
        setShortOfFunds(true);
        setNote({ text: data.message ?? 'Not enough MP yet.', tone: 'error' });
        void refresh();
        return;
      }
      setNote({ text: data.message ?? data.error ?? 'Something went wrong.', tone: 'error' });
    } catch {
      setNote({ text: 'Could not reach the store. Try again in a moment.', tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  const canAfford = balanceCents === null || balanceCents >= priceCents;

  return (
    <div className="space-y-3">
      {owned ? (
        <>
          {rookie && (
            <div className="rounded-2xl border-2 border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-100 px-4 py-3">
              <div className="text-amber-950 font-black text-base">
                🏆 You got Edition #1!
              </div>
              <p className="text-amber-900 text-xs mt-0.5">
                The very first copy ever sold. That number is yours forever.
              </p>
            </div>
          )}
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-900 font-black px-4 py-2 rounded-full text-sm">
            <span aria-hidden>✓</span> In your collection
          </div>
          <a
            href={downloadUrl}
            className="flex w-full items-center justify-center gap-2 bg-green-600 hover:bg-green-500 active:bg-green-700 text-white font-black text-lg px-6 py-4 rounded-2xl transition-colors min-h-[56px]"
          >
            ⬇️ Download the original
          </a>
          <p className="text-xs text-gray-600">
            Yours forever — download it as many times as you like, for free. It never costs MP
            again.
          </p>
        </>
      ) : soldOut ? (
        <div className="rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-4">
          <div className="font-black text-red-800 mb-1">Sold out</div>
          <p className="text-sm text-red-900">
            Somebody bought the last copy just now. You were not charged.
          </p>
          <Link
            href="/image-store"
            className="mt-3 inline-block bg-purple-700 hover:bg-purple-600 text-white font-black text-sm px-4 py-2.5 rounded-xl transition-colors"
          >
            See the rest of the drop
          </Link>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={handleBuy}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 bg-purple-700 hover:bg-purple-600 active:bg-purple-800 disabled:bg-gray-400 text-white font-black text-lg px-6 py-4 rounded-2xl transition-colors min-h-[56px]"
          >
            {busy ? 'Buying…' : `Buy for ${centsToMP(priceCents)}`}
          </button>
          {learner && balanceCents !== null && (
            <p className={`text-sm ${canAfford ? 'text-gray-600' : 'text-red-700 font-bold'}`}>
              You have {centsToMP(balanceCents)}
              {!canAfford && ` — ${centsToMP(priceCents - balanceCents)} to go`}
            </p>
          )}
        </>
      )}

      {note && (
        <div
          role="status"
          className={
            'rounded-xl px-4 py-3 text-sm font-medium border ' +
            (note.tone === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : note.tone === 'success'
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-purple-50 border-purple-200 text-purple-900')
          }
        >
          {note.text}
        </div>
      )}

      {needsLogin && (
        <Link
          href="/shop/login"
          className="inline-block bg-purple-700 hover:bg-purple-600 text-white font-black px-5 py-3 rounded-xl transition-colors"
        >
          Log in
        </Link>
      )}

      {shortOfFunds && (
        <div className="flex flex-wrap gap-2">
          <Link
            href="/math"
            className="bg-yellow-300 hover:bg-yellow-200 text-purple-950 font-black text-sm px-4 py-2.5 rounded-xl transition-colors"
          >
            🧮 Earn MP in Math
          </Link>
          <Link
            href="/portal/money"
            className="bg-purple-100 hover:bg-purple-200 text-purple-900 font-bold text-sm px-4 py-2.5 rounded-xl transition-colors"
          >
            💰 My MP Money
          </Link>
        </div>
      )}
    </div>
  );
}
