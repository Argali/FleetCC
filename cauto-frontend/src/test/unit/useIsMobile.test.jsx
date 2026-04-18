import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useIsMobile } from "@/hooks/useIsMobile";

// ── Helper ────────────────────────────────────────────────────────────────────

function MobileDisplay() {
  const isMobile = useIsMobile();
  return <span data-testid="mobile">{String(isMobile)}</span>;
}

function setWidth(width) {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: width });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useIsMobile", () => {
  it("returns false for desktop width (1024px)", () => {
    setWidth(1024);
    render(<MobileDisplay />);
    expect(screen.getByTestId("mobile").textContent).toBe("false");
  });

  it("returns true for mobile width (375px)", () => {
    setWidth(375);
    render(<MobileDisplay />);
    expect(screen.getByTestId("mobile").textContent).toBe("true");
  });

  it("returns false at exactly the breakpoint (768px)", () => {
    setWidth(768);
    render(<MobileDisplay />);
    // hook uses < 768, so 768 is NOT mobile
    expect(screen.getByTestId("mobile").textContent).toBe("false");
  });

  it("updates when window is resized below breakpoint", () => {
    setWidth(1024);
    render(<MobileDisplay />);
    expect(screen.getByTestId("mobile").textContent).toBe("false");

    act(() => {
      setWidth(375);
      window.dispatchEvent(new Event("resize"));
    });
    expect(screen.getByTestId("mobile").textContent).toBe("true");
  });

  it("updates when window is resized above breakpoint", () => {
    setWidth(375);
    render(<MobileDisplay />);
    expect(screen.getByTestId("mobile").textContent).toBe("true");

    act(() => {
      setWidth(1440);
      window.dispatchEvent(new Event("resize"));
    });
    expect(screen.getByTestId("mobile").textContent).toBe("false");
  });
});
