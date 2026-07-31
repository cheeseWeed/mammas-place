// /portal/collection — "My Collection", the kid's own gallery.
//
// EVERYTHING a kid buys shows up here: shop purchases AND image-store artwork,
// in ONE filterable gallery. Previously this page listed only ImagePurchase
// rows, so a kid who bought a battery and a tire in the shop saw an empty
// collection and reasonably concluded the site had lost their stuff.
//
// Everything here is already PAID FOR, so this page is open every day of the
// week. The Sabbath rule closes SHOPPING; it does not take away what you own.
// Re-downloads are free and unlimited — an ImagePurchase row is permanent and
// is never consumed.
//
// Server component: both reads and the merge run here, and set-completion is
// computed from the catalog (lib/image-store/catalog.ts setProgressFor) rather
// than trusting anything the browser sends. The client half is presentation and
// filter state only.

import Link from 'next/link';
import { currentUser } from '@/lib/family/auth';
import { setProgressFor } from '@/lib/image-store/catalog';
import { listPurchases } from '@/lib/image-store/purchase';
import { listOrders } from '@/lib/money/balance';
import { buildCollection, summarize, type CollectionOrderLine } from '@/lib/collection/model';
import { centsToMP } from '@/lib/money/format';
import CollectionGallery, {
  type SerializedEntry,
} from '@/components/collection/CollectionGallery';

export const metadata = {
  title: "My Collection · Mamma's Place",
  description: 'Everything you own — shop treasures and artwork, all in one place.',
};

/** MpOrder.items is JSON; coerce it defensively rather than trusting the blob. */
function coerceLines(raw: unknown): CollectionOrderLine[] {
  if (!Array.isArray(raw)) return [];
  const out: CollectionOrderLine[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const productId = typeof r.productId === 'string' ? r.productId.trim() : '';
    if (!productId) continue;
    out.push({
      productId,
      name: typeof r.name === 'string' && r.name.trim() ? r.name.trim() : productId,
      qty: Number.isInteger(r.qty) && (r.qty as number) > 0 ? (r.qty as number) : 1,
      priceCents: Number.isInteger(r.priceCents) ? (r.priceCents as number) : 0,
    });
  }
  return out;
}

export default async function CollectionPage() {
  const user = await currentUser();

  if (!user) {
    return (
      <div className="min-h-[calc(100vh-260px)] px-4 py-10 flex items-start justify-center">
        <div className="w-full max-w-lg bg-white rounded-2xl border-2 border-purple-200 shadow-sm p-8 text-center">
          <div className="text-5xl mb-3">🗂️</div>
          <h1 className="text-2xl font-black text-purple-900 mb-2">Log in to see your collection</h1>
          <p className="text-sm text-gray-700 mb-6">
            Your stuff is tied to your name, so we need to know who you are before we can show it
            to you.
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

  // THE TWO SOURCES. Read in parallel, merged by the pure model so the dedup
  // rule lives in one tested place rather than in this component.
  const [copies, orders] = await Promise.all([listPurchases(user), listOrders(user, 200)]);

  const entries = buildCollection(
    orders.map((o) => ({
      id: o.id,
      items: coerceLines(o.items),
      createdAt: o.createdAt,
      status: o.status,
    })),
    copies,
  );

  const totals = summarize(entries);
  const progress = setProgressFor(copies.map((c) => c.imageId));
  const completedSets = progress.filter((s) => s.complete).length;

  // Dates must cross to the client as strings.
  const serialized: SerializedEntry[] = entries.map((e) => ({
    ...e,
    acquiredAt: e.acquiredAt.toISOString(),
    copies: e.copies.map((c) => ({
      imageId: c.imageId,
      pricePaidCents: c.pricePaidCents,
      editionNumber: c.editionNumber,
      createdAt: c.createdAt.toISOString(),
      source: c.source,
    })),
  }));

  return (
    <div className="min-h-[calc(100vh-260px)] px-4 py-8 max-w-5xl mx-auto">
      {/* Hero */}
      <div className="bg-gradient-to-br from-purple-800 to-purple-950 rounded-2xl p-6 sm:p-8 text-white shadow-lg border-2 border-yellow-300/40 mb-8">
        <div className="text-yellow-300 text-sm font-bold uppercase tracking-wide mb-1">
          My Collection
        </div>
        <h1 className="text-3xl sm:text-4xl font-black mb-2">🗂️ Everything you own</h1>
        <p className="text-purple-100 text-sm sm:text-base">
          {totals.entries === 0
            ? 'Nothing here yet — the shop and the image store are the places to start.'
            : `${totals.totalItems} thing${totals.totalItems === 1 ? '' : 's'} · ${centsToMP(
                totals.spentCents,
              )} spent${completedSets > 0 ? ` · ${completedSets} full set${completedSets === 1 ? '' : 's'} 🏆` : ''}${
                totals.rookies > 0
                  ? ` · ${totals.rookies} Edition #1${totals.rookies === 1 ? '' : 's'} 🥇`
                  : ''
              }`}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/shop"
            className="bg-yellow-300 hover:bg-yellow-200 text-purple-950 font-black text-sm px-4 py-2.5 rounded-xl transition-colors min-h-[44px] flex items-center"
          >
            🛍️ Go shopping
          </Link>
          <Link
            href="/image-store"
            className="bg-purple-700 hover:bg-purple-600 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-colors min-h-[44px] flex items-center"
          >
            🖼️ This week&apos;s drop
          </Link>
          <Link
            href="/portal/trades"
            className="bg-purple-700 hover:bg-purple-600 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-colors min-h-[44px] flex items-center"
          >
            🤝 Trade
          </Link>
        </div>
      </div>

      {totals.rookies > 0 && (
        <div className="mb-8 rounded-2xl border-2 border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-100 p-5">
          <div className="text-amber-950 font-black text-lg mb-1">
            🏆 You own {totals.rookies} rookie card{totals.rookies === 1 ? '' : 's'}
          </div>
          <p className="text-amber-900 text-sm">
            {totals.rookies === 1
              ? 'One of your pieces is Edition #1 — you were the very first person ever to get it.'
              : `${totals.rookies} of your pieces are Edition #1 — you were the very first person ever to get them.`}{' '}
            That number is yours forever.
          </p>
        </div>
      )}

      {totals.entries === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-purple-200 p-8 text-center">
          <div className="text-5xl mb-3">🛍️</div>
          <p className="text-gray-700 mb-4">
            You haven&apos;t bought anything yet. Everything you buy shows up right here.
          </p>
          <Link
            href="/shop"
            className="inline-block bg-purple-700 hover:bg-purple-600 text-white font-black px-6 py-3 rounded-xl transition-colors"
          >
            Go to the shop
          </Link>
        </div>
      ) : (
        <>
          {/* Set-completion progress — the collectible layer stays meaningful. */}
          {progress.length > 0 && (
            <section className="mb-10">
              <h2 className="text-xl sm:text-2xl font-black text-purple-900 mb-3">Set progress</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {progress.map((set) => (
                  <div
                    key={set.setName}
                    className={
                      'rounded-2xl border-2 px-4 py-3 bg-white ' +
                      (set.complete ? 'border-green-300' : 'border-purple-100')
                    }
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-black text-purple-900 text-sm sm:text-base truncate">
                        {set.setName}
                      </span>
                      <span
                        className={
                          'text-xs font-black shrink-0 ' +
                          (set.complete ? 'text-green-700' : 'text-purple-700/70')
                        }
                      >
                        {set.complete ? 'COMPLETE 🏆' : `${set.owned} of ${set.total}`}
                      </span>
                    </div>
                    <div className="mt-2 h-2.5 w-full rounded-full bg-purple-100 overflow-hidden">
                      <div
                        className={
                          'h-full rounded-full ' + (set.complete ? 'bg-green-500' : 'bg-purple-600')
                        }
                        style={{
                          width: `${set.total > 0 ? Math.min(100, Math.round((set.owned / set.total) * 100)) : 0}%`,
                        }}
                      />
                    </div>
                    {!set.complete && (
                      <div className="mt-1.5 text-[11px] text-gray-600">
                        {set.total - set.owned} more to finish {set.setName}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-xl sm:text-2xl font-black text-purple-900 mb-3">Your stuff</h2>
            <CollectionGallery entries={serialized} />
            <p className="text-center text-xs text-gray-500 mt-8">
              Downloads are free forever — buying a piece once is the only time it ever costs MP.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
