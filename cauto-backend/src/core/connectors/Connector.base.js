/**
 * Abstract base connector.
 *
 * Every ERP connector must extend this class and implement:
 *   parse()   — fetch raw bytes and return a structured raw dataset
 *   clean()   — fix encoding, trim noise, normalize casing
 *   map()     — convert raw → canonical models using the mapping engine
 *   validate()— run Zod schemas, separate valid from invalid records
 *
 * The run() method orchestrates the lifecycle and always returns a RunResult,
 * even when individual steps fail — so the scheduler can log + continue.
 *
 * Concrete example:
 *   class TargetCrossConnector extends ConnectorBase { ... }
 */

const logger = require("../../utils/logger");

class ConnectorBase {
  /**
   * @param {string} name            - Unique connector identifier (e.g. "targetcross")
   * @param {object} config          - Loaded mapping config (from configLoader.loadConfig)
   * @param {object} [options]
   * @param {string} [options.organizationId] - Tenant scope for this run
   */
  constructor(name, config, options = {}) {
    if (new.target === ConnectorBase) {
      throw new Error("ConnectorBase is abstract — extend it, don't instantiate it directly.");
    }
    this.name           = name;
    this.config         = config;
    this.organizationId = options.organizationId || "default";
    this.log            = logger.child({ connector: name, tenant: this.organizationId });
  }

  // ─── Lifecycle hooks (override in subclass) ─────────────────────────────────

  /**
   * Fetch raw data from the ERP source.
   * @returns {Promise<RawDataset>} raw dataset ready for clean()
   *
   * RawDataset shape:
   *   { vehicles: object[], operators: object[], maintenance: object[] }
   */
  // eslint-disable-next-line no-unused-vars
  async parse() {
    throw new Error(`[${this.name}] parse() must be implemented`);
  }

  /**
   * Fix encoding issues, trim whitespace, normalize known inconsistencies.
   * @param {RawDataset} raw
   * @returns {RawDataset} cleaned (same shape)
   */
  async clean(raw) {
    // Default: pass through — override for ERP-specific quirks
    return raw;
  }

  /**
   * Map cleaned raw records to canonical models using the mapping engine.
   * @param {RawDataset} cleaned
   * @returns {CanonicalDataset} { vehicles: CanonicalVehicle[], operators: CanonicalOperator[], maintenance: CanonicalMaintenanceEvent[] }
   */
  // eslint-disable-next-line no-unused-vars
  async map(cleaned) {
    throw new Error(`[${this.name}] map() must be implemented`);
  }

  /**
   * Validate canonical records. Invalid ones are moved to errors[].
   * @param {CanonicalDataset} mapped
   * @returns {{ valid: CanonicalDataset, errors: ValidationError[] }}
   */
  async validate(mapped) {
    // Default: accept everything — override for custom validation rules
    return { valid: mapped, errors: [] };
  }

  // ─── Orchestrator ────────────────────────────────────────────────────────────

  /**
   * Execute the full pipeline: parse → clean → map → validate.
   * Always resolves (never rejects) — errors are captured in the RunResult.
   *
   * @returns {Promise<RunResult>}
   *
   * RunResult shape:
   * {
   *   run_id:          string,
   *   connector:       string,
   *   organization_id: string,
   *   started_at:      string (ISO),
   *   finished_at:     string (ISO),
   *   duration_ms:     number,
   *   rows_in:         { vehicles, operators, maintenance },
   *   rows_out:        { vehicles, operators, maintenance },
   *   rows_dropped:    number,
   *   validation_errors: ValidationError[],
   *   pipeline_error:  string | null,
   *   data:            CanonicalDataset | null,
   * }
   */
  async run() {
    const { randomUUID } = require("crypto");
    const run_id    = randomUUID();
    const startedAt = Date.now();

    const result = {
      run_id,
      connector:       this.name,
      organization_id: this.organizationId,
      started_at:      new Date(startedAt).toISOString(),
      finished_at:     null,
      duration_ms:     null,
      rows_in:         { vehicles: 0, operators: 0, maintenance: 0 },
      rows_out:        { vehicles: 0, operators: 0, maintenance: 0 },
      rows_dropped:    0,
      validation_errors: [],
      pipeline_error:  null,
      data:            null,
    };

    this.log.info({ run_id }, "Connector run started");

    try {
      // 1. Parse
      this.log.debug({ run_id }, "parse()");
      const raw = await this.parse();
      result.rows_in = {
        vehicles:    (raw.vehicles    || []).length,
        operators:   (raw.operators   || []).length,
        maintenance: (raw.maintenance || []).length,
      };
      this.log.info({ run_id, rows_in: result.rows_in }, "Parsed");

      // 2. Clean
      this.log.debug({ run_id }, "clean()");
      const cleaned = await this.clean(raw);

      // 3. Map
      this.log.debug({ run_id }, "map()");
      const mapped = await this.map(cleaned);

      // 4. Validate
      this.log.debug({ run_id }, "validate()");
      const { valid, errors } = await this.validate(mapped);

      result.validation_errors = errors;
      result.rows_dropped      = errors.length;
      result.rows_out = {
        vehicles:    (valid.vehicles    || []).length,
        operators:   (valid.operators   || []).length,
        maintenance: (valid.maintenance || []).length,
      };
      result.data = valid;

      this.log.info({ run_id, rows_out: result.rows_out, rows_dropped: result.rows_dropped }, "Run complete");

    } catch (err) {
      result.pipeline_error = err.message;
      this.log.error({ run_id, err: err.message }, "Pipeline error — keeping last-good snapshot");
    }

    result.finished_at = new Date().toISOString();
    result.duration_ms = Date.now() - startedAt;
    return result;
  }
}

module.exports = ConnectorBase;
