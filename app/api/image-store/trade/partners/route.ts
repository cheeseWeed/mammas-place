// GET /api/image-store/trade/partners
//
// Powers the "propose a trade" screen: who can I trade with, what have I got,
// and what have they got?
//
// Kid-authed and deliberately NARROW — name + displayName + owned artwork only.
// No balances, no PII, no progress. Same reasoning as
// /api/money/gift/recipients: there is no kid-facing learner list elsewhere
// (listAllLearners is parent-gated and leaks balances), and a kid needs to pick
// a sibling from a list rather than type an exact username.
//
// The caller is excluded from the partner list so the picker can never offer a
// self-trade (which proposeTrade refuses anyway — this just keeps it off the
// screen).
//
// Every id returned is cross-referenced against the catalog for its title and
// preview. `originalPath` / `sourceFile` are NEVER included — those are
// server-only and gated behind the download route's ownership check.

import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/family/auth';
import { prisma } from '@/lib/prisma';
import { getImageById } from '@/lib/image-store/catalog';

interface OwnedPiece {
  imageId: string;
  title: string;
  setName: string;
  preview: string;
  editionNumber: number;
  /** True for the rookie card — the UI warns before trading one away. */
  rookie: boolean;
}

function toPiece(row: { imageId: string; editionNumber: number }): OwnedPiece {
  const entry = getImageById(row.imageId);
  const editionNumber =
    Number.isInteger(row.editionNumber) && row.editionNumber > 0 ? row.editionNumber : 1;
  return {
    imageId: row.imageId,
    // Art retired from the catalog is still OWNED (the row is the truth), so
    // fall back to the id rather than dropping it from a tradable list.
    title: entry?.title ?? row.imageId,
    setName: entry?.setName ?? 'Archive',
    preview: entry?.watermarkedPreview ?? '',
    editionNumber,
    rookie: editionNumber === 1,
  };
}

export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: 'Log in to trade' }, { status: 401 });
  }

  const others = await prisma.driveUser.findMany({
    where: { name: { not: user } },
    select: { name: true, displayName: true },
    orderBy: { name: 'asc' },
  });

  // ONE query for every relevant kid's collection, then bucket in memory —
  // never a query per partner.
  const names = [user, ...others.map((o) => o.name)];
  const rows = await prisma.imagePurchase.findMany({
    where: { userName: { in: names } },
    select: { userName: true, imageId: true, editionNumber: true },
    orderBy: { createdAt: 'desc' },
  });

  const byUser = new Map<string, OwnedPiece[]>(names.map((n) => [n, []]));
  for (const row of rows) {
    byUser.get(row.userName)?.push(toPiece(row));
  }

  const mine = byUser.get(user) ?? [];
  const mineIds = new Set(mine.map((p) => p.imageId));

  return NextResponse.json({
    me: { name: user, owned: mine },
    partners: others.map((o) => {
      const owned = byUser.get(o.name) ?? [];
      return {
        name: o.name,
        displayName: (o.displayName?.trim() || o.name).trim(),
        owned: owned.map((p) => ({
          ...p,
          // THE EDGE CASE, surfaced to the UI: a kid may hold at most one copy
          // of a picture (ImagePurchase @@unique([userName, imageId])), so a
          // piece they already own cannot be asked for. The picker greys these
          // out instead of letting a kid build an offer that can never work.
          // proposeTrade refuses it too — this is only the friendly half.
          alreadyMine: mineIds.has(p.imageId),
        })),
      };
    }),
  });
}
