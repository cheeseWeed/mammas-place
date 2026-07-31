// Grant keys — the idempotency identity of an artwork grant.
//
// PURE. No prisma, no I/O, no clock, no randomness. That is the whole point:
// the SAME order must always produce the SAME keys, on the checkout path and in
// the backfill script alike, or "already granted" becomes unknowable and a
// re-run mints free artwork.
//
// This is the replacement for the deleted @@unique([userName, imageId]) on
// ImagePurchase (see the long note in prisma/schema.prisma). The rule moved from
// "one copy per kid per picture" to "one copy per PURCHASE EVENT", which is what
// the constraint was always really protecting.

/**
 * Key for ONE copy granted by a shop order.
 *
 * Derived ENTIRELY from (orderId, imageId, ordinal) — no timestamp, no cuid, no
 * user (the order already determines the user). Replaying the order proposes
 * identical keys, every one collides on `grantKey @unique`, and the DB refuses
 * the duplicates without anyone having to read first.
 *
 * `ordinal` is 1..qty: buying 3 tires yields three DISTINCT keys, so three
 * copies land — that is the "I want to be able to buy multiple" requirement —
 * while re-running that same order yields those same three keys and adds
 * nothing.
 */
export function grantKeyForOrderItem(
  orderId: string,
  imageId: string,
  ordinal: number,
): string {
  return `order:${orderId}:${imageId}:${ordinal}`;
}

/**
 * Key for a copy bought outright in the image store.
 *
 * Carries a caller-supplied unique token because two deliberate buys of the same
 * picture by the same kid are two legitimate events that must BOTH land. The
 * store's own double-submit protection is the per-click token, not this shape.
 */
export function grantKeyForStorePurchase(
  userName: string,
  imageId: string,
  token: string,
): string {
  return `store:${userName}:${imageId}:${token}`;
}

/** Every grant key an order line produces, in ordinal order. */
export function grantKeysForLine(
  orderId: string,
  imageId: string,
  qty: number,
): string[] {
  const n = Number.isInteger(qty) && qty > 0 ? qty : 0;
  const out: string[] = [];
  for (let i = 1; i <= n; i += 1) out.push(grantKeyForOrderItem(orderId, imageId, i));
  return out;
}
