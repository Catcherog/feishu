'use strict';

// Pilot Vertical Slice - Reader.
//
// Reads records back from the Pilot Base by exact record_id and verifies
// that the stored fields match the projected payload. Any field mismatch
// causes a verification failure - the caller decides whether to cleanup
// or keep the record.
//
// Per MIGRATION-VERTICAL-SLICE-ACCELERATION-01-R1 Required Correction 03:
//   - Read by target record ID
//   - Verify fields and relationships against expected projection
//
// Public surface:
//   createPilotReader(config) -> reader
//   readBackRecord(reader, input) -> { record_id, status, diffs }
//   readBackBatch(reader, inputs) -> { results, summary }
//   PILOT_READER_VERSION
//
// I/O-bound: the transport function performs the actual Feishu read.
// In tests, a fake transport is injected.

const PILOT_READER_VERSION = 'pilot-reader-v1.0';

// Fields that are writer-injected metadata and may differ in format
// between write time and read time (e.g. ISO timestamp normalization).
// These are EXCLUDED from field-level diff comparison because the Base
// may apply its own formatting. They are still reported as "metadata"
// in the read-back result for audit.
const METADATA_FIELDS = Object.freeze([
  'migrated_at',
  'migration_batch_id',
]);

/**
 * Create a Pilot reader bound to a specific Pilot Base + transport.
 *
 * @param {object} config
 * @param {string} config.pilot_base_token - MUST be a Pilot Base token
 * @param {string} config.production_v2_base_token - production V2 token to reject
 * @param {string} config.pilot_base_alias - human-readable alias
 * @param {function} config.transport - async (tableId, recordId) => { fields }
 * @param {object} config.table_ids - map of entity_type -> pilot table ID
 * @returns {object} reader
 */
function createPilotReader(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('createPilotReader: config must be a non-null object');
  }
  const pilotBaseToken = _str(config.pilot_base_token);
  const productionV2Token = _str(config.production_v2_base_token);
  const pilotBaseAlias = _str(config.pilot_base_alias);
  const transport = config.transport;
  const tableIds = config.table_ids;

  if (!_nonEmpty(pilotBaseToken)) {
    throw new Error('createPilotReader: pilot_base_token is required (fail closed)');
  }
  if (!_nonEmpty(productionV2Token)) {
    throw new Error('createPilotReader: production_v2_base_token is required (fail closed)');
  }
  if (!_nonEmpty(pilotBaseAlias)) {
    throw new Error('createPilotReader: pilot_base_alias is required');
  }
  if (typeof transport !== 'function') {
    throw new Error('createPilotReader: transport must be a function(tableId, recordId) -> Promise<{fields}>');
  }
  if (!tableIds || typeof tableIds !== 'object') {
    throw new Error('createPilotReader: table_ids must be a map of entity_type -> pilot table ID');
  }
  for (const entityType of ['customer', 'project', 'model', 'makeup']) {
    if (!_nonEmpty(_str(tableIds[entityType]))) {
      throw new Error(`createPilotReader: table_ids.${entityType} is required`);
    }
  }
  if (pilotBaseToken === productionV2Token) {
    throw new Error('createPilotReader: pilot_base_token MUST NOT equal production_v2_base_token (isolation violated)');
  }

  return Object.freeze({
    version: PILOT_READER_VERSION,
    pilot_base_alias: pilotBaseAlias,

    /**
     * Read back a single record by exact record_id and verify fields.
     *
     * @param {object} input
     * @param {string} input.record_id - exact target record ID returned by writer
     * @param {string} input.target_entity_type
     * @param {object} input.expected_payload - projected V2 fields (from projection.js)
     * @param {string} input.expected_idempotency_key
     * @returns {Promise<{record_id: string, status: string, diffs: Array, fields_read: object}>}
     */
    async readRecord(input) {
      _validateReadInput(input);
      const tableId = tableIds[input.target_entity_type];
      const result = await transport(tableId, input.record_id);

      if (!result) {
        return {
          record_id: input.record_id,
          status: 'NOT_FOUND',
          diffs: [],
          fields_read: null,
        };
      }

      const fieldsRead = result.fields || {};
      const diffs = _diffFields(input.expected_payload, fieldsRead);

      // Verify idempotency_key matches (critical for audit trail).
      const idemKey = _str(fieldsRead.idempotency_key);
      if (idemKey !== input.expected_idempotency_key) {
        diffs.push({
          field: 'idempotency_key',
          expected: input.expected_idempotency_key,
          actual: idemKey,
          severity: 'CRITICAL',
        });
      }

      return {
        record_id: input.record_id,
        status: diffs.length === 0 ? 'VERIFIED' : 'MISMATCH',
        diffs,
        fields_read: fieldsRead,
      };
    },

    /**
     * Read back a batch of records.
     *
     * @param {Array} inputs
     * @returns {Promise<{results: Array, summary: object}>}
     */
    async readBatch(inputs) {
      if (!Array.isArray(inputs)) {
        throw new Error('readBatch: inputs must be an array');
      }
      const results = [];
      let verified = 0;
      let mismatch = 0;
      let notFound = 0;
      let failed = 0;

      for (const input of inputs) {
        try {
          const result = await this.readRecord(input);
          if (result.status === 'VERIFIED') verified += 1;
          else if (result.status === 'MISMATCH') mismatch += 1;
          else if (result.status === 'NOT_FOUND') notFound += 1;
          results.push(result);
        } catch (err) {
          failed += 1;
          results.push({
            record_id: input.record_id,
            status: 'READ_FAILED',
            error: err.message,
            diffs: [],
          });
        }
      }

      return {
        results,
        summary: {
          total: inputs.length,
          verified,
          mismatch,
          not_found: notFound,
          failed,
          pilot_base_alias: pilotBaseAlias,
        },
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

function _validateReadInput(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('readRecord: input must be a non-null object');
  }
  if (!_nonEmpty(input.record_id)) {
    throw new Error('readRecord: record_id is required');
  }
  if (!_nonEmpty(input.target_entity_type)) {
    throw new Error('readRecord: target_entity_type is required');
  }
  if (!input.expected_payload || typeof input.expected_payload !== 'object') {
    throw new Error('readRecord: expected_payload is required');
  }
  if (!_nonEmpty(input.expected_idempotency_key)) {
    throw new Error('readRecord: expected_idempotency_key is required');
  }
}

/**
 * Compare expected payload fields against actual read-back fields.
 * Metadata fields (migrated_at, migration_batch_id) are excluded - the
 * Base may normalize timestamps. All other fields must match exactly.
 *
 * @param {object} expected
 * @param {object} actual
 * @returns {Array<{field: string, expected: string, actual: string, severity: string}>}
 */
function _diffFields(expected, actual) {
  const diffs = [];
  const expectedKeys = new Set(Object.keys(expected || {}));
  const actualKeys = new Set(Object.keys(actual || {}));

  // Check expected fields are present with matching values.
  for (const key of expectedKeys) {
    if (METADATA_FIELDS.includes(key)) continue;
    const expVal = _normalizeValue(expected[key]);
    const actVal = _normalizeValue(actual[key]);
    if (expVal !== actVal) {
      diffs.push({
        field: key,
        expected: expVal,
        actual: actVal,
        severity: 'FIELD_MISMATCH',
      });
    }
  }

  // Check for unexpected fields in actual (excluding metadata + writer-injected).
  const allowedExtra = new Set([
    ...METADATA_FIELDS,
    'legacy_source',
    'legacy_record_id',
    'migration_rule_version',
    'idempotency_key',
    'record_id',
  ]);
  for (const key of actualKeys) {
    if (expectedKeys.has(key)) continue;
    if (allowedExtra.has(key)) continue;
    diffs.push({
      field: key,
      expected: '<absent>',
      actual: _normalizeValue(actual[key]),
      severity: 'UNEXPECTED_FIELD',
    });
  }

  return diffs;
}

function _normalizeValue(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v).trim();
}

module.exports = {
  createPilotReader,
  PILOT_READER_VERSION,
  METADATA_FIELDS,
};
