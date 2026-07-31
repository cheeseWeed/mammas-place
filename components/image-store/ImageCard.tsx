// One piece of artwork in a grid. Server component — no state, no handlers,
// so it stays out of the client bundle and the catalog JSON never ships to the
// browser. Buying happens on the detail page (components/image-store/BuyButton).
//
// Only the WATERMARKED preview is ever rendered. The original is not linkable
// from anywhere in the UI except a download button on a piece the kid owns.

import Link from 'next/link';
import { centsToMP } from '@/lib/money/format';
import type { ImageStoreEntry } from '@/lib/image-store/catalog';
import type { EditionState } from '@/lib/image-store/editions';
import MisprintBadge from './MisprintBadge';
import { EditionStockBadge } from './EditionBadge';

export default function ImageCard({
  item,
  owned = false,
  edition,
}: {
  item: ImageStoreEntry;
  owned?: boolean;
  /**
   * Server-computed scarcity state. Optional so any existing caller still
   * renders; without it the card falls back to the plain list price, which is
   * exactly what it showed before editions existed.
   */
  edition?: EditionState;
}) {
  const misprint = item.tier === 'misprint';
  // The DISPLAYED price is the same function the charge uses. Never item.priceCents
  // when we have an edition state — that would show a price we would not honour.
  const priceCents = edition?.priceCents ?? item.priceCents;
  const soldOut = edition?.soldOut ?? false;

  return (
    <Link
      href={`/image-store/${encodeURIComponent(item.id)}`}
      className={
        'group block bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border-2 ' +
        (misprint ? 'border-amber-300' : 'border-purple-100')
      }
    >
      <div className="relative bg-gradient-to-br from-purple-50 to-purple-100 overflow-hidden">
        <div className="h-44 sm:h-52 flex items-center justify-center p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.watermarkedPreview}
            alt={`${item.title} — watermarked preview`}
            className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        </div>
        {misprint && (
          <div className="absolute top-2 left-2">
            <MisprintBadge />
          </div>
        )}
        {owned && (
          <div className="absolute top-2 right-2 bg-green-600 text-white text-xs font-black px-2.5 py-1 rounded-full shadow">
            ✓ YOURS
          </div>
        )}
        {/* Sold out and not owned: dim the art so the state reads at a glance. */}
        {soldOut && !owned && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
            <span className="bg-red-600 text-white text-xs font-black px-3 py-1.5 rounded-full shadow">
              SOLD OUT
            </span>
          </div>
        )}
      </div>

      <div className="p-3">
        <div className="text-[11px] text-purple-500 uppercase font-bold tracking-wide truncate">
          {item.setName}
        </div>
        <h3 className="font-bold text-gray-800 group-hover:text-purple-700 transition-colors leading-tight text-sm sm:text-base mt-0.5">
          {item.title}
        </h3>
        {edition && (
          <div className="mt-1.5">
            <EditionStockBadge
              remaining={edition.remaining}
              size={edition.availableSize}
              soldOut={edition.soldOut}
              oneOfOne={edition.oneOfOne}
            />
          </div>
        )}

        <div className="mt-2 flex items-center justify-between gap-2">
          <span
            className={
              'font-black text-lg ' + (soldOut ? 'text-gray-400 line-through' : 'text-purple-900')
            }
          >
            {centsToMP(priceCents)}
          </span>
          <span
            className={
              'text-xs font-black px-3 py-1.5 rounded-full ' +
              (owned
                ? 'bg-green-100 text-green-800'
                : soldOut
                  ? 'bg-gray-200 text-gray-600'
                  : 'bg-purple-700 text-white')
            }
          >
            {owned ? 'Download' : soldOut ? 'Gone' : 'Look'}
          </span>
        </div>
      </div>
    </Link>
  );
}
