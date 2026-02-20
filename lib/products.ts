import productsData from '@/data/products.json';
import { Product } from '@/types';

const products: Product[] = productsData as Product[];

export function getAvailableProducts(): Product[] {
  return products.filter((p) => p.availableOnWebsite === true);
}

export function getPublishedProducts(): Product[] {
  return getAvailableProducts();
}

export function getAllProducts(): Product[] {
  return getAvailableProducts();
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
  return [...new Set(getAvailableProducts().map((p) => p.category))];
}

export function getProductsBySkus(skus: string[]): Product[] {
  return products.filter((p) => skus.includes(p.sku));
}

export function getAudiobooks(): Product[] {
  return getAvailableProducts().filter((p) => p.isAudiobook === true);
}

export function getComingSoonProducts(): Product[] {
  return products.filter((p) => p.isComingSoon === true);
}
