'use client';

// "Offer a trade" — pick who, pick what you give, pick what you want back.
//
// Thin client over /api/image-store/trade. The lists come from
// /api/image-store/trade/partners (kid-authed, name + artwork only, no
// balances), and the SERVER decides every rule — this form only stops a kid
// building an offer that obviously cannot work, so the refusal arrives before
// they get their hopes up rather than after.

import { useEffect, useState } from 'react';
import { centsToMP } from '@/lib/money/format';

interface Piece {
  imageId: string;
  title: string;
  setName: string;
  editionNumber: number;
  rookie: boolean;
  alreadyMine?: boolean;
}

interface Partner {
  name: string;
  displayName: string;
  owned: Piece[];
}

export default function TradeProposer() {
  const [loading, setLoading] = useState(true);
  const [mine, setMine] = useState<Piece[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partner, setPartner] = useState('');
  const [offered, setOffered] = useState('');
  // '' = ask for MP instead of a picture.
  const [wanted, setWanted] = useState('');
  const [askMP, setAskMP] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/image-store/trade/partners')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load failed'))))
      .then((d: { me: { owned: Piece[] }; partners: Partner[] }) => {
        if (!alive) return;
        setMine(d.me.owned);
        setPartners(d.partners);
        if (d.partners.length > 0) setPartner(d.partners[0].name);
      })
      .catch(() => {
        if (alive) setMsg({ text: 'Could not load your collection.', ok: false });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const chosenPartner = partners.find((p) => p.name === partner);
  const askCents = (() => {
    const trimmed = askMP.trim();
    if (!trimmed) return 0;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 0) return NaN;
    return Math.round(n * 100);
  })();

  async function submit() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/image-store/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: partner,
          offeredImageId: offered,
          // Empty string means "I want MP, not a picture" — send null so the
          // server reads it as a SALE rather than an unknown image id.
          wantedImageId: wanted || null,
          askCents: Number.isNaN(askCents) ? -1 : askCents,
          note,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };
      if (res.ok && data.ok) {
        setMsg({ text: data.message ?? 'Offer sent!', ok: true });
        setOffered('');
        setWanted('');
        setAskMP('');
        setNote('');
        setTimeout(() => window.location.reload(), 1600);
        return;
      }
      setMsg({ text: data.message ?? data.error ?? 'That did not work.', ok: false });
    } catch {
      setMsg({ text: 'Could not reach the store. Try again in a moment.', ok: false });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="text-gray-600 text-sm">Loading your collection…</div>;
  }

  if (mine.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-purple-200 bg-white p-6 text-center text-gray-700">
        You need at least one picture before you can trade. Have a look at the store!
      </div>
    );
  }

  // A trade needs something coming back — a picture or some MP.
  const canSend =
    !!partner && !!offered && (!!wanted || (askCents > 0 && !Number.isNaN(askCents)));

  const offeredPiece = mine.find((p) => p.imageId === offered);

  return (
    <div className="rounded-2xl border-2 border-purple-200 bg-white p-5 sm:p-6 space-y-5">
      <div>
        <label className="block font-black text-purple-900 mb-2">1. Who do you want to trade with?</label>
        <select
          value={partner}
          onChange={(e) => {
            setPartner(e.target.value);
            setWanted('');
          }}
          className="w-full rounded-xl border-2 border-purple-200 px-4 py-3 text-base font-bold min-h-[52px]"
        >
          {partners.map((p) => (
            <option key={p.name} value={p.name}>
              {p.displayName}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block font-black text-purple-900 mb-2">2. What will you give them?</label>
        <select
          value={offered}
          onChange={(e) => setOffered(e.target.value)}
          className="w-full rounded-xl border-2 border-purple-200 px-4 py-3 text-base font-bold min-h-[52px]"
        >
          <option value="">Pick one of your pictures…</option>
          {mine.map((p) => (
            <option key={p.imageId} value={p.imageId}>
              {p.title} — Edition #{p.editionNumber}
              {p.rookie ? ' 🏆' : ''}
            </option>
          ))}
        </select>
        {offeredPiece?.rookie && (
          <p className="mt-2 text-sm font-bold text-amber-800">
            🏆 Careful — that one is Edition #1, the very first ever sold. If you trade it, the #1
            goes with it and it will not be yours any more.
          </p>
        )}
      </div>

      <div>
        <label className="block font-black text-purple-900 mb-2">3. What do you want back?</label>
        <select
          value={wanted}
          onChange={(e) => {
            setWanted(e.target.value);
            if (e.target.value) setAskMP('');
          }}
          className="w-full rounded-xl border-2 border-purple-200 px-4 py-3 text-base font-bold min-h-[52px]"
        >
          <option value="">💰 MP instead of a picture</option>
          {(chosenPartner?.owned ?? []).map((p) => (
            <option key={p.imageId} value={p.imageId} disabled={p.alreadyMine}>
              {p.title} — Edition #{p.editionNumber}
              {p.alreadyMine ? ' (you already have one)' : ''}
            </option>
          ))}
        </select>

        {!wanted && (
          <div className="mt-3">
            <label className="block text-sm font-bold text-purple-800 mb-1">
              How much MP are you asking for?
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={askMP}
              onChange={(e) => setAskMP(e.target.value)}
              placeholder="5"
              className="w-full rounded-xl border-2 border-purple-200 px-4 py-3 text-base font-bold min-h-[52px]"
            />
            {askCents > 0 && !Number.isNaN(askCents) && (
              <p className="mt-1 text-sm text-gray-600">That is {centsToMP(askCents)}.</p>
            )}
          </div>
        )}
      </div>

      <div>
        <label className="block font-black text-purple-900 mb-2">4. Say why (optional)</label>
        <input
          type="text"
          value={note}
          maxLength={200}
          onChange={(e) => setNote(e.target.value)}
          placeholder="I really want your unicorn!"
          className="w-full rounded-xl border-2 border-purple-200 px-4 py-3 text-base min-h-[52px]"
        />
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={busy || !canSend}
        className="w-full bg-purple-700 hover:bg-purple-600 active:bg-purple-800 disabled:bg-gray-300 text-white font-black text-lg px-6 py-4 rounded-2xl transition-colors min-h-[56px]"
      >
        {busy ? 'Sending…' : '🤝 Send the offer'}
      </button>

      {msg && (
        <div
          role="status"
          className={
            'rounded-xl px-4 py-3 text-sm font-medium border ' +
            (msg.ok
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800')
          }
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}
