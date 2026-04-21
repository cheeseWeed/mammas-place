import { test, expect } from "./fixtures/base.fixture";
import { gotoWithCart } from "./helpers/cart.helpers";
import { PRODUCTS, TEST_CHECKOUT_FORM } from "./fixtures/test-data";

const cartProduct = {
  id: PRODUCTS.regular.id,
  name: PRODUCTS.regular.name,
  price: PRODUCTS.regular.price,
  category: PRODUCTS.regular.category,
};

test.describe("Checkout Page", () => {
  test("empty cart shows empty message on checkout", async ({ page }) => {
    await page.goto("/checkout");
    await page.waitForTimeout(500);
    await expect(page.getByText(/cart is empty/i)).toBeVisible({ timeout: 10000 });
  });

  test("checkout form renders with sections", async ({ page }) => {
    await gotoWithCart(page, "/checkout", cartProduct);
    await expect(page.getByText(/contact/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder(/email/i)).toBeVisible();
  });

  test("promo code MAMMA10 applies 10% discount", async ({ page }) => {
    await gotoWithCart(page, "/checkout", cartProduct);
    await expect(page.getByPlaceholder(/enter code/i)).toBeVisible({ timeout: 10000 });
    await page.getByPlaceholder(/enter code/i).fill("MAMMA10");
    await page.getByRole("button", { name: /apply/i }).click();
    await expect(page.getByText(/MAMMA10 applied/i)).toBeVisible();
  });

  test("promo code SAVE30 applies 30% discount", async ({ page }) => {
    await gotoWithCart(page, "/checkout", cartProduct);
    await expect(page.getByPlaceholder(/enter code/i)).toBeVisible({ timeout: 10000 });
    await page.getByPlaceholder(/enter code/i).fill("SAVE30");
    await page.getByRole("button", { name: /apply/i }).click();
    await expect(page.getByText(/SAVE30 applied/i)).toBeVisible();
  });

  test("invalid promo code shows error", async ({ page }) => {
    await gotoWithCart(page, "/checkout", cartProduct);
    await expect(page.getByPlaceholder(/enter code/i)).toBeVisible({ timeout: 10000 });
    await page.getByPlaceholder(/enter code/i).fill("FAKECODE");
    await page.getByRole("button", { name: /apply/i }).click();
    await expect(page.getByText(/invalid promo code/i)).toBeVisible();
  });

  test("full checkout flow completes order", async ({ page }) => {
    await gotoWithCart(page, "/checkout", cartProduct);
    await expect(page.getByPlaceholder(/email/i)).toBeVisible({ timeout: 10000 });

    // Fill all form fields
    await page.getByPlaceholder(/email/i).fill(TEST_CHECKOUT_FORM.email);
    await page.getByPlaceholder(/first name/i).fill(TEST_CHECKOUT_FORM.firstName);
    await page.getByPlaceholder(/last name/i).fill(TEST_CHECKOUT_FORM.lastName);
    await page.getByPlaceholder(/address/i).fill(TEST_CHECKOUT_FORM.address);
    await page.getByPlaceholder(/city/i).fill(TEST_CHECKOUT_FORM.city);
    await page.getByPlaceholder(/state/i).fill(TEST_CHECKOUT_FORM.state);
    await page.getByPlaceholder(/zip/i).fill(TEST_CHECKOUT_FORM.zip);
    await page.getByPlaceholder(/name on card/i).fill(TEST_CHECKOUT_FORM.cardName);
    await page.getByPlaceholder(/card number/i).fill(TEST_CHECKOUT_FORM.cardNumber);
    await page.getByPlaceholder(/mm\/yy/i).fill(TEST_CHECKOUT_FORM.expiry);
    await page.getByPlaceholder(/cvv/i).fill(TEST_CHECKOUT_FORM.cvv);

    // Place order
    await page.getByRole("button", { name: /place order/i }).click();

    // Verify order confirmation
    await expect(page.getByText(/order confirmed/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(TEST_CHECKOUT_FORM.email)).toBeVisible();
  });

  test("back to cart link works", async ({ page }) => {
    await gotoWithCart(page, "/checkout", cartProduct);
    await expect(page.getByRole("link", { name: /back to cart/i })).toBeVisible({ timeout: 10000 });
    await page.getByRole("link", { name: /back to cart/i }).click();
    await expect(page).toHaveURL("/cart");
  });
});
