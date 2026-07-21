'use strict';

// Pilot Vertical Slice - Writer.
//
// Writes MIGRATABLE records to an ISOLATED Pilot Base only. Production V2
// Base tokens are explicitly rejected. The writer is fail-closed: any
// ambiguity in configuration, classification, or payload causes a throw
// rather than a silent write.
//
// Per MIGRATION-VERTICAL-SLICE-ACCELERATION-01-R1:
//   - Only accepts explicit Pilot Base configuration (pilot_base_token)
//   - Only accepts MIGRATABLE classification
//   - Returns target record ID for every successful write
//   - Default fail closed
//   - Production V2 token must be explicitly rejected
//
// Public surface:
//   createPilotWriter(config) -> writer
//   writePilotRecord(writer, input) -> { record_id, idempotency_key, status }
//   writePilotBatch(writer, inputs) -> { results, summary }
//   PILOT_WRITER_VERSION
//
// This module is I/O-bound (writes to Feishu). It MUST be constructed with
// an explicit transport function so that tests can inject a fake transport
// without touching real Feishu APIs. In production, the transport is
// `lark-cli +record-create` wrapped in a Node callback.

const {
  buildIdempotencyKey,
  PILOT_RULE_VERSION,
} = require('./idempotency');

const PILOT_WRITER_VERSION = 'pilot-writer-v1.1';

// A-05 idempotency scope declaration (per MIGRATION-VERTICAL-SLICE-ACCELERATION-01-R1-STAGE-A-AUDIT-FIX-01 RF-05).
//
// The current writer only deduplicates against an in-process Map passed via
// `input.idempotencyIndex`. This Map is created fresh inside `writeBatch`
// for each batch invocation and does NOT survive across:
//   1. New writer instances (createPilotWriter returns a new frozen object)
//   2. Node process restarts
//   3. Stage B command re-execution
//   4. Ambiguous transport responses (create succeeded but response lost)
//   5. Records already present in Pilot Base from prior runs
//
// Per GPT audit RF-05, Stage B authorization requires EITHER:
//   (A) Remote idempotency pre-check (query Pilot Base by idempotency_key
//       before create) OR a persistent execution ledger
//   (B) Stage B explicitly blocked until (A) is implemented
//
// This writer chooses Option B by emitting idempotency_scope=IN_PROCESS_ONLY
// in every writeRecord / writeBatch result. The manifest field
// `pilot_idempotency_ready=false` blocks Stage B until remote idempotency
// is implemented in a future batch.
const IDEMPOTENCY_SCOPE = 'IN_PROCESS_ONLY';

// Tokens that are explicitly forbidden as Pilot Base targets. These are
// stable aliases - the real tokens live in config/resource-map.local.json
// (gitignored). The writer rejects any token that matches these aliases
// OR any token that equals the production V2 token passed in config.
const FORBIDDEN_TOKEN_ALIASES = Object.freeze([
  'V2_BASE_TOKEN',
  'V2_PRODUCTION_BASE_TOKEN',
  '<V2_BASE_TOKEN>',
]);

/**
 * Create a Pilot writer bound to a specific Pilot Base + transport.
 *
 * @param {object} config
 * @param {string} config.pilot_base_token - MUST be a Pilot Base token, not production V2
 * @param {string} config.production_v2_base_token - production V2 token to reject (from resource-map)
 * @param {string} config.pilot_base_alias - human-readable alias for logs (e.g. "V2_PILOT_BASE_ALIAS")
 * @param {function} config.transport - async (tableId, fields, idempotencyKey) => { record_id }
 * @param {object} config.table_ids - map of entity_type -> pilot table ID
 * @returns {object} writer object with writeRecord / writeBatch methods
 * @throws {Error} if config is missing required fields or pilot_base_token equals production token
 */
function createPilotWriter(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('createPilotWriter: config must be a non-null object');
  }
  const pilotBaseToken = _str(config.pilot_base_token);
  const productionV2Token = _str(config.production_v2_base_token);
  const pilotBaseAlias = _str(config.pilot_base_alias);
  const transport = config.transport;
  const tableIds = config.table_ids;

  // Fail closed: all required fields must be present.
  if (!_nonEmpty(pilotBaseToken)) {
    throw new Error(
      'createPilotWriter: pilot_base_token is required (fail closed - missing Pilot Base config)',
    );
  }
  if (!_nonEmpty(productionV2Token)) {
    throw new Error(
      'createPilotWriter: production_v2_base_token is required (fail closed - must explicitly know which token to reject)',
    );
  }
  if (!_nonEmpty(pilotBaseAlias)) {
    throw new Error(
      'createPilotWriter: pilot_base_alias is required (for audit logs)',
    );
  }
  if (typeof transport !== 'function') {
    throw new Error(
      'createPilotWriter: transport must be a function(tableId, fields, idempotencyKey) -> Promise<{record_id}>',
    );
  }
  if (!tableIds || typeof tableIds !== 'object') {
    throw new Error(
      'createPilotWriter: table_ids must be a map of entity_type -> pilot table ID',
    );
  }
  for (const entityType of ['customer', 'project', 'model', 'makeup']) {
    if (!_nonEmpty(_str(tableIds[entityType]))) {
      throw new Error(
        `createPilotWriter: table_ids.${entityType} is required`,
      );
    }
  }

  // A-03: Production V2 token must be explicitly rejected. If pilot_base_token
  // equals production_v2_base_token, the writer is misconfigured and MUST
  // fail closed. This is the isolation guarantee.
  if (pilotBaseToken === productionV2Token) {
    throw new Error(
      'createPilotWriter: pilot_base_token MUST NOT equal production_v2_base_token (isolation violated - fail closed)',
    );
  }

  // Reject forbidden aliases (e.g. if someone accidentally passes the
  // example placeholder token).
  if (FORBIDDEN_TOKEN_ALIASES.includes(pilotBaseToken)) {
    throw new Error(
      `createPilotWriter: pilot_base_token "${pilotBaseToken}" is a forbidden placeholder alias - real token required`,
    );
  }
  if (FORBIDDEN_TOKEN_ALIASES.includes(productionV2Token)) {
    throw new Error(
      `createPilotWriter: production_v2_base_token "${productionV2Token}" is a forbidden placeholder alias - real token required`,
    );
  }

  return Object.freeze({
    version: PILOT_WRITER_VERSION,
    pilot_base_alias: pilotBaseAlias,
    rule_version: PILOT_RULE_VERSION,

    /**
     * Write a single MIGRATABLE record to the Pilot Base.
     *
     * @param {object} input
     * @param {string} input.legacy_source
     * @param {string} input.legacy_record_id
     * @param {string} input.target_entity_type
     * @param {{record_key: string, entity_type: string, fields: object}} input.record
     * @param {{record_key: string, entity_type: string, classification: string}} input.classified
     * @param {object} input.payload - projected V2 fields (from projection.js)
     * @param {Map<string, {record_id?: string}>} [input.idempotencyIndex] - existing keys -> record_id for dedup
     * @returns {Promise<{record_id: string, idempotency_key: string, status: string, composition: string}>}
     */
    async writeRecord(input) {
      _validateWriteInput(input);

      // A-01: Only MIGRATABLE records may be written.
      if (input.classified.classification !== 'MIGRATABLE') {
        throw new Error(
          `writeRecord: ${input.record.record_key} classification "${input.classified.classification}" is not MIGRATABLE - write rejected (fail closed)`,
        );
      }

      // Entity_type consistency check (mirror projection.js invariant).
      if (input.record.entity_type !== input.classified.entity_type) {
        throw new Error(
          `writeRecord: ${input.record.record_key} entity_type mismatch (record=${input.record.entity_type}, classified=${input.classified.entity_type})`,
        );
      }
      if (input.record.entity_type !== input.target_entity_type) {
        throw new Error(
          `writeRecord: ${input.record.record_key} record.entity_type "${input.record.entity_type}" does not match target_entity_type "${input.target_entity_type}"`,
        );
      }

      // Build idempotency key.
      const idem = buildIdempotencyKey({
        legacy_source: input.legacy_source,
        legacy_record_id: input.legacy_record_id,
        target_entity_type: input.target_entity_type,
      });

      // A-05: Idempotency - if the key already exists in the index, return
      // the existing record_id without writing a duplicate.
      if (input.idempotencyIndex instanceof Map
          && input.idempotencyIndex.has(idem.key)) {
        const existing = input.idempotencyIndex.get(idem.key);
        return {
          record_id: existing.record_id,
          idempotency_key: idem.key,
          composition: idem.composition,
          status: 'DUPLICATE_SKIPPED',
          // RF-05: declare idempotency scope so callers / auditors know
          // this dedup is in-process only and does not protect against
          // cross-process or cross-run duplicates.
          idempotency_scope: IDEMPOTENCY_SCOPE,
        };
      }

      // Fail closed: payload must be a non-null object.
      if (!input.payload || typeof input.payload !== 'object'
          || Array.isArray(input.payload)) {
        throw new Error(
          `writeRecord: ${input.record.record_key} payload must be a non-null object (projection must produce a writable payload before calling writer)`,
        );
      }

      // Inject idempotency metadata into the payload so the Base record
      // itself carries the dedup key. This allows cross-session idempotency
      // by querying the Base for existing idempotency_key before writing.
      const writeFields = Object.assign({}, input.payload, {
        legacy_source: input.legacy_source,
        legacy_record_id: input.legacy_record_id,
        migration_batch_id: _deriveBatchId(input),
        migration_rule_version: PILOT_RULE_VERSION,
        idempotency_key: idem.key,
        migrated_at: new Date().toISOString(),
      });

      const tableId = tableIds[input.target_entity_type];
      const result = await transport(tableId, writeFields, idem.key);

      if (!result || !_nonEmpty(_str(result.record_id))) {
        throw new Error(
          `writeRecord: transport for ${input.record.record_key} did not return a record_id (fail closed - A-04 violated)`,
        );
      }

      return {
        record_id: result.record_id,
        idempotency_key: idem.key,
        composition: idem.composition,
        status: 'CREATED',
        // RF-05: declare idempotency scope so callers / auditors know
        // this write only deduped against an in-process Map and does
        // NOT constitute cross-process / cross-run idempotency.
        idempotency_scope: IDEMPOTENCY_SCOPE,
      };
    },

    /**
     * Write a batch of MIGRATABLE records. Returns a structured result with
     * per-record outcomes and a summary. Partial failures do NOT abort the
     * batch - each failure is recorded so cleanup can target exact records.
     *
     * @param {Array} inputs - array of writeRecord inputs
     * @returns {Promise<{results: Array, summary: object}>}
     */
    async writeBatch(inputs) {
      if (!Array.isArray(inputs)) {
        throw new Error('writeBatch: inputs must be an array');
      }
      const results = [];
      const idempotencyIndex = new Map();
      let created = 0;
      let duplicateSkipped = 0;
      let failed = 0;

      for (const input of inputs) {
        try {
          const result = await this.writeRecord(
            Object.assign({}, input, { idempotencyIndex }),
          );
          if (result.status === 'CREATED') {
            idempotencyIndex.set(result.idempotency_key, {
              record_id: result.record_id,
            });
            created += 1;
          } else if (result.status === 'DUPLICATE_SKIPPED') {
            duplicateSkipped += 1;
          }
          results.push({
            record_key: input.record.record_key,
            entity_type: input.target_entity_type,
            status: result.status,
            record_id: result.record_id,
            idempotency_key: result.idempotency_key,
            // RF-05: propagate idempotency scope to batch results so
            // callers / auditors can see this dedup is in-process only.
            idempotency_scope: result.idempotency_scope || IDEMPOTENCY_SCOPE,
          });
        } catch (err) {
          failed += 1;
          results.push({
            record_key: input.record && input.record.record_key
              ? input.record.record_key
              : '<unknown>',
            entity_type: input.target_entity_type || '<unknown>',
            status: 'FAILED',
            error: err.message,
            // RF-05: even failed attempts must declare scope so auditors
            // know no cross-process dedup was attempted.
            idempotency_scope: IDEMPOTENCY_SCOPE,
          });
        }
      }

      return {
        results,
        summary: {
          total: inputs.length,
          created,
          duplicate_skipped: duplicateSkipped,
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

function _validateWriteInput(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('writeRecord: input must be a non-null object');
  }
  if (!_nonEmpty(input.legacy_source)) {
    throw new Error('writeRecord: legacy_source is required');
  }
  if (!_nonEmpty(input.legacy_record_id)) {
    throw new Error('writeRecord: legacy_record_id is required');
  }
  if (!_nonEmpty(input.target_entity_type)) {
    throw new Error('writeRecord: target_entity_type is required');
  }
  if (!input.record || typeof input.record !== 'object') {
    throw new Error('writeRecord: record is required');
  }
  if (!_nonEmpty(input.record.record_key)) {
    throw new Error('writeRecord: record.record_key is required');
  }
  if (!_nonEmpty(input.record.entity_type)) {
    throw new Error('writeRecord: record.entity_type is required');
  }
  if (!input.classified || typeof input.classified !== 'object') {
    throw new Error('writeRecord: classified is required');
  }
  if (!_nonEmpty(input.classified.record_key)) {
    throw new Error('writeRecord: classified.record_key is required');
  }
  if (!_nonEmpty(input.classified.entity_type)) {
    throw new Error('writeRecord: classified.entity_type is required');
  }
  if (!_nonEmpty(input.classified.classification)) {
    throw new Error('writeRecord: classified.classification is required');
  }
  if (input.record.record_key !== input.classified.record_key) {
    throw new Error(
      `writeRecord: record_key mismatch (record=${input.record.record_key}, classified=${input.classified.record_key})`,
    );
  }
}

function _deriveBatchId(input) {
  // Batch ID is derived from the idempotency composition so that all
  // records in the same Pilot run share a traceable batch identifier.
  // This is NOT the idempotency key itself (which is per-record); it is
  // a coarser grouping for audit and cleanup.
  const ts = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `pilot-${ts}-${input.target_entity_type}`;
}

module.exports = {
  createPilotWriter,
  PILOT_WRITER_VERSION,
  FORBIDDEN_TOKEN_ALIASES,
  IDEMPOTENCY_SCOPE,
};
