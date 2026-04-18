/**
 * Canonical Operator schema.
 *
 * Represents a driver / fleet operator.
 * ERP field names (NOME_OPERATORE, MATRICOLA, etc.) never appear here.
 */

const { z } = require("zod");

const OperatorSchema = z.object({
  id:              z.string().uuid(),
  external_id:     z.string().min(1),
  organization_id: z.string().min(1),
  name:            z.string().min(1),
  email:           z.string().email().optional(),
  role:            z.string().optional().default("driver"),
  status:          z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  source:          z.string().default("unknown"),
  ingested_at:     z.string().datetime().optional(),
});

function validateOperator(raw) {
  const result = OperatorSchema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok:     false,
    errors: result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`),
  };
}

module.exports = { OperatorSchema, validateOperator };
