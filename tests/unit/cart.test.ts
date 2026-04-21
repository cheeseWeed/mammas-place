import { describe, it, expect, beforeEach } from "vitest";
import { addToCart, removeFromCart, updateQuantity, clearCart, getCart, applyPromoCode } from "@/lib/cart";
import { Product } from "@/types";

// Reusable test product
const mockProduct: Product = {
  id: "test-001",
  name: "Test Pony",
  price: 24.99,
  originalPrice: 29.99,
  description: "A test product",
  shortDescription: "Test",
  category: "toys-and-games",
  tags: ["test"],
  imageUrl: "/test.png",
  images: [],
  inStock: true,
  stockCount: 50,
  rating: 4.5,
  reviewCount: 10,
  isSale: true,
  isFeatured: false,
  createdAt: "2026-01-01",
  availableOnWebsite: true,
  sku: "TEST-001",
};

// Second product for multi-item tests
const mockProduct2: Product = {
  ...mockProduct,
  id: "test-002",
  name: "Test Unicorn",
  price: 19.99,
  originalPrice: 19.99,
  isSale: false,
};

describe("Cart - Core Operations", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts with an empty cart", () => {
    const cart = getCart();
    expect(cart.items).toHaveLength(0);
    expect(cart.subtotal).toBe(0);
    expect(cart.total).toBe(0);
  });

  it("adds a product to the cart", () => {
    const cart = addToCart(mockProduct, 1);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].productId).toBe("test-001");
    expect(cart.items[0].quantity).toBe(1);
  });

  it("increments quantity when adding the same product twice", () => {
    addToCart(mockProduct, 1);
    const cart = addToCart(mockProduct, 2);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(3);
  });

  it("adds multiple different products", () => {
    addToCart(mockProduct, 1);
    const cart = addToCart(mockProduct2, 1);
    expect(cart.items).toHaveLength(2);
  });

  it("removes a product from the cart", () => {
    addToCart(mockProduct, 1);
    addToCart(mockProduct2, 1);
    const cart = removeFromCart("test-001");
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].productId).toBe("test-002");
  });

  it("updates product quantity", () => {
    addToCart(mockProduct, 1);
    const cart = updateQuantity("test-001", 5);
    expect(cart.items[0].quantity).toBe(5);
  });

  it("removes product when quantity is set to 0", () => {
    addToCart(mockProduct, 3);
    const cart = updateQuantity("test-001", 0);
    expect(cart.items).toHaveLength(0);
  });

  it("clears the entire cart", () => {
    addToCart(mockProduct, 2);
    addToCart(mockProduct2, 3);
    const cart = clearCart();
    expect(cart.items).toHaveLength(0);
    expect(cart.subtotal).toBe(0);
  });

  it("persists cart to localStorage", () => {
    addToCart(mockProduct, 1);
    const raw = localStorage.getItem("mammas-place-cart");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].productId).toBe("test-001");
  });

  it("restores cart from localStorage", () => {
    addToCart(mockProduct, 2);
    const cart = getCart();
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(2);
  });
});

describe("Cart - Price Calculations", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("calculates correct subtotal", () => {
    const cart = addToCart(mockProduct, 2);
    // 24.99 * 2 = 49.98
    expect(cart.subtotal).toBeCloseTo(49.98, 2);
  });

  it("calculates 8% tax on subtotal", () => {
    const cart = addToCart(mockProduct, 2);
    // 49.98 * 0.08 = 3.9984
    expect(cart.tax).toBeCloseTo(49.98 * 0.08, 2);
  });

  it("charges $5.99 shipping under $50", () => {
    const cart = addToCart(mockProduct, 1);
    // 24.99 < 50
    expect(cart.shipping).toBe(5.99);
  });

  it("gives free shipping over $50", () => {
    const cart = addToCart(mockProduct, 3);
    // 24.99 * 3 = 74.97 > 50
    expect(cart.shipping).toBe(0);
  });

  it("calculates correct total (subtotal + tax + shipping)", () => {
    const cart = addToCart(mockProduct, 1);
    const expectedTotal = cart.subtotal + cart.tax + cart.shipping;
    expect(cart.total).toBeCloseTo(expectedTotal, 2);
  });

  it("calculates item discount from sale prices", () => {
    const cart = addToCart(mockProduct, 1);
    // originalPrice (29.99) - price (24.99) = 5.00 savings
    expect(cart.discount).toBeCloseTo(5.0, 2);
  });

  it("shows zero discount for non-sale items", () => {
    const cart = addToCart(mockProduct2, 1);
    expect(cart.discount).toBe(0);
  });
});

describe("Cart - Promo Codes", () => {
  it("MAMMA10 gives 10% discount", () => {
    expect(applyPromoCode("MAMMA10")).toBe(0.1);
  });

  it("PRINCESS20 gives 20% discount", () => {
    expect(applyPromoCode("PRINCESS20")).toBe(0.2);
  });

  it("UNICORN15 gives 15% discount", () => {
    expect(applyPromoCode("UNICORN15")).toBe(0.15);
  });

  it("PONY25 gives 25% discount", () => {
    expect(applyPromoCode("PONY25")).toBe(0.25);
  });

  it("SAVE30 gives 30% discount", () => {
    expect(applyPromoCode("SAVE30")).toBe(0.3);
  });

  it("is case-insensitive", () => {
    expect(applyPromoCode("mamma10")).toBe(0.1);
    expect(applyPromoCode("Pony25")).toBe(0.25);
  });

  it("returns 0 for invalid codes", () => {
    expect(applyPromoCode("FAKECODE")).toBe(0);
    expect(applyPromoCode("")).toBe(0);
    expect(applyPromoCode("MAMMA11")).toBe(0);
  });
});
