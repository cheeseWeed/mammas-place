// POST /api/money/order
// Body: { user, items: [{ productId, qty }] }
// Server re-reads price from products.json — kid client can't forge totals.
// Debits balance + writes order + ledger row in a single Prisma transaction.

import { NextRequest, NextResponse } from 'next/server';
import { isValidUser, normalizeUser } from '@/lib/drive-progress';
import { prisma } from '@/lib/prisma';
import { placeOrder, InsufficientFundsError, OrderItem } from '@/lib/money/balance';
import { decrementStock, OutOfStockError } from '@/lib/inventory';

interface BodyItem { productId?: unknown; qty?: unknown }

export async function POST(req: NextRequest) {
  let body: { user?: unknown; items?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!isValidUser(body.user)) {
    return NextResponse.json({ error: 'Bad user' }, { status: 400 });
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'No items' }, { status: 400 });
  }

  const items: OrderItem[] = [];
  let totalCents = 0;
  for (const raw of body.items as BodyItem[]) {
    if (!raw || typeof raw.productId !== 'string') {
      return NextResponse.json({ error: 'Bad item' }, { status: 400 });
    }
    const qty = Number(raw.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
      return NextResponse.json({ error: 'Bad qty' }, { status: 400 });
    }
    // Read priceCents directly from the DB. Going through getProductById +
    // Math.round(product.price * 100) introduced float drift on cents-not-
    // divisible-by-100 prices, which caused checkout to demand 104.94 MP for
    // a cart the UI showed as 104.93 MP. Source of truth is the integer column.
    // Apply the sale price (originalPriceCents was the strikethrough; priceCents
    // is what the kid actually pays).
    const row = await prisma.product.findUnique({
      where: { id: raw.productId },
      select: { id: true, name: true, priceCents: true },
    });
    if (!row) {
      return NextResponse.json({ error: `Unknown product ${raw.productId}` }, { status: 400 });
    }
    items.push({ productId: row.id, name: row.name, qty, priceCents: row.priceCents });
    totalCents += row.priceCents * qty;
  }

  // Stock check / decrement runs BEFORE the balance debit so we reject
  // out-of-stock orders without touching the kid's wallet. If any item runs
  // out we attempt to refund earlier successful decrements (best-effort —
  // see comment below). decrementStock no-ops on unlimited-stock items.
  const decremented: { productId: string; qty: number }[] = [];
  for (const it of items) {
    try {
      await decrementStock(it.productId, it.qty);
      decremented.push({ productId: it.productId, qty: it.qty });
    } catch (err) {
      // Roll back any prior decrements in this order. Not a transaction —
      // each restore is a separate update — but the window is tiny and
      // restoring slightly stale counts is harmless (we add back the same
      // qty we removed).
      const { prisma } = await import('@/lib/prisma');
      for (const d of decremented) {
        try {
          await prisma.product.updateMany({
            where: { id: d.productId, stockQuantity: { not: null } },
            data: { stockQuantity: { increment: d.qty } },
          });
        } catch {
          /* swallow — best-effort restore, column may be missing */
        }
      }
      if (err instanceof OutOfStockError) {
        return NextResponse.json(
          { error: `Sold out: ${it.productId}`, productId: it.productId },
          { status: 409 },
        );
      }
      throw err;
    }
  }

  try {
    const result = await placeOrder(normalizeUser(body.user as string), items, totalCents);
    return NextResponse.json({
      ok: true,
      orderId: result.orderId,
      balanceCents: result.balanceCents,
      totalCents,
    });
  } catch (err) {
    // Balance debit failed — restore the stock we decremented above so the
    // shelf doesn't drift.
    const { prisma } = await import('@/lib/prisma');
    for (const d of decremented) {
      try {
        await prisma.product.updateMany({
          where: { id: d.productId, stockQuantity: { not: null } },
          data: { stockQuantity: { increment: d.qty } },
        });
      } catch {
        /* swallow — best-effort restore */
      }
    }
    if (err instanceof InsufficientFundsError) {
      return NextResponse.json(
        {
          error: 'Insufficient funds',
          balanceCents: err.balanceCents,
          neededCents: err.neededCents,
        },
        { status: 402 },
      );
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'User not found') {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
