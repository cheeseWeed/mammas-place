// /portal/trades — kid-to-kid trading.
//
// Server component: the queues are read once on the server, so the browser
// never sees the catalog (which carries server-only original paths) and never
// needs a fetch-per-card.
//
// Trading MOVES artwork and MP, so it is shopping and closes on the Sabbath —
// the API enforces that independently (never rely on the client guard alone,
// per CLAUDE.md). Seeing your own history is not shopping, so this page renders
// the history section regardless and only the propose/accept controls are
// behind the guard.

import Link from 'next/link';
import SabbathGuard from '@/components/SabbathGuard';
import TradeInbox from '@/components/image-store/TradeInbox';
import TradeProposer from '@/components/image-store/TradeProposer';
import { currentUser } from '@/lib/family/auth';
import { centsToMP } from '@/lib/money/format';
import {
  listIncoming,
  listOutgoing,
  listTradeHistory,
  TRADE_APPROVAL_THRESHOLD_CENTS,
} from '@/lib/image-store/trade';

export const metadata = {
  title: "Trades · Mamma's Place",
  description: 'Swap artwork with your brothers and sisters.',
};

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function TradesPage() {
  const user = await currentUser();

  if (!user) {
    return (
      <div className="min-h-[calc(100vh-260px)] px-4 py-10 flex items-start justify-center">
        <div className="w-full max-w-lg bg-white rounded-2xl border-2 border-purple-200 shadow-sm p-8 text-center">
          <div className="text-5xl mb-3">🤝</div>
          <h1 className="text-2xl font-black text-purple-900 mb-2">Log in to trade</h1>
          <p className="text-sm text-gray-700 mb-6">
            Trading swaps artwork between you and your brothers and sisters, so we need to know who
            you are.
          </p>
          <Link
            href="/shop/login"
            className="inline-block bg-purple-700 hover:bg-purple-600 text-white font-black px-6 py-3 rounded-xl transition-colors"
          >
            Log in
          </Link>
        </div>
      </div>
    );
  }

  const [incoming, outgoing, history] = await Promise.all([
    listIncoming(user),
    listOutgoing(user),
    listTradeHistory(user),
  ]);

  // Plain objects only across the server/client boundary — Dates become
  // strings, so the card type takes exactly what it renders.
  const toCard = (t: Awaited<ReturnType<typeof listIncoming>>[number]) => ({
    id: t.id,
    proposerUser: t.proposerUser,
    recipientUser: t.recipientUser,
    offeredImageId: t.offeredImageId,
    offeredTitle: t.offeredTitle,
    wantedImageId: t.wantedImageId,
    wantedTitle: t.wantedTitle,
    askCents: t.askCents,
    status: t.status,
    note: t.note,
    isSale: t.isSale,
    direction: t.direction,
    offeredEditionNumber: t.offeredEditionNumber,
    wantedEditionNumber: t.wantedEditionNumber,
  });

  return (
    <div className="min-h-[calc(100vh-260px)] px-4 py-8 max-w-3xl mx-auto">
      <div className="bg-gradient-to-br from-purple-800 to-purple-950 rounded-2xl p-6 sm:p-8 text-white shadow-lg border-2 border-yellow-300/40 mb-8">
        <div className="text-yellow-300 text-sm font-bold uppercase tracking-wide mb-1">
          My Trades
        </div>
        <h1 className="text-3xl sm:text-4xl font-black mb-2">🤝 Trading</h1>
        <p className="text-purple-100 text-sm sm:text-base">
          Swap pictures with your brothers and sisters, or sell one for MP. Both of you have to say
          yes before anything moves — and the{' '}
          <strong className="text-yellow-200">edition number goes with the picture</strong>, so
          trading away your Edition #1 means somebody else has the rookie card.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/portal/collection"
            className="bg-yellow-300 hover:bg-yellow-200 text-purple-950 font-black text-sm px-4 py-2.5 rounded-xl transition-colors"
          >
            🗂️ My Collection
          </Link>
          <Link
            href="/image-store"
            className="bg-purple-700 hover:bg-purple-600 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-colors"
          >
            🖼️ The store
          </Link>
        </div>
      </div>

      <SabbathGuard label="Trading">
        <div className="space-y-10">
          <TradeInbox
            incoming={incoming.map(toCard)}
            outgoing={outgoing.map(toCard)}
            me={user}
          />

          <section>
            <h2 className="text-xl sm:text-2xl font-black text-purple-900 mb-3">
              Offer a trade
            </h2>
            <p className="text-sm text-gray-600 mb-3">
              Trades worth {centsToMP(TRADE_APPROVAL_THRESHOLD_CENTS)} or more need a grown-up to
              say yes first.
            </p>
            <TradeProposer />
          </section>
        </div>
      </SabbathGuard>

      {history.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl sm:text-2xl font-black text-purple-900 mb-3">
            Trades you have done
          </h2>
          <div className="space-y-2">
            {history.map((t) => {
              const other = t.direction === 'in' ? t.proposerUser : t.recipientUser;
              const otherName = other.charAt(0).toUpperCase() + other.slice(1);
              const done = t.status === 'accepted';
              return (
                <div
                  key={t.id}
                  className={
                    'rounded-xl border-2 bg-white px-4 py-3 ' +
                    (done ? 'border-green-200' : 'border-gray-200')
                  }
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-bold text-gray-800 text-sm sm:text-base">
                      {done ? '✅' : '—'} {t.offeredTitle}
                      {t.offeredEditionNumber ? ` (Edition #${t.offeredEditionNumber})` : ''}
                      {t.wantedTitle ? ` ↔ ${t.wantedTitle}` : ` for ${centsToMP(t.askCents)}`}
                    </span>
                    <span className="text-xs font-black text-gray-500 uppercase shrink-0">
                      {t.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    with {otherName} · {formatDate(t.createdAt)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
