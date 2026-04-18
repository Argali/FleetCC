/**
 * Target Cross — Mapper
 *
 * Responsibility: convert cleaned raw records → canonical models
 * using the mapping engine + the JSON config file.
 *
 * The mapper never hardcodes field names like "TARGA" or "ID_MEZZO".
 * It asks the engine to resolve them from the config aliases.
 * This means a new client with different TC field names = new JSON config, not new code.
 */

const { randomUUID }               = require("crypto");
const engine                       = require("../../core/connectors/mapping.engine");
const { getEntityMapping }         = require("../../core/connectors/configLoader");

/**
 * Map a cleaned raw vehicle record to a canonical Vehicle.
 * @param {object} raw
 * @param {object} mapping - { aliases, transforms }
 * @param {string} organizationId
 * @returns {object} partial canonical Vehicle (not yet validated)
 */
function mapVehicle(raw, mapping, organizationId) {
  const { aliases, transforms } = mapping;
  const partial = engine.applyMapping(raw, aliases);

  // Apply field-level transforms
  for (const [field, txList] of Object.entries(transforms)) {
    if (partial[field] !== undefined) {
      partial[field] = engine.applyTransforms(partial[field], txList);
    }
  }

  return {
    id:              randomUUID(),
    external_id:     partial.external_id   || String(raw.ID_MEZZO || raw.id || ""),
    organization_id: organizationId,
    license_plate:   partial.license_plate || "",
    name:            partial.name          || "",
    status:          partial.status        || "ACTIVE",
    vehicle_type:    partial.vehicle_type  || "",
    source:          "targetcross",
    ingested_at:     new Date().toISOString(),
  };
}

/**
 * Map a cleaned raw operator record to a canonical Operator.
 */
function mapOperator(raw, mapping, organizationId) {
  const { aliases, transforms } = mapping;
  const partial = engine.applyMapping(raw, aliases);

  for (const [field, txList] of Object.entries(transforms)) {
    if (partial[field] !== undefined) {
      partial[field] = engine.applyTransforms(partial[field], txList);
    }
  }

  return {
    id:              randomUUID(),
    external_id:     partial.external_id || "",
    organization_id: organizationId,
    name:            partial.name        || "",
    email:           partial.email       || undefined,
    role:            partial.role        || "driver",
    status:          partial.status      || "ACTIVE",
    source:          "targetcross",
    ingested_at:     new Date().toISOString(),
  };
}

/**
 * Map a cleaned raw maintenance record to a canonical MaintenanceEvent.
 */
function mapMaintenance(raw, mapping, organizationId) {
  const { aliases, transforms } = mapping;
  const partial = engine.applyMapping(raw, aliases);

  for (const [field, txList] of Object.entries(transforms)) {
    if (partial[field] !== undefined) {
      partial[field] = engine.applyTransforms(partial[field], txList);
    }
  }

  return {
    id:              randomUUID(),
    external_id:     partial.external_id   || "",
    organization_id: organizationId,
    vehicle_id:      partial.vehicle_ext_id || "", // resolved to internal UUID in Phase 3
    vehicle_ext_id:  partial.vehicle_ext_id || "",
    event_type:      partial.event_type    || "unknown",
    description:     partial.description   || "",
    date:            partial.date          || new Date().toISOString().split("T")[0],
    cost_eur:        typeof partial.cost_eur   === "number" ? partial.cost_eur   : undefined,
    mileage_km:      typeof partial.mileage_km === "number" ? partial.mileage_km : undefined,
    status:          "CLOSED",
    source:          "targetcross",
    ingested_at:     new Date().toISOString(),
  };
}

/**
 * Map a full cleaned dataset to canonical models.
 * @param {{ vehicles, operators, maintenance }} cleaned
 * @param {object} config  - loaded connector config (from configLoader)
 * @param {string} organizationId
 * @returns {{ vehicles, operators, maintenance }}
 */
function map(cleaned, config, organizationId) {
  const vehicleMapping     = getEntityMapping(config, "vehicles");
  const operatorMapping    = getEntityMapping(config, "operators");
  const maintenanceMapping = getEntityMapping(config, "maintenance");

  return {
    vehicles:    (cleaned.vehicles    || []).map(r => mapVehicle(r, vehicleMapping, organizationId)),
    operators:   (cleaned.operators   || []).map(r => mapOperator(r, operatorMapping, organizationId)),
    maintenance: (cleaned.maintenance || []).map(r => mapMaintenance(r, maintenanceMapping, organizationId)),
  };
}

module.exports = { map, mapVehicle, mapOperator, mapMaintenance };
