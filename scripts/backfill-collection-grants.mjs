#!/usr/bin/env node
// Backfill artwork grants for every PAST shop purchase.
//
//   node scripts/backfill-collection-grants.mjs --dry     # report only, writes nothing
//   node scripts/backfill-collection-grants.mjs           # actually grant
//
// WHY THIS EXISTS. Automatic granting at checkout (lib/collection/grant.ts, wired
// into app/api/money/order) only helps orders placed from now on. Orders already
// in the DB — including shepherd's battery-001 + tire-003 from 2026-07-31 —
// never went through it, so their artwork was never granted and those purchases
// would show in the collection as plain shop items with nothing to download.
//
// IDEMPOTENT, AND NOT BY CHECKING FIRST. Every copy carries
// `grantKey @unique`, derived purely from (orderId, imageId, ordinal) by
// lib/collection/grant-key.ts. Re-running proposes the exact same keys, every
// one collides, and nothing duplicates. There is no findFirst-then-create here:
// that is a check-then-act race, and this codebase refuses it everywhere (see
// MpEarning.idempotencyKey and the long note in prisma/schema.prisma). The DB
// constraint is the gate.
//
// SAFETY. This script grants FREE artwork. It never touches a balance, never
// writes an MpTransaction, and never modifies an existing row — the only write
// it can make is an INSERT into image_purchases. A sold-out edition run is
// skipped rather than overfilled.
//
// The dry run reports exactly what a real run would do, derived the same way, so
// the two can never disagree about the plan.

import { PrismaClient } from '@prisma/client';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const catalog = require('../data/image-store.json');

const DRY = process.argv.includes('--dry');
const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Catalog matching — MUST agree with lib/collection/artwork-match.ts.
// Re-derived here rather than imported because this is a plain .mjs script and
// the lib is TypeScript with `@/` path aliases. The rule is one line and the
// unit tests pin it: sourceFile stem === productId.
// ---------------------------------------------------------------------------

const stem = (f) => String(f).replace(/\.[^./\\]+$/, '');

const byProductId = new Map();
for (const entry of catalog) {
  if (!entry || typeof entry.sourceFile !== 'string' || typeof entry.id !== 'string') continue;
  const key = stem(entry.sourceFile);
  if (!key || byProductId.has(key)) continue;
  byProductId.set(key, entry);
}

/** Mirrors lib/collection/grant-key.ts grantKeyForOrderItem. Keep in lockstep. */
const grantKeyFor = (orderId, imageId, ordinal) => `order:${orderId}:${imageId}:${ordinal}`;

/**
 * Edition run size. Mirrors the tier fallback in lib/image-store/catalog.ts: the
 * JSON value is a convenience, and anything missing/non-integer/<1 is not
 * honoured. Deliberately does NOT model the restock top-up (effectiveEditionSize)
 * — a backfill should be the CONSERVATIVE reading of a run, never the one that
 * squeezes in extra copies.
 */
function editionSizeOf(entry) {
  const declared = typeof entry.editionSize === 'number' ? entry.editionSize : NaN;
  return Number.isInteger(declared) && declared >= 1 ? declared : 1;
}

async function main() {
  console.log(DRY ? '=== DRY RUN — nothing will be written ===\n' : '=== LIVE RUN ===\n');

  const orders = await prisma.mpOrder.findMany({ orderBy: { createdAt: 'asc' } });
  console.log(`Scanning ${orders.length} order(s).\n`);

  // Live sold-counts per image, so we never overfill a run. In a dry run we keep
  // incrementing this map in memory so the report reflects the cumulative effect
  // of the whole backfill rather than pretending each order runs alone.
  const soldCache = new Map();
  async function soldFor(imageId) {
    if (!soldCache.has(imageId)) {
      soldCache.set(imageId, await prisma.imagePurchase.count({ where: { imageId } }));
    }
    return soldCache.get(imageId);
  }

  // THE LEGACY-GRANT PROBLEM, and why this map exists.
  //
  // Six ImagePurchase rows already in production came from a ONE-TIME hand
  // backfill in June. They predate the `grantKey` column, so they carry NULL —
  // which means the unique index cannot recognise them and a naive re-run would
  // hand those kids a SECOND free copy of art they already hold. (Verified
  // against the real DB: a naive plan proposed 8 grants, 6 of them duplicates of
  // the June backfill.)
  //
  // So an un-keyed row that this kid already holds for this image is treated as
  // "already granted". That is the conservative reading: the only cost of being
  // wrong is a kid missing a bonus copy they can still be granted deliberately,
  // whereas the opposite error silently mints free editions and burns numbers
  // out of a limited run.
  //
  // This is a ONE-TIME reconciliation for pre-grantKey rows. Everything written
  // from now on carries a key and is matched exactly.
  const legacyRows = await prisma.imagePurchase.findMany({
    where: { grantKey: null },
    select: { userName: true, imageId: true },
  });
  const legacyHeld = new Map();
  for (const row of legacyRows) {
    const k = `${row.userName}|${row.imageId}`;
    legacyHeld.set(k, (legacyHeld.get(k) ?? 0) + 1);
  }
  if (legacyRows.length > 0) {
    console.log(
      `Found ${legacyRows.length} pre-grantKey row(s); those count as already granted.\n`,
    );
  }

  let planned = 0;
  let created = 0;
  let skipped = 0;
  let soldOut = 0;
  let noArtwork = 0;
  let legacySkips = 0;

  for (const order of orders) {
    if (order.status === 'cancelled') continue;
    const items = Array.isArray(order.items) ? order.items : [];

    for (const line of items) {
      if (!line || typeof line.productId !== 'string') continue;
      const entry = byProductId.get(line.productId);
      if (!entry) {
        noArtwork += 1;
        console.log(`  – ${order.userName}: ${line.productId} has no archive artwork, skipping`);
        continue;
      }

      const qty = Number.isInteger(line.qty) && line.qty > 0 ? line.qty : 1;
      const size = editionSizeOf(entry);

      for (let ordinal = 1; ordinal <= qty; ordinal += 1) {
        const grantKey = grantKeyFor(order.id, entry.id, ordinal);

        // Consume one legacy (un-keyed) copy before proposing a new grant — see
        // the note above. Decrementing rather than just testing means a kid who
        // legitimately holds two un-keyed copies absorbs two ordinals, not one.
        const legacyKey = `${order.userName}|${entry.id}`;
        const legacyLeft = legacyHeld.get(legacyKey) ?? 0;
        if (legacyLeft > 0) {
          legacyHeld.set(legacyKey, legacyLeft - 1);
          legacySkips += 1;
          console.log(
            `  = ${order.userName}: ${entry.id} already granted before grantKey existed`,
          );
          continue;
        }

        const sold = await soldFor(entry.id);

        if (sold >= size) {
          soldOut += 1;
          console.log(
            `  ! ${order.userName}: ${entry.id} run is full (${sold}/${size}) — skipping`,
          );
          continue;
        }

        planned += 1;

        if (DRY) {
          // Report what a real run WOULD do. An existing key is reported as a
          // skip so a dry run over an already-backfilled DB reads as a no-op.
          const exists = await prisma.imagePurchase.findUnique({
            where: { grantKey },
            select: { id: true },
          });
          if (exists) {
            skipped += 1;
            console.log(`  = ${order.userName}: ${entry.id} already granted`);
          } else {
            soldCache.set(entry.id, sold + 1);
            console.log(
              `  + ${order.userName}: WOULD grant ${entry.id} "${entry.title}" edition #${sold + 1}/${size}`,
            );
          }
          continue;
        }

        // LIVE. No pre-check — the unique index is the gate.
        try {
          await prisma.imagePurchase.create({
            data: {
              userName: order.userName,
              imageId: entry.id,
              pricePaidCents: 0, // a grant is free; the shop item was the purchase
              editionNumber: sold + 1,
              source: 'grant',
              grantOrderId: order.id,
              grantKey,
            },
          });
          soldCache.set(entry.id, sold + 1);
          created += 1;
          console.log(
            `  + ${order.userName}: granted ${entry.id} "${entry.title}" edition #${sold + 1}/${size}`,
          );
        } catch (err) {
          if (err?.code === 'P2002') {
            const target = String(err.meta?.target ?? '').toLowerCase();
            if (target.includes('edition')) {
              // Lost an edition-number race with a concurrent write. Refresh and
              // let the next run pick it up rather than guessing another number.
              soldCache.delete(entry.id);
              console.log(`  ~ ${order.userName}: ${entry.id} edition race — retry on next run`);
            } else {
              skipped += 1;
              console.log(`  = ${order.userName}: ${entry.id} already granted`);
            }
            continue;
          }
          throw err;
        }
      }
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Planned grants : ${planned}`);
  console.log(DRY ? `Would create   : ${planned - skipped}` : `Created        : ${created}`);
  console.log(`Already there  : ${skipped}`);
  console.log(`Pre-key skips  : ${legacySkips}   (June hand-backfill rows)`);
  console.log(`Sold-out skips : ${soldOut}`);
  console.log(`No artwork     : ${noArtwork}`);
  if (DRY) console.log('\nDry run — nothing was written. Re-run without --dry to apply.');
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
