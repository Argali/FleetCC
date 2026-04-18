import React, { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext(null);

function applyTheme(mode) {
  document.documentElement.setAttribute("data-theme", mode === "light" ? "light" : "");
  document.documentElement.style.colorScheme = mode;
}

function getInitialMode() {
  const saved = localStorage.getItem("fleetcc.theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(() => {
    const initial = getInitialMode();
    applyTheme(initial);
    return initial;
  });

  useEffect(() => {
    applyTheme(mode);
    localStorage.setItem("fleetcc.theme", mode);
  }, [mode]);

  const toggle = () => setModeState(m => (m === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ mode, setMode: setModeState, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
