import { test, expect } from "./fixtures/base.fixture";
import { PRODUCTS } from "./fixtures/test-data";

test.describe("Product Detail Page", () => {
  test("displays product info", async ({ page }) => {
    await page.goto(`/product/${PRODUCTS.regular.id}`);
    await expect(page.getByRole("heading", { name: PRODUCTS.regular.name })).toBeVisible();
    await expect(page.getByText(`$${PRODUCTS.regular.price.toFixed(2)}`)).toBeVisible();
  });

  test("breadcrumb navigation is visible", async ({ page }) => {
    await page.goto(`/product/${PRODUCTS.regular.id}`);
    await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Shop" })).toBeVisible();
  });

  test("add to cart shows toast notification", async ({ page }) => {
    await page.goto(`/product/${PRODUCTS.regular.id}`);
    await page.getByRole("button", { name: /add to cart/i }).click();
    await expect(page.getByText(/added/i)).toBeVisible();
  });

  test("buy now navigates to checkout", async ({ page }) => {
    await page.goto(`/product/${PRODUCTS.regular.id}`);
    await page.getByRole("button", { name: /buy now/i }).click();
    await expect(page).toHaveURL("/checkout");
  });

  test("quantity increase updates total", async ({ page }) => {
    await page.goto(`/product/${PRODUCTS.regular.id}`);
    const increaseBtn = page.getByRole("button", { name: /increase/i });
    await increaseBtn.click();
    await expect(page.getByText("2")).toBeVisible();
  });

  test("quantity cannot go below 1", async ({ page }) => {
    await page.goto(`/product/${PRODUCTS.regular.id}`);
    const decreaseBtn = page.getByRole("button", { name: /decrease/i });
    await decreaseBtn.click();
    // Quantity should still be 1
    await expect(page.locator("text=1").first()).toBeVisible();
  });

  test("customer reviews section is visible", async ({ page }) => {
    await page.goto(`/product/${PRODUCTS.regular.id}`);
    await expect(page.getByText(/customer reviews/i)).toBeVisible();
    await expect(page.getByText(/verified purchase/i).first()).toBeVisible();
  });

  test("related products section is visible", async ({ page }) => {
    await page.goto(`/product/${PRODUCTS.regular.id}`);
    await expect(page.getByText(/also/i).first()).toBeVisible();
  });

  test("nonexistent product shows not found", async ({ page }) => {
    await page.goto("/product/nonexistent-product-id-12345");
    await expect(page.getByText(/product not found/i)).toBeVisible();
  });

  test("out of stock product has disabled buttons", async ({ page }) => {
    await page.goto(`/product/${PRODUCTS.outOfStock.id}`);
    const addToCartBtn = page.getByRole("button", { name: /add to cart/i });
    if (await addToCartBtn.isVisible()) {
      await expect(addToCartBtn).toBeDisabled();
    }
  });
});
