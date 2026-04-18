/**
 * Mapping engine — config-driven field resolution.
 *
 * Given a raw ERP row (object) and a list of candidate field-name aliases,
 * returns the first non-empty value found, or `defaultValue`.
 *
 * This means:
 *   - New client with different field names → new JSON config, not new code
 *   - Inconsistent ERP exports (some versions use TARGA, others use plate) → handled
 *
 * Example config entry:
 *   { "license_plate": ["TARGA", "plate", "Plate", "LICENSE_PLATE"] }
 *
 * Usage:
 *   const engine = require("./mapping.engine");
 *   const plate  = engine.resolveField(row, ["TARGA", "plate"]);
 */

/**
 * Resolve a single field from a raw row using an ordered alias list.
 *
 * @param {Record<string, unknown>} row       - Raw ERP record
 * @param {string[]}                aliases   - Candidate field names (priority order)
 * @param {unknown}                 defaultValue - Returned if no alias matches
 * @returns {unknown}
 */
function resolveField(row, aliases, defaultValue = null) {
  for (const alias of aliases) {
    const val = row[alias];
    if (val !== undefined && val !== null && val !== "") {
      return val;
    }
  }
  return defaultValue;
}

/**
 * Apply an entire field-mapping config to a raw row.
 *
 * @param {Record<string, unknown>}          row    - Raw ERP record
 * @param {Record<string, string[]>}         config - { canonicalField: [alias1, alias2, ...] }
 * @returns {Record<string, unknown>}               - Partially-filled canonical object
 */
function applyMapping(row, config) {
  const result = {};
  for (const [canonicalField, aliases] of Object.entries(config)) {
    result[canonicalField] = resolveField(row, aliases);
  }
  return result;
}

/**
 * Apply a transform function by name (registered in the transforms map).
 *
 * Built-in transforms:
 *   trim           → trim whitespace
 *   uppercase      → uppercase string
 *   lowercase      → lowercase string
 *   italianPlate   → normalize Italian license plates (remove spaces, uppercase)
 *   toISODate      → parse various date formats to ISO 8601
 *   toFloat        → parse string to float, null on failure
 *   toInt          → parse string to int, null on failure
 *   activeStatus   → normalize ERP boolean / string to "ACTIVE" | "INACTIVE"
 */
const TRANSFORMS = {
  trim:        (v) => (typeof v === "string" ? v.trim() : v),
  uppercase:   (v) => (typeof v === "string" ? v.toUpperCase() : v),
  lowercase:   (v) => (typeof v === "string" ? v.toLowerCase() : v),
  italianPlate:(v) => (typeof v === "string" ? v.replace(/\s+/g, "").toUpperCase() : v),
  toISODate:   (v) => {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
  },
  toFloat:     (v) => {
    const n = parseFloat(String(v).replace(",", "."));
    return isNaN(n) ? null : n;
  },
  toInt:       (v) => {
    const n = parseInt(String(v), 10);
    return isNaN(n) ? null : n;
  },
  activeStatus:(v) => {
    if (v === true || v === 1 || /^(attivo|active|1|si|yes|true)$/i.test(String(v))) return "ACTIVE";
    return "INACTIVE";
  },
};

/**
 * Apply a named transform to a value.
 * Unknown transform names are logged and skipped (value returned unchanged).
 *
 * @param {unknown} value
 * @param {string}  transformName
 * @returns {unknown}
 */
function applyTransform(value, transformName) {
  const fn = TRANSFORMS[transformName];
  if (!fn) {
    console.warn(`[MappingEngine] Unknown transform: "${transformName}"`);
    return value;
  }
  return fn(value);
}

/**
 * Apply a chain of transforms to a value.
 *
 * @param {unknown}  value
 * @param {string[]} transforms - ordered list of transform names
 * @returns {unknown}
 */
function applyTransforms(value, transforms = []) {
  return transforms.reduce((v, t) => applyTransform(v, t), value);
}

module.exports = { resolveField, applyMapping, applyTransform, applyTransforms, TRANSFORMS };
