import { test, expect } from "./fixtures/base.fixture";

test.describe("Home Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("displays hero banner with shop now button", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /welcome|mamma/i })).toBeVisible();
    const shopNow = page.getByRole("link", { name: /shop now/i });
    await expect(shopNow).toBeVisible();
    await expect(shopNow).toHaveAttribute("href", /\/shop/);
  });

  test("shows category cards that link to shop", async ({ page }) => {
    const categoryLinks = page.locator('a[href*="/shop?category="]');
    await expect(categoryLinks.first()).toBeVisible();
    const count = await categoryLinks.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("clicking a category navigates to filtered shop", async ({ page }) => {
    const firstCategory = page.locator('a[href*="/shop?category="]').first();
    await firstCategory.click();
    await expect(page).toHaveURL(/\/shop\?category=/);
  });

  test("displays featured products section", async ({ page }) => {
    await expect(page.getByText(/featured/i).first()).toBeVisible();
  });

  test("displays sale products section", async ({ page }) => {
    const saleSection = page.getByText(/sale/i).first();
    await expect(saleSection).toBeVisible();
  });

  test("view sales button links to sale items", async ({ page }) => {
    const viewSales = page.getByRole("link", { name: /view.*sale/i }).first();
    if (await viewSales.isVisible()) {
      await expect(viewSales).toHaveAttribute("href", /sale=true/);
    }
  });

  test("promo codes are displayed", async ({ page }) => {
    await expect(page.getByText("MAMMA10")).toBeVisible();
  });
});
