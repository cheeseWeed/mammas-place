// POST /api/money/order
// Body: { user, items: [{ productId, qty }] }
// Server re-reads price from products.json — kid client can't forge totals.
// Debits balance + writes order + ledger row in a single Prisma transaction.

import { NextRequest, NextResponse } from 'next/server';
import { isValidUser, normalizeUser } from '@/lib/drive-progress';
import { getProductById } from '@/lib/products';
import { placeOrder, InsufficientFundsError, OrderItem } from '@/lib/money/balance';

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
    const product = getProductById(raw.productId);
    if (!product) {
      return NextResponse.json({ error: `Unknown product ${raw.productId}` }, { status: 400 });
    }
    const priceCents = Math.round(product.price * 100);
    items.push({ productId: product.id, name: product.name, qty, priceCents });
    totalCents += priceCents * qty;
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
