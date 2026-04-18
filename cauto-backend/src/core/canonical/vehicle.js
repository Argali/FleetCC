/**
 * Canonical Vehicle schema.
 *
 * This is the FleetCC-internal representation of a vehicle.
 * ERP-specific field names (TARGA, ID_MEZZO, etc.) never appear here.
 *
 * Field rules:
 *   id              — internal UUID (never the ERP ID)
 *   external_id     — ERP's own identifier, kept for upsert deduplication
 *   organization_id — tenant isolation (required, enforced)
 *   status          — normalized enum: ACTIVE | INACTIVE | WORKSHOP
 *   source          — which connector produced this record
 */

const { z } = require("zod");

const VehicleSchema = z.object({
  id:              z.string().uuid(),
  external_id:     z.string().min(1),
  organization_id: z.string().min(1),
  license_plate:   z.string().min(1),
  name:            z.string().optional().default(""),
  status:          z.enum(["ACTIVE", "INACTIVE", "WORKSHOP"]).default("ACTIVE"),
  vehicle_type:    z.string().optional().default(""),
  source:          z.string().default("unknown"),
  ingested_at:     z.string().datetime().optional(),
});

/**
 * Validate a raw object against the canonical Vehicle schema.
 * Returns { ok, data, errors }.
 *
 * @param {unknown} raw
 * @returns {{ ok: boolean, data?: object, errors?: string[] }}
 */
function validateVehicle(raw) {
  const result = VehicleSchema.safeParse(raw);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  return {
    ok:     false,
    errors: result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`),
  };
}

module.exports = { VehicleSchema, validateVehicle };
