import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, useTheme } from "@/core/theme/ThemeContext";

// ── Helper ────────────────────────────────────────────────────────────────────

function ThemeDisplay() {
  const { mode, toggle } = useTheme();
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <button onClick={toggle}>toggle</button>
    </div>
  );
}

function renderTheme(localStorageMode) {
  if (localStorageMode) localStorage.setItem("fleetcc.theme", localStorageMode);
  return render(
    <ThemeProvider>
      <ThemeDisplay />
    </ThemeProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ThemeContext", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to dark mode when localStorage is empty", () => {
    renderTheme();
    expect(screen.getByTestId("mode").textContent).toBe("dark");
  });

  it("restores saved theme from localStorage", () => {
    renderTheme("light");
    expect(screen.getByTestId("mode").textContent).toBe("light");
  });

  it("toggles from dark to light on button click", async () => {
    const user = userEvent.setup();
    renderTheme("dark");
    await user.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.getByTestId("mode").textContent).toBe("light");
  });

  it("toggles back from light to dark", async () => {
    const user = userEvent.setup();
    renderTheme("light");
    await user.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.getByTestId("mode").textContent).toBe("dark");
  });

  it("persists mode to localStorage after toggle", async () => {
    const user = userEvent.setup();
    renderTheme("dark");
    await user.click(screen.getByRole("button", { name: "toggle" }));
    expect(localStorage.getItem("fleetcc.theme")).toBe("light");
  });

  it("sets data-theme attribute on <html> when toggling", async () => {
    const user = userEvent.setup();
    renderTheme("dark");
    // Dark mode: no data-theme attribute (or empty string)
    expect(document.documentElement.getAttribute("data-theme")).toBeFalsy();

    await user.click(screen.getByRole("button", { name: "toggle" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    await user.click(screen.getByRole("button", { name: "toggle" }));
    expect(document.documentElement.getAttribute("data-theme")).toBeFalsy();
  });

  it("throws when useTheme is used outside ThemeProvider", () => {
    function Bad() {
      useTheme();
      return null;
    }
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Bad />)).toThrow("useTheme must be used within ThemeProvider");
    spy.mockRestore();
  });
});
