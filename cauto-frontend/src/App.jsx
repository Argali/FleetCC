import React, { useState, useEffect, lazy, Suspense } from "react";
import { msalInstance, loginRequest } from "@/msalConfig.js";
import { API } from "@/api";
import T from "@/theme";
import { AuthProvider, useAuth } from "@/core/auth/AuthContext";
import { PermProvider } from "@/core/permissions/PermContext";
import FleetLogo from "@/shared/ui/FleetLogo";

const LoginScreen = lazy(() => import("@/modules/dashboard/LoginScreen"));
const Dashboard   = lazy(() => import("@/modules/dashboard/Dashboard"));

function AppInner() {
  const { auth, login } = useAuth();
  const [redirecting, setRedirecting] = useState(true);

  useEffect(() => {
    msalInstance.initialize()
      .then(() => msalInstance.handleRedirectPromise())
      .then(async result => {
        if (result?.idToken) {
          try {
            const res = await fetch(`${API}/auth/azure`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id_token: result.idToken }),
            });
            const data = await res.json();
            if (data.ok) login(data.token, data.user, data.tenant);
          } catch {}
        }
      })
      .catch(() => {})
      .finally(() => setRedirecting(false));
  }, [login]);

  if (redirecting) return (
    <div style={{ height: "100vh", background: T.sidebar, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.font, color: T.textSub, fontSize: 13 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <FleetLogo size={28} />
        <span>Caricamento...</span>
      </div>
    </div>
  );

  return (
    <Suspense fallback={
      <div style={{ height: "100vh", background: T.sidebar, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.font, color: T.textSub, fontSize: 13 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <FleetLogo size={28} />
          <span>Caricamento...</span>
        </div>
      </div>
    }>
      {auth ? <Dashboard /> : <LoginScreen />}
    </Suspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PermProvider>
        <AppInner />
      </PermProvider>
    </AuthProvider>
  );
}
