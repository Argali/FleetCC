/**
 * Target Cross Connector
 *
 * Extends ConnectorBase to implement the full parse → clean → map → validate
 * pipeline for Target Cross ERP exports.
 *
 * Self-registers in the connector registry on first require().
 *
 * Usage (via runner):
 *   const runner = require("../../core/connectors/runner");
 *   await runner.runConnector("targetcross", { organizationId: "cauto", mappingConfig });
 */

const path          = require("path");
const ConnectorBase = require("../../core/connectors/Connector.base");
const registry      = require("../../core/connectors/registry");
const { loadConfig }= require("../../core/connectors/configLoader");
const { parse }     = require("./parser");
const { clean }     = require("./cleaner");
const { map }       = require("./mapper");
const { validate }  = require("./validator");

// Default config path — can be overridden per tenant
const DEFAULT_CONFIG_PATH = path.resolve(__dirname, "../_config/targetcross.default.json");

class TargetCrossConnector extends ConnectorBase {
  /**
   * @param {object} config      - loaded mapping config (pass result of loadConfig())
   * @param {object} [options]
   * @param {string} [options.organizationId]
   */
  constructor(config, options = {}) {
    super("targetcross", config, options);
  }

  async parse() {
    return parse();
  }

  async clean(raw) {
    return clean(raw);
  }

  async map(cleaned) {
    return map(cleaned, this.config, this.organizationId);
  }

  async validate(mapped) {
    return validate(mapped);
  }
}

// ── Self-register ─────────────────────────────────────────────────────────────
registry.register("targetcross", TargetCrossConnector);

// ── Export helpers ────────────────────────────────────────────────────────────

/**
 * Convenience factory: load default config and return an instance.
 * @param {object} [options]
 * @param {string} [options.organizationId]
 * @param {string} [options.configPath]  - override config path per tenant
 */
function createTargetCrossConnector(options = {}) {
  const configPath = options.configPath || DEFAULT_CONFIG_PATH;
  const config     = loadConfig(configPath);
  return new TargetCrossConnector(config, options);
}

module.exports = { TargetCrossConnector, createTargetCrossConnector, DEFAULT_CONFIG_PATH };
