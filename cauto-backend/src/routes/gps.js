const express = require("express");
const multer  = require("multer");
const ExcelJS = require("exceljs");
const adapter = require("../adapters");
const { requireAuth, requirePerm } = require("../middleware/auth");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── Excel import helpers ───────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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
  if (!address) return { street: "", civico: null, civico_original: null };
  const m = address.trim().match(/^(.+?)\s+(\d+[a-zA-Z\/\-]*)\s*$/);
  if (m) {
    const civico_original = m[2];
    const civico = parseInt(civico_original, 10) || null;
    return { street: m[1].trim(), civico, civico_original };
  }
  return { street: address.trim(), civico: null, civico_original: null };
}

async function nominatim(street, civico, comune) {
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
    if (data && data.length > 0) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    return null;
  } catch {
    return null;
  }
}

router.get("/vehicles", requireAuth, requirePerm("gps", "view"), async (_req, res) => {
  try {
    res.json({ ok: true, data: await adapter.getVehicles() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/routes", requireAuth, requirePerm("gps", "view"), async (_req, res) => {
  try {
    res.json({ ok: true, data: await adapter.getRoutes() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/routes", requireAuth, requirePerm("gps", "edit"), async (req, res) => {
  try {
    const { name, color, sector, vehicle, status, stops, waypoints } = req.body;
    if (!name || !waypoints) return res.status(400).json({ ok: false, error: "name e waypoints obbligatori" });
    const r = await adapter.createRoute({ name, color: color||"#4ade80", sector: sector||"", vehicle: vehicle||"", status: status||"pianificato", stops: stops||0, waypoints });
    res.status(201).json({ ok: true, data: r });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.put("/routes/:id", requireAuth, requirePerm("gps", "edit"), async (req, res) => {
  try {
    const r = await adapter.updateRoute(req.params.id, req.body);
    if (!r) return res.status(404).json({ ok: false, error: "Percorso non trovato" });
    res.json({ ok: true, data: r });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.delete("/routes/:id", requireAuth, requirePerm("gps", "edit"), async (req, res) => {
  try {
    const ok = await adapter.deleteRoute(req.params.id);
    if (!ok) return res.status(404).json({ ok: false, error: "Percorso non trovato" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Excel import ──────────────────────────────────────────────────────────────
router.post("/routes/import-excel", requireAuth, requirePerm("gps", "edit"), upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: "Nessun file ricevuto" });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(req.file.buffer);
    const ws = wb.worksheets[0];
    if (!ws) return res.status(400).json({ ok: false, error: "Foglio Excel vuoto o non valido" });

    // Map header columns (case-insensitive)
    const headerVals = ws.getRow(1).values; // 1-indexed; [0] is undefined
    const hdr = {};
    headerVals.forEach((cell, i) => { if (cell) hdr[String(cell).trim().toLowerCase()] = i; });

    const cOrdine   = hdr["ordine"];
    const cIndirizzo = hdr["indirizzo"];
    const cComune   = hdr["comune"];
    if (cIndirizzo == null || cComune == null)
      return res.status(400).json({ ok: false, error: "Colonne 'Indirizzo' e 'Comune' obbligatorie" });

    // Parse rows
    const rows = [];
    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) return;
      const indirizzo = String(row.getCell(cIndirizzo).value ?? "").trim();
      const comune    = String(row.getCell(cComune).value   ?? "").trim();
      if (!indirizzo || !comune) return;
      const ordine = cOrdine ? (parseFloat(row.getCell(cOrdine).value) || rowNum) : rowNum;
      const { street, civico, civico_original } = extractCivico(indirizzo);
      rows.push({ ordine, indirizzo, street: normalizeStreet(street), civico, civico_original, comune });
    });

    if (rows.length === 0)
      return res.status(400).json({ ok: false, error: "Nessuna riga valida trovata nel file" });

    // Sort by Ordine
    rows.sort((a, b) => a.ordine - b.ordine);

    // Group consecutive rows with same normalized street + comune
    const groups = [];
    for (const row of rows) {
      const last = groups[groups.length - 1];
      if (last && last.street === row.street && last.comune === row.comune) {
        last.rows.push(row);
      } else {
        groups.push({ street: row.street, comune: row.comune, rows: [row] });
      }
    }

    // Geocode each group via Nominatim (1100ms rate-limit)
    const waypoints = [];
    const unrecognized = [];

    for (let i = 0; i < groups.length; i++) {
      if (i > 0) await sleep(1100);
      const g = groups[i];
      const civicos = g.rows.map(r => r.civico).filter(c => c != null);
      const midCivico = civicos.length > 0
        ? Math.round(civicos.reduce((a, b) => a + b, 0) / civicos.length)
        : null;

      const coords = await nominatim(g.street, midCivico, g.comune);
      if (coords) {
        waypoints.push(coords);
      } else {
        const label = midCivico ? `${g.street} ${midCivico}, ${g.comune}` : `${g.street}, ${g.comune}`;
        unrecognized.push({ address: label, reason: "Non trovato su Nominatim" });
      }
    }

    if (waypoints.length < 2)
      return res.status(422).json({
        ok: false,
        error: `Geocodifica insufficiente: solo ${waypoints.length} su ${groups.length} indirizzi trovati.`,
        unrecognized,
      });

    res.json({ ok: true, data: { waypoints, unrecognized } });
  } catch (err) {
    console.error("Excel import error:", err);
    res.status(500).json({ ok: false, error: `Errore elaborazione: ${err.message}` });
  }
});

// ── Snap-to-roads (Valhalla) ───────────────────────────────────────────────────
function decodePolyline6(encoded) {
  const coords=[]; let index=0,lat=0,lng=0;
  while(index<encoded.length){
    let b,shift=0,result=0;
    do{b=encoded.charCodeAt(index++)-63;result|=(b&0x1f)<<shift;shift+=5;}while(b>=0x20);
    lat+=((result&1)?~(result>>1):(result>>1));
    shift=0;result=0;
    do{b=encoded.charCodeAt(index++)-63;result|=(b&0x1f)<<shift;shift+=5;}while(b>=0x20);
    lng+=((result&1)?~(result>>1):(result>>1));
    coords.push([lat/1e6,lng/1e6]);
  }
  return coords;
}

router.post("/routes/snap-to-roads", requireAuth, async (req, res) => {
  const { waypoints, costing = "auto" } = req.body;
  if (!Array.isArray(waypoints) || waypoints.length < 2) {
    return res.status(400).json({ ok: false, error: "Servono almeno 2 waypoint." });
  }
  const valhallaUrl = process.env.VALHALLA_URL || "http://localhost:8002";
  const costingMapped = costing === "truck" ? "truck" : "auto";
  const locations = waypoints.map(([lat, lon]) => ({ lat, lon, type: "break" }));
  const body = { locations, costing: costingMapped };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let response;
    try {
      response = await fetch(`${valhallaUrl}/route`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    const data = await response.json();
    if (!data.trip || !data.trip.legs) {
      return res.status(502).json({ ok: false, error: "Risposta Valhalla non valida." });
    }
    const segments = data.trip.legs.map(leg => decodePolyline6(leg.shape));
    return res.json({ ok: true, data: { segments, unmatched: [] } });
  } catch (err) {
    if (err.code === "ECONNREFUSED" || err.name === "AbortError" || err.cause?.code === "ECONNREFUSED") {
      return res.json({ ok: false, error: "Valhalla non disponibile. Avvia il server di routing." });
    }
    console.error("snap-to-roads error:", err);
    return res.status(500).json({ ok: false, error: `Errore snap-to-roads: ${err.message}` });
  }
});

module.exports = router;
