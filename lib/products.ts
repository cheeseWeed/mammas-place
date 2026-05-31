// Product catalog — DB-backed (Prisma `Product` model on Neon Postgres).
//
// Historically lived as `data/products.json` shipped at build time. Promoted
// to the DB so the MP Bank admin dashboard can edit products without redeploy.
// Field names match `types.Product` so existing UI code keeps compiling; the
// only break is that every accessor is now async and consumers must `await`.
//
// Client components (shop page, header, ProductCard) can't call Prisma
// directly — they fetch via `/api/products` (see app/api/products/route.ts)
// and pass a Product[] into the helper functions in `lib/products-client.ts`.
//
// Category visibility is a STORAGE-LAYER concept and stays in localStorage:
// the parent toggles which categories show up in the storefront from their
// browser, with no DB roundtrip. We keep `getHiddenCategories` etc. here
// (sync, client-only) so existing consumers don't break.

import type { Product } from '@/types';
import { prisma } from '@/lib/prisma';

// ---- Internal: Prisma row → Product domain shape -----------------------
// Prisma stores price in cents (integer) to dodge float drift; the legacy
// Product shape uses `price: number` in dollars. Round-trip via the helpers.
type ProductRow = {
  id: string;
  name: string;
  priceCents: number;
  originalPriceCents: number | null;
  discount: number;
  description: string;
  shortDescription: string;
  category: string;
  subcategory: string | null;
  tags: unknown;
  imageUrl: string;
  images: unknown;
  inStock: boolean;
  stockCount: number;
  rating: number;
  reviewCount: number;
  isSale: boolean;
  isFeatured: boolean;
  isComingSoon: boolean;
  availableOnWebsite: boolean;
  sku: string;
  audioPreviewUrl: string | null;
  isAudiobook: boolean;
  isStudyGuide: boolean;
  studyGuideUrl: string | null;
  downloadUrl: string | null;
  reviews: unknown;
  series: string | null;
  // Inventory subsystem fields — owned by lib/inventory.ts; surfaced through
  // here so admin/UI keeps a single Product shape. All optional/nullable.
  stockQuantity?: number | null;
  availabilityRule?: unknown;
  restockSchedule?: unknown;
  lastRestockAt?: Date | null;
  createdAt: Date;
};

function jsonArray(v: unknown): string[] {
  return Array.isArray(v) ? (v as string[]) : [];
}

export function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    price: row.priceCents / 100,
    originalPrice:
      row.originalPriceCents === null ? undefined : row.originalPriceCents / 100,
    discount: row.discount,
    description: row.description,
    shortDescription: row.shortDescription,
    category: row.category,
    subcategory: row.subcategory ?? undefined,
    tags: jsonArray(row.tags),
    imageUrl: row.imageUrl,
    images: jsonArray(row.images),
    inStock: row.inStock,
    stockCount: row.stockCount,
    rating: row.rating,
    reviewCount: row.reviewCount,
    isSale: row.isSale,
    isFeatured: row.isFeatured,
    isComingSoon: row.isComingSoon,
    createdAt: row.createdAt.toISOString(),
    availableOnWebsite: row.availableOnWebsite,
    sku: row.sku,
    audioPreviewUrl: row.audioPreviewUrl ?? undefined,
    isAudiobook: row.isAudiobook,
    isStudyGuide: row.isStudyGuide,
    studyGuideUrl: row.studyGuideUrl ?? undefined,
    downloadUrl: row.downloadUrl ?? undefined,
    reviews: (row.reviews as Product['reviews']) ?? undefined,
    series: row.series ?? undefined,
    // Inventory subsystem — pass through verbatim. Null on the DB side maps
    // to undefined here (Product treats both as "no rule / unlimited").
    stockQuantity: row.stockQuantity ?? undefined,
    availabilityRule:
      (row.availabilityRule as Product['availabilityRule']) ?? undefined,
    restockSchedule:
      (row.restockSchedule as Product['restockSchedule']) ?? undefined,
  };
}

// Category-visibility helpers (localStorage-backed) now live in
// lib/products-client.ts since they're pure client-side. Re-exported here
// for any server code that may still import them; client components should
// import from products-client directly to avoid pulling prisma.
import {
  getHiddenCategories,
  setHiddenCategories,
  toggleCategoryVisibility,
  isCategoryHidden,
} from './products-client';
export {
  getHiddenCategories,
  setHiddenCategories,
  toggleCategoryVisibility,
  isCategoryHidden,
};

// ---- DB reads (server-only; client uses /api/products) -----------------
export async function getAllProductsIncludingUnavailable(): Promise<Product[]> {
  const rows = (await prisma.product.findMany({
    orderBy: { createdAt: 'asc' },
  })) as unknown as ProductRow[];
  return rows.map(rowToProduct);
}

export async function getAvailableProducts(): Promise<Product[]> {
  const rows = (await prisma.product.findMany({
    where: { availableOnWebsite: true },
    orderBy: { createdAt: 'asc' },
  })) as unknown as ProductRow[];
  return rows.map(rowToProduct);
}

export async function getPublishedProducts(): Promise<Product[]> {
  return getAvailableProducts();
}

// Visible-to-store list. Filters by `availableOnWebsite` and excludes any
// categories the parent hid client-side. Server callers won't have access to
// the hidden list (no window) — they get every available product; the client
// is responsible for re-filtering if it cares about hides.
export async function getAllProducts(): Promise<Product[]> {
  const all = await getAvailableProducts();
  const hidden = getHiddenCategories();
  if (hidden.length === 0) return all;
  return all.filter((p) => !hidden.includes(p.category));
}

export async function getProductById(id: string): Promise<Product | undefined> {
  const row = (await prisma.product.findUnique({
    where: { id },
  })) as unknown as ProductRow | null;
  return row ? rowToProduct(row) : undefined;
}

export async function getProductsByCategory(category: string): Promise<Product[]> {
  const rows = (await prisma.product.findMany({
    where: { availableOnWebsite: true, category },
    orderBy: { createdAt: 'asc' },
  })) as unknown as ProductRow[];
  return rows.map(rowToProduct);
}

export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  // Strategy: same category OR overlapping tag. Pull a wide-ish slice from
  // the DB (same category) then merge with tag-matches, dedupe, slice.
  const sameCategory = await getProductsByCategory(product.category);
  const tagSet = new Set(product.tags);
  const tagMatches =
    tagSet.size > 0
      ? ((await prisma.product.findMany({
          where: {
            availableOnWebsite: true,
            NOT: { id: product.id },
            category: { not: product.category },
          },
        })) as unknown as ProductRow[]).map(rowToProduct).filter((p) =>
          p.tags.some((t) => tagSet.has(t)),
        )
      : [];
  const seen = new Set<string>([product.id]);
  const out: Product[] = [];
  for (const p of [...sameCategory, ...tagMatches]) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

export async function getSaleProducts(): Promise<Product[]> {
  const rows = (await prisma.product.findMany({
    where: { availableOnWebsite: true, isSale: true },
    orderBy: { createdAt: 'asc' },
  })) as unknown as ProductRow[];
  return rows.map(rowToProduct);
}

export async function getFeaturedProducts(): Promise<Product[]> {
  const rows = (await prisma.product.findMany({
    where: { availableOnWebsite: true, isFeatured: true },
    orderBy: { createdAt: 'asc' },
  })) as unknown as ProductRow[];
  return rows.map(rowToProduct);
}

export async function searchProducts(query: string): Promise<Product[]> {
  const q = query.toLowerCase().trim();
  if (!q) return getAvailableProducts();
  // Pull available products and filter in JS — set is small (hundreds) and
  // we already need substring search on tags (jsonb). If the catalog grows
  // into the thousands we can swap to Postgres `ILIKE` + jsonb `@>` here.
  const all = await getAvailableProducts();
  return all.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.tags.some((tag) => tag.toLowerCase().includes(q)),
  );
}

export async function getAllCategories(): Promise<string[]> {
  const all = await getAvailableProducts();
  return [...new Set(all.map((p) => p.category))];
}

export async function getVisibleCategories(): Promise<string[]> {
  const cats = await getAllCategories();
  const hidden = getHiddenCategories();
  return cats.filter((c) => !hidden.includes(c));
}

export async function getCategories(): Promise<string[]> {
  return getVisibleCategories();
}

export async function getSubcategoriesByCategory(category: string): Promise<string[]> {
  const all = await getAvailableProducts();
  return [
    ...new Set(
      all
        .filter((p) => p.category === category && p.subcategory)
        .map((p) => p.subcategory!),
    ),
  ];
}

export async function getCategorySubcategoryMap(): Promise<Record<string, string[]>> {
  const cats = await getCategories();
  const map: Record<string, string[]> = {};
  for (const cat of cats) {
    map[cat] = await getSubcategoriesByCategory(cat);
  }
  return map;
}

export async function getProductsBySkus(skus: string[]): Promise<Product[]> {
  if (skus.length === 0) return [];
  const rows = (await prisma.product.findMany({
    where: { sku: { in: skus } },
  })) as unknown as ProductRow[];
  return rows.map(rowToProduct);
}

export async function getAudiobooks(): Promise<Product[]> {
  const rows = (await prisma.product.findMany({
    where: { availableOnWebsite: true, isAudiobook: true },
    orderBy: { createdAt: 'asc' },
  })) as unknown as ProductRow[];
  return rows.map(rowToProduct);
}

export async function getComingSoonProducts(): Promise<Product[]> {
  const hidden = getHiddenCategories();
  const rows = (await prisma.product.findMany({
    where: { isComingSoon: true },
    orderBy: { createdAt: 'asc' },
  })) as unknown as ProductRow[];
  return rows
    .map(rowToProduct)
    .filter((p) => !hidden.includes(p.category));
}
