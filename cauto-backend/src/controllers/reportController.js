const reportService = require("../services/reportService");

function sendWorkbook(res, wb, filename) {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  wb.xlsx.write(res).then(() => res.end());
}

const reportController = {
  async segnalazioni(_req, res, next) {
    try { const { wb, filename } = await reportService.buildSegnalazioniWorkbook(); sendWorkbook(res, wb, filename); }
    catch (err) { next(err); }
  },

  async fuel(_req, res, next) {
    try { const { wb, filename } = await reportService.buildFuelWorkbook(); sendWorkbook(res, wb, filename); }
    catch (err) { next(err); }
  },

  async workshop(_req, res, next) {
    try { const { wb, filename } = await reportService.buildWorkshopWorkbook(); sendWorkbook(res, wb, filename); }
    catch (err) { next(err); }
  },

  async fleet(_req, res, next) {
    try { const { wb, filename } = await reportService.buildFleetWorkbook(); sendWorkbook(res, wb, filename); }
    catch (err) { next(err); }
  },
};

module.exports = reportController;
