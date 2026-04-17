import React, { useState, useEffect, lazy, Suspense } from "react";
import { msalInstance } from "@/msalConfig.js";
import { API } from "@/api";
import T from "@/theme";
import { useAuth } from "@/core/auth";
import FleetLogo from "@/shared/ui/FleetLogo";

const LoginScreen = lazy(() => import("@/modules/dashboard/LoginScreen"));
const Dashboard   = lazy(() => import("@/modules/dashboard/Dashboard"));

const Splash = () => (
  <div style={{ height: "100vh", background: T.sidebar, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.font, color: T.textSub, fontSize: 13 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <FleetLogo size={28} />
      <span>Caricamento...</span>
    </div>
  </div>
);

export default function AppShell() {
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

  if (redirecting) return <Splash />;

  return (
    <Suspense fallback={<Splash />}>
      {auth ? <Dashboard /> : <LoginScreen />}
    </Suspense>
  );
}
