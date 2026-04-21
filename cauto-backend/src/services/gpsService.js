const ExcelJS   = require("exceljs");
const { AppError } = require("../middleware/errorHandler");
const vehicleRepo        = require("../repositories/vehicleRepository");
const routeRepo          = require("../repositories/routeRepository");
const driverLocationRepo = require("../repositories/driverLocationRepository");

// ── Street normalization ──────────────────────────────────────────────────────
const ABBR = [
  [/^V\.\s+/i,      "Via "],
  [/^P\.zza?\s+/i,  "Piazza "],
  [/^Pzza?\s+/i,    "Piazza "],
  [/^Vle\.?\s+/i,   "Viale "],
  [/^C\.so\.?\s+/i, "Corso "],
  [/^Cso\.?\s+/i,   "Corso "],
  [/^Lgo\.?\s+/i,   "Largo "],
  [/^Bgo\.?\s+/i,   "Borgo "],
  [/^Str\.?\s+/i,   "Strada "],
  [/^Fraz\.?\s+/i,  "Frazione "],
  [/^Fr\.?\s+/i,    "Frazione "],
  [/^Loc\.?\s+/i,   "Localita "],
  [/^Vic\.?\s+/i,   "Vicolo "],
  [/^Vico\s+/i,     "Vicolo "],
  [/^S\.ta?\s+/i,   "Santa "],
  [/^S\.to\s+/i,    "Santo "],
];

function normalizeStreet(s) {
  if (!s) return "";
  s = s.trim();
  for (const [re, rep] of ABBR) {
    if (re.test(s)) { s = s.replace(re, rep); break; }
  }
  return s.replace(/\s+/g, " ").trim();
}

function extractCivico(address) {
  if (!address) return { street: "", civico: null };
  const m = address.trim().match(/^(.+?)\s+(\d+[a-zA-Z\/\-]*)\s*$/);
  if (m) return { street: m[1].trim(), civico: parseInt(m[2], 10) || null };
  return { street: address.trim(), civico: null };
}

async function geocodeAddress(street, civico, comune) {
  const q = civico != null
    ? `${street} ${civico}, ${comune}, Italia`
    : `${street}, ${comune}, Italia`;
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=it`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "FleetCC/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.length > 0 ? [parseFloat(data[0].lat), parseFloat(data[0].lon)] : null;
  } catch {
    return null;
  }
}

function decodePolyline6(encoded) {
  const coords = []; let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += ((result & 1) ? ~(result >> 1) : (result >> 1));
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += ((result & 1) ? ~(result >> 1) : (result >> 1));
    coords.push([lat / 1e6, lng / 1e6]);
  }
  return coords;
}

async function callValhalla(endpoint, body, timeoutMs = 12000) {
  const base       = process.env.VALHALLA_URL || "http://localhost:8002";
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const gpsService = {
  // ── Vehicles ──────────────────────────────────────────────────────────────
  async getVehicles() {
    return vehicleRepo.findAll();
  },

  // ── Routes ────────────────────────────────────────────────────────────────
  async getRoutes() {
    return routeRepo.findAll();
  },

  async createRoute(fields) {
    const { name, color, sector, vehicle, status, stops, waypoints,
            comune, materiali, materiale, tipo_mezzo } = fields;
    if (!name || !waypoints) throw new AppError("name e waypoints obbligatori", 400);
    return routeRepo.create({
      name,
      color:      color      || "#4ade80",
      sector:     sector     || "",
      vehicle:    vehicle    || "",
      status:     status     || "pianificato",
      stops:      stops      || 0,
      waypoints,
      comune:     comune     || "",
      materiali:  materiali  || [],
      materiale:  materiale  || "",
      tipo_mezzo: tipo_mezzo || "",
    });
  },

  async updateRoute(id, fields) {
    const { name, color, opacity, sector, vehicle, status, stops, waypoints,
            annotations, comune, materiali, materiale, tipo_mezzo } = fields;
    const updated = await routeRepo.update(id, {
      name, color, opacity, sector, vehicle, status, stops,
      waypoints, annotations, comune, materiali, materiale, tipo_mezzo,
    });
    if (!updated) throw new AppError("Percorso non trovato", 404);
    return updated;
  },

  async deleteRoute(id) {
    const ok = await routeRepo.delete(id);
    if (!ok) throw new AppError("Percorso non trovato", 404);
  },

  // ── Excel import (geocoding via Nominatim) ────────────────────────────────
  async importFromExcel(buffer) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.worksheets[0];
    if (!ws) throw new AppError("Foglio Excel vuoto o non valido", 400);

    const headerVals = ws.getRow(1).values;
    const hdr = {};
    headerVals.forEach((cell, i) => { if (cell) hdr[String(cell).trim().toLowerCase()] = i; });

    const cOrdine    = hdr["ordine"];
    const cIndirizzo = hdr["indirizzo"];
    const cComune    = hdr["comune"];
    if (cIndirizzo == null || cComune == null)
      throw new AppError("Colonne 'Indirizzo' e 'Comune' obbligatorie", 400);

    const rows = [];
    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) return;
      const indirizzo = String(row.getCell(cIndirizzo).value ?? "").trim();
      const comune    = String(row.getCell(cComune).value   ?? "").trim();
      if (!indirizzo || !comune) return;
      const ordine = cOrdine ? (parseFloat(row.getCell(cOrdine).value) || rowNum) : rowNum;
      const { street, civico } = extractCivico(indirizzo);
      rows.push({ ordine, street: normalizeStreet(street), civico, comune });
    });

    if (rows.length === 0) throw new AppError("Nessuna riga valida trovata nel file", 400);
    rows.sort((a, b) => a.ordine - b.ordine);

    // Group consecutive rows with same street + comune
    const groups = [];
    for (const row of rows) {
      const last = groups[groups.length - 1];
      if (last && last.street === row.street && last.comune === row.comune) {
        last.rows.push(row);
      } else {
        groups.push({ street: row.street, comune: row.comune, rows: [row] });
      }
    }

    const waypoints    = [];
    const unrecognized = [];
    for (let i = 0; i < groups.length; i++) {
      if (i > 0) await sleep(1100); // Nominatim rate-limit
      const g        = groups[i];
      const civicos  = g.rows.map(r => r.civico).filter(c => c != null);
      const midCivico = civicos.length > 0
        ? Math.round(civicos.reduce((a, b) => a + b, 0) / civicos.length) : null;
      const coords = await geocodeAddress(g.street, midCivico, g.comune);
      if (coords) {
        waypoints.push(coords);
      } else {
        const label = midCivico ? `${g.street} ${midCivico}, ${g.comune}` : `${g.street}, ${g.comune}`;
        unrecognized.push({ address: label, reason: "Non trovato su Nominatim" });
      }
    }

    if (waypoints.length < 2) {
      const err = new AppError(`Geocodifica insufficiente: solo ${waypoints.length} su ${groups.length} indirizzi trovati.`, 422);
      err.unrecognized = unrecognized;
      throw err;
    }
    return { waypoints, unrecognized };
  },

  // ── Snap-to-roads (Valhalla) ──────────────────────────────────────────────
  async snapToRoads(waypoints, costing = "auto") {
    if (!Array.isArray(waypoints) || waypoints.length < 2)
      throw new AppError("Servono almeno 2 waypoint.", 400);
    const locations = waypoints.map(([lat, lon]) => ({ lat, lon, type: "break" }));
    try {
      const data = await callValhalla("route", {
        locations,
        costing: costing === "truck" ? "truck" : "auto",
      });
      if (!data.trip?.legs) throw new AppError("Risposta Valhalla non valida.", 502);
      return { segments: data.trip.legs.map(leg => decodePolyline6(leg.shape)), unmatched: [] };
    } catch (err) {
      if (err.isOperational) throw err;
      if (err.code === "ECONNREFUSED" || err.name === "AbortError" || err.cause?.code === "ECONNREFUSED")
        throw new AppError("Valhalla non disponibile. Avvia il server di routing.", 503);
      throw err;
    }
  },

  // ── Turn-by-turn navigation (Valhalla) ────────────────────────────────────
  async navigate(from, to, costing = "auto") {
    if (!Array.isArray(from) || from.length < 2 || !Array.isArray(to) || to.length < 2)
      throw new AppError("from e to [lat,lon] obbligatori", 400);
    const body = {
      locations: [
        { lat: from[0], lon: from[1], type: "break" },
        { lat: to[0],   lon: to[1],   type: "break" },
      ],
      costing: costing === "truck" ? "truck" : "auto",
      directions_options: { language: "it-IT", units: "km" },
    };
    try {
      const data = await callValhalla("route", body, 15000);
      if (!data.trip?.legs?.length) throw new AppError("Nessun percorso trovato tra questi punti.", 502);
      const leg = data.trip.legs[0];
      const maneuvers = (leg.maneuvers || []).map(m => ({
        type: m.type, instruction: m.instruction || "",
        length: m.length || 0, time: m.time || 0,
        begin_shape_index: m.begin_shape_index, end_shape_index: m.end_shape_index,
      }));
      const summary = data.trip.summary || {};
      return { shape: decodePolyline6(leg.shape), maneuvers, distance: summary.length || 0, duration: summary.time || 0 };
    } catch (err) {
      if (err.isOperational) throw err;
      if (err.name === "AbortError" || err.code === "ECONNREFUSED" || err.cause?.code === "ECONNREFUSED")
        throw new AppError("Valhalla non disponibile. Controlla la connessione.", 503);
      throw err;
    }
  },

  // ── VisiRun extended endpoints (safe stubs on mock provider) ────────────────

  async getHistory(plate, date) {
    return vehicleRepo.getHistory(plate, date);
  },

  async getVehicleStops(plate, startDateTime, endDateTime) {
    return vehicleRepo.getStops(plate, startDateTime, endDateTime);
  },

  async getFleetKpi(date) {
    return vehicleRepo.getKpi(date);
  },

  async getFleetOdometer() {
    return vehicleRepo.getOdometer();
  },

  // ── Driver locations ───────────────────────────────────────────────────────
  setDriverLocation(userId, lat, lng, name) {
    if (lat == null || lng == null) throw new AppError("lat e lng obbligatori", 400);
    driverLocationRepo.set(userId, { lat: parseFloat(lat), lng: parseFloat(lng), name, userId });
  },

  removeDriverLocation(userId) {
    driverLocationRepo.delete(userId);
  },

  getActiveDriverLocations(excludeUserId) {
    return driverLocationRepo.findAllActive(excludeUserId);
  },
};

module.exports = gpsService;
