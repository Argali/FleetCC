/**
 * Centralized error handler — mount LAST in index.js
 * Services throw AppError for known errors, plain Error for unexpected ones.
 */

class AppError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
    this.isOperational = true;
  }
}

function errorHandler(err, _req, res, _next) {
  if (err.isOperational) {
    return res.status(err.status).json({ ok: false, error: err.message });
  }
  console.error("[Unhandled]", err);
  res.status(500).json({ ok: false, error: "Errore interno del server" });
}

module.exports = { AppError, errorHandler };
