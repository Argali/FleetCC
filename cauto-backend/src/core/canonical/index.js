/**
 * Canonical model barrel.
 *
 * Also exposes factory helpers that generate internal UUIDs automatically,
 * so connectors don't need to import crypto directly.
 */

const { randomUUID } = require("crypto");
const { VehicleSchema, validateVehicle }           = require("./vehicle");
const { OperatorSchema, validateOperator }         = require("./operator");
const { MaintenanceEventSchema, validateMaintenanceEvent } = require("./maintenance");

/**
 * Create a canonical Vehicle record, generating a UUID if not provided.
 * @param {object} fields — must include all required canonical fields except `id`
 */
function createVehicle(fields) {
  return validateVehicle({
    id:          randomUUID(),
    ingested_at: new Date().toISOString(),
    ...fields,
  });
}

/**
 * Create a canonical Operator record.
 */
function createOperator(fields) {
  return validateOperator({
    id:          randomUUID(),
    ingested_at: new Date().toISOString(),
    ...fields,
  });
}

/**
 * Create a canonical MaintenanceEvent record.
 */
function createMaintenanceEvent(fields) {
  return validateMaintenanceEvent({
    id:          randomUUID(),
    ingested_at: new Date().toISOString(),
    ...fields,
  });
}

module.exports = {
  // Schemas (for external validation / typing)
  VehicleSchema,
  OperatorSchema,
  MaintenanceEventSchema,

  // Validators
  validateVehicle,
  validateOperator,
  validateMaintenanceEvent,

  // Factories (preferred — auto-generate UUID + ingested_at)
  createVehicle,
  createOperator,
  createMaintenanceEvent,
};
