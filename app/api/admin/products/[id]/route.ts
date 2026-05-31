// /api/admin/products/[id] — parent-gated single-product mutations.
//   PUT    → update the product matching `id` (path param). Body shape mirrors
//            POST on /api/admin/products. `id` in the body is ignored — path
//            wins so the kid can't pivot to another product mid-request.
//   DELETE → drop the row. No cascade — only removes from the catalog.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isParentAuthenticated } from '@/lib/money/parent';
import { rowToProduct } from '@/lib/products';
import { normalizeProductInput, ProductWriteInput } from '@/lib/admin-products';

export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  if (!(await isParentAuthenticated())) {
    return NextResponse.json({ error: 'Parent login required' }, { status: 401 });
  }
  const { id } = await params;
  let body: ProductWriteInput;
  try {
    body = (await req.json()) as ProductWriteInput;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  let data;
  try {
    data = normalizeProductInput(body, id);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid product input' },
      { status: 400 },
    );
  }
  // SKU is unique across rows — disallow setting it to one another row owns.
  const skuClash = await prisma.product.findFirst({
    where: { sku: data.sku, NOT: { id: data.id } },
    select: { id: true },
  });
  if (skuClash) {
    return NextResponse.json(
      { error: 'Another product already uses that sku' },
      { status: 409 },
    );
  }
  try {
    // Strip `id` from the update payload — it's already pinned by `where`.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _ignored, ...rest } = data;
    const updated = (await prisma.product.update({
      where: { id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: rest as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })) as any;
    return NextResponse.json({ product: rowToProduct(updated) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    // Prisma P2025 = record not found.
    if (message.includes('P2025') || message.toLowerCase().includes('not found')) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  if (!(await isParentAuthenticated())) {
    return NextResponse.json({ error: 'Parent login required' }, { status: 401 });
  }
  const { id } = await params;
  try {
    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('P2025') || message.toLowerCase().includes('not found')) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
