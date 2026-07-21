'use strict';

// Pilot Vertical Slice - Cleanup.
//
// Deletes Pilot Base records by EXACT record_id only. Never deletes by
// name, fuzzy match, or batch-wide wipe. Partial failures produce a
// structured report with created / verified / cleanup_pending lists so
// the operator can manually resolve any leftover records.
//
// Per MIGRATION-VERTICAL-SLICE-ACCELERATION-01-R1 Required Correction 03:
//   - Only delete records created in this run (by exact record_id)
//   - Never delete by name or fuzzy condition
//   - Partial failure MUST preserve a traceable execution log
//
// Public surface:
//   createPilotCleanup(config) -> cleanup
//   cleanupRecord(cleanup, input) -> { record_id, status }
//   cleanupBatch(cleanup, inputs) -> { results, summary, cleanup_pending }
//   PILOT_CLEANUP_VERSION
//
// I/O-bound: the transport function performs the actual Feishu delete.

const PILOT_CLEANUP_VERSION = 'pilot-cleanup-v1.0';

/**
 * Create a Pilot cleanup handle bound to a specific Pilot Base + transport.
 *
 * @param {object} config
 * @param {string} config.pilot_base_token - MUST be a Pilot Base token
 * @param {string} config.production_v2_base_token - production V2 token to reject
 * @param {string} config.pilot_base_alias
 * @param {function} config.transport - async (tableId, recordId) => { deleted: boolean }
 * @param {object} config.table_ids
 * @returns {object} cleanup
 */
function createPilotCleanup(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('createPilotCleanup: config must be a non-null object');
  }
  const pilotBaseToken = _str(config.pilot_base_token);
  const productionV2Token = _str(config.production_v2_base_token);
  const pilotBaseAlias = _str(config.pilot_base_alias);
  const transport = config.transport;
  const tableIds = config.table_ids;

  if (!_nonEmpty(pilotBaseToken)) {
    throw new Error('createPilotCleanup: pilot_base_token is required (fail closed)');
  }
  if (!_nonEmpty(productionV2Token)) {
    throw new Error('createPilotCleanup: production_v2_base_token is required (fail closed)');
  }
  if (!_nonEmpty(pilotBaseAlias)) {
    throw new Error('createPilotCleanup: pilot_base_alias is required');
  }
  if (typeof transport !== 'function') {
    throw new Error('createPilotCleanup: transport must be a function(tableId, recordId) -> Promise<{deleted: boolean}>');
  }
  if (!tableIds || typeof tableIds !== 'object') {
    throw new Error('createPilotCleanup: table_ids must be a map of entity_type -> pilot table ID');
  }
  for (const entityType of ['customer', 'project', 'model', 'makeup']) {
    if (!_nonEmpty(_str(tableIds[entityType]))) {
      throw new Error(`createPilotCleanup: table_ids.${entityType} is required`);
    }
  }
  if (pilotBaseToken === productionV2Token) {
    throw new Error('createPilotCleanup: pilot_base_token MUST NOT equal production_v2_base_token (isolation violated)');
  }

  return Object.freeze({
    version: PILOT_CLEANUP_VERSION,
    pilot_base_alias: pilotBaseAlias,

    /**
     * Delete a single Pilot record by exact record_id.
     *
     * @param {object} input
     * @param {string} input.record_id - exact target record ID (from writer output)
     * @param {string} input.target_entity_type
     * @param {string} input.idempotency_key - for audit log correlation
     * @param {string} input.reason - why this record is being cleaned up
     * @returns {Promise<{record_id: string, status: string, idempotency_key: string}>}
     */
    async deleteRecord(input) {
      _validateCleanupInput(input);
      const tableId = tableIds[input.target_entity_type];
      const result = await transport(tableId, input.record_id);

      if (!result || result.deleted !== true) {
        return {
          record_id: input.record_id,
          status: 'CLEANUP_FAILED',
          idempotency_key: input.idempotency_key,
          reason: input.reason,
        };
      }
      return {
        record_id: input.record_id,
        status: 'DELETED',
        idempotency_key: input.idempotency_key,
        reason: input.reason,
      };
    },

    /**
     * Delete a batch of Pilot records by exact record_id. Partial failures
     * do NOT abort the batch - each failure is recorded in cleanup_pending
     * so the operator can manually resolve.
     *
     * @param {Array} inputs
     * @returns {Promise<{results: Array, summary: object, cleanup_pending: Array}>}
     */
    async deleteBatch(inputs) {
      if (!Array.isArray(inputs)) {
        throw new Error('deleteBatch: inputs must be an array');
      }
      const results = [];
      const cleanupPending = [];
      let deleted = 0;
      let failed = 0;

      for (const input of inputs) {
        try {
          const result = await this.deleteRecord(input);
          if (result.status === 'DELETED') {
            deleted += 1;
          } else {
            failed += 1;
            cleanupPending.push({
              record_id: input.record_id,
              target_entity_type: input.target_entity_type,
              idempotency_key: input.idempotency_key,
              reason: input.reason,
              error: 'transport returned deleted=false',
            });
          }
          results.push(result);
        } catch (err) {
          failed += 1;
          results.push({
            record_id: input.record_id,
            status: 'CLEANUP_ERROR',
            idempotency_key: input.idempotency_key,
            reason: input.reason,
            error: err.message,
          });
          cleanupPending.push({
            record_id: input.record_id,
            target_entity_type: input.target_entity_type,
            idempotency_key: input.idempotency_key,
            reason: input.reason,
            error: err.message,
          });
        }
      }

      return {
        results,
        summary: {
          total: inputs.length,
          deleted,
          failed,
          pilot_base_alias: pilotBaseAlias,
        },
        cleanup_pending: cleanupPending,
      };
    },
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _str(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function _nonEmpty(v) {
  return _str(v).length > 0;
}

function _validateCleanupInput(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('deleteRecord: input must be a non-null object');
  }
  if (!_nonEmpty(input.record_id)) {
    throw new Error('deleteRecord: record_id is required (exact ID only - no fuzzy delete)');
  }
  if (!_nonEmpty(input.target_entity_type)) {
    throw new Error('deleteRecord: target_entity_type is required');
  }
  if (!_nonEmpty(input.idempotency_key)) {
    throw new Error('deleteRecord: idempotency_key is required (for audit correlation)');
  }
  if (!_nonEmpty(input.reason)) {
    throw new Error('deleteRecord: reason is required (every cleanup must be justified)');
  }
}

module.exports = {
  createPilotCleanup,
  PILOT_CLEANUP_VERSION,
};
