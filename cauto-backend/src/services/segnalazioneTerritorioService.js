const { AppError } = require("../middleware/errorHandler");
const repo         = require("../repositories/segnalazioneTerritorioRepository");

const segnalazioneTerritorioService = {
  getAll() {
    return repo.findAll();
  },

  create({ tipo, note, address, lat, lng }, user) {
    if (!tipo || !repo.VALID_TIPI.includes(tipo))
      throw new AppError("Tipo non valido", 400);
    if (!address && (lat == null || lng == null))
      throw new AppError("Indirizzo o coordinate obbligatori", 400);
    if (tipo === "altro" && !note?.trim())
      throw new AppError("Nota obbligatoria per tipo 'Altro'", 400);

    return repo.create({
      tipo,
      note:            note?.trim() || null,
      address:         address || null,
      lat:             lat != null ? parseFloat(lat) : null,
      lng:             lng != null ? parseFloat(lng) : null,
      status:          "aperta",
      created_by:      user.id,
      created_by_name: user.name,
      created_at:      new Date().toISOString(),
    });
  },

  updateStatus(id, status) {
    if (!repo.VALID_STATUS.includes(status))
      throw new AppError("Stato non valido", 400);
    const updated = repo.updateStatus(id, status);
    if (!updated) throw new AppError("Segnalazione non trovata", 404);
    return updated;
  },

  addIntervention(id, { note, photo_url }, user) {
    if (!note?.trim() && !photo_url)
      throw new AppError("Nota o foto obbligatoria", 400);
    const updated = repo.addIntervention(id, {
      note:         note?.trim() || null,
      photo_url:    photo_url || null,
      done_by:      user.id,
      done_by_name: user.name,
      done_at:      new Date().toISOString(),
    });
    if (!updated) throw new AppError("Segnalazione non trovata", 404);
    return updated;
  },

  delete(id) {
    const ok = repo.delete(id);
    if (!ok) throw new AppError("Segnalazione non trovata", 404);
  },
};

module.exports = segnalazioneTerritorioService;
