// GET /api/products
// Public read endpoint — returns the full product catalog from the DB so client
// components (shop page, header mega-menu, product detail) can render without
// importing Prisma directly. Mutations live at `/api/admin/products` and are
// parent-gated.
//
// Replaces the older file-based POST/PUT/DELETE handlers — admin edits now
// write to the `products` table via /api/admin/products/* routes.
//
// Response shape kept backwards-compatible: { success, products } so the
// older admin UI (/admin/upload, etc.) keeps working if it polls this.
import { NextResponse } from 'next/server';
import { getAllProductsIncludingUnavailable } from '@/lib/products';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const products = await getAllProductsIncludingUnavailable();
    return NextResponse.json({ success: true, products });
  } catch (error) {
    console.error('Error reading products:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to read products', products: [] },
      { status: 500 },
    );
  }
}
