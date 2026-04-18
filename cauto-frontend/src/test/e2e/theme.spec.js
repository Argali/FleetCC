import { test, expect } from "@playwright/test";
import { injectAuth } from "./fixtures";

test.describe("Theme toggle", () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
    await page.goto("/");
  });

  test("theme toggle button is visible in the sidebar", async ({ page }) => {
    await expect(page.getByTestId("theme-toggle")).toBeVisible();
  });

  test("toggles from dark to light mode", async ({ page }) => {
    // Default is dark — sidebar should have dark background
    const sidebar = page.locator("[data-testid='sidebar'], nav").first();
    const darkBg = await sidebar.evaluate(el => getComputedStyle(el).backgroundColor);

    await page.getByTestId("theme-toggle").click();

    // After toggle, background should change
    const lightBg = await sidebar.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(lightBg).not.toBe(darkBg);
  });

  test("persists theme choice after page reload", async ({ page }) => {
    await page.getByTestId("theme-toggle").click();
    // localStorage should now be "light"
    const stored = await page.evaluate(() => localStorage.getItem("fleetcc.theme"));
    expect(stored).toBe("light");

    await page.reload();
    const storedAfterReload = await page.evaluate(() => localStorage.getItem("fleetcc.theme"));
    expect(storedAfterReload).toBe("light");
  });
});
