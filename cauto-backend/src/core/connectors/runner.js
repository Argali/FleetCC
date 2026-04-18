/**
 * Connector runner.
 *
 * Instantiates a registered connector for a given tenant, runs the full
 * pipeline, updates the in-memory ERP snapshot, and stores the run record.
 *
 * Usage (from the scheduler):
 *   const runner = require("./runner");
 *   await runner.runConnector("targetcross", tenantConfig);
 *
 * Run history is kept in-memory (last N runs). Phase 3 will persist to Postgres.
 */

const registry = require("./registry");
const snapshot = require("../../adapters/erp/snapshot");
const logger   = require("../../utils/logger");

const MAX_HISTORY = 50;
const runHistory  = [];

const runner = {
  /**
   * Run a connector for a specific tenant configuration.
   *
   * @param {string} connectorName - e.g. "targetcross"
   * @param {object} tenantConfig
   * @param {string} tenantConfig.organizationId  - tenant slug (e.g. "cauto")
   * @param {object} tenantConfig.mappingConfig   - loaded via configLoader.loadConfig()
   * @param {object} [tenantConfig.options]       - passed through to connector constructor
   * @returns {Promise<RunResult>}
   */
  async runConnector(connectorName, tenantConfig) {
    const { organizationId, mappingConfig, options = {} } = tenantConfig;
    const log = logger.child({ connector: connectorName, tenant: organizationId });

    let ConnectorClass;
    try {
      ConnectorClass = registry.resolve(connectorName);
    } catch (err) {
      log.error({ err: err.message }, "Cannot resolve connector");
      return { pipeline_error: err.message, connector: connectorName, organization_id: organizationId };
    }

    const connector = new ConnectorClass(mappingConfig, { organizationId, ...options });
    const result    = await connector.run();

    // Update in-memory snapshot only when pipeline succeeded
    if (!result.pipeline_error && result.data) {
      snapshot.update(organizationId, result.data);
      log.info(
        { run_id: result.run_id, rows_out: result.rows_out },
        "Snapshot updated"
      );
    } else if (result.pipeline_error) {
      log.warn({ run_id: result.run_id }, "Keeping previous snapshot due to pipeline error");
    }

    // Store run record
    runHistory.unshift(result);
    if (runHistory.length > MAX_HISTORY) runHistory.pop();

    return result;
  },

  /**
   * Get run history (most recent first).
   * @param {number} [limit=10]
   * @returns {RunResult[]}
   */
  getHistory(limit = 10) {
    return runHistory.slice(0, limit);
  },

  /**
   * Get the last run for a specific connector + tenant.
   */
  getLastRun(connectorName, organizationId) {
    return runHistory.find(
      r => r.connector === connectorName && r.organization_id === organizationId
    ) || null;
  },
};

module.exports = runner;
