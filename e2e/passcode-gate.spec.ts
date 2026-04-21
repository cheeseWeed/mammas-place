import { test, expect } from "@playwright/test";
import { PASSCODE } from "./fixtures/test-data";

// These tests do NOT bypass the passcode — they test the gate itself
test.describe("Passcode Gate", () => {
  test("shows passcode keypad on fresh session", async ({ page }) => {
    await page.goto("/");
    // Should see the numeric keypad, not the main site
    await expect(page.getByText(/★/).first()).toBeVisible();
  });

  test("entering correct passcode unlocks the site", async ({ page }) => {
    await page.goto("/");
    // Type each digit of 1379
    for (const digit of PASSCODE.split("")) {
      await page.getByRole("button", { name: digit }).click();
    }
    // Should now see the main site content
    await expect(page.getByRole("link", { name: /shop/i }).first()).toBeVisible({ timeout: 5000 });
  });

  test("entering wrong passcode shows error", async ({ page }) => {
    await page.goto("/");
    // Type wrong code: 0000
    for (const digit of "0000".split("")) {
      await page.getByRole("button", { name: digit }).click();
    }
    await expect(page.getByText(/incorrect/i)).toBeVisible();
  });

  test("passcode persists across page reload within session", async ({ page }) => {
    await page.goto("/");
    // Enter correct code
    for (const digit of PASSCODE.split("")) {
      await page.getByRole("button", { name: digit }).click();
    }
    await expect(page.getByRole("link", { name: /shop/i }).first()).toBeVisible({ timeout: 5000 });

    // Reload page — should still be unlocked
    await page.reload();
    await expect(page.getByRole("link", { name: /shop/i }).first()).toBeVisible({ timeout: 5000 });
  });
});
