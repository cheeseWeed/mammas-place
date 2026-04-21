import { test, expect } from "./fixtures/base.fixture";
import { gotoWithCart } from "./helpers/cart.helpers";
import { PRODUCTS } from "./fixtures/test-data";

const cartProduct = {
  id: PRODUCTS.regular.id,
  name: PRODUCTS.regular.name,
  price: PRODUCTS.regular.price,
  category: PRODUCTS.regular.category,
};

test.describe("Cart Page", () => {
  test("empty cart shows empty message", async ({ page }) => {
    await page.goto("/cart");
    await page.waitForTimeout(500);
    await expect(page.getByText(/cart is empty/i)).toBeVisible({ timeout: 10000 });
  });

  test("shows cart item when product is in cart", async ({ page }) => {
    await gotoWithCart(page, "/cart", cartProduct);
    await expect(page.getByText(PRODUCTS.regular.name)).toBeVisible({ timeout: 10000 });
  });

  test("increase quantity updates display", async ({ page }) => {
    await gotoWithCart(page, "/cart", cartProduct);
    await expect(page.getByText(PRODUCTS.regular.name)).toBeVisible({ timeout: 10000 });
    const increaseBtn = page.getByRole("button", { name: "+" }).first();
    await increaseBtn.click();
    await expect(page.getByText("2").first()).toBeVisible();
  });

  test("proceed to checkout navigates correctly", async ({ page }) => {
    await gotoWithCart(page, "/cart", cartProduct);
    await expect(page.getByText(PRODUCTS.regular.name)).toBeVisible({ timeout: 10000 });
    await page.getByRole("link", { name: /checkout/i }).click();
    await expect(page).toHaveURL("/checkout");
  });

  test("order summary shows subtotal", async ({ page }) => {
    await gotoWithCart(page, "/cart", cartProduct);
    await expect(page.getByText(/subtotal/i)).toBeVisible({ timeout: 10000 });
  });

  test("order summary shows tax", async ({ page }) => {
    await gotoWithCart(page, "/cart", cartProduct);
    await expect(page.getByText(/tax/i).first()).toBeVisible({ timeout: 10000 });
  });
});
