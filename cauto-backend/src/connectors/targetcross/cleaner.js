/**
 * Target Cross — Cleaner
 *
 * Responsibility: fix ERP-specific data quality issues before mapping.
 * This is the place to absorb Target Cross chaos:
 *   - Encoding issues (Latin-1 artifacts in Italian text)
 *   - Inconsistent plate formats (with/without spaces/dashes)
 *   - Date format variations (DD/MM/YYYY, YYYY-MM-DD, Excel serial)
 *   - Boolean representations (S/N, 1/0, Sì/No, true/false)
 *   - Null-like strings ("NULL", "N/A", "-", "")
 *
 * Cleaner receives raw arrays (plain objects) and returns the same shape.
 * It must not change the field names — that's the mapper's job.
 */

/** Strings that should be treated as null/missing */
const NULL_STRINGS = new Set(["null", "n/a", "n.a.", "-", "nd", "n.d.", "none", ""]);

/**
 * Normalize a single value: strip null-like strings, trim whitespace.
 * @param {unknown} val
 * @returns {unknown}
 */
function normalizeValue(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (NULL_STRINGS.has(trimmed.toLowerCase())) return null;
    return trimmed;
  }
  return val;
}

/**
 * Recursively normalize all string values in an object.
 * @param {Record<string, unknown>} obj
 * @returns {Record<string, unknown>}
 */
function normalizeRecord(obj) {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, normalizeValue(v)])
  );
}

/**
 * Clean a raw vehicle record.
 * Add Target Cross-specific fixes here as you discover them.
 */
function cleanVehicle(raw) {
  return normalizeRecord(raw);
  // Future: fix known TC encoding artifact for "à" → "Ã\xa0" etc.
}

/**
 * Clean a raw operator record.
 */
function cleanOperator(raw) {
  return normalizeRecord(raw);
}

/**
 * Clean a raw maintenance record.
 */
function cleanMaintenance(raw) {
  const norm = normalizeRecord(raw);
  // TC sometimes exports dates as DD/MM/YYYY — convert for mapper
  // (The mapping engine's toISODate handles multiple formats, but
  //  an explicit fix here keeps the mapper pure.)
  for (const dateField of ["DATA_INTERVENTO", "data_intervento", "Date", "event_date"]) {
    if (norm[dateField] && typeof norm[dateField] === "string") {
      const ddmmyyyy = norm[dateField].match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (ddmmyyyy) {
        norm[dateField] = `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
      }
    }
  }
  return norm;
}

/**
 * Clean a full raw dataset.
 * @param {{ vehicles, operators, maintenance }} raw
 * @returns {{ vehicles, operators, maintenance }}
 */
function clean(raw) {
  return {
    vehicles:    (raw.vehicles    || []).map(cleanVehicle),
    operators:   (raw.operators   || []).map(cleanOperator),
    maintenance: (raw.maintenance || []).map(cleanMaintenance),
  };
}

module.exports = { clean, cleanVehicle, cleanOperator, cleanMaintenance };
