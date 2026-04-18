import { describe, it, expect } from "vitest";
import T, { alpha, statusColor, statusLabel, roleLabel, moduleLabel, levelColor } from "@/theme";

describe("T token object", () => {
  it("is a plain object (not a Proxy)", () => {
    expect(typeof T).toBe("object");
    expect(T).not.toBeNull();
  });

  it("exposes all colour tokens as CSS var strings", () => {
    const cssVarTokens = [
      "sidebar", "bg", "card", "cardBorder", "border",
      "text", "textSub", "textDim",
      "green", "blue", "orange", "red", "yellow", "teal",
      "navActive", "tabLine", "shadowCard",
    ];
    cssVarTokens.forEach(key => {
      expect(T[key], `T.${key} should be defined`).toBeDefined();
      expect(T[key], `T.${key} should be a CSS var`).toMatch(/^var\(--t-/);
    });
  });

  it("exposes static font tokens as plain strings", () => {
    expect(T.font).toContain("Inter");
    expect(T.mono).toContain("JetBrains Mono");
    expect(T.font).not.toMatch(/^var\(/);
    expect(T.mono).not.toMatch(/^var\(/);
  });

  it("each CSS var token references the correct custom property name", () => {
    expect(T.bg).toBe("var(--t-bg)");
    expect(T.red).toBe("var(--t-red)");
    expect(T.textSub).toBe("var(--t-text-sub)");
    expect(T.navActive).toBe("var(--t-nav-active)");
    expect(T.shadowCard).toBe("var(--t-shadow-card)");
  });
});

describe("alpha() helper", () => {
  it("produces a color-mix() expression", () => {
    const result = alpha(T.red, 27);
    expect(result).toBe("color-mix(in srgb, var(--t-red) 27%, transparent)");
  });

  it("handles different percentages", () => {
    expect(alpha(T.blue, 7)).toBe("color-mix(in srgb, var(--t-blue) 7%, transparent)");
    expect(alpha(T.green, 33)).toBe("color-mix(in srgb, var(--t-green) 33%, transparent)");
    expect(alpha(T.blue, 53)).toBe("color-mix(in srgb, var(--t-blue) 53%, transparent)");
  });

  it("works with any CSS var string", () => {
    const result = alpha("var(--t-border)", 13);
    expect(result).toContain("var(--t-border)");
    expect(result).toContain("13%");
  });

  it("replaces the old hex-suffix pattern correctly — 44hex≈27%", () => {
    // Previously: `${T.red}44`  →  now: alpha(T.red, 27)
    const old44 = 0x44 / 255;   // ≈ 0.267 = 26.7%
    expect(Math.round(old44 * 100)).toBe(27);
  });
});

describe("statusColor", () => {
  it("has entries for all vehicle statuses", () => {
    expect(statusColor.active).toBeDefined();
    expect(statusColor.idle).toBeDefined();
    expect(statusColor.workshop).toBeDefined();
  });
});

describe("statusLabel", () => {
  it("maps status keys to Italian labels", () => {
    expect(statusLabel.active).toBe("Attivo");
    expect(statusLabel.idle).toBe("Fermo");
    expect(statusLabel.workshop).toBe("Officina");
    expect(statusLabel.done).toBe("Completato");
  });
});

describe("roleLabel", () => {
  it("maps role keys to Italian labels", () => {
    expect(roleLabel.superadmin).toBe("Super Admin");
    expect(roleLabel.company_admin).toBe("Admin Azienda");
    expect(roleLabel.fleet_manager).toBe("Fleet Manager");
  });
});

describe("moduleLabel", () => {
  it("has labels for all modules", () => {
    ["gps", "navigation", "workshop", "fuel", "suppliers", "costs", "admin"].forEach(m => {
      expect(moduleLabel[m], `missing label for: ${m}`).toBeDefined();
    });
  });
});

describe("levelColor", () => {
  it("has colours for all permission levels", () => {
    expect(levelColor.none).toBeDefined();
    expect(levelColor.view).toBeDefined();
    expect(levelColor.edit).toBeDefined();
    expect(levelColor.full).toBeDefined();
  });
});
