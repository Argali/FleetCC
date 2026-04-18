import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TabBar from "@/shared/ui/TabBar";

const tabs = [
  { id: "fleet", label: "Flotta" },
  { id: "map",   label: "Mappa" },
  { id: "fuel",  label: "Carburante", badge: 3 },
];

describe("TabBar", () => {
  it("renders all tab labels", () => {
    render(<TabBar tabs={tabs} active="fleet" onChange={() => {}} />);
    expect(screen.getByText("Flotta")).toBeTruthy();
    expect(screen.getByText("Mappa")).toBeTruthy();
    expect(screen.getByText("Carburante")).toBeTruthy();
  });

  it("calls onChange with the correct id when a tab is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TabBar tabs={tabs} active="fleet" onChange={onChange} />);
    await user.click(screen.getByText("Mappa"));
    expect(onChange).toHaveBeenCalledWith("map");
  });

  it("renders badge when tab has badge > 0", () => {
    render(<TabBar tabs={tabs} active="fleet" onChange={() => {}} />);
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("does not render badge when badge is 0 or absent", () => {
    const tabsNoBadge = [{ id: "a", label: "A", badge: 0 }];
    render(<TabBar tabs={tabsNoBadge} active="a" onChange={() => {}} />);
    // Badge span only renders when badge > 0
    expect(screen.queryByText("0")).toBeNull();
  });

  it("calls onChange once per click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TabBar tabs={tabs} active="fleet" onChange={onChange} />);
    await user.click(screen.getByText("Flotta"));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
