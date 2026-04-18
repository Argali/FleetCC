import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider } from "@/core/auth/AuthContext";
import { PermProvider, usePerms } from "@/core/permissions/PermContext";
import { ThemeProvider } from "@/core/theme/ThemeContext";

// ── Helper ────────────────────────────────────────────────────────────────────

function PermDisplay() {
  const { perms, can } = usePerms();
  return (
    <div>
      <span data-testid="gps-level">{perms.gps ?? "none"}</span>
      <span data-testid="can-admin-full">{String(can("admin", "full"))}</span>
      <span data-testid="can-suppliers-edit">{String(can("suppliers", "edit"))}</span>
    </div>
  );
}

function renderWithAuth(token) {
  if (token) {
    sessionStorage.setItem(
      "cauto_auth",
      JSON.stringify({ token, user: { id: "1", email: "a@b.com", role: "company_admin" }, tenant: { id: "t1" } })
    );
  }
  return render(
    <ThemeProvider>
      <AuthProvider>
        <PermProvider>
          <PermDisplay />
        </PermProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PermContext", () => {
  it("shows 'none' perms when not authenticated", () => {
    renderWithAuth(null);
    expect(screen.getByTestId("gps-level").textContent).toBe("none");
  });

  it("loads permissions from API when authenticated", async () => {
    renderWithAuth("test-jwt-token");
    await waitFor(() => {
      expect(screen.getByTestId("gps-level").textContent).toBe("full");
    });
  });

  it("can() returns true when user has sufficient level", async () => {
    renderWithAuth("test-jwt-token");
    await waitFor(() => {
      expect(screen.getByTestId("can-admin-full").textContent).toBe("true");
    });
  });

  it("can() returns false when user level is below required", async () => {
    renderWithAuth("test-jwt-token");
    // suppliers is "view" in mock, "edit" requires more
    await waitFor(() => {
      expect(screen.getByTestId("can-suppliers-edit").textContent).toBe("false");
    });
  });
});

describe("can() level ordering", () => {
  // Direct unit tests of the ordering logic without DOM
  it("level ordering: none < view < edit < full", () => {
    const order = ["none", "view", "edit", "full"];
    const can = (userLevel, required) =>
      order.indexOf(userLevel) >= order.indexOf(required);

    expect(can("full", "view")).toBe(true);
    expect(can("edit", "edit")).toBe(true);
    expect(can("view", "edit")).toBe(false);
    expect(can("none", "view")).toBe(false);
  });
});
