const express  = require("express");
const ExcelJS  = require("exceljs");
const { requireAuth } = require("../middleware/auth");

// Import data from existing routes' in-memory stores
const workshopRoute  = require("./workshop");
const fuelRoute      = require("./fuel");
const segnalazioniRoute = require("./segnalazioni");

const router = express.Router();

// ─── Shared style helpers ────────────────────────────────────────────────────
function styleHeader(row) {
  row.eachCell(cell => {
    cell.font      = { bold: true, color: { argb: "FFD1FAE5" } };
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D2E0D" } };
    cell.border    = { bottom: { style: "thin", color: { argb: "FF2A6A2A" } } };
    cell.alignment = { vertical: "middle" };
  });
  row.height = 22;
}

function styleDataRow(row, shade) {
  row.eachCell(cell => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: shade ? "FF0A1A0A" : "FF060F06" } };
    cell.font = { color: { argb: "FFD1FAE5" } };
  });
}

function autoWidth(sheet) {
  sheet.columns.forEach(col => {
    let max = col.header ? col.header.length : 10;
    col.eachCell({ includeEmpty: false }, cell => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 4, 50);
  });
}

function sendWorkbook(res, workbook, filename) {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  workbook.xlsx.write(res).then(() => res.end());
}

// ─── Segnalazioni export ─────────────────────────────────────────────────────
router.get("/segnalazioni", requireAuth, async (req, res) => {
  const data = segnalazioniRoute.getData();

  const wb    = new ExcelJS.Workbook();
  wb.creator  = "Cauto Command Centre";
  wb.created  = new Date();

  const ws = wb.addWorksheet("Segnalazioni");
  ws.columns = [
    { header: "Data",         key: "created_at"    },
    { header: "Veicolo",      key: "vehicle"        },
    { header: "Targa",        key: "plate"          },
    { header: "Settore",      key: "settore"        },
    { header: "Tipo",         key: "tipo"           },
    { header: "Descrizione",  key: "description"    },
    { header: "Segnalante",   key: "reporter_name"  },
    { header: "Stato",        key: "status"         },
    { header: "Disp. dal",    key: "available_from" },
  ];

  styleHeader(ws.getRow(1));

  data.forEach((s, i) => {
    const row = ws.addRow({
      ...s,
      created_at: new Date(s.created_at).toLocaleString("it-IT"),
    });
    styleDataRow(row, i % 2 === 0);
  });

  autoWidth(ws);
  sendWorkbook(res, wb, `segnalazioni_${date()}.xlsx`);
});

// ─── Fuel export ─────────────────────────────────────────────────────────────
router.get("/fuel", requireAuth, async (req, res) => {
  const { entries, summary } = fuelRoute.getData();

  const wb   = new ExcelJS.Workbook();
  wb.creator = "Cauto Command Centre";
  wb.created = new Date();

  // Sheet 1 — entries
  const wsEntries = wb.addWorksheet("Rifornimenti");
  wsEntries.columns = [
    { header: "Data",     key: "date"     },
    { header: "Veicolo",  key: "vehicle"  },
    { header: "Litri",    key: "liters"   },
    { header: "Costo €",  key: "cost_eur" },
    { header: "KM",       key: "km"       },
    { header: "Stazione", key: "station"  },
  ];
  styleHeader(wsEntries.getRow(1));
  entries.forEach((e, i) => { const row = wsEntries.addRow(e); styleDataRow(row, i % 2 === 0); });
  autoWidth(wsEntries);

  // Sheet 2 — summary
  const wsSummary = wb.addWorksheet("Riepilogo");
  wsSummary.columns = [
    { header: "Metrica", key: "label" },
    { header: "Valore",  key: "value" },
  ];
  styleHeader(wsSummary.getRow(1));
  [
    ["Litri totali",         `${summary.total_liters} L`],
    ["Costo totale",         `€${summary.total_cost_eur}`],
    ["KM totali",            `${summary.total_km} km`],
    ["Consumo medio",        `${summary.avg_consumption_l100} L/100km`],
  ].forEach(([label, value], i) => {
    const row = wsSummary.addRow({ label, value });
    styleDataRow(row, i % 2 === 0);
  });
  autoWidth(wsSummary);

  sendWorkbook(res, wb, `carburante_${date()}.xlsx`);
});

// ─── Workshop export ──────────────────────────────────────────────────────────
router.get("/workshop", requireAuth, async (req, res) => {
  const orders = workshopRoute.getData();

  const wb   = new ExcelJS.Workbook();
  wb.creator = "Cauto Command Centre";
  wb.created = new Date();

  const ws = wb.addWorksheet("Ordini Officina");
  ws.columns = [
    { header: "Veicolo",   key: "vehicle"  },
    { header: "Targa",     key: "plate"    },
    { header: "Tipo",      key: "type"     },
    { header: "Stato",     key: "status"   },
    { header: "Meccanico", key: "mechanic" },
    { header: "ETA",       key: "eta"      },
    { header: "Note",      key: "notes"    },
  ];
  styleHeader(ws.getRow(1));
  orders.forEach((o, i) => { const row = ws.addRow(o); styleDataRow(row, i % 2 === 0); });
  autoWidth(ws);

  sendWorkbook(res, wb, `officina_${date()}.xlsx`);
});

// ─── Full fleet report (multi-sheet) ─────────────────────────────────────────
router.get("/fleet", requireAuth, async (req, res) => {
  const orders    = workshopRoute.getData();
  const { entries, summary } = fuelRoute.getData();
  const segnalazioni = segnalazioniRoute.getData();

  const wb   = new ExcelJS.Workbook();
  wb.creator = "Cauto Command Centre";
  wb.created = new Date();

  // Sheet 1 — fuel
  const wsF = wb.addWorksheet("Carburante");
  wsF.columns = [
    { header: "Data", key: "date" }, { header: "Veicolo", key: "vehicle" },
    { header: "Litri", key: "liters" }, { header: "Costo €", key: "cost_eur" },
    { header: "KM", key: "km" }, { header: "Stazione", key: "station" },
  ];
  styleHeader(wsF.getRow(1));
  entries.forEach((e, i) => { const row = wsF.addRow(e); styleDataRow(row, i % 2 === 0); });
  autoWidth(wsF);

  // Sheet 2 — workshop
  const wsW = wb.addWorksheet("Officina");
  wsW.columns = [
    { header: "Veicolo", key: "vehicle" }, { header: "Targa", key: "plate" },
    { header: "Tipo", key: "type" }, { header: "Stato", key: "status" },
    { header: "Meccanico", key: "mechanic" }, { header: "ETA", key: "eta" },
    { header: "Note", key: "notes" },
  ];
  styleHeader(wsW.getRow(1));
  orders.forEach((o, i) => { const row = wsW.addRow(o); styleDataRow(row, i % 2 === 0); });
  autoWidth(wsW);

  // Sheet 3 — segnalazioni
  const wsS = wb.addWorksheet("Segnalazioni");
  wsS.columns = [
    { header: "Data", key: "created_at" }, { header: "Veicolo", key: "vehicle" },
    { header: "Targa", key: "plate" }, { header: "Settore", key: "settore" },
    { header: "Tipo", key: "tipo" }, { header: "Descrizione", key: "description" },
    { header: "Segnalante", key: "reporter_name" }, { header: "Stato", key: "status" },
    { header: "Disp. dal", key: "available_from" },
  ];
  styleHeader(wsS.getRow(1));
  segnalazioni.forEach((s, i) => {
    const row = wsS.addRow({ ...s, created_at: new Date(s.created_at).toLocaleString("it-IT") });
    styleDataRow(row, i % 2 === 0);
  });
  autoWidth(wsS);

  // Sheet 4 — fuel summary
  const wsSummary = wb.addWorksheet("Riepilogo Carburante");
  wsSummary.columns = [{ header: "Metrica", key: "label" }, { header: "Valore", key: "value" }];
  styleHeader(wsSummary.getRow(1));
  [
    ["Litri totali", `${summary.total_liters} L`],
    ["Costo totale", `€${summary.total_cost_eur}`],
    ["KM totali", `${summary.total_km} km`],
    ["Consumo medio", `${summary.avg_consumption_l100} L/100km`],
  ].forEach(([label, value], i) => {
    const row = wsSummary.addRow({ label, value });
    styleDataRow(row, i % 2 === 0);
  });
  autoWidth(wsSummary);

  sendWorkbook(res, wb, `report_flotta_${date()}.xlsx`);
});

function date() {
  return new Date().toISOString().slice(0, 10);
}

module.exports = router;
