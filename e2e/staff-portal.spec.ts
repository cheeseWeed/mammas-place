import { test, expect } from "./fixtures/base.fixture";
import { STAFF_CREDENTIALS } from "./fixtures/test-data";
import { loginAsStaff } from "./helpers/auth.helpers";

test.describe("Staff Portal", () => {
  test("login page renders", async ({ page }) => {
    await page.goto("/portal");
    await expect(page.getByPlaceholder("Username")).toBeVisible();
    await expect(page.getByPlaceholder("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("invalid credentials show error", async ({ page }) => {
    await page.goto("/portal");
    await page.getByPlaceholder("Username").fill("wronguser");
    await page.getByPlaceholder("Password").fill("wrongpass");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/invalid/i)).toBeVisible();
  });

  test("manager can login and see dashboard", async ({ page }) => {
    await loginAsStaff(page, "manager");
    await expect(page.getByText(/store manager/i)).toBeVisible();
  });

  test("manager sees promo codes section", async ({ page }) => {
    await loginAsStaff(page, "manager");
    await expect(page.getByText("MAMMA10")).toBeVisible();
  });

  test("agent can login and see dashboard", async ({ page }) => {
    await loginAsStaff(page, "agent1");
    await expect(page.getByText(/sales agent/i)).toBeVisible();
  });

  test("logout returns to login page", async ({ page }) => {
    await loginAsStaff(page, "manager");
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL("/portal");
  });

  test("dashboard redirects to login when not authenticated", async ({ page }) => {
    await page.goto("/portal/dashboard");
    await expect(page).toHaveURL("/portal");
  });

  test("back to store link works", async ({ page }) => {
    await page.goto("/portal");
    const backLink = page.getByRole("link", { name: /back to store/i });
    if (await backLink.isVisible()) {
      await backLink.click();
      await expect(page).toHaveURL("/");
    }
  });
});
