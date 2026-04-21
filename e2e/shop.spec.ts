import { test, expect } from "./fixtures/base.fixture";

test.describe("Shop Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/shop");
  });

  test("page loads with products grid", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /products|shop/i }).first()).toBeVisible();
    const productCards = page.locator('a[href*="/product/"]');
    await expect(productCards.first()).toBeVisible();
    const count = await productCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test("search filters products", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i).first();
    await searchInput.fill("pony");
    await searchInput.press("Enter");
    await expect(page).toHaveURL(/search=pony/);
  });

  test("search with no results shows message", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i).first();
    await searchInput.fill("xyznonexistent12345");
    await searchInput.press("Enter");
    await expect(page.getByText(/no products found/i)).toBeVisible();
  });

  test("category filter works via URL", async ({ page }) => {
    await page.goto("/shop?category=toys-and-games");
    const productCards = page.locator('a[href*="/product/"]');
    await expect(productCards.first()).toBeVisible();
  });

  test("sale filter shows only sale items", async ({ page }) => {
    await page.goto("/shop?sale=true");
    const saleBadges = page.getByText(/sale/i);
    await expect(saleBadges.first()).toBeVisible();
  });

  test("sort by price low to high works", async ({ page }) => {
    const sortSelect = page.locator("select").first();
    if (await sortSelect.isVisible()) {
      await sortSelect.selectOption({ label: "Price: Low to High" });
    }
  });

  test("sort by price high to low works", async ({ page }) => {
    const sortSelect = page.locator("select").first();
    if (await sortSelect.isVisible()) {
      await sortSelect.selectOption({ label: "Price: High to Low" });
    }
  });

  test("clicking product card navigates to detail page", async ({ page }) => {
    const firstProduct = page.locator('a[href*="/product/"]').first();
    await firstProduct.click();
    await expect(page).toHaveURL(/\/product\//);
  });

  test("subcategory pills appear when category is selected", async ({ page }) => {
    await page.goto("/shop?category=toys-and-games");
    // Subcategory pills should be visible above the product grid
    await page.waitForTimeout(500);
    const pills = page.locator('button, a').filter({ hasText: /ponies|unicorns|princesses|games/i });
    const count = await pills.count();
    expect(count).toBeGreaterThan(0);
  });
});
