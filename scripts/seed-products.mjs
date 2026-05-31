// One-shot products seeder — slurps data/products.json into the `products`
// Prisma table. Safe to re-run (uses upsert). Mirrors POST /api/admin/products/seed
// for the case where the parent wants to bootstrap WITHOUT logging in.
//
// Usage:
//   node scripts/seed-products.mjs
//
// Requires DATABASE_URL in env (Neon connection string — same one prisma uses).

import { PrismaClient } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

function priceToCents(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}
function optionalPriceToCents(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function legacyToInput(p) {
  return {
    id: p.id,
    name: p.name,
    priceCents: priceToCents(p.price),
    originalPriceCents: optionalPriceToCents(p.originalPrice),
    discount: Number(p.discount) || 0,
    description: p.description ?? '',
    shortDescription: p.shortDescription ?? '',
    category: p.category ?? 'uncategorized',
    subcategory: p.subcategory ?? null,
    tags: Array.isArray(p.tags) ? p.tags : [],
    imageUrl: p.imageUrl ?? '',
    images: Array.isArray(p.images) ? p.images : [],
    inStock: typeof p.inStock === 'boolean' ? p.inStock : true,
    stockCount: Number(p.stockCount) || 0,
    rating: Number(p.rating) || 0,
    reviewCount: Number(p.reviewCount) || 0,
    isSale: !!p.isSale,
    isFeatured: !!p.isFeatured,
    isComingSoon: !!p.isComingSoon,
    availableOnWebsite: p.availableOnWebsite !== false,
    sku: p.sku,
    audioPreviewUrl: p.audioPreviewUrl ?? null,
    isAudiobook: !!p.isAudiobook,
    isStudyGuide: !!p.isStudyGuide,
    studyGuideUrl: p.studyGuideUrl ?? null,
    downloadUrl: p.downloadUrl ?? null,
    reviews: p.reviews ?? null,
  };
}

const prisma = new PrismaClient();
try {
  const raw = await readFile(resolve(REPO_ROOT, 'data/products.json'), 'utf-8');
  const list = JSON.parse(raw);
  let seeded = 0;
  let failed = 0;
  for (const p of list) {
    try {
      const data = legacyToInput(p);
      const { id, ...rest } = data;
      await prisma.product.upsert({
        where: { id },
        create: data,
        update: rest,
      });
      seeded++;
    } catch (err) {
      failed++;
      console.error('FAILED', p.id, err.message);
    }
  }
  console.log(`Done. Seeded ${seeded} / ${list.length} products. Failures: ${failed}.`);
} finally {
  await prisma.$disconnect();
}
