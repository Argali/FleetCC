import React from "react";
import { render } from "@testing-library/react";
import { ThemeProvider } from "@/core/theme/ThemeContext";
import { AuthProvider } from "@/core/auth/AuthContext";
import { PermProvider } from "@/core/permissions/PermContext";

/**
 * Renders a component wrapped in all app-level providers.
 * @param {React.ReactElement} ui - Component to render
 * @param {object} options
 * @param {object} options.auth - Pre-populate sessionStorage auth ({token, user, tenant})
 * @param {object} options.renderOptions - Extra options forwarded to @testing-library/react render
 */
export function renderWithProviders(ui, { auth, ...renderOptions } = {}) {
  if (auth) {
    sessionStorage.setItem("cauto_auth", JSON.stringify(auth));
  }

  function Wrapper({ children }) {
    return (
      <ThemeProvider>
        <AuthProvider>
          <PermProvider>
            {children}
          </PermProvider>
        </AuthProvider>
      </ThemeProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

/** Convenience auth fixture for a logged-in company_admin */
export const mockAuth = {
  token: "test-jwt-token",
  user: { id: "1", name: "Test Admin", email: "admin@test.com", role: "company_admin" },
  tenant: { id: "t1", name: "Test Company" },
};
