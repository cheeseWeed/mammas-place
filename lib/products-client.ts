// Client-only product helpers — operate on a Product[] already fetched from
// `/api/products`. Lets client components keep the old filter/search API
// shape (sync, in-memory) without importing prisma. Same logic as the
// pre-DB version of lib/products.ts, just parameterized by the input list.
//
// React-side fetch hook is below — pages call useProducts() to lazy-load
// the catalog on mount, then pipe the array through these helpers.

'use client';

import { useEffect, useState } from 'react';
import type { Product } from '@/types';

// ---- Category visibility (client-side localStorage; UI concern) --------
// Lived in lib/products.ts originally but that file now imports prisma,
// so any 'use client' code that needs this had to be moved here.
export function getHiddenCategories(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem('hiddenCategories');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function setHiddenCategories(categories: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('hiddenCategories', JSON.stringify(categories));
  } catch (err) {
    console.error('Failed to save hidden categories:', err);
  }
}

export function toggleCategoryVisibility(category: string): void {
  const hidden = getHiddenCategories();
  if (hidden.includes(category)) {
    setHiddenCategories(hidden.filter((c) => c !== category));
  } else {
    setHiddenCategories([...hidden, category]);
  }
}

export function isCategoryHidden(category: string): boolean {
  return getHiddenCategories().includes(category);
}

// ---- Pure filters (sync, no React, no fetch) ----------------------------
export function filterAvailable(products: Product[]): Product[] {
  return products.filter((p) => p.availableOnWebsite === true);
}

export function filterByCategory(products: Product[], category: string): Product[] {
  return filterAvailable(products).filter((p) => p.category === category);
}

export function filterSale(products: Product[]): Product[] {
  return filterAvailable(products).filter((p) => p.isSale);
}

export function filterFeatured(products: Product[]): Product[] {
  return filterAvailable(products).filter((p) => p.isFeatured);
}

export function findById(products: Product[], id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

export function searchClient(products: Product[], query: string): Product[] {
  const q = query.toLowerCase().trim();
  if (!q) return filterAvailable(products);
  return filterAvailable(products).filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q)),
  );
}

export function relatedClient(
  products: Product[],
  product: Product,
  limit = 4,
): Product[] {
  return filterAvailable(products)
    .filter(
      (p) =>
        p.id !== product.id &&
        (p.category === product.category ||
          p.tags.some((tag) => product.tags.includes(tag))),
    )
    .slice(0, limit);
}

export function categoriesFromProducts(products: Product[]): string[] {
  return [...new Set(filterAvailable(products).map((p) => p.category))];
}

export function subcategoriesFromProducts(
  products: Product[],
  category: string,
): string[] {
  return [
    ...new Set(
      filterAvailable(products)
        .filter((p) => p.category === category && p.subcategory)
        .map((p) => p.subcategory!),
    ),
  ];
}

export function categorySubcategoryMapFromProducts(
  products: Product[],
  hiddenCategories: string[] = [],
): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  const cats = categoriesFromProducts(products).filter(
    (c) => !hiddenCategories.includes(c),
  );
  for (const cat of cats) {
    map[cat] = subcategoriesFromProducts(products, cat);
  }
  return map;
}

// ---- React hook ---------------------------------------------------------
// Fetches the full catalog once per page mount. The catalog isn't huge
// (hundreds of rows), so we keep it in module-level memo to avoid duplicate
// fetches across mount/unmount cycles on the same page. Calls
// `refresh()` to force a re-fetch (used after admin edits).
let _cache: Product[] | null = null;
let _inflight: Promise<Product[]> | null = null;

async function fetchAll(): Promise<Product[]> {
  if (_cache) return _cache;
  if (_inflight) return _inflight;
  _inflight = fetch('/api/products', { cache: 'no-store' })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data: { products?: Product[] }) => {
      const list = Array.isArray(data.products) ? data.products : [];
      _cache = list;
      return list;
    })
    .finally(() => {
      _inflight = null;
    });
  return _inflight;
}

export function invalidateProductsCache(): void {
  _cache = null;
}

export function useProducts(): {
  products: Product[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const [products, setProducts] = useState<Product[]>(_cache ?? []);
  const [loading, setLoading] = useState<boolean>(_cache === null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchAll();
      setProducts(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (_cache) return; // already have it
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = async () => {
    invalidateProductsCache();
    await load();
  };

  return { products, loading, error, refresh };
}
