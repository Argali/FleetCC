import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../mocks/server";
import { AuthProvider } from "@/core/auth/AuthContext";
import { ThemeProvider } from "@/core/theme/ThemeContext";
import { useApi } from "@/hooks/useApi";

// ── Helper ────────────────────────────────────────────────────────────────────

function ApiConsumer({ path, skip }) {
  const { data, loading, error } = useApi(path, { skip });
  if (loading) return <span data-testid="loading">loading</span>;
  if (error) return <span data-testid="error">{error}</span>;
  return <span data-testid="data">{JSON.stringify(data)}</span>;
}

function renderWithAuth(ui, token = "test-jwt-token") {
  sessionStorage.setItem(
    "cauto_auth",
    JSON.stringify({ token, user: { id: "1", email: "a@b.com" }, tenant: { id: "t1" } })
  );
  return render(
    <ThemeProvider>
      <AuthProvider>{ui}</AuthProvider>
    </ThemeProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useApi", () => {
  it("shows loading state initially", () => {
    renderWithAuth(<ApiConsumer path="/vehicles" />);
    expect(screen.getByTestId("loading")).toBeTruthy();
  });

  it("resolves data from the API", async () => {
    renderWithAuth(<ApiConsumer path="/vehicles" />);
    await waitFor(() => expect(screen.getByTestId("data")).toBeTruthy());
    const data = JSON.parse(screen.getByTestId("data").textContent);
    expect(Array.isArray(data)).toBe(true);
    expect(data[0].plate).toBe("AB123CD");
  });

  it("surfaces an error message on HTTP failure", async () => {
    server.use(
      http.get("http://localhost:3001/api/vehicles", () =>
        HttpResponse.json({ message: "Server error" }, { status: 500 })
      )
    );
    renderWithAuth(<ApiConsumer path="/vehicles" />);
    await waitFor(() => expect(screen.getByTestId("error")).toBeTruthy());
    expect(screen.getByTestId("error").textContent).toContain("HTTP 500");
  });

  it("skips fetch when skip=true", async () => {
    renderWithAuth(<ApiConsumer path="/vehicles" skip={true} />);
    // Should immediately exit loading without data or error
    await waitFor(() => expect(screen.queryByTestId("loading")).toBeNull());
    expect(screen.queryByTestId("error")).toBeNull();
  });

  it("calls logout on 401 response", async () => {
    server.use(
      http.get("http://localhost:3001/api/vehicles", () =>
        HttpResponse.json({ message: "Unauthorized" }, { status: 401 })
      )
    );
    renderWithAuth(<ApiConsumer path="/vehicles" />);
    await waitFor(() => {
      expect(sessionStorage.getItem("cauto_auth")).toBeNull();
    });
  });
});
