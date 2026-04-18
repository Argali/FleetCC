import { test, expect } from "@playwright/test";

test.describe("Login screen", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("shows the FleetCC logo and title", async ({ page }) => {
    await expect(page.getByText("FleetCC")).toBeVisible();
    await expect(page.getByText("Fleet Command Center")).toBeVisible();
  });

  test("shows Microsoft login button", async ({ page }) => {
    await expect(page.getByTestId("microsoft-login-btn")).toBeVisible();
    await expect(page.getByTestId("microsoft-login-btn")).toContainText("Accedi con Microsoft");
  });

  test("admin login section is hidden by default", async ({ page }) => {
    await expect(page.getByTestId("admin-login-form")).not.toBeVisible();
  });

  test("reveals admin login form on toggle click", async ({ page }) => {
    await page.getByTestId("toggle-admin-login").click();
    await expect(page.getByTestId("admin-login-form")).toBeVisible();
    await expect(page.getByTestId("admin-email")).toBeVisible();
    await expect(page.getByTestId("admin-password")).toBeVisible();
  });

  test("shows error on bad admin credentials", async ({ page }) => {
    await page.getByTestId("toggle-admin-login").click();
    await page.getByTestId("admin-email").fill("wrong@test.com");
    await page.getByTestId("admin-password").fill("badpassword");
    await page.getByTestId("admin-submit").click();
    await expect(page.getByTestId("login-error")).toBeVisible();
  });

  test("logs in successfully with valid admin credentials", async ({ page }) => {
    await page.getByTestId("toggle-admin-login").click();
    await page.getByTestId("admin-email").fill("admin@test.com");
    await page.getByTestId("admin-password").fill("password123");
    await page.getByTestId("admin-submit").click();
    // After login, login screen should no longer be visible
    await expect(page.getByText("Fleet Command Center")).not.toBeVisible({ timeout: 5000 });
  });
});
