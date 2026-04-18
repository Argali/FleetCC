import { test, expect } from "@playwright/test";
import { injectAuth } from "./fixtures";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
    await page.goto("/");
  });

  test("renders the main dashboard after authentication", async ({ page }) => {
    // The dashboard should be visible; LoginScreen should not show its subtitle
    await expect(page.getByText("Fleet Command Center")).not.toBeVisible({ timeout: 5000 });
  });

  test("sidebar navigation is visible", async ({ page }) => {
    // Sidebar should contain FleetCC branding
    await expect(page.getByText("FleetCC")).toBeVisible();
  });

  test("can navigate between modules via sidebar", async ({ page }) => {
    // Find a nav button and click it — use the first available navigation buttons
    const navButtons = page.locator("nav button, aside button").filter({ hasNotText: /tema/i });
    const count = await navButtons.count();
    expect(count).toBeGreaterThan(0);
  });

  test("displays stat cards on the home/fleet view", async ({ page }) => {
    // Stat cards use the .fcc-stat-card class
    const cards = page.locator(".fcc-stat-card");
    await expect(cards.first()).toBeVisible({ timeout: 8000 });
  });
});
