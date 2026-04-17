import React, { createContext, useContext, useState, useEffect } from "react";
import T, { buildTheme } from "@/theme";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(() => {
    const saved = localStorage.getItem("fleetcc.theme");
    if (saved === "light" || saved === "dark") {
      T.__setMode(saved);
      document.documentElement.style.colorScheme = saved;
      return saved;
    }
    const initial = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    T.__setMode(initial);
    document.documentElement.style.colorScheme = initial;
    return initial;
  });

  useEffect(() => {
    T.__setMode(mode);
    document.documentElement.style.colorScheme = mode;
    localStorage.setItem("fleetcc.theme", mode);
  }, [mode]);

  const toggle = () => setModeState(m => (m === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ mode, setMode: setModeState, toggle }}>
      {/* key forces full tree remount on theme change so T proxy reads update */}
      <div key={mode} style={{ display: "contents" }}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
