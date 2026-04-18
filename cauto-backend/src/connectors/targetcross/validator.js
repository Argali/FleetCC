/**
 * Target Cross — Validator
 *
 * Responsibility: run canonical Zod schemas over the mapped records.
 * Invalid records are separated from valid ones and returned as errors.
 * The pipeline never crashes on bad data — it logs and continues.
 */

const { validateVehicle, validateOperator, validateMaintenanceEvent } = require("../../core/canonical");

/**
 * Validate a list of records against a validator function.
 * Returns { valid: [], errors: [] }.
 *
 * @param {object[]}  records   - mapped canonical records
 * @param {Function}  validator - validateVehicle | validateOperator | validateMaintenanceEvent
 * @param {string}    entity    - entity name for error context
 */
function validateList(records, validator, entity) {
  const valid  = [];
  const errors = [];

  for (const record of records) {
    const result = validator(record);
    if (result.ok) {
      valid.push(result.data);
    } else {
      errors.push({
        entity,
        external_id: record.external_id || "unknown",
        issues:      result.errors,
      });
    }
  }

  return { valid, errors };
}

/**
 * Validate a full mapped dataset.
 * @param {{ vehicles, operators, maintenance }} mapped
 * @returns {{ valid: { vehicles, operators, maintenance }, errors: ValidationError[] }}
 */
function validate(mapped) {
  const vResult = validateList(mapped.vehicles    || [], validateVehicle,          "vehicle");
  const oResult = validateList(mapped.operators   || [], validateOperator,         "operator");
  const mResult = validateList(mapped.maintenance || [], validateMaintenanceEvent, "maintenance");

  return {
    valid: {
      vehicles:    vResult.valid,
      operators:   oResult.valid,
      maintenance: mResult.valid,
    },
    errors: [...vResult.errors, ...oResult.errors, ...mResult.errors],
  };
}

module.exports = { validate };
