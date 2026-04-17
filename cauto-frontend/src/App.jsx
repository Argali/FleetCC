import React from "react";
import { AuthProvider } from "@/core/auth";
import { PermProvider } from "@/core/permissions";
import AppShell from "@/layout/AppShell";

export default function App() {
  return (
    <AuthProvider>
      <PermProvider>
        <AppShell />
      </PermProvider>
    </AuthProvider>
  );
}
