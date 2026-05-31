// /api/admin/products — parent-gated product catalog management.
//   GET  → list every product (including unavailable) so the admin editor can
//          show toggles for `availableOnWebsite`.
//   POST → create a new product. Body shape: see lib/admin-products.ts.
//
// Per-id update/delete lives at /api/admin/products/[id].
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isParentAuthenticated } from '@/lib/money/parent';
import { rowToProduct } from '@/lib/products';
import { normalizeProductInput, ProductWriteInput } from '@/lib/admin-products';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isParentAuthenticated())) {
    return NextResponse.json({ error: 'Parent login required' }, { status: 401 });
  }
  const rows = await prisma.product.findMany({ orderBy: { createdAt: 'asc' } });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const products = rows.map((r: any) => rowToProduct(r));
  return NextResponse.json({ products });
}

export async function POST(req: NextRequest) {
  if (!(await isParentAuthenticated())) {
    return NextResponse.json({ error: 'Parent login required' }, { status: 401 });
  }
  let body: ProductWriteInput;
  try {
    body = (await req.json()) as ProductWriteInput;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  let data;
  try {
    data = normalizeProductInput(body);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid product input' },
      { status: 400 },
    );
  }
  // Manual unique check on id / sku — gives a clean 409 instead of a Prisma
  // P2002 with an opaque target message.
  const existing = await prisma.product.findFirst({
    where: { OR: [{ id: data.id }, { sku: data.sku }] },
    select: { id: true, sku: true },
  });
  if (existing) {
    const which = existing.id === data.id ? 'id' : 'sku';
    return NextResponse.json(
      { error: `A product with that ${which} already exists` },
      { status: 409 },
    );
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const created = (await prisma.product.create({ data: data as any })) as any;
    return NextResponse.json({ product: rowToProduct(created) }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
