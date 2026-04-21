import { test, expect } from "./fixtures/base.fixture";
import { loginAsAdmin } from "./helpers/auth.helpers";

test.describe("Admin Portal", () => {
  test("login page renders", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByPlaceholder("Username")).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder("Password")).toBeVisible();
  });

  test("invalid credentials show error", async ({ page }) => {
    await page.goto("/admin");
    await page.getByPlaceholder("Username").fill("wronguser");
    await page.getByPlaceholder("Password").fill("wrongpass");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/invalid/i)).toBeVisible({ timeout: 10000 });
  });

  test("admin can login and see dashboard", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByText(/total products/i)).toBeVisible({ timeout: 10000 });
  });

  test("logout returns to login page", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByText(/total products/i)).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: /sign out|logout/i }).click();
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("dashboard redirects to login when not authenticated", async ({ page }) => {
    await page.goto("/admin/dashboard");
    // Should redirect to /admin login page
    await expect(page.getByPlaceholder("Username")).toBeVisible({ timeout: 10000 });
  });
});
