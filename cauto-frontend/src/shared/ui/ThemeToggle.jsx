import React from "react";
import T from "@/theme";
import { useTheme } from "@/core/theme";

const SUN  = "M12 1v2 M12 21v2 M4.22 4.22l1.42 1.42 M18.36 18.36l1.42 1.42 M1 12h2 M21 12h2 M4.22 19.78l1.42-1.42 M18.36 5.64l1.42-1.42 M12 7a5 5 0 1 0 0 10A5 5 0 0 0 12 7z";
const MOON = "M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z";

export default function ThemeToggle({ collapsed = false }) {
  const { mode, toggle } = useTheme();
  const isDark = mode === "dark";

  return (
    <button
      onClick={toggle}
      title={isDark ? "Passa al tema chiaro" : "Passa al tema scuro"}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: collapsed ? "center" : "flex-start",
        gap: 8,
        padding: collapsed ? "8px 0" : "8px 10px",
        background: "transparent",
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        color: T.textSub,
        cursor: "pointer",
        fontFamily: T.font,
        fontSize: 12,
        marginTop: 4,
        transition: "border-color 0.15s, color 0.15s",
      }}
    >
      <span style={{
        display: "flex",
        flexShrink: 0,
        transition: "transform 400ms cubic-bezier(.4,0,.2,1)",
        transform: isDark ? "rotate(0deg)" : "rotate(200deg)",
      }}>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d={isDark ? SUN : MOON} />
        </svg>
      </span>
      {!collapsed && (isDark ? "Tema chiaro" : "Tema scuro")}
    </button>
  );
}
