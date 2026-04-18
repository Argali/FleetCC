const { AppError }      = require("../middleware/errorHandler");
const segnalazioneRepo  = require("../repositories/segnalazioneRepository");

const segnalazioneService = {
  getAll() {
    return segnalazioneRepo.findAll();
  },

  create({ reporter_name, settore, vehicle, plate, description, tipo, available_from, photo_url }, user) {
    if (!reporter_name || !settore || !vehicle || !description)
      throw new AppError("Campi obbligatori: nome, settore, veicolo, descrizione", 400);
    const validTipo = segnalazioneRepo.VALID_TIPI;
    if (tipo && !validTipo.includes(tipo))
      throw new AppError("Tipo non valido", 400);

    return segnalazioneRepo.create({
      reporter_name,
      settore,
      vehicle,
      plate:          plate || null,
      description,
      tipo:           tipo || "guasto",
      available_from: available_from || null,
      photo_url:      photo_url || null,
      status:         "aperta",
      created_by:     user.id,
      created_by_name:user.name,
      created_at:     new Date().toISOString(),
    });
  },

  updateStatus(id, status) {
    if (!segnalazioneRepo.VALID_STATUS.includes(status))
      throw new AppError("Stato non valido", 400);
    const updated = segnalazioneRepo.updateStatus(id, status);
    if (!updated) throw new AppError("Segnalazione non trovata", 404);
    return updated;
  },
};

module.exports = segnalazioneService;
