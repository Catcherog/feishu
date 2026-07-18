'use strict';

// Migration projection module. Pure function, no I/O.
//
// Takes a normalized Customer / Project record (already classified as
// MIGRATABLE) plus its classification result, and produces the target
// V2 field payload. The 5 schema-default fields that the lark-cli
// `+field-create` limitation could not apply at the Base layer (per R5
// Task 4 finding and TASK-004 P0-1) are populated EXPLICITLY here by
// constants — they never rely on the Base default_value mechanism.
//
// Public surface:
//   projectCustomer(record, classified) -> payload | null
//   projectProject(record, classified)  -> payload | null
//   projectBatch(records, classified)    -> Array<{record_key, entity_type, payload}>
//   MIGRATION_DEFAULTS, SOURCE_CHANNEL_MAPPING_VERSION,
//     STATUS_MAPPING_RULE_VERSION, PROJECT_CURRENCY
//
// Source of truth:
//   - DECISION_LOG D-020 (status-map-v1.0), D-021 (source-map-v1.0),
//     D-024 (Schema v1.1), D-025 (budget-map-v1.0)
//   - TASK-004 P0-1 (5 explicit defaults)
//   - PUBLIC_EXECUTION_ENTRYPOINT.md Section 3.7 (R6 submission)
//
// This module does NOT call Feishu APIs, write to any Base, or mutate
// the input records. It is safe to run from any context.

const { parseBudget, BUDGET_RULE_VERSION } = require('./classifier/budget');

// ---------------------------------------------------------------------------
// Explicit migration defaults (the 5 schema-default fields that the Base
// layer cannot apply on its own).
// ---------------------------------------------------------------------------
//
// These values are versioned. Changing any value here MUST be accompanied
// by a DECISION_LOG update and a classifier version bump.
//
// 1. customer.budget_parse_rule_version = 'budget-map-v1.0'  (D-025)
// 2. customer.source_channel_mapping_version = 'source-map-v1.0'  (D-021)
// 3. customer.status_mapping_rule_version = 'status-map-v1.0'  (D-020)
// 4. project.currency = 'CNY'  (D-024)
// 5. project.status_mapping_rule_version = 'status-map-v1.0'  (D-020)

const SOURCE_CHANNEL_MAPPING_VERSION = 'source-map-v1.0';
const STATUS_MAPPING_RULE_VERSION = 'status-map-v1.0';
const PROJECT_CURRENCY = 'CNY';

const MIGRATION_DEFAULTS = Object.freeze({
  customer: Object.freeze({
    budget_parse_rule_version: BUDGET_RULE_VERSION, // 'budget-map-v1.0'
    source_channel_mapping_version: SOURCE_CHANNEL_MAPPING_VERSION,
    status_mapping_rule_version: STATUS_MAPPING_RULE_VERSION,
  }),
  project: Object.freeze({
    currency: PROJECT_CURRENCY,
    status_mapping_rule_version: STATUS_MAPPING_RULE_VERSION,
  }),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function str(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function ensureKeyMatch(record, classified) {
  if (!record || !classified) {
    throw new Error('projection requires both record and classified');
  }
  const rKey = str(record.record_key);
  const cKey = str(classified.record_key);
  if (rKey === '') {
    throw new Error('projection: record.record_key is empty');
  }
  if (rKey !== cKey) {
    throw new Error(
      `projection: record_key mismatch (record=${rKey}, classified=${cKey})`,
    );
  }
}

function ensureClassification(record, classified, requiredClass) {
  if (classified.classification !== requiredClass) {
    throw new Error(
      `projection: ${record.record_key} expected classification ${requiredClass}, got ${classified.classification}`,
    );
  }
}

function ensureEntityType(record, expected) {
  if (record.entity_type !== expected) {
    throw new Error(
      `projection: ${record.record_key} expected entity_type ${expected}, got ${record.entity_type}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Public projection functions
// ---------------------------------------------------------------------------

/**
 * Project a single MIGRATABLE customer record into a V2 Customer payload.
 *
 * Returns null when the record is not MIGRATABLE — callers MUST NOT write
 * a null payload to the V2 Base. The caller is responsible for filtering
 * NEEDS_REVIEW / BLOCKED records out of any write batch.
 *
 * The payload always includes the 3 explicit customer defaults:
 *   - budget_parse_rule_version
 *   - source_channel_mapping_version
 *   - status_mapping_rule_version
 *
 * @param {{record_key: string, entity_type: string, fields: object}} record
 * @param {{record_key: string, classification: string}} classified
 * @returns {object|null}
 */
function projectCustomer(record, classified) {
  ensureKeyMatch(record, classified);
  if (classified.classification !== 'MIGRATABLE') return null;
  ensureEntityType(record, 'customer');

  const f = record.fields || {};
  const budget = parseBudget(f.budget_range_raw);

  return {
    // Migrated business fields (preserved from source)
    name: f.name,
    status_raw: f.status_raw,
    source_channel_raw: f.source_channel_raw,
    phone: f.phone,
    wechat_id: f.wechat_id,
    budget_min: budget.budget_min,
    budget_max: budget.budget_max,
    budget_range_raw: budget.budget_range_raw,
    budget_parse_status: budget.budget_parse_status,

    // Explicit migration-rule versioning — these 3 fields are the
    // schema-default fields that the lark-cli `+field-create` limitation
    // could not apply at the Base layer. They MUST be set here so that
    // the migration NEVER relies on Base default_value semantics.
    budget_parse_rule_version:
      MIGRATION_DEFAULTS.customer.budget_parse_rule_version,
    source_channel_mapping_version:
      MIGRATION_DEFAULTS.customer.source_channel_mapping_version,
    status_mapping_rule_version:
      MIGRATION_DEFAULTS.customer.status_mapping_rule_version,
  };
}

/**
 * Project a single MIGRATABLE project record into a V2 Project payload.
 *
 * Returns null when the record is not MIGRATABLE — callers MUST NOT write
 * a null payload to the V2 Base.
 *
 * The payload always includes the 2 explicit project defaults:
 *   - currency
 *   - status_mapping_rule_version
 *
 * @param {{record_key: string, entity_type: string, fields: object}} record
 * @param {{record_key: string, classification: string}} classified
 * @returns {object|null}
 */
function projectProject(record, classified) {
  ensureKeyMatch(record, classified);
  if (classified.classification !== 'MIGRATABLE') return null;
  ensureEntityType(record, 'project');

  const f = record.fields || {};

  return {
    // Migrated business fields (preserved from source)
    name: f.name,
    status_raw: f.status_raw,
    project_type_raw: f.project_type_raw,
    linked_customer_key: f.linked_customer_key,

    // Explicit migration-rule versioning — these 2 fields are the
    // schema-default fields that the lark-cli `+field-create` limitation
    // could not apply at the Base layer. They MUST be set here so that
    // the migration NEVER relies on Base default_value semantics.
    currency: MIGRATION_DEFAULTS.project.currency,
    status_mapping_rule_version:
      MIGRATION_DEFAULTS.project.status_mapping_rule_version,
  };
}

/**
 * Project a batch of records into V2 payloads.
 *
 * For each record, returns an object `{record_key, entity_type, payload}`:
 *   - If the record is MIGRATABLE and is a customer or project, `payload`
 *     is the V2 field payload.
 *   - If the record is not MIGRATABLE, `payload` is null — the caller
 *     MUST skip records with null payloads when writing to the V2 Base.
 *   - If the record is a MIGRATABLE model or makeup (resource) entity,
 *     `payload` is null — this module does not project resources. Resource
 *     migration uses a separate projection module.
 *
 * Throws if any record is missing a classification or if record_key
 * values do not align between `records` and `classified`.
 *
 * Deterministic: output order matches input order.
 *
 * @param {Array<{record_key, entity_type, fields}>} records
 * @param {Array<{record_key, entity_type, classification, primary_reason_code, secondary_reason_codes}>} classified
 * @returns {Array<{record_key: string, entity_type: string, payload: object|null}>}
 */
function projectBatch(records, classified) {
  const byKey = new Map();
  for (const c of classified) {
    if (byKey.has(c.record_key)) {
      throw new Error(`projectBatch: duplicate classified record_key ${c.record_key}`);
    }
    byKey.set(c.record_key, c);
  }

  const out = [];
  for (const r of records) {
    const c = byKey.get(r.record_key);
    if (!c) {
      throw new Error(`projectBatch: no classification for ${r.record_key}`);
    }
    let payload = null;
    if (c.classification === 'MIGRATABLE') {
      if (r.entity_type === 'customer') {
        payload = projectCustomer(r, c);
      } else if (r.entity_type === 'project') {
        payload = projectProject(r, c);
      }
      // model / makeup: payload stays null — resource projection is out of
      // scope for this module. R6 does not project resources.
    }
    out.push({
      record_key: r.record_key,
      entity_type: r.entity_type,
      payload,
    });
  }
  return out;
}

module.exports = {
  projectCustomer,
  projectProject,
  projectBatch,
  MIGRATION_DEFAULTS,
  SOURCE_CHANNEL_MAPPING_VERSION,
  STATUS_MAPPING_RULE_VERSION,
  PROJECT_CURRENCY,
};
