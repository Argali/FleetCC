/**
 * ERP data snapshot — in-memory cache.
 *
 * The runner writes here after each successful ingestion run.
 * The ERP adapter reads from here to serve repositories.
 *
 * Phase 3: This module will be replaced by direct Postgres queries.
 * Until then, the snapshot persists for the lifetime of the process.
 *
 * Shape per tenant:
 * {
 *   vehicles:    CanonicalVehicle[],
 *   operators:   CanonicalOperator[],
 *   maintenance: CanonicalMaintenanceEvent[],
 *   updated_at:  string (ISO),
 * }
 */

const _store = new Map(); // organizationId → snapshot

const snapshot = {
  /**
   * Update the snapshot for a tenant with fresh canonical data.
   * @param {string} organizationId
   * @param {object} data - { vehicles, operators, maintenance }
   */
  update(organizationId, data) {
    _store.set(organizationId, {
      vehicles:    data.vehicles    || [],
      operators:   data.operators   || [],
      maintenance: data.maintenance || [],
      updated_at:  new Date().toISOString(),
    });
  },

  /**
   * Get the full snapshot for a tenant.
   * @param {string} organizationId
   * @returns {{ vehicles, operators, maintenance, updated_at } | null}
   */
  get(organizationId) {
    return _store.get(organizationId) || null;
  },

  /** @returns {string[]} Tenants that have a snapshot */
  tenants() {
    return [..._store.keys()];
  },

  /** Check if a tenant has a snapshot */
  has(organizationId) {
    return _store.has(organizationId);
  },

  /** Clear snapshot for a tenant (useful for testing) */
  clear(organizationId) {
    _store.delete(organizationId);
  },
};

module.exports = snapshot;
