import { describe, it, expect } from "vitest";
import productsJson from "@/data/products.json";
import type { Product } from "@/types";
import {
  filterAvailable,
  filterSale,
  filterFeatured,
  findById,
  searchClient,
  relatedClient,
  subcategoriesFromProducts,
} from "@/lib/products-client";

// The DB-backed lib/products.ts is async + needs a real Prisma connection.
// For unit tests we exercise the same logic against the in-repo static catalog
// (data/products.json) using the pure helpers in lib/products-client.ts.
const ALL: Product[] = productsJson as Product[];

function getAvailableProducts() {
  return filterAvailable(ALL);
}
function getAllProductsIncludingUnavailable() {
  return ALL;
}
function getProductById(id: string) {
  return findById(ALL, id);
}
function getProductsByCategory(category: string) {
  return filterAvailable(ALL).filter((p) => p.category === category);
}
function getSaleProducts() {
  return filterSale(ALL);
}
function getFeaturedProducts() {
  return filterFeatured(ALL);
}
function searchProducts(q: string) {
  return searchClient(ALL, q);
}
function getRelatedProducts(p: Product, limit?: number) {
  return relatedClient(ALL, p, limit);
}
function getSubcategoriesByCategory(category: string) {
  return subcategoriesFromProducts(ALL, category);
}
function getAudiobooks() {
  return filterAvailable(ALL).filter((p) => p.isAudiobook === true);
}

describe("Products - Data Integrity", () => {
  it("loads products from JSON data", () => {
    const products = getAvailableProducts();
    expect(products.length).toBeGreaterThan(0);
  });

  it("all available products have required fields", () => {
    const products = getAvailableProducts();
    for (const p of products) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.price).toBeGreaterThanOrEqual(0);
      expect(p.category).toBeTruthy();
      expect(typeof p.inStock).toBe("boolean");
      expect(typeof p.rating).toBe("number");
    }
  });

  it("all products have valid ratings between 0 and 5", () => {
    const products = getAvailableProducts();
    for (const p of products) {
      expect(p.rating).toBeGreaterThanOrEqual(0);
      expect(p.rating).toBeLessThanOrEqual(5);
    }
  });

  it("sale products have a price lower than or equal to originalPrice", () => {
    const saleProducts = getSaleProducts();
    for (const p of saleProducts) {
      if (p.originalPrice) {
        expect(p.price).toBeLessThanOrEqual(p.originalPrice);
      }
    }
  });
});

describe("Products - Lookup Functions", () => {
  it("finds a product by ID", () => {
    const product = getProductById("pony-001");
    expect(product).toBeDefined();
    expect(product!.name).toBe("Rainbow Sparkle Pony");
  });

  it("returns undefined for nonexistent product ID", () => {
    const product = getProductById("nonexistent-999");
    expect(product).toBeUndefined();
  });

  it("filters products by category", () => {
    const products = getProductsByCategory("toys-and-games");
    expect(products.length).toBeGreaterThan(0);
    for (const p of products) {
      expect(p.category).toBe("toys-and-games");
    }
  });

  it("returns empty array for nonexistent category", () => {
    const products = getProductsByCategory("nonexistent-category");
    expect(products).toHaveLength(0);
  });
});

describe("Products - Filtering Functions", () => {
  it("returns sale products", () => {
    const products = getSaleProducts();
    expect(products.length).toBeGreaterThan(0);
    for (const p of products) {
      expect(p.isSale).toBe(true);
    }
  });

  it("returns featured products", () => {
    const products = getFeaturedProducts();
    expect(products.length).toBeGreaterThan(0);
    for (const p of products) {
      expect(p.isFeatured).toBe(true);
    }
  });

  it("only returns website-available products", () => {
    const available = getAvailableProducts();
    const all = getAllProductsIncludingUnavailable();
    // Available should be a subset
    expect(available.length).toBeLessThanOrEqual(all.length);
    for (const p of available) {
      expect(p.availableOnWebsite).toBe(true);
    }
  });
});

describe("Products - Search", () => {
  it("finds products by name", () => {
    const results = searchProducts("pony");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((p) => p.name.toLowerCase().includes("pony"))).toBe(true);
  });

  it("search is case-insensitive", () => {
    const lower = searchProducts("pony");
    const upper = searchProducts("PONY");
    expect(lower.length).toBe(upper.length);
  });

  it("finds products by category name", () => {
    const results = searchProducts("automotive");
    expect(results.length).toBeGreaterThan(0);
  });

  it("finds products by tag", () => {
    const results = searchProducts("kids");
    expect(results.length).toBeGreaterThan(0);
  });

  it("returns empty array for nonsense query", () => {
    const results = searchProducts("xyznonexistent12345");
    expect(results).toHaveLength(0);
  });
});

describe("Products - Related Products", () => {
  it("returns related products for a given product", () => {
    const product = getProductById("pony-001");
    expect(product).toBeDefined();
    const related = getRelatedProducts(product!);
    expect(related.length).toBeGreaterThan(0);
  });

  it("does not include the original product in related", () => {
    const product = getProductById("pony-001");
    const related = getRelatedProducts(product!);
    expect(related.find((p) => p.id === "pony-001")).toBeUndefined();
  });

  it("respects the limit parameter", () => {
    const product = getProductById("pony-001");
    const related = getRelatedProducts(product!, 2);
    expect(related.length).toBeLessThanOrEqual(2);
  });
});

describe("Products - Subcategories", () => {
  it("returns subcategories for a category", () => {
    const subs = getSubcategoriesByCategory("toys-and-games");
    expect(subs.length).toBeGreaterThan(0);
  });

  it("returns empty for category with no subcategories", () => {
    const subs = getSubcategoriesByCategory("nonexistent-category");
    expect(subs).toHaveLength(0);
  });
});

describe("Products - Audiobooks", () => {
  it("returns audiobook products", () => {
    const audiobooks = getAudiobooks();
    for (const p of audiobooks) {
      expect(p.isAudiobook).toBe(true);
    }
  });
});
