import { test, expect } from "./fixtures/base.fixture";

test.describe("Static Pages", () => {
  test("about page loads with content", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByRole("heading").first()).toBeVisible();
    await expect(page.getByText(/mamma/i).first()).toBeVisible();
  });

  test("about page has navigation links", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByRole("link", { name: /shop|products/i }).first()).toBeVisible();
  });

  test("FAQ page loads with categories", async ({ page }) => {
    await page.goto("/faq");
    await expect(page.getByText(/shipping/i).first()).toBeVisible();
    await expect(page.getByText(/returns/i).first()).toBeVisible();
    await expect(page.getByText(/payment/i).first()).toBeVisible();
  });

  test("shipping page loads with policy info", async ({ page }) => {
    await page.goto("/shipping");
    await expect(page.getByText(/free shipping/i).first()).toBeVisible();
    await expect(page.getByText(/\$50/i).first()).toBeVisible();
  });

  test("shipping page shows return policy", async ({ page }) => {
    await page.goto("/shipping");
    await expect(page.getByText(/30.*day/i).first()).toBeVisible();
  });
});
