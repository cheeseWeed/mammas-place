// Edition badges — the visual language of scarcity in the image store.
//
// Server components (no state, no handlers), so they stay out of the client
// bundle like ImageCard. Every number they render is computed server-side by
// lib/image-store/editions.ts — nothing here decides a price or an availability.
//
// Three separate badges rather than one prop-heavy component, because they
// appear in different places and mean different things:
//   * EditionStockBadge — "3 of 6 left" / "SOLD OUT". On a piece you might buy.
//   * RookieBadge       — "EDITION #1" on a piece you OWN. The rookie card.
//   * PriceMoveNote     — why the price is not the list price.

import { editionBrag, isRookie } from '@/lib/image-store/editions';
import { centsToMP } from '@/lib/money/format';

/**
 * Remaining-stock pill. `remaining`/`size` come from `editionStateFor`.
 *
 * Colour is the whole point: green while there is room, amber when the run is
 * nearly gone, red when it is over. A 1-of-1 is always amber-gold because it is
 * always nearly gone by definition.
 */
export function EditionStockBadge({
  remaining,
  size,
  soldOut,
  oneOfOne = false,
  className = '',
}: {
  remaining: number;
  size: number;
  soldOut: boolean;
  oneOfOne?: boolean;
  className?: string;
}) {
  if (soldOut) {
    return (
      <span
        className={
          'inline-flex items-center gap-1 bg-red-600 text-white text-[11px] font-black px-2.5 py-1 rounded-full ' +
          className
        }
      >
        SOLD OUT
      </span>
    );
  }

  if (oneOfOne || size === 1) {
    return (
      <span
        className={
          'inline-flex items-center gap-1 bg-amber-400 text-amber-950 text-[11px] font-black px-2.5 py-1 rounded-full ' +
          className
        }
      >
        ⭐ 1 OF 1
      </span>
    );
  }

  // "Nearly gone" once a third or less of the run is left — that is when the
  // number should start feeling urgent rather than informational.
  const scarce = remaining <= Math.max(1, Math.ceil(size / 3));
  return (
    <span
      className={
        'inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-full ' +
        (scarce ? 'bg-amber-400 text-amber-950' : 'bg-purple-100 text-purple-900') +
        ' ' +
        className
      }
    >
      {remaining} of {size} left
    </span>
  );
}

/**
 * The number ON a copy the kid owns. #1 is celebrated loudly — it is the whole
 * reason the feature exists — and everything else gets a quiet plate.
 */
export function RookieBadge({
  editionNumber,
  editionSize,
  className = '',
}: {
  editionNumber: number;
  editionSize?: number | null;
  className?: string;
}) {
  const rookie = isRookie(editionNumber);
  return (
    <span
      className={
        'inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-full ' +
        (rookie
          ? 'bg-gradient-to-r from-yellow-300 to-amber-400 text-amber-950 ring-2 ring-yellow-200'
          : 'bg-purple-900 text-white') +
        ' ' +
        className
      }
      title={editionBrag(editionNumber, editionSize)}
    >
      {rookie ? '🏆 EDITION #1' : `#${editionNumber}${editionSize ? ` of ${editionSize}` : ''}`}
    </span>
  );
}

/**
 * Explains a price that is not the list price, so a moving number never looks
 * like a bug to a kid (or a parent). Renders nothing when the price is at list.
 */
export function PriceMoveNote({
  listPriceCents,
  priceCents,
  oneOfOne = false,
}: {
  listPriceCents: number;
  priceCents: number;
  oneOfOne?: boolean;
}) {
  if (priceCents === listPriceCents) return null;
  const up = priceCents > listPriceCents;

  if (oneOfOne) {
    return (
      <p className="text-xs text-amber-800 font-bold">
        ⭐ One-of-a-kind pricing — only one of these will ever exist.
      </p>
    );
  }

  return (
    <p className={'text-xs font-bold ' + (up ? 'text-amber-800' : 'text-green-700')}>
      {up ? (
        <>📈 Price went up as copies sold — it was {centsToMP(listPriceCents)}.</>
      ) : (
        <>📉 Fresh edition, still {centsToMP(listPriceCents - priceCents)} under list price.</>
      )}
    </p>
  );
}
