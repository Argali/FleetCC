/**
 * Canonical MaintenanceEvent schema.
 *
 * Represents a single maintenance / workshop event.
 * ERP field names (TIPO_INTERVENTO, DATA_INTERVENTO, etc.) never appear here.
 */

const { z } = require("zod");

const MaintenanceEventSchema = z.object({
  id:              z.string().uuid(),
  external_id:     z.string().min(1),
  organization_id: z.string().min(1),
  vehicle_id:      z.string(),           // internal vehicle UUID (or external_id pre-join)
  vehicle_ext_id:  z.string(),           // ERP vehicle ID for cross-referencing before DB join
  event_type:      z.string().min(1),    // e.g. "oil_change", "repair", "inspection"
  description:     z.string().optional().default(""),
  date:            z.string(),           // ISO 8601 date string
  cost_eur:        z.number().nonnegative().optional(),
  mileage_km:      z.number().nonnegative().optional(),
  status:          z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]).default("CLOSED"),
  source:          z.string().default("unknown"),
  ingested_at:     z.string().datetime().optional(),
});

function validateMaintenanceEvent(raw) {
  const result = MaintenanceEventSchema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok:     false,
    errors: result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`),
  };
}

module.exports = { MaintenanceEventSchema, validateMaintenanceEvent };
