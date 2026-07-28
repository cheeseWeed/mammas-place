// /portal/collection — "My Collection", the kid's own gallery.
//
// Everything here is already PAID FOR, so this page is open every day of the
// week. The Sabbath rule closes SHOPPING; it does not take away what you own.
// Re-downloads are free and unlimited — an ImagePurchase row is permanent and
// is never consumed.
//
// Server component: the ownership query runs once, and set-completion is
// computed from the catalog (lib/image-store/catalog.ts setProgressFor) rather
// than trusting anything the browser sends.

import Link from 'next/link';
import { currentUser } from '@/lib/family/auth';
import { getImageById, setProgressFor } from '@/lib/image-store/catalog';
import { listPurchases } from '@/lib/image-store/purchase';
import { centsToMP } from '@/lib/money/format';
import MisprintBadge from '@/components/image-store/MisprintBadge';

export const metadata = {
  title: "My Collection · Mamma's Place",
  description: 'Every original you own — download them again any time, free.',
};

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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
            Your artwork is tied to your name, so we need to know who you are before we can show it
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

  const purchases = await listPurchases(user);
  const progress = setProgressFor(purchases.map((p) => p.imageId));
  const totalSpentCents = purchases.reduce((sum, p) => sum + p.pricePaidCents, 0);
  const completedSets = progress.filter((s) => s.complete).length;

  return (
    <div className="min-h-[calc(100vh-260px)] px-4 py-8 max-w-5xl mx-auto">
      {/* Hero */}
      <div className="bg-gradient-to-br from-purple-800 to-purple-950 rounded-2xl p-6 sm:p-8 text-white shadow-lg border-2 border-yellow-300/40 mb-8">
        <div className="text-yellow-300 text-sm font-bold uppercase tracking-wide mb-1">
          My Collection
        </div>
        <h1 className="text-3xl sm:text-4xl font-black mb-2">🗂️ Your gallery</h1>
        <p className="text-purple-100 text-sm sm:text-base">
          {purchases.length === 0
            ? 'Nothing here yet — the store is the place to start.'
            : `${purchases.length} original${purchases.length === 1 ? '' : 's'} · ${centsToMP(
                totalSpentCents,
              )} invested${completedSets > 0 ? ` · ${completedSets} full set${completedSets === 1 ? '' : 's'} 🏆` : ''}`}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/image-store"
            className="bg-yellow-300 hover:bg-yellow-200 text-purple-950 font-black text-sm px-4 py-2.5 rounded-xl transition-colors"
          >
            🖼️ This week&apos;s drop
          </Link>
          <Link
            href="/portal/money"
            className="bg-purple-700 hover:bg-purple-600 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-colors"
          >
            💰 My MP Money
          </Link>
        </div>
      </div>

      {purchases.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-purple-200 p-8 text-center">
          <div className="text-5xl mb-3">🖼️</div>
          <p className="text-gray-700 mb-4">
            You haven&apos;t bought any artwork yet. New pieces drop every Monday.
          </p>
          <Link
            href="/image-store"
            className="inline-block bg-purple-700 hover:bg-purple-600 text-white font-black px-6 py-3 rounded-xl transition-colors"
          >
            Go to the image store
          </Link>
        </div>
      ) : (
        <>
          {/* Set-completion progress */}
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

          {/* Owned pieces — newest first */}
          <section>
            <h2 className="text-xl sm:text-2xl font-black text-purple-900 mb-3">
              Your originals
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {purchases.map((p) => {
                const item = getImageById(p.imageId);
                const downloadUrl = `/api/image-store/download/${encodeURIComponent(p.imageId)}`;
                // Art retired from the catalog after purchase: the kid STILL
                // owns it (the row is the truth), so keep the download working
                // and just render what we know.
                const title = item?.title ?? p.imageId;
                const misprint = item?.tier === 'misprint';
                return (
                  <div
                    key={p.imageId}
                    className={
                      'bg-white rounded-2xl shadow-md overflow-hidden border-2 flex flex-col ' +
                      (misprint ? 'border-amber-300' : 'border-purple-100')
                    }
                  >
                    <div className="relative bg-gradient-to-br from-purple-50 to-purple-100 h-44 flex items-center justify-center p-3">
                      {item ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.watermarkedPreview}
                          alt={`${title} — preview`}
                          className="max-h-full max-w-full object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-4xl" aria-hidden>
                          🖼️
                        </span>
                      )}
                      {misprint && (
                        <div className="absolute top-2 left-2">
                          <MisprintBadge />
                        </div>
                      )}
                    </div>
                    <div className="p-3 flex flex-col gap-2 grow">
                      <div>
                        <div className="text-[11px] text-purple-500 uppercase font-bold tracking-wide truncate">
                          {item?.setName ?? 'Archive'}
                        </div>
                        <h3 className="font-bold text-gray-800 leading-tight text-sm sm:text-base">
                          {title}
                        </h3>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Bought {formatDate(p.createdAt)} for {centsToMP(p.pricePaidCents)}
                        </div>
                      </div>
                      <a
                        href={downloadUrl}
                        className="mt-auto flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 active:bg-green-700 text-white font-black px-4 py-3 rounded-xl transition-colors min-h-[48px]"
                      >
                        ⬇️ Download
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-center text-xs text-gray-500 mt-8">
              Downloads are free forever — buying a piece once is the only time it ever costs MP.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
