// POST /api/admin/products/seed
// Parent-gated one-shot seeder — slurps the legacy `data/products.json` and
// upserts every row into the `products` table. Safe to call multiple times
// (uses upsert, so existing rows get re-applied with the static values).
//
// Run this ONCE after deploying the DB-backed catalog migration. After the
// admin starts editing through the dashboard, re-running the seed will
// stomp their edits with the JSON values — so treat this as a fresh-start
// or recovery tool only.
//
// Response: { seeded, skipped, errors }
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isParentAuthenticated } from '@/lib/money/parent';
import { legacyProductToInput } from '@/lib/admin-products';
import productsJson from '@/data/products.json';
import type { Product } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST() {
  if (!(await isParentAuthenticated())) {
    return NextResponse.json({ error: 'Parent login required' }, { status: 401 });
  }

  const list = productsJson as Product[];
  let seeded = 0;
  let skipped = 0;
  const errors: { id: string; error: string }[] = [];

  for (const p of list) {
    try {
      const input = legacyProductToInput(p);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, ...data } = input;
      await prisma.product.upsert({
        where: { id: input.id },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        create: input as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        update: data as any,
      });
      seeded++;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      errors.push({ id: p.id, error: message });
      skipped++;
    }
  }

  return NextResponse.json({
    ok: true,
    seeded,
    skipped,
    errors,
    sourceCount: list.length,
  });
}
