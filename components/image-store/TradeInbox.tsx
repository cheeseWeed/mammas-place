'use client';

// The trade inbox / outbox — "Hailey wants to swap her Moonbeam Unicorn for
// your Rainbow Pony."
//
// A THIN CLIENT over an authoritative server, exactly like BuyButton: it sends
// a trade id and an action, and every outcome it renders comes back from the
// API. Nothing here decides whether a trade is allowed, computes a price, or
// knows what a race is — the copy just repeats what the server said.
//
// Kid-simple language and big buttons throughout: one sentence per card saying
// who wants what, and two 56px targets (Yes / No thanks).

import { useState } from 'react';
import { centsToMP } from '@/lib/money/format';

export interface TradeCard {
  id: string;
  proposerUser: string;
  recipientUser: string;
  offeredImageId: string;
  offeredTitle: string;
  wantedImageId: string | null;
  wantedTitle: string | null;
  askCents: number;
  status: string;
  note: string | null;
  isSale: boolean;
  direction: 'in' | 'out';
  offeredEditionNumber: number | null;
  wantedEditionNumber: number | null;
}

type Tone = 'info' | 'error' | 'success';

/**
 * The one sentence that explains a trade to a five-year-old.
 *
 * Built from the SERVER's titles, never from a catalog lookup in the browser —
 * the catalog carries server-only paths and must not ship here.
 */
function describe(t: TradeCard, meName: string): string {
  const them = t.direction === 'in' ? t.proposerUser : t.recipientUser;
  const theirName = them.charAt(0).toUpperCase() + them.slice(1);

  if (t.direction === 'in') {
    if (t.wantedTitle) {
      return `${theirName} wants to swap their ${t.offeredTitle} for your ${t.wantedTitle}.`;
    }
    return `${theirName} will give you their ${t.offeredTitle} for ${centsToMP(t.askCents)}.`;
  }
  if (t.wantedTitle) {
    return `You offered your ${t.offeredTitle} for ${theirName}'s ${t.wantedTitle}.`;
  }
  return `You offered your ${t.offeredTitle} for ${centsToMP(t.askCents)}.`;
}

export default function TradeInbox({
  incoming,
  outgoing,
  me,
}: {
  incoming: TradeCard[];
  outgoing: TradeCard[];
  me: string;
}) {
  const [cards, setCards] = useState({ incoming, outgoing });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<{ text: string; tone: Tone } | null>(null);

  async function act(tradeId: string, action: 'accept' | 'decline' | 'cancel') {
    if (busyId) return;
    setBusyId(tradeId);
    setNote(null);
    try {
      const res = await fetch(`/api/image-store/trade/${encodeURIComponent(tradeId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };

      if (res.ok && data.ok) {
        setNote({ text: data.message ?? 'Done!', tone: 'success' });
        // Drop the resolved card from both lists.
        setCards((c) => ({
          incoming: c.incoming.filter((t) => t.id !== tradeId),
          outgoing: c.outgoing.filter((t) => t.id !== tradeId),
        }));
        // A trade moves MP and artwork — reload so the header balance, the
        // collection and the queues all reflect the new truth rather than a
        // half-updated client guess.
        setTimeout(() => window.location.reload(), 1400);
        return;
      }
      // Every refusal is already a kid-readable sentence from the server, and
      // every one of them means NOTHING moved.
      setNote({ text: data.message ?? data.error ?? 'That did not work.', tone: 'error' });
      // A stale/duplicate offer is gone for good — take it off the screen.
      if (res.status === 409) {
        setCards((c) => ({
          incoming: c.incoming.filter((t) => t.id !== tradeId),
          outgoing: c.outgoing.filter((t) => t.id !== tradeId),
        }));
      }
    } catch {
      setNote({ text: 'Could not reach the store. Try again in a moment.', tone: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  const nothing = cards.incoming.length === 0 && cards.outgoing.length === 0;

  return (
    <div className="space-y-8">
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

      {nothing && (
        <div className="bg-white rounded-2xl border-2 border-dashed border-purple-200 p-8 text-center">
          <div className="text-5xl mb-3">🤝</div>
          <p className="text-gray-700">
            No trades right now. Pick something from your collection to offer!
          </p>
        </div>
      )}

      {cards.incoming.length > 0 && (
        <section>
          <h2 className="text-xl sm:text-2xl font-black text-purple-900 mb-3">
            Somebody wants to trade with you
          </h2>
          <div className="space-y-4">
            {cards.incoming.map((t) => {
              const blocked = t.status === 'blocked';
              return (
                <div
                  key={t.id}
                  className={
                    'rounded-2xl border-2 bg-white p-5 ' +
                    (blocked ? 'border-amber-300' : 'border-purple-200')
                  }
                >
                  <p className="text-lg font-bold text-gray-800 leading-snug">
                    {describe(t, me)}
                  </p>
                  {t.note && (
                    <p className="mt-2 text-sm text-purple-800 italic">“{t.note}”</p>
                  )}
                  {t.offeredEditionNumber === 1 && (
                    <p className="mt-2 text-sm font-black text-amber-800">
                      🏆 Theirs is Edition #1 — the very first one ever sold. If you say yes, that
                      number becomes yours.
                    </p>
                  )}

                  {blocked ? (
                    <div className="mt-4 rounded-xl bg-amber-50 border-2 border-amber-200 px-4 py-3">
                      <p className="text-amber-900 font-bold text-sm">
                        ⏳ This is a big trade, so a grown-up has to say yes first. Check back soon!
                      </p>
                      <button
                        type="button"
                        onClick={() => act(t.id, 'decline')}
                        disabled={busyId === t.id}
                        className="mt-3 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-800 font-black px-5 py-3 rounded-xl transition-colors min-h-[48px]"
                      >
                        No thanks
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onClick={() => act(t.id, 'accept')}
                        disabled={busyId === t.id}
                        className="flex-1 bg-green-600 hover:bg-green-500 active:bg-green-700 disabled:bg-gray-400 text-white font-black text-lg px-6 py-4 rounded-2xl transition-colors min-h-[56px]"
                      >
                        {busyId === t.id ? 'Trading…' : '✅ Yes, trade!'}
                      </button>
                      <button
                        type="button"
                        onClick={() => act(t.id, 'decline')}
                        disabled={busyId === t.id}
                        className="flex-1 bg-gray-200 hover:bg-gray-300 active:bg-gray-400 disabled:bg-gray-100 text-gray-800 font-black text-lg px-6 py-4 rounded-2xl transition-colors min-h-[56px]"
                      >
                        No thanks
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {cards.outgoing.length > 0 && (
        <section>
          <h2 className="text-xl sm:text-2xl font-black text-purple-900 mb-3">
            Offers you sent
          </h2>
          <div className="space-y-4">
            {cards.outgoing.map((t) => (
              <div key={t.id} className="rounded-2xl border-2 border-purple-100 bg-white p-5">
                <p className="text-base font-bold text-gray-800 leading-snug">
                  {describe(t, me)}
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  {t.status === 'blocked'
                    ? '⏳ Waiting for a grown-up to say yes.'
                    : '⏳ Waiting for them to answer.'}
                </p>
                <button
                  type="button"
                  onClick={() => act(t.id, 'cancel')}
                  disabled={busyId === t.id}
                  className="mt-3 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-800 font-black px-5 py-3 rounded-xl transition-colors min-h-[48px]"
                >
                  {busyId === t.id ? 'Taking back…' : 'Take it back'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
