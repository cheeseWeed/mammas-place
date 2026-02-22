import productsData from '@/data/products.json';
import { Product } from '@/types';

const products: Product[] = productsData as Product[];

// Category visibility management
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
    setHiddenCategories(hidden.filter(c => c !== category));
  } else {
    setHiddenCategories([...hidden, category]);
  }
}

export function isCategoryHidden(category: string): boolean {
  return getHiddenCategories().includes(category);
}

export function getAllCategories(): string[] {
  return [...new Set(getAvailableProducts().map((p) => p.category))];
}

export function getVisibleCategories(): string[] {
  const allCategories = getAllCategories();
  const hidden = getHiddenCategories();
  return allCategories.filter(cat => !hidden.includes(cat));
}

export function getAvailableProducts(): Product[] {
  return products.filter((p) => p.availableOnWebsite === true);
}

export function getPublishedProducts(): Product[] {
  return getAvailableProducts();
}

export function getAllProducts(): Product[] {
  const hidden = getHiddenCategories();
  return getAvailableProducts().filter(p => !hidden.includes(p.category));
}

export function getAllProductsIncludingUnavailable(): Product[] {
  return products;
}

export function getProductById(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

export function getProductsByCategory(category: string): Product[] {
  return getAvailableProducts().filter((p) => p.category === category);
}

export function getRelatedProducts(product: Product, limit = 4): Product[] {
  return getAvailableProducts()
    .filter(
      (p) =>
        p.id !== product.id &&
        (p.category === product.category ||
          p.tags.some((tag) => product.tags.includes(tag)))
    )
    .slice(0, limit);
}

export function getSaleProducts(): Product[] {
  return getAvailableProducts().filter((p) => p.isSale);
}

export function getFeaturedProducts(): Product[] {
  return getAvailableProducts().filter((p) => p.isFeatured);
}

export function searchProducts(query: string): Product[] {
  const q = query.toLowerCase();
  return getAvailableProducts().filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.tags.some((tag) => tag.toLowerCase().includes(q))
  );
}

export function getCategories(): string[] {
  return getVisibleCategories();
}

export function getSubcategoriesByCategory(category: string): string[] {
  return [
    ...new Set(
      getAvailableProducts()
        .filter((p) => p.category === category && p.subcategory)
        .map((p) => p.subcategory!)
    ),
  ];
}

export function getCategorySubcategoryMap(): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  const cats = getCategories();
  cats.forEach((cat) => {
    map[cat] = getSubcategoriesByCategory(cat);
  });
  return map;
}

export function getProductsBySkus(skus: string[]): Product[] {
  return products.filter((p) => skus.includes(p.sku));
}

export function getAudiobooks(): Product[] {
  return getAvailableProducts().filter((p) => p.isAudiobook === true);
}

export function getComingSoonProducts(): Product[] {
  const hidden = getHiddenCategories();
  return products.filter((p) => p.isComingSoon === true && !hidden.includes(p.category));
}
