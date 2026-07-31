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
import {
  IMAGE_CATALOG,
  getImageById,
  setSize,
  subjectProgressFor,
} from '@/lib/image-store/catalog';
import { listPurchases, ownedImageIds, soldCountFor } from '@/lib/image-store/purchase';
import { editionStateFor } from '@/lib/image-store/editions';
import { EditionStockBadge, PriceMoveNote, RookieBadge } from '@/components/image-store/EditionBadge';
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

  // Other pieces that draw the SAME THING (an archive plate and its restaurant
  // re-plating, a gown in two colourways). Most pieces are the only version of
  // their subject, and then this whole block is skipped.
  const subject = subjectProgressFor([...owned], item.subjectId);
  const siblings = subject.variants.filter((v) => v.id !== item.id);

  // Edition state — the SAME server function that will compute the charge, so
  // the number on this page is the number the kid pays.
  const sold = await soldCountFor(item.id);
  const edition = editionStateFor(item, sold, new Date());

  // If they own it, which copy is theirs? That is the rookie number.
  const myCopy = isOwned && user
    ? (await listPurchases(user)).find((p) => p.imageId === item.id) ?? null
    : null;

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
            {myCopy && (
              <RookieBadge
                editionNumber={myCopy.editionNumber}
                editionSize={edition.availableSize}
              />
            )}
            {!isOwned && (
              <EditionStockBadge
                remaining={edition.remaining}
                size={edition.availableSize}
                soldOut={edition.soldOut}
                oneOfOne={edition.oneOfOne}
              />
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

          {/* THE ROOKIE CARD. #1 gets its own banner — it is the whole point. */}
          {myCopy && myCopy.editionNumber === 1 && (
            <div className="mb-4 rounded-2xl border-2 border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-100 px-4 py-3">
              <div className="text-amber-950 font-black text-base sm:text-lg">
                🏆 Edition #1 — first ever sold
              </div>
              <p className="text-amber-900 text-xs sm:text-sm mt-0.5">
                You were the very first person to buy this piece. Nobody can ever take that
                number — it&apos;s yours forever.
              </p>
            </div>
          )}
          {myCopy && myCopy.editionNumber !== 1 && (
            <div className="mb-4 rounded-xl border border-purple-200 bg-purple-50 px-4 py-2.5 text-purple-900 text-sm font-bold">
              Your copy is Edition #{myCopy.editionNumber} of {edition.availableSize}.
            </div>
          )}

          <div className="mb-4">
            <div
              className={
                'text-3xl font-black ' +
                (edition.soldOut ? 'text-gray-400 line-through' : 'text-purple-900')
              }
            >
              {centsToMP(edition.priceCents)}
            </div>
            {!isOwned && (
              <PriceMoveNote
                listPriceCents={edition.listPriceCents}
                priceCents={edition.priceCents}
                oneOfOne={edition.oneOfOne}
              />
            )}
          </div>

          {/* Sold out and not owned: no Buy button at all. */}
          {edition.soldOut && !isOwned ? (
            <div className="rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-4">
              <div className="font-black text-red-800 text-lg mb-1">
                {edition.oneOfOne ? 'Gone forever' : 'Sold out'}
              </div>
              <p className="text-sm text-red-900">
                {edition.oneOfOne
                  ? 'Only one of this piece ever existed, and somebody else got it. There will never be another one.'
                  : `All ${edition.availableSize} copies have been bought. Sometimes another copy turns up in the archive, but it takes a long while — check back in a few months.`}
              </p>
              <Link
                href="/image-store"
                className="mt-3 inline-block bg-purple-700 hover:bg-purple-600 text-white font-black text-sm px-4 py-2.5 rounded-xl transition-colors"
              >
                See what else is in the drop
              </Link>
            </div>
          ) : (
            <BuyButton
              imageId={item.id}
              title={item.title}
              priceCents={edition.priceCents}
              initiallyOwned={isOwned}
            />
          )}

          {/* Edition explainer — always visible, so scarcity is never a surprise. */}
          <div className="mt-6 rounded-xl border border-purple-100 bg-white px-4 py-3">
            <div className="text-xs font-bold uppercase tracking-wide text-purple-700/70 mb-1">
              Limited edition
            </div>
            {edition.oneOfOne ? (
              <div className="text-sm text-gray-800">
                This is a <strong>1 of 1</strong>. Exactly one copy will ever exist, and it never
                comes back.
              </div>
            ) : (
              <div className="text-sm text-gray-800">
                Only <strong>{edition.availableSize}</strong> copies of this piece will ever be
                sold — <strong>{edition.remaining}</strong> still available.
              </div>
            )}
            <div className="mt-1 text-xs text-gray-600">
              The first buyer gets Edition #1. Numbers are given out in the order pieces sell, and
              they never change.
            </div>
          </div>

          {siblings.length > 0 && (
            <div className="mt-6 rounded-xl border border-purple-100 bg-white px-4 py-3">
              <div className="text-xs font-bold uppercase tracking-wide text-purple-700/70 mb-1">
                Other versions
              </div>
              <div className="text-sm text-gray-800">
                <strong>{subject.total}</strong> versions of this artwork exist &mdash; you own{' '}
                <strong>{subject.owned}</strong>.
              </div>
              <div className="mt-1 text-xs text-gray-600">
                This one: {item.variantLabel}
              </div>
              <ul className="mt-2 space-y-1">
                {siblings.map((v) => (
                  <li key={v.id} className="text-sm">
                    <Link
                      href={`/image-store/${encodeURIComponent(v.id)}`}
                      className="font-bold text-purple-700 hover:text-purple-900"
                    >
                      {v.title}
                    </Link>{' '}
                    <span className="text-xs text-gray-600">
                      &mdash; {v.variantLabel}
                      {owned.has(v.id) ? ' · yours' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

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
