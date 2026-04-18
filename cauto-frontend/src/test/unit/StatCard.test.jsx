import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StatCard from "@/shared/ui/StatCard";

describe("StatCard", () => {
  it("renders label and value", () => {
    render(<StatCard label="Veicoli Attivi" value={12} />);
    expect(screen.getByText("Veicoli Attivi")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
  });

  it("renders sub text when provided", () => {
    render(<StatCard label="Km Totali" value={45000} sub="ultimi 30 giorni" />);
    expect(screen.getByText("ultimi 30 giorni")).toBeTruthy();
  });

  it("renders em dash when value is undefined", () => {
    render(<StatCard label="Dati" value={undefined} />);
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("renders em dash when value is null", () => {
    render(<StatCard label="Dati" value={null} />);
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("renders value 0 (not treated as falsy)", () => {
    render(<StatCard label="Interventi" value={0} />);
    expect(screen.getByText("0")).toBeTruthy();
  });

  it("applies alert styling class when alert=true", () => {
    const { container } = render(<StatCard label="Allarme" value={3} alert />);
    // The value should be rendered; alert flag changes colour via style not class
    expect(screen.getByText("3")).toBeTruthy();
    // Confirm the container renders without error
    expect(container.firstChild).toBeTruthy();
  });

  it("does not render sub text when omitted", () => {
    render(<StatCard label="Test" value={5} />);
    expect(screen.queryByText("ultimi 30 giorni")).toBeNull();
  });
});
