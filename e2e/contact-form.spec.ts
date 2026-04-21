import { test, expect } from "./fixtures/base.fixture";

test.describe("Contact Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/contact");
  });

  test("contact form renders with all fields", async ({ page }) => {
    await expect(page.getByPlaceholder(/name/i).first()).toBeVisible();
    await expect(page.getByPlaceholder(/email/i).first()).toBeVisible();
    await expect(page.getByPlaceholder(/message/i)).toBeVisible();
  });

  test("successful form submission shows confirmation", async ({ page }) => {
    await page.getByPlaceholder(/name/i).first().fill("Test User");
    await page.getByPlaceholder(/email/i).first().fill("test@example.com");

    // Select subject from dropdown
    const subjectSelect = page.locator("select");
    if (await subjectSelect.isVisible()) {
      await subjectSelect.selectOption({ index: 1 });
    }

    await page.getByPlaceholder(/message/i).fill("This is a test message for QA.");
    await page.getByRole("button", { name: /send/i }).click();
    await expect(page.getByText(/sent successfully|thank you/i)).toBeVisible({ timeout: 5000 });
  });

  test("contact info is displayed", async ({ page }) => {
    await expect(page.getByText(/support@mammasplace\.com/i)).toBeVisible();
    await expect(page.getByText(/1-800/i).first()).toBeVisible();
  });

  test("page has links to FAQ and shipping", async ({ page }) => {
    await expect(page.getByRole("link", { name: /faq/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /shipping/i }).first()).toBeVisible();
  });
});
