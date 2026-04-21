import { Page } from "@playwright/test";
import { STORAGE_KEYS } from "../fixtures/test-data";

interface CartProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  quantity?: number;
}

// Injects a product into the cart via localStorage before page load
export async function addProductToCartViaStorage(page: Page, product: CartProduct) {
  const quantity = product.quantity ?? 1;
  const cartItems = [
    {
      productId: product.id,
      product: {
        id: product.id,
        name: product.name,
        price: product.price,
        originalPrice: product.price,
        category: product.category,
        description: "Test product",
        shortDescription: "Test",
        tags: [],
        imageUrl: "/images/pony-001.svg",
        inStock: true,
        stockCount: 100,
        rating: 4.5,
        reviewCount: 10,
        isSale: false,
        isFeatured: true,
        availableOnWebsite: true,
        sku: "TEST-001",
      },
      quantity,
    },
  ];

  // Use addInitScript so localStorage is set before React hydration
  await page.addInitScript(({ key, items }) => {
    localStorage.setItem(key, JSON.stringify(items));
  }, { key: STORAGE_KEYS.cart, items: cartItems });
}

// Navigates to a page with cart pre-populated (use this instead of separate add + goto)
export async function gotoWithCart(page: Page, url: string, product: CartProduct) {
  await addProductToCartViaStorage(page, product);
  await page.goto(url);
  // Wait for React to hydrate and read localStorage
  await page.waitForTimeout(500);
}

export async function clearCartViaStorage(page: Page) {
  await page.evaluate((key) => {
    localStorage.removeItem(key);
  }, STORAGE_KEYS.cart);
}
