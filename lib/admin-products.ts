// Server-only helpers for the parent-gated product CRUD API.
// Validates + sanitizes the request body shape before it hits Prisma.
//
// Wire format (what the editor UI sends):
//   {
//     id: string,            // primary key; matches legacy "pony-001" style
//     name: string,
//     price: number,         // dollars (UI-facing). Stored as priceCents in DB.
//     originalPrice?: number | null,
//     discount?: number,
//     description: string,
//     shortDescription: string,
//     category: string,
//     subcategory?: string | null,
//     tags?: string[],
//     imageUrl: string,
//     images?: string[],
//     inStock?: boolean,
//     stockCount?: number,
//     rating?: number,
//     reviewCount?: number,
//     isSale?: boolean,
//     isFeatured?: boolean,
//     isComingSoon?: boolean,
//     availableOnWebsite?: boolean,
//     sku: string,
//     audioPreviewUrl?: string | null,
//     isAudiobook?: boolean,
//     isStudyGuide?: boolean,
//     studyGuideUrl?: string | null,
//     downloadUrl?: string | null,
//     reviews?: Review[] | null
//   }

import type { Product } from '@/types';

export interface ProductWriteInput {
  id?: string;
  name?: unknown;
  price?: unknown;
  originalPrice?: unknown;
  discount?: unknown;
  description?: unknown;
  shortDescription?: unknown;
  category?: unknown;
  subcategory?: unknown;
  tags?: unknown;
  imageUrl?: unknown;
  images?: unknown;
  inStock?: unknown;
  stockCount?: unknown;
  rating?: unknown;
  reviewCount?: unknown;
  isSale?: unknown;
  isFeatured?: unknown;
  isComingSoon?: unknown;
  availableOnWebsite?: unknown;
  sku?: unknown;
  audioPreviewUrl?: unknown;
  isAudiobook?: unknown;
  isStudyGuide?: unknown;
  studyGuideUrl?: unknown;
  downloadUrl?: unknown;
  reviews?: unknown;
}

export interface NormalizedProductInput {
  id: string;
  name: string;
  priceCents: number;
  originalPriceCents: number | null;
  discount: number;
  description: string;
  shortDescription: string;
  category: string;
  subcategory: string | null;
  tags: string[];
  imageUrl: string;
  images: string[];
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
}

function asString(v: unknown, max = 5000): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}
function asOptionalString(v: unknown, max = 5000): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed === '' ? null : trimmed.slice(0, max);
}
function asBool(v: unknown, fallback = false): boolean {
  return typeof v === 'boolean' ? v : fallback;
}
function asInt(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}
function asFloat(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === 'string').map((x) => (x as string).slice(0, 200));
}
function priceToCents(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}
function optionalPriceToCents(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

// Normalizes raw POST/PUT input. Throws on missing required fields. Caller
// should catch and 400 with the message.
export function normalizeProductInput(input: ProductWriteInput, idFromUrl?: string): NormalizedProductInput {
  const id = (idFromUrl ?? input.id ?? '').toString().trim();
  if (!id) throw new Error('Product id is required');

  const name = asString(input.name, 300).trim();
  if (!name) throw new Error('Product name is required');

  const sku = asString(input.sku, 100).trim();
  if (!sku) throw new Error('Product sku is required');

  const description = asString(input.description, 10000).trim();
  const shortDescription = asString(input.shortDescription, 500).trim();
  const category = asString(input.category, 100).trim() || 'uncategorized';

  return {
    id,
    name,
    priceCents: priceToCents(input.price),
    originalPriceCents: optionalPriceToCents(input.originalPrice),
    discount: Math.max(0, Math.min(100, asInt(input.discount, 0))),
    description,
    shortDescription,
    category,
    subcategory: asOptionalString(input.subcategory, 100),
    tags: asStringArray(input.tags),
    imageUrl: asString(input.imageUrl, 500).trim(),
    images: asStringArray(input.images),
    inStock: asBool(input.inStock, true),
    stockCount: Math.max(0, asInt(input.stockCount, 0)),
    rating: Math.max(0, Math.min(5, asFloat(input.rating, 0))),
    reviewCount: Math.max(0, asInt(input.reviewCount, 0)),
    isSale: asBool(input.isSale, false),
    isFeatured: asBool(input.isFeatured, false),
    isComingSoon: asBool(input.isComingSoon, false),
    availableOnWebsite: asBool(input.availableOnWebsite, true),
    sku,
    audioPreviewUrl: asOptionalString(input.audioPreviewUrl, 500),
    isAudiobook: asBool(input.isAudiobook, false),
    isStudyGuide: asBool(input.isStudyGuide, false),
    studyGuideUrl: asOptionalString(input.studyGuideUrl, 500),
    downloadUrl: asOptionalString(input.downloadUrl, 500),
    reviews: input.reviews ?? null,
  };
}

// Adapter: convert a legacy Product (price in dollars) to a normalized input.
// Used by the seed endpoint to slurp `data/products.json` straight in.
export function legacyProductToInput(p: Product): NormalizedProductInput {
  return normalizeProductInput({
    id: p.id,
    name: p.name,
    price: p.price,
    originalPrice: p.originalPrice ?? null,
    discount: p.discount ?? 0,
    description: p.description,
    shortDescription: p.shortDescription,
    category: p.category,
    subcategory: p.subcategory ?? null,
    tags: p.tags,
    imageUrl: p.imageUrl,
    images: p.images,
    inStock: p.inStock,
    stockCount: p.stockCount,
    rating: p.rating,
    reviewCount: p.reviewCount,
    isSale: p.isSale,
    isFeatured: p.isFeatured,
    isComingSoon: p.isComingSoon ?? false,
    availableOnWebsite: p.availableOnWebsite,
    sku: p.sku,
    audioPreviewUrl: p.audioPreviewUrl ?? null,
    isAudiobook: p.isAudiobook ?? false,
    isStudyGuide: p.isStudyGuide ?? false,
    studyGuideUrl: p.studyGuideUrl ?? null,
    downloadUrl: p.downloadUrl ?? null,
    reviews: p.reviews ?? null,
  });
}
