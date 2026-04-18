import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ApiError from "@/shared/ui/ApiError";

describe("ApiError", () => {
  it("renders the error heading", () => {
    render(<ApiError error="Connessione rifiutata" />);
    expect(screen.getByText("Errore API")).toBeTruthy();
  });

  it("renders the error message", () => {
    render(<ApiError error="HTTP 500" />);
    expect(screen.getByText("HTTP 500")).toBeTruthy();
  });

  it("renders retry button when onRetry is provided", () => {
    render(<ApiError error="err" onRetry={() => {}} />);
    expect(screen.getByRole("button", { name: "Riprova" })).toBeTruthy();
  });

  it("does not render retry button when onRetry is absent", () => {
    render(<ApiError error="err" />);
    expect(screen.queryByRole("button", { name: "Riprova" })).toBeNull();
  });

  it("calls onRetry when the button is clicked", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ApiError error="err" onRetry={onRetry} />);
    await user.click(screen.getByRole("button", { name: "Riprova" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
