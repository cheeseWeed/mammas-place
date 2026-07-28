// /image-store/[id] — one piece: big watermarked preview, price, Buy button,
// and (only if the kid actually owns it) the Download button.
//
// SABBATH NUANCE. A piece you DON'T own is a shop shelf, so it is closed on
// Sunday like the rest of the store. A piece you DO own is your own property —
// looking at it and re-downloading it is not shopping — so an owned piece
// renders every day of the week, Sundays included. That is the same line the
// APIs draw: /api/image-store/buy 403s on the Sabbath, the download route does
// not.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import SabbathGuard from '@/components/SabbathGuard';
import BuyButton from '@/components/image-store/BuyButton';
import MisprintBadge from '@/components/image-store/MisprintBadge';
import { currentUser } from '@/lib/family/auth';
import { IMAGE_CATALOG, getImageById, setSize } from '@/lib/image-store/catalog';
import { ownedImageIds } from '@/lib/image-store/purchase';
import { centsToMP } from '@/lib/money/format';

export default async function ImageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = getImageById(id);
  if (!item) notFound();

  const user = await currentUser();
  const owned = user ? await ownedImageIds(user) : new Set<string>();
  const isOwned = owned.has(item.id);

  const misprint = item.tier === 'misprint';
  const setTotal = setSize(item.setName);
  const ownedInSet = IMAGE_CATALOG.filter(
    (e) => e.setName === item.setName && owned.has(e.id),
  ).length;

  const body = (
    <div className="min-h-[calc(100vh-260px)] px-4 py-8 max-w-4xl mx-auto">
      <Link
        href="/image-store"
        className="inline-block text-sm font-bold text-purple-700 hover:text-purple-900 mb-4"
      >
        ← Back to the drop
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        {/* Preview — watermarked, always. The original is never linked here. */}
        <div
          className={
            'rounded-2xl border-2 bg-gradient-to-br from-purple-50 to-purple-100 p-4 flex items-center justify-center ' +
            (misprint ? 'border-amber-300' : 'border-purple-100')
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.watermarkedPreview}
            alt={`${item.title} — watermarked preview`}
            className="max-h-[420px] w-full object-contain"
          />
        </div>

        {/* Details + buy/download */}
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {misprint && <MisprintBadge size="lg" />}
            {isOwned && (
              <span className="inline-flex items-center gap-1 bg-green-600 text-white text-xs font-black px-3 py-1.5 rounded-full">
                ✓ YOURS
              </span>
            )}
          </div>

          <div className="text-xs text-purple-500 uppercase font-bold tracking-wide">
            {item.setName}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-purple-900 mt-1 mb-3">
            {item.title}
          </h1>

          {misprint ? (
            <p className="text-sm sm:text-base text-amber-950 bg-amber-50 border-2 border-amber-200 rounded-xl px-4 py-3 mb-4">
              <strong>This one came out wrong — on purpose-ish.</strong> A misprint is a one-off
              press mistake: a smudge, a colour that slipped, an edge that never lined up. Nobody
              can make it happen again, which is exactly why collectors want it. The flaw IS the
              art.
            </p>
          ) : (
            <p className="text-sm sm:text-base text-gray-700 mb-4">
              An original from the <strong>{item.setName}</strong> archive. Buy it once and the
              clean, un-watermarked file is yours to download forever.
            </p>
          )}

          <div className="text-3xl font-black text-purple-900 mb-4">
            {centsToMP(item.priceCents)}
          </div>

          <BuyButton
            imageId={item.id}
            title={item.title}
            priceCents={item.priceCents}
            initiallyOwned={isOwned}
          />

          {setTotal > 1 && (
            <div className="mt-6 rounded-xl border border-purple-100 bg-white px-4 py-3">
              <div className="text-xs font-bold uppercase tracking-wide text-purple-700/70 mb-1">
                Set progress
              </div>
              <div className="text-sm text-gray-800">
                You own <strong>{ownedInSet}</strong> of <strong>{setTotal}</strong>{' '}
                {item.setName}.
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-purple-100 overflow-hidden">
                <div
                  className="h-full bg-purple-600 rounded-full"
                  style={{ width: `${Math.round((ownedInSet / setTotal) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Owned → always viewable, Sabbath included. Not owned → it's a shop shelf.
  return isOwned ? body : <SabbathGuard label="The image store">{body}</SabbathGuard>;
}
