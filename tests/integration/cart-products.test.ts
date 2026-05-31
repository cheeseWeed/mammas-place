import { describe, it, expect, beforeEach } from "vitest";
import { addToCart, getCart, clearCart, applyPromoCode } from "@/lib/cart";
import productsJson from "@/data/products.json";
import type { Product } from "@/types";
import {
  filterAvailable,
  filterSale,
  findById,
} from "@/lib/products-client";

// lib/products.ts is now async + DB-backed (Prisma against Neon). For unit
// tests we operate on the static `data/products.json` snapshot using the
// pure sync helpers in lib/products-client.ts. Behaviour mirrors the old
// in-memory catalog so the cart math tests still exercise the same flow.
const CATALOG: Product[] = productsJson as Product[];
const getProductById = (id: string) => findById(CATALOG, id);
const getSaleProducts = () => filterSale(CATALOG);
const getAvailableProducts = () => filterAvailable(CATALOG);

describe("Integration: Cart + Products", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("adds a real product from the catalog to the cart", () => {
    const product = getProductById("pony-001");
    expect(product).toBeDefined();

    const cart = addToCart(product!, 1);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].product.name).toBe("Rainbow Sparkle Pony");
    expect(cart.subtotal).toBe(product!.price);
  });

  it("correctly calculates cart total with real product prices", () => {
    const product = getProductById("pony-001");
    const cart = addToCart(product!, 2);

    const expectedSubtotal = product!.price * 2;
    const expectedTax = expectedSubtotal * 0.08;
    const expectedShipping = expectedSubtotal > 50 ? 0 : 5.99;

    expect(cart.subtotal).toBeCloseTo(expectedSubtotal, 2);
    expect(cart.tax).toBeCloseTo(expectedTax, 2);
    expect(cart.shipping).toBe(expectedShipping);
  });

  it("handles adding multiple real products", () => {
    const products = getAvailableProducts().slice(0, 3);
    for (const p of products) {
      addToCart(p, 1);
    }
    const cart = getCart();
    expect(cart.items).toHaveLength(3);

    // Subtotal should be sum of all product prices
    const expectedSubtotal = products.reduce((sum, p) => sum + p.price, 0);
    expect(cart.subtotal).toBeCloseTo(expectedSubtotal, 2);
  });

  it("calculates sale discount correctly for real sale products", () => {
    const saleProducts = getSaleProducts();
    expect(saleProducts.length).toBeGreaterThan(0);

    const saleProduct = saleProducts[0];
    const cart = addToCart(saleProduct, 1);

    if (saleProduct.originalPrice) {
      const expectedDiscount = saleProduct.originalPrice - saleProduct.price;
      expect(cart.discount).toBeCloseTo(expectedDiscount, 2);
    }
  });

  it("promo code applies correct percentage to real cart total", () => {
    const product = getProductById("pony-001");
    const cart = addToCart(product!, 1);

    const discount = applyPromoCode("SAVE30");
    const promoSavings = cart.subtotal * discount;

    expect(discount).toBe(0.3);
    expect(promoSavings).toBeCloseTo(cart.subtotal * 0.3, 2);
  });

  it("free shipping threshold works with real prices", () => {
    // Add cheap item — should have shipping
    const products = getAvailableProducts();
    const cheapProduct = products.find((p) => p.price < 25);
    expect(cheapProduct).toBeDefined();

    let cart = addToCart(cheapProduct!, 1);
    expect(cart.shipping).toBe(5.99);

    // Add more to cross $50 threshold
    clearCart();
    cart = addToCart(cheapProduct!, 1);
    const expensiveProduct = products.find((p) => p.price >= 50);
    if (expensiveProduct) {
      cart = addToCart(expensiveProduct, 1);
      expect(cart.shipping).toBe(0);
    }
  });

  it("cart persists and restores real products correctly", () => {
    const product = getProductById("pony-001");
    addToCart(product!, 3);

    // Read back from localStorage
    const restoredCart = getCart();
    expect(restoredCart.items).toHaveLength(1);
    expect(restoredCart.items[0].product.name).toBe("Rainbow Sparkle Pony");
    expect(restoredCart.items[0].quantity).toBe(3);
  });
});
