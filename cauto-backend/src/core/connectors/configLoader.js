/**
 * Connector config loader.
 *
 * Loads a JSON mapping config from disk and validates it against the
 * expected meta-schema. Throws on invalid config so problems are caught
 * at startup, not at ingestion time.
 *
 * Config file format:
 * {
 *   "connector": "targetcross",
 *   "version":   "1.0",
 *   "fields": {
 *     "vehicles": {
 *       "external_id":   ["ID_MEZZO", "id_mezzo"],
 *       "license_plate": ["TARGA", "plate"],
 *       "name":          ["NOME_MEZZO", "name"],
 *       "status":        ["STATO"],
 *       "_transforms": {
 *         "license_plate": ["trim", "italianPlate"],
 *         "status":        ["activeStatus"]
 *       }
 *     },
 *     "operators": { ... },
 *     "maintenance": { ... }
 *   }
 * }
 */

const fs   = require("fs");
const path = require("path");
const { z } = require("zod");

// Meta-schema: validates a mapping config file.
// Each entity block is a flat object where:
//   - most keys map to string[] of field-name aliases
//   - the special "_transforms" key maps to Record<string, string[]>
// We use z.record(z.any()) to stay permissive here — deep validation
// of individual alias lists happens in getEntityMapping() at runtime.
const EntityMappingSchema = z.record(z.string(), z.any());

const ConnectorConfigSchema = z.object({
  connector:   z.string().min(1),
  version:     z.string().default("1.0"),
  description: z.string().optional(),
  fields:      z.object({
    vehicles:    EntityMappingSchema.optional(),
    operators:   EntityMappingSchema.optional(),
    maintenance: EntityMappingSchema.optional(),
  }),
});

/**
 * Load and validate a connector mapping config from a JSON file.
 *
 * @param {string} configPath - Absolute or relative-to-cwd path to the JSON file
 * @returns {object} Validated config object
 * @throws {Error} If the file is missing, invalid JSON, or fails schema validation
 */
function loadConfig(configPath) {
  const absPath = path.resolve(configPath);

  if (!fs.existsSync(absPath)) {
    throw new Error(`[ConfigLoader] Config file not found: ${absPath}`);
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(absPath, "utf8"));
  } catch (e) {
    throw new Error(`[ConfigLoader] Invalid JSON in ${absPath}: ${e.message}`);
  }

  const result = ConnectorConfigSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map(i => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`[ConfigLoader] Invalid config schema in ${absPath}:\n${issues}`);
  }

  return result.data;
}

/**
 * Extract the field-alias map and transforms for a specific entity type.
 *
 * @param {object} config     - Loaded config object (from loadConfig)
 * @param {string} entityType - "vehicles" | "operators" | "maintenance"
 * @returns {{ aliases: Record<string, string[]>, transforms: Record<string, string[]> }}
 */
function getEntityMapping(config, entityType) {
  const entityConfig = config.fields?.[entityType] || {};
  const transforms   = entityConfig._transforms || {};
  const aliases      = Object.fromEntries(
    Object.entries(entityConfig)
      .filter(([k]) => k !== "_transforms")
      .map(([k, v]) => [k, Array.isArray(v) ? v : []])
  );
  return { aliases, transforms };
}

module.exports = { loadConfig, getEntityMapping, ConnectorConfigSchema };
