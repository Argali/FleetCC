const { AppError }   = require("../middleware/errorHandler");
const workshopRepo   = require("../repositories/workshopRepository");

const VALID_STATUS = ["in_progress", "waiting_parts", "done"];

const workshopService = {
  getOrders() {
    return workshopRepo.findAll();
  },

  updateOrder(id, { status, mechanic, eta, notes }) {
    const updates = {};
    if (status   !== undefined) {
      if (!VALID_STATUS.includes(status)) throw new AppError("Stato non valido", 400);
      updates.status = status;
    }
    if (mechanic !== undefined) updates.mechanic = mechanic;
    if (eta      !== undefined) updates.eta      = eta;
    if (notes    !== undefined) updates.notes    = notes;

    const updated = workshopRepo.update(id, updates);
    if (!updated) throw new AppError("Ordine non trovato", 404);
    return updated;
  },
};

module.exports = workshopService;
