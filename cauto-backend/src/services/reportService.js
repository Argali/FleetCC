const ExcelJS        = require("exceljs");
const workshopRepo   = require("../repositories/workshopRepository");
const fuelRepo       = require("../repositories/fuelRepository");
const segnalazioneRepo = require("../repositories/segnalazioneRepository");

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

function dateStr() {
  return new Date().toISOString().slice(0, 10);
}

const reportService = {
  async buildSegnalazioniWorkbook() {
    const data = segnalazioneRepo.findAll();
    const wb   = new ExcelJS.Workbook();
    wb.creator = "Cauto Command Centre";
    wb.created = new Date();
    const ws = wb.addWorksheet("Segnalazioni");
    ws.columns = [
      { header: "Data",        key: "created_at"    },
      { header: "Veicolo",     key: "vehicle"        },
      { header: "Targa",       key: "plate"          },
      { header: "Settore",     key: "settore"        },
      { header: "Tipo",        key: "tipo"           },
      { header: "Descrizione", key: "description"    },
      { header: "Segnalante",  key: "reporter_name"  },
      { header: "Stato",       key: "status"         },
      { header: "Disp. dal",   key: "available_from" },
    ];
    styleHeader(ws.getRow(1));
    data.forEach((s, i) => { const row = ws.addRow({ ...s, created_at: new Date(s.created_at).toLocaleString("it-IT") }); styleDataRow(row, i % 2 === 0); });
    autoWidth(ws);
    return { wb, filename: `segnalazioni_${dateStr()}.xlsx` };
  },

  async buildFuelWorkbook() {
    const entries = fuelRepo.findAllEntries();
    const summary = fuelRepo.getSummary();
    const wb      = new ExcelJS.Workbook();
    wb.creator    = "Cauto Command Centre";
    wb.created    = new Date();
    const wsE = wb.addWorksheet("Rifornimenti");
    wsE.columns = [
      { header: "Data",     key: "date"     },
      { header: "Veicolo",  key: "vehicle"  },
      { header: "Litri",    key: "liters"   },
      { header: "Costo €",  key: "cost_eur" },
      { header: "KM",       key: "km"       },
      { header: "Stazione", key: "station"  },
    ];
    styleHeader(wsE.getRow(1));
    entries.forEach((e, i) => { const row = wsE.addRow(e); styleDataRow(row, i % 2 === 0); });
    autoWidth(wsE);
    const wsS = wb.addWorksheet("Riepilogo");
    wsS.columns = [{ header: "Metrica", key: "label" }, { header: "Valore", key: "value" }];
    styleHeader(wsS.getRow(1));
    [
      ["Litri totali",  `${summary.total_liters} L`],
      ["Costo totale",  `€${summary.total_cost_eur}`],
      ["KM totali",     `${summary.total_km} km`],
      ["Consumo medio", `${summary.avg_consumption_l100} L/100km`],
    ].forEach(([label, value], i) => { const row = wsS.addRow({ label, value }); styleDataRow(row, i % 2 === 0); });
    autoWidth(wsS);
    return { wb, filename: `carburante_${dateStr()}.xlsx` };
  },

  async buildWorkshopWorkbook() {
    const orders = workshopRepo.findAll();
    const wb     = new ExcelJS.Workbook();
    wb.creator   = "Cauto Command Centre";
    wb.created   = new Date();
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
    return { wb, filename: `officina_${dateStr()}.xlsx` };
  },

  async buildFleetWorkbook() {
    const orders  = workshopRepo.findAll();
    const entries = fuelRepo.findAllEntries();
    const summary = fuelRepo.getSummary();
    const segs    = segnalazioneRepo.findAll();
    const wb      = new ExcelJS.Workbook();
    wb.creator    = "Cauto Command Centre";
    wb.created    = new Date();

    const wsF = wb.addWorksheet("Carburante");
    wsF.columns = [
      { header: "Data", key: "date" }, { header: "Veicolo", key: "vehicle" },
      { header: "Litri", key: "liters" }, { header: "Costo €", key: "cost_eur" },
      { header: "KM", key: "km" }, { header: "Stazione", key: "station" },
    ];
    styleHeader(wsF.getRow(1));
    entries.forEach((e, i) => { const row = wsF.addRow(e); styleDataRow(row, i % 2 === 0); });
    autoWidth(wsF);

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

    const wsS = wb.addWorksheet("Segnalazioni");
    wsS.columns = [
      { header: "Data", key: "created_at" }, { header: "Veicolo", key: "vehicle" },
      { header: "Targa", key: "plate" }, { header: "Settore", key: "settore" },
      { header: "Tipo", key: "tipo" }, { header: "Descrizione", key: "description" },
      { header: "Segnalante", key: "reporter_name" }, { header: "Stato", key: "status" },
      { header: "Disp. dal", key: "available_from" },
    ];
    styleHeader(wsS.getRow(1));
    segs.forEach((s, i) => {
      const row = wsS.addRow({ ...s, created_at: new Date(s.created_at).toLocaleString("it-IT") });
      styleDataRow(row, i % 2 === 0);
    });
    autoWidth(wsS);

    const wsSumm = wb.addWorksheet("Riepilogo Carburante");
    wsSumm.columns = [{ header: "Metrica", key: "label" }, { header: "Valore", key: "value" }];
    styleHeader(wsSumm.getRow(1));
    [
      ["Litri totali",  `${summary.total_liters} L`],
      ["Costo totale",  `€${summary.total_cost_eur}`],
      ["KM totali",     `${summary.total_km} km`],
      ["Consumo medio", `${summary.avg_consumption_l100} L/100km`],
    ].forEach(([label, value], i) => { const row = wsSumm.addRow({ label, value }); styleDataRow(row, i % 2 === 0); });
    autoWidth(wsSumm);

    return { wb, filename: `report_flotta_${dateStr()}.xlsx` };
  },
};

module.exports = reportService;
