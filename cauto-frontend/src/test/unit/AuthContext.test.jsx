import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "@/core/auth/AuthContext";

// ── Helpers ──────────────────────────────────────────────────────────────────

function DisplayAuth() {
  const { auth, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="auth-state">{auth ? `logged:${auth.user.email}` : "none"}</span>
      <button onClick={() => login("tok", { id: "1", email: "a@b.com" }, { id: "t1" })}>login</button>
      <button onClick={logout}>logout</button>
    </div>
  );
}

function renderAuth() {
  return render(
    <AuthProvider>
      <DisplayAuth />
    </AuthProvider>
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("AuthContext", () => {
  beforeEach(() => sessionStorage.clear());

  it("starts unauthenticated when sessionStorage is empty", () => {
    renderAuth();
    expect(screen.getByTestId("auth-state").textContent).toBe("none");
  });

  it("restores auth from sessionStorage on mount", () => {
    sessionStorage.setItem(
      "cauto_auth",
      JSON.stringify({ token: "t", user: { id: "1", email: "x@y.com" }, tenant: { id: "t1" } })
    );
    renderAuth();
    expect(screen.getByTestId("auth-state").textContent).toBe("logged:x@y.com");
  });

  it("sets auth and sessionStorage on login()", async () => {
    const user = userEvent.setup();
    renderAuth();
    await user.click(screen.getByRole("button", { name: "login" }));
    expect(screen.getByTestId("auth-state").textContent).toBe("logged:a@b.com");
    expect(JSON.parse(sessionStorage.getItem("cauto_auth")).token).toBe("tok");
  });

  it("clears auth and sessionStorage on logout()", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem(
      "cauto_auth",
      JSON.stringify({ token: "t", user: { id: "1", email: "x@y.com" }, tenant: {} })
    );
    renderAuth();
    await user.click(screen.getByRole("button", { name: "logout" }));
    expect(screen.getByTestId("auth-state").textContent).toBe("none");
    expect(sessionStorage.getItem("cauto_auth")).toBeNull();
  });
});
