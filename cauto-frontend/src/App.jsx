import React from "react";
import { ThemeProvider } from "@/core/theme";
import { AuthProvider } from "@/core/auth";
import { PermProvider } from "@/core/permissions";
import AppShell from "@/layout/AppShell";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PermProvider>
          <AppShell />
        </PermProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
