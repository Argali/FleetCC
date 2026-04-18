/**
 * ERP adapter — env-driven provider switch.
 *
 * Controlled by ERP_SOURCE environment variable:
 *   ERP_SOURCE=mock         → in-memory mock data (default, development)
 *   ERP_SOURCE=targetcross  → reads from the live ingestion snapshot
 *
 * This adapter exposes the same interface regardless of source,
 * so repositories never need to know which ERP is active.
 *
 * Interface:
 *   getVehicles(organizationId)    → CanonicalVehicle[]
 *   getOperators(organizationId)   → CanonicalOperator[]
 *   getMaintenance(organizationId) → CanonicalMaintenanceEvent[]
 *   getStatus(organizationId)      → { source, updated_at, counts }
 */

const snapshot = require("./snapshot");
const logger   = require("../../utils/logger");

const ERP_SOURCE = process.env.ERP_SOURCE || "mock";

// ── Mock fallback data (canonical format) ─────────────────────────────────────
// Mirrors the existing gps.mock.js vehicles but in canonical shape.
// Keeps the app fully functional when no ERP is connected.
const MOCK_VEHICLES = [
  { id:"00000000-0000-0000-0000-000000000001", external_id:"v1", organization_id:"cauto", license_plate:"FE-123AA", name:"Camion 01",  status:"ACTIVE",   vehicle_type:"compattatore", source:"mock" },
  { id:"00000000-0000-0000-0000-000000000002", external_id:"v2", organization_id:"cauto", license_plate:"FE-456BB", name:"Camion 02",  status:"INACTIVE",  vehicle_type:"compattatore", source:"mock" },
  { id:"00000000-0000-0000-0000-000000000003", external_id:"v3", organization_id:"cauto", license_plate:"FE-789CC", name:"Camion 03",  status:"WORKSHOP",  vehicle_type:"compattatore", source:"mock" },
  { id:"00000000-0000-0000-0000-000000000004", external_id:"v4", organization_id:"cauto", license_plate:"FE-321DD", name:"Furgone 01", status:"ACTIVE",   vehicle_type:"furgone",      source:"mock" },
  { id:"00000000-0000-0000-0000-000000000005", external_id:"v5", organization_id:"cauto", license_plate:"FE-654EE", name:"Furgone 02", status:"INACTIVE",  vehicle_type:"furgone",      source:"mock" },
  { id:"00000000-0000-0000-0000-000000000006", external_id:"v6", organization_id:"cauto", license_plate:"FE-987FF", name:"Camion 04",  status:"ACTIVE",   vehicle_type:"compattatore", source:"mock" },
];

const MOCK_OPERATORS = [
  { id:"00000000-0000-0000-0000-000000000101", external_id:"op1", organization_id:"cauto", name:"Mario Rossi",   role:"driver",     status:"ACTIVE",  source:"mock" },
  { id:"00000000-0000-0000-0000-000000000102", external_id:"op2", organization_id:"cauto", name:"Luigi Bianchi", role:"driver",     status:"ACTIVE",  source:"mock" },
  { id:"00000000-0000-0000-0000-000000000103", external_id:"op3", organization_id:"cauto", name:"Anna Verdi",    role:"supervisor", status:"ACTIVE",  source:"mock" },
];

const MOCK_MAINTENANCE = [];

// ── Adapter implementation ────────────────────────────────────────────────────

const erpAdapter = {
  /**
   * Return canonical vehicles for a tenant.
   * Reads from connector snapshot if ERP_SOURCE != mock, falls back to mock.
   */
  getVehicles(organizationId = "cauto") {
    if (ERP_SOURCE !== "mock") {
      const snap = snapshot.get(organizationId);
      if (snap) return snap.vehicles;
      logger.warn({ organizationId, source: ERP_SOURCE }, "ERP snapshot not yet available — using mock fallback");
    }
    return MOCK_VEHICLES.filter(v => v.organization_id === organizationId);
  },

  getOperators(organizationId = "cauto") {
    if (ERP_SOURCE !== "mock") {
      const snap = snapshot.get(organizationId);
      if (snap) return snap.operators;
    }
    return MOCK_OPERATORS.filter(o => o.organization_id === organizationId);
  },

  getMaintenance(organizationId = "cauto") {
    if (ERP_SOURCE !== "mock") {
      const snap = snapshot.get(organizationId);
      if (snap) return snap.maintenance;
    }
    return MOCK_MAINTENANCE;
  },

  /** Observability — last sync metadata */
  getStatus(organizationId = "cauto") {
    const snap = snapshot.get(organizationId);
    return {
      source:     ERP_SOURCE,
      connected:  ERP_SOURCE !== "mock",
      updated_at: snap?.updated_at || null,
      counts: {
        vehicles:    snap?.vehicles?.length    ?? MOCK_VEHICLES.length,
        operators:   snap?.operators?.length   ?? MOCK_OPERATORS.length,
        maintenance: snap?.maintenance?.length ?? 0,
      },
    };
  },
};

logger.info({ source: ERP_SOURCE }, "ERP adapter initialised");

module.exports = erpAdapter;
