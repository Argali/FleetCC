/**
 * Ingestion scheduler.
 *
 * On startup:
 *   1. Runs all configured connectors immediately (warm the snapshot)
 *   2. Schedules recurring runs at INGEST_INTERVAL_MS (default: 5 min)
 *
 * Design choices:
 *   - Uses setInterval (no external queue needed for MVP)
 *   - Each run is fully isolated — a failure never blocks the next run
 *   - Keeps last-good snapshot (runner handles this)
 *   - Phase 3: replace with node-cron + Postgres run persistence
 *
 * Environment variables:
 *   ERP_SOURCE           = mock | targetcross  (default: mock)
 *   INGEST_INTERVAL_MS   = milliseconds        (default: 300000 = 5 min)
 *   TARGETCROSS_ORG_ID   = tenant slug         (default: cauto)
 */

const runner = require("../core/connectors/runner");
const logger = require("../utils/logger");

const ERP_SOURCE    = process.env.ERP_SOURCE           || "mock";
const INTERVAL_MS   = parseInt(process.env.INGEST_INTERVAL_MS || "300000", 10);
const ORG_ID        = process.env.TARGETCROSS_ORG_ID   || "cauto";

// ── Tenant connector configs ──────────────────────────────────────────────────
// In Phase 4, this will be loaded from the database per tenant.
// For now, a static list drives which connectors run.

function buildTenantConfigs() {
  if (ERP_SOURCE === "mock") return [];

  const path           = require("path");
  const { loadConfig } = require("../core/connectors/configLoader");

  const configs = [];

  if (ERP_SOURCE === "targetcross") {
    // Ensure the connector class is registered
    require("../connectors/targetcross");

    const configPath = process.env.TARGETCROSS_CONFIG_PATH
      || path.resolve(__dirname, "../connectors/_config/targetcross.default.json");

    configs.push({
      connectorName:  "targetcross",
      organizationId: ORG_ID,
      mappingConfig:  loadConfig(configPath),
    });
  }

  return configs;
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

let _intervalHandle = null;
let _tenantConfigs  = [];

async function runAll() {
  if (_tenantConfigs.length === 0) return;

  for (const { connectorName, organizationId, mappingConfig } of _tenantConfigs) {
    try {
      const result = await runner.runConnector(connectorName, { organizationId, mappingConfig });
      if (result.pipeline_error) {
        logger.warn(
          { connector: connectorName, tenant: organizationId, err: result.pipeline_error },
          "Run completed with pipeline error"
        );
      } else {
        logger.info(
          { connector: connectorName, tenant: organizationId, rows_out: result.rows_out, duration_ms: result.duration_ms },
          "Scheduled run complete"
        );
      }
    } catch (err) {
      // Should not reach here — runner.runConnector() never rejects
      logger.error({ connector: connectorName, tenant: organizationId, err: err.message }, "Unexpected scheduler error");
    }
  }
}

/**
 * Start the ingestion scheduler.
 * Safe to call multiple times — only one interval runs at a time.
 */
function start() {
  if (_intervalHandle) return; // Already running

  _tenantConfigs = buildTenantConfigs();

  if (_tenantConfigs.length === 0) {
    logger.info({ source: ERP_SOURCE }, "ERP_SOURCE=mock — ingestion scheduler disabled");
    return;
  }

  logger.info(
    { source: ERP_SOURCE, tenants: _tenantConfigs.map(c => c.organizationId), interval_ms: INTERVAL_MS },
    "Ingestion scheduler starting"
  );

  // Run immediately on startup
  runAll().catch(err => logger.error({ err: err.message }, "Initial ingestion run failed"));

  // Then schedule recurring runs
  _intervalHandle = setInterval(() => {
    runAll().catch(err => logger.error({ err: err.message }, "Scheduled ingestion run failed"));
  }, INTERVAL_MS);

  // Don't block process exit
  if (_intervalHandle.unref) _intervalHandle.unref();
}

/** Stop the scheduler (used in tests) */
function stop() {
  if (_intervalHandle) {
    clearInterval(_intervalHandle);
    _intervalHandle = null;
    logger.info({}, "Ingestion scheduler stopped");
  }
}

module.exports = { start, stop, runAll };
