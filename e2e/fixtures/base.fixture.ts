import { test as base } from "@playwright/test";
import { STORAGE_KEYS } from "./test-data";

export const test = base.extend({
  page: async ({ page }, use) => {
    // Bypass passcode gate before every test by injecting sessionStorage
    await page.addInitScript((key) => {
      sessionStorage.setItem(key, "true");
    }, STORAGE_KEYS.passcode);
    await use(page);
  },
});

export { expect } from "@playwright/test";
