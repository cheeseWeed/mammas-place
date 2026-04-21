import { test, expect } from "./fixtures/base.fixture";
import { addProductToCartViaStorage } from "./helpers/cart.helpers";
import { PRODUCTS } from "./fixtures/test-data";

test.describe("Navigation", () => {
  test("header logo links to home", async ({ page }) => {
    await page.goto("/shop");
    const logo = page.getByRole("link", { name: /mamma/i }).first();
    await logo.click();
    await expect(page).toHaveURL("/");
  });

  test("header shop link navigates to shop", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /shop/i }).first().click();
    await expect(page).toHaveURL(/\/shop/);
  });

  test("header cart link navigates to cart", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /cart/i }).first().click();
    await expect(page).toHaveURL("/cart");
  });

  test("cart badge shows item count", async ({ page }) => {
    await addProductToCartViaStorage(page, {
      id: PRODUCTS.regular.id,
      name: PRODUCTS.regular.name,
      price: PRODUCTS.regular.price,
      category: PRODUCTS.regular.category,
    });
    await page.goto("/");
    // Cart badge should show "1"
    await expect(page.getByText("1").first()).toBeVisible();
  });

  test("footer has about link", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    await expect(footer.getByRole("link", { name: /about/i })).toBeVisible();
  });

  test("footer has contact link", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    await expect(footer.getByRole("link", { name: /contact/i })).toBeVisible();
  });
});
