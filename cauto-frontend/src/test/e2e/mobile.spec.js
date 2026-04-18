import { test, expect } from "@playwright/test";
import { injectAuth } from "./fixtures";

// These tests run in the "Mobile Chrome" project (Pixel 5 viewport)
test.describe("Mobile layout", () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
    await page.goto("/");
  });

  test("renders mobile tab bar at the bottom", async ({ page }) => {
    // Mobile tab bar should be visible on small viewports
    // The tab bar is rendered only on mobile (width < 768)
    const vp = page.viewportSize();
    if (vp && vp.width < 768) {
      // Look for the bottom tab area (fixed position bar)
      const tabBar = page.locator("[style*='position: fixed'][style*='bottom']").first();
      await expect(tabBar).toBeVisible({ timeout: 5000 });
    } else {
      test.skip();
    }
  });

  test("sidebar is hidden on mobile by default", async ({ page }) => {
    const vp = page.viewportSize();
    if (vp && vp.width < 768) {
      // On mobile, sidebar overlay pattern — desktop sidebar should not be visible
      const sidebar = page.locator("nav, aside").first();
      // Either hidden or very narrow
      const width = await sidebar.evaluate(el => el.offsetWidth);
      expect(width).toBeLessThanOrEqual(60);
    } else {
      test.skip();
    }
  });

  test("page does not overflow horizontally", async ({ page }) => {
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // +1 for rounding
  });
});
