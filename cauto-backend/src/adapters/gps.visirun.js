/**
 * VisiRun GPS adapter
 *
 * Implements the same interface as gps.mock.js so it can be swapped in via
 *   GPS_PROVIDER=visirun
 *
 * Live data calls:
 *   getVehicles()                  → getFleetCurrentPosition (cached 30 s)
 *   getHistory(plate, date)        → getRoute
 *   getStops(plate, start, end)    → getStops (max 7-day window)
 *   getKpi(date)                   → getFleetKpi
 *   getOdometer()                  → getFleetOdometer
 *
 * Route CRUD (plans/percorsi drawn in FleetCC) stays in memory — these are
 * internal planning objects, not VisiRun missions.
 */

const { callVisiRun, toArray } = require("../utils/visirun");

// ── In-memory route store (same as mock) ─────────────────────────────────────
let routes     = [];
let nextRouteId = 1;

// ── Vehicle position cache ────────────────────────────────────────────────────
const CACHE_TTL_MS = 30_000; // 30 s
let _vehicleCache    = null;
let _vehicleCacheAt  = 0;

// ── Mapping helpers ───────────────────────────────────────────────────────────

/**
 * Map a single CurrentPositionResponseElement to the internal vehicle shape.
 *
 * VisiRun fields → internal:
 *   remoteUnitSerial  → id
 *   vehicleName       → name
 *   vehiclePlate      → plate
 *   speed             → speed_kmh
 *   lat / lon         → lat / lng
 *   vehicleCategory   → sector
 *   datestamp         → last_seen
 *   (derived)         → status: active if speed > 0, else idle
 *   (n/a)             → fuel_pct: null (not in live position endpoint)
 */
function mapVehicle(el) {
  const speedKmh = parseFloat(el.speed) || 0;
  return {
    id:         String(el.remoteUnitSerial || ""),
    name:       el.vehicleName  || el.vehiclePlate || "Sconosciuto",
    plate:      el.vehiclePlate || "",
    status:     speedKmh > 0 ? "active" : "idle",
    speed_kmh:  speedKmh,
    fuel_pct:   null,                   // not available in this endpoint
    sector:     el.vehicleCategory || "",
    lat:        parseFloat(el.lat)  || 0,
    lng:        parseFloat(el.lon)  || 0,
    last_seen:  el.datestamp || null,
  };
}

/**
 * Map a single route point from getRoute response.
 *
 * Returns [lat, lng] or null if coordinates are missing.
 */
function mapRoutePoint(pt) {
  const lat = parseFloat(pt.lat);
  const lng = parseFloat(pt.lon ?? pt.lng);
  if (isNaN(lat) || isNaN(lng)) return null;
  return [lat, lng];
}

/**
 * Map a stop element from getStops response.
 */
function mapStop(el) {
  return {
    date:         el.date        || null,
    plate:        el.plate       || null,
    lat:          parseFloat(el.latitude)  || null,
    lng:          parseFloat(el.longitude) || null,
    start_time:   el.startTime   || null,
    end_time:     el.endTime     || null,
    duration:     el.duration    || null,
    poi_name:     el.poiName     || null,
    engine_on:    el.engineOnTime|| null,
  };
}

/**
 * Map a KPI element from getFleetKpi response.
 */
function mapKpi(el) {
  return {
    id:          el.remoteUnitSerial || null,
    name:        el.vehicleName      || null,
    plate:       el.vehiclePlate     || null,
    drive_time:  el.driveTime        || null,
    work_time:   el.workTime         || null,
    idle_time:   el.idleTime         || null,
    distance_m:  parseInt(el.distance, 10) || 0,
    consumption: parseFloat(el.consumption) || null,
    wasted_fuel: parseFloat(el.wastedFuel)  || null,
  };
}

/**
 * Map an odometer element from getFleetOdometer response.
 */
function mapOdometer(el) {
  return {
    id:          el.remoteUnitSerial || null,
    name:        el.vehicleName      || null,
    plate:       el.vehiclePlate     || null,
    total_km:    parseFloat(el.totalDistance) || null,
    engine_hours:parseFloat(el.engineHours)   || null,
  };
}

// ── Exported adapter interface ────────────────────────────────────────────────

module.exports = {
  /**
   * Return live fleet positions, cached for 30 seconds.
   */
  async getVehicles() {
    const now = Date.now();
    if (_vehicleCache && now - _vehicleCacheAt < CACHE_TTL_MS) {
      return _vehicleCache;
    }

    const response = await callVisiRun("getFleetCurrentPosition", {});

    // Navigate into the response.  VisiRun wraps elements in
    // CurrentPositionResponse > CurrentPositionResponseElement
    const wrapper  = response?.CurrentPositionResponse ?? response ?? {};
    const elements = toArray(wrapper.CurrentPositionResponseElement);
    const vehicles = elements.map(mapVehicle);

    _vehicleCache   = vehicles;
    _vehicleCacheAt = now;
    return vehicles;
  },

  /**
   * Return full-day GPS track for a vehicle.
   *
   * @param {string} plate   Vehicle plate or serial number
   * @param {string} date    yyyy-mm-dd
   * @returns {{ waypoints: [lat,lng][], summary: object }}
   */
  async getHistory(plate, date) {
    const response = await callVisiRun("getRoute", {
      vehicleCode: plate,
      date,
    });

    const wrapper  = response?.getRouteResponse ?? response ?? {};
    // Route response structure varies; normalise to array of points
    const points   = toArray(
      wrapper.RouteResponseElement ?? wrapper.item ?? wrapper.point ?? []
    );
    const waypoints = points.map(mapRoutePoint).filter(Boolean);

    const summary = wrapper.summary ?? {};
    return {
      waypoints,
      summary: {
        distance_km:    parseFloat(summary.distance)    || null,
        avg_speed_kmh:  parseFloat(summary.avgspeed)    || null,
        drive_time:     summary.driveTime               || null,
        stop_time:      summary.stopTime                || null,
        engine_on_time: summary.engineOnTime            || null,
      },
    };
  },

  /**
   * Return stop list for a vehicle within a time window (max 7 days).
   *
   * @param {string} plate          Vehicle plate or serial
   * @param {string} startDateTime  yyyy-mm-dd hh:mm:ss UTC
   * @param {string} endDateTime    yyyy-mm-dd hh:mm:ss UTC
   * @returns {object[]}
   */
  async getStops(plate, startDateTime, endDateTime) {
    const response = await callVisiRun("getStops", {
      vehicleCode:   plate,
      startDateTime,
      endDateTime,
    });

    const wrapper  = response?.getStopsResponse ?? response ?? {};
    const elements = toArray(wrapper.getStopsResponseElement ?? wrapper.item ?? []);
    return elements.map(mapStop);
  },

  /**
   * Return daily KPIs for the entire fleet.
   *
   * @param {string} date  yyyy-mm-dd
   * @returns {object[]}
   */
  async getKpi(date) {
    const response = await callVisiRun("getFleetKpi", { date });

    const wrapper  = response?.getFleetKpiResponse ?? response ?? {};
    const elements = toArray(wrapper.getFleetKpiResponseElement ?? wrapper.item ?? []);
    return elements.map(mapKpi);
  },

  /**
   * Return cumulative odometer readings for the entire fleet.
   *
   * @returns {object[]}
   */
  async getOdometer() {
    const response = await callVisiRun("getFleetOdometer", {});

    const wrapper  = response?.getFleetOdometerResponse ?? response ?? {};
    const elements = toArray(wrapper.getFleetOdometerResponseElement ?? wrapper.item ?? []);
    return elements.map(mapOdometer);
  },

  // ── In-memory route CRUD (planning objects, not VisiRun missions) ─────────

  async getRoutes() {
    return routes;
  },

  async createRoute(data) {
    const r = { id: `r${nextRouteId++}`, ...data };
    routes = [...routes, r];
    return r;
  },

  async updateRoute(id, data) {
    const idx = routes.findIndex(r => r.id === id);
    if (idx === -1) return null;
    const updated = { ...routes[idx], ...data };
    routes = routes.map(r => r.id === id ? updated : r);
    return updated;
  },

  async deleteRoute(id) {
    const exists = routes.some(r => r.id === id);
    if (!exists) return false;
    routes = routes.filter(r => r.id !== id);
    return true;
  },
};
