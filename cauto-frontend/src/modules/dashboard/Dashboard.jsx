import React, { useState, useEffect, lazy, Suspense } from "react";
import { msalInstance } from "@/msalConfig.js";
import { API } from "@/api";
import T from "@/theme";
import { roleLabel } from "@/theme";
import { useAuth } from "@/core/auth/AuthContext";
import { usePerms } from "@/core/permissions/PermContext";
import { useApi } from "@/hooks/useApi";
import { useIsMobile } from "@/hooks/useIsMobile";
import FleetLogo from "@/shared/ui/FleetLogo";
import Icon from "@/shared/ui/Icon";
import ModuleSpinner from "@/shared/ui/ModuleSpinner";
import ThemeToggle from "@/shared/ui/ThemeToggle";

const BugReportModal   = lazy(() => import("@/modules/dashboard/BugReportModal"));
const VehicleDetail    = lazy(() => import("@/modules/dashboard/VehicleDetail"));
const HomeModule       = lazy(() => import("@/modules/dashboard/HomeModule"));
const GPSModule        = lazy(() => import("@/modules/map/GPSModule"));
const OperativoModule  = lazy(() => import("@/modules/workshop/OperativoModule"));
const AnalyticsModule  = lazy(() => import("@/modules/dashboard/AnalyticsModule"));
const FlottaModule     = lazy(() => import("@/modules/fleet/FlottaModule"));
const TerritorioModule = lazy(() => import("@/modules/territorio/TerritorioModule"));
const AdminPanel       = lazy(() => import("@/modules/admin/AdminPanel"));
const SuperAdminDashboard = lazy(() => import("@/modules/admin/SuperAdminDashboard"));
const CompanyAdminPanel   = lazy(() => import("@/modules/admin/CompanyAdminPanel"));
const SuperAdminAnalytics = lazy(() => import("@/modules/admin/SuperAdminAnalytics"));

const NAV_DEF = [
  { id: "home",       label: "Dashboard",  short: "Home",      icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10", module: null },
  { id: "gps",        label: "GPS Live",   short: "GPS",       icon: "M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3V7z M9 4v13 M15 7v13",          module: "gps" },
  { id: "editors",    label: "Editori",    short: "Editori",   icon: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",        module: "gps" },
  { id: "operativo",  label: "Operativo",  short: "Operativo", icon: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01", module: null },
  { id: "analytics",  label: "Analytics",  short: "Analytics", icon: "M18 20V10 M12 20V4 M6 20v-6",                                    module: null },
  { id: "fleet",      label: "Flotta",     short: "Flotta",    icon: "M3 22V8l9-6 9 6v14H3z M9 22v-6h6v6",                             modules: ["fuel", "suppliers", "costs"] },
  { id: "territorio", label: "Territorio", short: "Territorio",icon: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01", module: "gps" },
  { id: "admin",      label: "Admin",      short: "Admin",     icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z", module: "admin" },
];

export default function Dashboard() {
  const { auth, logout } = useAuth();
  const { can } = usePerms();
  const isMobile = useIsMobile();
  const [active, setActive] = useState("home");
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 900);
  const [showBugModal, setShowBugModal] = useState(false);
  const { data: vehicles } = useApi("/gps/vehicles", { pollMs: 10000, skip: !can("gps") });

  const role = auth.user?.role;
  const isSuperAdmin = role === "superadmin";
  const isCompanyAdmin = role === "company_admin";

  const nav = NAV_DEF.filter(n => {
    if (isSuperAdmin) return n.id === "admin";
    if (isCompanyAdmin) return n.id === "admin" || n.module === null || can(n.module) || n.modules?.some(m => can(m));
    if (n.module === null && !n.modules) return true;
    if (n.module) return can(n.module);
    if (n.modules) return n.modules.some(m => can(m));
    return true;
  });

  useEffect(() => { if (nav.length && !nav.find(n => n.id === active)) setActive(nav[0].id); }, [nav, active]);
  const handleSetActive = (id) => { setSelectedVehicle(null); setActive(id); };

  const counts = vehicles ? {
    active: vehicles.filter(v => v.status === "active").length,
    idle: vehicles.filter(v => v.status === "idle").length,
    workshop: vehicles.filter(v => v.status === "workshop").length,
  } : { active: "—", idle: "—", workshop: "—" };

  const renderModule = () => {
    if (selectedVehicle) return <VehicleDetail vehicle={selectedVehicle} onBack={() => setSelectedVehicle(null)} />;
    const adminPanel = isSuperAdmin
      ? <SuperAdminDashboard />
      : isCompanyAdmin
        ? <CompanyAdminPanel />
        : <AdminPanel />;
    const analyticsPanel = isSuperAdmin
      ? <SuperAdminAnalytics />
      : <AnalyticsModule onSelectVehicle={setSelectedVehicle} />;
    const map = {
      home:       <HomeModule onSelectVehicle={setSelectedVehicle} />,
      gps:        <GPSModule mode="live" onSelectVehicle={setSelectedVehicle} />,
      editors:    <GPSModule mode="editors" onSelectVehicle={setSelectedVehicle} />,
      operativo:  <OperativoModule />,
      analytics:  analyticsPanel,
      fleet:      <FlottaModule />,
      territorio: <TerritorioModule />,
      admin:      adminPanel,
    };
    return map[active] || null;
  };

  const handleLogout = async () => {
    try { await fetch(`${API}/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${auth.token}` } }); } catch {}
    logout();
    await msalInstance.clearCache();
    await msalInstance.logoutRedirect({ postLogoutRedirectUri: window.location.origin });
  };

  const moduleKey = active + (selectedVehicle?.id || "");
  const W = sidebarOpen ? 210 : 60;
  const currentNav = nav.find(n => n.id === active);

  // ── Mobile layout ──────────────────────────────────────────────────────────
  if (isMobile) {
    const mobileNav = nav.filter(n => n.id !== "editors");
    const activeIdx = mobileNav.findIndex(n => n.id === active);

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: T.bg, fontFamily: T.font, color: T.text, overflow: "hidden", paddingTop: "env(safe-area-inset-top)" }}>

        {/* Header */}
        <div style={{ background: T.sidebar, borderBottom: `1px solid ${T.border}`, padding: "0 16px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, zIndex: 100, backdropFilter: "blur(10px)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FleetLogo size={26} />
            <div style={{ fontSize: 14, fontWeight: 800, color: T.text, letterSpacing: -0.3 }}>Fleet<span style={{ color: T.green }}>CC</span></div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {currentNav && <span style={{ fontSize: 13, fontWeight: 600, color: T.textSub }}>{selectedVehicle ? selectedVehicle.name : currentNav.label}</span>}
            <ThemeToggle collapsed />
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: `linear-gradient(135deg,${T.blue},${T.green})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
              {auth.user.name.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px", paddingBottom: "calc(72px + env(safe-area-inset-bottom))", background: T.bg }}>
          <Suspense fallback={<ModuleSpinner />}>
            <div key={moduleKey} style={{ animation: "fadeIn 220ms ease-out" }}>
              {renderModule()}
            </div>
          </Suspense>
        </div>

        {/* Bottom tab bar */}
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: T.sidebar, borderTop: `1px solid ${T.border}`, display: "flex", alignItems: "stretch", zIndex: 200, paddingBottom: "env(safe-area-inset-bottom)" }}>
          {/* Sliding indicator */}
          {activeIdx >= 0 && (
            <div style={{
              position: "absolute",
              top: 0,
              left: `${(activeIdx / mobileNav.length) * 100}%`,
              width: `${(1 / mobileNav.length) * 100}%`,
              height: 2,
              background: T.blue,
              borderRadius: "0 0 2px 2px",
              transition: "left 280ms cubic-bezier(.4,0,.2,1)",
            }} />
          )}
          {mobileNav.map(n => {
            const isActive = active === n.id;
            return (
              <button key={n.id} onClick={() => handleSetActive(n.id)}
                className="fcc-tab-btn"
                style={{ flex: 1, minHeight: 60, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, border: "none", background: "transparent", color: isActive ? T.blue : T.textDim, cursor: "pointer", fontFamily: T.font, padding: "4px 2px", transition: "color 180ms, transform 120ms" }}>
                <span style={{ transform: isActive ? "scale(1.1)" : "scale(1)", transition: "transform 180ms" }}>
                  <Icon d={n.icon} size={18} />
                </span>
                <span style={{ fontSize: 9, fontWeight: isActive ? 700 : 400, letterSpacing: 0.2, whiteSpace: "nowrap" }}>{n.short}</span>
              </button>
            );
          })}
        </div>

        {showBugModal && <Suspense fallback={null}><BugReportModal auth={auth} onClose={() => setShowBugModal(false)} /></Suspense>}
      </div>
    );
  }

  // ── Desktop layout ─────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", height: "100vh", background: T.bg, fontFamily: T.font, color: T.text, overflow: "hidden" }}>

      {/* Sidebar */}
      <div style={{ width: W, background: T.sidebar, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", flexShrink: 0, transition: "width 260ms cubic-bezier(.4,0,.2,1)", overflow: "hidden" }}>

        {/* Logo */}
        <div style={{ height: 64, padding: sidebarOpen ? "0 16px" : "0", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: sidebarOpen ? "flex-start" : "center", gap: 10, flexShrink: 0 }}>
          <FleetLogo size={32} />
          {sidebarOpen && (
            <div style={{ minWidth: 0, opacity: sidebarOpen ? 1 : 0, transition: "opacity 140ms" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: T.text, letterSpacing: -0.3, whiteSpace: "nowrap" }}>Fleet<span style={{ color: T.green }}>CC</span></div>
              <div style={{ fontSize: 9, color: T.textDim, letterSpacing: 1.2, textTransform: "uppercase", marginTop: 1 }}>Command Center</div>
            </div>
          )}
        </div>

        {/* User info */}
        {sidebarOpen && (
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, flexShrink: 0, opacity: sidebarOpen ? 1 : 0, transition: "opacity 140ms" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: `linear-gradient(135deg,${T.blue},${T.green})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 12, fontWeight: 700, color: "#fff" }}>
                {auth.user.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{auth.user.name}</div>
                <div style={{ fontSize: 10, color: T.textDim }}>{roleLabel[auth.user.role] || auth.user.role}</div>
              </div>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: sidebarOpen ? "10px 8px" : "10px 4px", overflowY: "auto" }}>
          {sidebarOpen && <div style={{ fontSize: 9, color: T.textDim, textTransform: "uppercase", letterSpacing: 1.2, padding: "6px 8px 8px", fontWeight: 700 }}>Menu</div>}
          {nav.map(n => {
            const isActive = active === n.id;
            return (
              <button key={n.id} onClick={() => handleSetActive(n.id)} title={!sidebarOpen ? n.label : ""}
                className="fcc-nav-btn"
                style={{ width: "100%", display: "flex", alignItems: "center", gap: sidebarOpen ? 10 : 0, justifyContent: sidebarOpen ? "flex-start" : "center", padding: sidebarOpen ? "9px 10px" : "9px 0", borderRadius: 8, border: "none", cursor: "pointer", marginBottom: 2, background: isActive ? T.navActive : "transparent", color: isActive ? T.blue : T.textSub, transition: "background 0.15s, color 0.15s, transform 0.15s", textAlign: "left", fontFamily: T.font, position: "relative" }}>
                <span style={{ color: isActive ? T.blue : T.textDim, flexShrink: 0, transition: "color 0.15s" }}><Icon d={n.icon} size={16} /></span>
                {sidebarOpen && <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, whiteSpace: "nowrap", opacity: sidebarOpen ? 1 : 0, transition: "opacity 140ms" }}>{n.label}</span>}
                {sidebarOpen && isActive && (
                  <div style={{ marginLeft: "auto", width: 3, borderRadius: 2, background: T.blue, flexShrink: 0, height: 16, animation: "scaleIn 180ms ease-out" }} />
                )}
              </button>
            );
          })}
        </nav>

        {/* Fleet live counts */}
        {sidebarOpen && can("gps") && (
          <div style={{ padding: "12px 16px", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
            <div style={{ fontSize: 9, color: T.textDim, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8, fontWeight: 700 }}>Flotta live</div>
            {[["active", T.green, "Attivi"], ["idle", T.yellow, "Fermi"], ["workshop", T.red, "Officina"]].map(([k, col, l]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: col }} />
                  <span style={{ fontSize: 11, color: T.textSub }}>{l}</span>
                </div>
                <span style={{ fontSize: 12, color: col, fontFamily: T.mono, fontWeight: 600 }}>{counts[k]}</span>
              </div>
            ))}
          </div>
        )}

        {/* Sidebar footer */}
        <div style={{ padding: sidebarOpen ? "0 8px 10px" : "0 4px 10px", flexShrink: 0, borderTop: `1px solid ${T.border}` }}>
          <button onClick={() => setSidebarOpen(v => !v)} title={sidebarOpen ? "Comprimi sidebar" : "Espandi sidebar"}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: sidebarOpen ? "flex-start" : "center", gap: 8, padding: sidebarOpen ? "8px 10px" : "8px 0", marginTop: 8, background: "transparent", border: "none", borderRadius: 8, color: T.textDim, cursor: "pointer", fontFamily: T.font, fontSize: 12, transition: "color 0.15s" }}>
            <Icon d={sidebarOpen ? "M11 19l-7-7 7-7 M18 19l-7-7 7-7" : "M13 5l7 7-7 7 M6 5l7 7-7 7"} size={14} />
            {sidebarOpen && "Comprimi"}
          </button>
          <ThemeToggle collapsed={!sidebarOpen} />
          <button onClick={() => setShowBugModal(true)}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: sidebarOpen ? "flex-start" : "center", gap: 8, padding: sidebarOpen ? "8px 10px" : "8px 0", background: "transparent", border: `1px solid ${T.red}44`, borderRadius: 8, color: T.red, cursor: "pointer", fontFamily: T.font, fontSize: 12, marginTop: 4, transition: "border-color 0.15s, color 0.15s" }}
            title={!sidebarOpen ? "Segnala un bug" : ""}>
            <span style={{ fontSize: 13 }}>🐛</span>
            {sidebarOpen && "Segnala un bug"}
          </button>
          {sidebarOpen && API.includes("localhost") && (
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: T.orange, border: `1px solid ${T.orange}44`, borderRadius: 4, padding: "2px 6px", alignSelf: "flex-start", marginTop: 4 }}>DEV</div>
          )}
          <button onClick={handleLogout}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: sidebarOpen ? "flex-start" : "center", gap: 8, padding: sidebarOpen ? "8px 10px" : "8px 0", background: "transparent", border: `1px solid ${T.border}`, borderRadius: 8, color: T.textSub, cursor: "pointer", fontFamily: T.font, fontSize: 12, marginTop: 4, transition: "border-color 0.15s, color 0.15s" }}
            title={!sidebarOpen ? "Esci" : ""}>
            <Icon d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9" size={14} />
            {sidebarOpen && "Esci"}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <div style={{ height: 64, padding: "0 24px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: T.sidebar, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {currentNav && <span style={{ color: T.textDim }}><Icon d={currentNav.icon} size={16} /></span>}
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{selectedVehicle ? selectedVehicle.name : (currentNav?.label || "")}</div>
              <div style={{ fontSize: 11, color: T.textDim, marginTop: 1 }}>{auth.tenant?.name} · {auth.tenant?.city}</div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: T.textDim, fontFamily: T.mono }}>
            {new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
          </div>
        </div>

        <div style={{ flex: 1, padding: "24px 28px", overflowY: "auto", background: T.bg }}>
          <Suspense fallback={<ModuleSpinner />}>
            <div key={moduleKey} style={{ animation: "fadeIn 220ms ease-out" }}>
              {renderModule()}
            </div>
          </Suspense>
        </div>
      </div>

      {showBugModal && <Suspense fallback={null}><BugReportModal auth={auth} onClose={() => setShowBugModal(false)} /></Suspense>}
    </div>
  );
}
