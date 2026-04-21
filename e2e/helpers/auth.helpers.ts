import { Page } from "@playwright/test";
import { STORAGE_KEYS, STAFF_CREDENTIALS, ADMIN_CREDENTIALS } from "../fixtures/test-data";

// Logs into the staff portal via the UI
export async function loginAsStaff(page: Page, role: keyof typeof STAFF_CREDENTIALS) {
  const creds = STAFF_CREDENTIALS[role];
  await page.goto("/portal");
  await page.getByPlaceholder("Username").fill(creds.username);
  await page.getByPlaceholder("Password").fill(creds.password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL("**/portal/dashboard", { timeout: 10000 });
}

// Logs into the admin portal via the UI (has a 400ms artificial delay)
export async function loginAsAdmin(page: Page) {
  await page.goto("/admin");
  await page.getByPlaceholder("Username").fill(ADMIN_CREDENTIALS.username);
  await page.getByPlaceholder("Password").fill(ADMIN_CREDENTIALS.password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL("**/admin/dashboard", { timeout: 10000 });
}

// Injects staff auth directly into localStorage (faster, no UI)
export async function setStaffAuthViaStorage(page: Page, role: keyof typeof STAFF_CREDENTIALS) {
  const creds = STAFF_CREDENTIALS[role];
  await page.addInitScript(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
  }, { key: STORAGE_KEYS.auth, value: { username: creds.username, role: creds.role, name: creds.name } });
}

// Injects admin auth directly into localStorage (faster, no UI)
export async function setAdminAuthViaStorage(page: Page) {
  await page.addInitScript(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
  }, { key: STORAGE_KEYS.adminAuth, value: { username: "admin", authenticated: true } });
}
