import { http, HttpResponse } from "msw";

const BASE = "http://localhost:3001/api";

// ─── Auth ────────────────────────────────────────────────────────────────────

export const handlers = [
  http.post(`${BASE}/auth/login`, async ({ request }) => {
    const body = await request.json();
    if (body.email === "admin@test.com" && body.password === "password123") {
      return HttpResponse.json({
        ok: true,
        token: "test-jwt-token",
        user: { id: "1", name: "Test Admin", email: "admin@test.com", role: "company_admin" },
        tenant: { id: "t1", name: "Test Company" },
      });
    }
    return HttpResponse.json({ ok: false, message: "Credenziali non valide" }, { status: 401 });
  }),

  // ─── Permissions ────────────────────────────────────────────────────────────

  http.get(`${BASE}/permissions`, () => {
    return HttpResponse.json({
      ok: true,
      my_access: {
        gps: "full",
        navigation: "full",
        workshop: "full",
        fuel: "full",
        suppliers: "view",
        costs: "view",
        admin: "full",
      },
      matrix: {},
      roles: ["company_admin", "fleet_manager"],
      levels: ["none", "view", "edit", "full"],
    });
  }),

  // ─── Vehicles ───────────────────────────────────────────────────────────────

  http.get(`${BASE}/vehicles`, () => {
    return HttpResponse.json({
      ok: true,
      data: [
        { id: "v1", plate: "AB123CD", model: "Fiat Ducato", status: "active", km: 45000, fuel_level: 0.8 },
        { id: "v2", plate: "EF456GH", model: "Iveco Daily", status: "idle", km: 82000, fuel_level: 0.4 },
        { id: "v3", plate: "IJ789KL", model: "Renault Master", status: "workshop", km: 31000, fuel_level: 0.2 },
      ],
    });
  }),

  http.get(`${BASE}/vehicles/:id`, ({ params }) => {
    return HttpResponse.json({
      ok: true,
      data: { id: params.id, plate: "AB123CD", model: "Fiat Ducato", status: "active" },
    });
  }),

  // ─── Fleet stats ────────────────────────────────────────────────────────────

  http.get(`${BASE}/stats`, () => {
    return HttpResponse.json({
      ok: true,
      data: {
        total: 3,
        active: 1,
        idle: 1,
        workshop: 1,
        fuel_avg: 0.47,
      },
    });
  }),

  // ─── Workshop ───────────────────────────────────────────────────────────────

  http.get(`${BASE}/workshop/interventions`, () => {
    return HttpResponse.json({
      ok: true,
      data: [
        { id: "i1", vehicle_id: "v3", type: "maintenance", status: "in_progress", description: "Tagliando", created_at: "2026-01-10" },
      ],
    });
  }),

  // ─── Fuel ───────────────────────────────────────────────────────────────────

  http.get(`${BASE}/fuel`, () => {
    return HttpResponse.json({
      ok: true,
      data: [
        { id: "f1", vehicle_id: "v1", liters: 40, cost: 72, date: "2026-01-15" },
      ],
    });
  }),

  // ─── Health ─────────────────────────────────────────────────────────────────

  http.get("http://localhost:3001/health", () => {
    return HttpResponse.json({ status: "ok", uptime: 123 });
  }),
];
