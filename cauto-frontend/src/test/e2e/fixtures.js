/**
 * Shared E2E helpers and fixtures
 */

/** Inject a valid auth session into sessionStorage so tests skip the login screen. */
export async function injectAuth(page) {
  await page.addInitScript(() => {
    const auth = JSON.stringify({
      token: "e2e-test-token",
      user: { id: "1", name: "E2E Admin", email: "e2e@test.com", role: "company_admin" },
      tenant: { id: "t1", name: "Test Company" },
    });
    sessionStorage.setItem("cauto_auth", auth);
  });
}

/** Navigate to a module by clicking the sidebar nav button by label text. */
export async function goToModule(page, labelText) {
  await page.getByRole("button", { name: labelText }).click();
}
