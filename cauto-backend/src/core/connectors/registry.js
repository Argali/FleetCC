/**
 * Connector registry.
 *
 * Associates a connector name (e.g. "targetcross") with its class.
 * New connectors self-register at module load time:
 *
 *   const registry = require("../../core/connectors/registry");
 *   registry.register("targetcross", TargetCrossConnector);
 *
 * Usage in the runner:
 *   const ConnectorClass = registry.resolve("targetcross");
 *   const connector = new ConnectorClass(config, { organizationId: "cauto" });
 */

const logger = require("../../utils/logger");

const _registry = new Map();

const registry = {
  /**
   * Register a connector class under a name.
   * @param {string} name          - Unique identifier (e.g. "targetcross")
   * @param {Function} ConnectorClass - Class extending ConnectorBase
   */
  register(name, ConnectorClass) {
    if (_registry.has(name)) {
      logger.warn({ connector: name }, "Connector already registered — overwriting");
    }
    _registry.set(name, ConnectorClass);
    logger.info({ connector: name }, "Connector registered");
  },

  /**
   * Resolve a connector class by name.
   * @param {string} name
   * @returns {Function} ConnectorClass
   * @throws {Error} if not found
   */
  resolve(name) {
    const cls = _registry.get(name);
    if (!cls) {
      throw new Error(
        `[Registry] Unknown connector: "${name}". Registered: [${[..._registry.keys()].join(", ")}]`
      );
    }
    return cls;
  },

  /** @returns {string[]} List of all registered connector names */
  list() {
    return [..._registry.keys()];
  },

  /** Check if a connector is registered */
  has(name) {
    return _registry.has(name);
  },
};

module.exports = registry;
