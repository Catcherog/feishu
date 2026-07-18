'use strict';

// D-026 quantity threshold evaluator (Phase 1B-3 启动前置条件).
//
// Pure function. No I/O. No PII in output.
//
// Replaces the ad-hoc `buildThresholdJudgement()` in the R6 temp script
// `src/scripts/temp/r6_aggregations.js`. Per TASK-004 P0-2, the previous
// evaluator only counted MIGRATABLE records per entity and omitted the
// D-026 requirement that "至少 5 个 MIGRATABLE Project 明确关联到本轮
// MIGRATABLE Customer 集合". This module adds that association check.
//
// Public surface:
//   evaluateD026Threshold(classified, sourceByKey) -> judgement
//   D026_THRESHOLDS, D026_PROJECT_ASSOCIATION_MIN
//
// Source of truth: DECISION_LOG D-026 Phase 1B-3 启动前置条件.

const D026_THRESHOLDS = Object.freeze({
  customer: 5,
  project: 5,
  model: 10,
  makeup: 10,
});

// D-026 requires "5 个 MIGRATABLE Project 且关联上述 Customer" — i.e. at
// least 5 MIGRATABLE projects must explicitly link to MIGRATABLE customers
// in the same batch. The threshold is fixed at 5 to match the customer and
// project minimums.
const D026_PROJECT_ASSOCIATION_MIN = 5;

const ENTITY_TYPES = ['customer', 'project', 'model', 'makeup'];

/**
 * Evaluate D-026 Phase 1B-3 启动前置条件.
 *
 * Required conditions (ALL must be met for PASS):
 *   1. customer MIGRATABLE count >= 5
 *   2. project MIGRATABLE count >= 5
 *   3. At least 5 MIGRATABLE projects have `linked_customer_key` pointing
 *      to a MIGRATABLE customer in this same batch
 *   4. model MIGRATABLE count >= 10
 *   5. makeup MIGRATABLE count >= 10
 *
 * The output is fully anonymized: only aggregate counts, no record keys,
 * no record IDs, no names, no linked-customer detail. The caller is
 * responsible for reading source records and constructing the
 * `sourceByKey` map — the evaluator itself never touches PII.
 *
 * @param {Array<{record_key: string, entity_type: string, classification: string, primary_reason_code: string, secondary_reason_codes: string[]}>} classified
 * @param {Map<string, {record_key: string, entity_type: string, fields: {linked_customer_key?: string}}>} sourceByKey
 *   Source records keyed by `record_key`. Used to look up
 *   `fields.linked_customer_key` on MIGRATABLE projects. Only this
 *   single field is accessed; no other source field is read.
 * @returns {{
 *   schema_version: string,
 *   decision_reference: string,
 *   description: string,
 *   all_thresholds_met: boolean,
 *   judgement: string,
 *   thresholds: Object<string, {
 *     required_migratable: number,
 *     actual_migratable: number,
 *     threshold_met: boolean,
 *     shortfall: number
 *   }>,
 *   project_association_check: {
 *     required_migratable_with_migratable_customer: number,
 *     actual_migratable_with_migratable_customer: number,
 *     met: boolean,
 *     shortfall: number
 *   }
 * }}
 */
function evaluateD026Threshold(classified, sourceByKey) {
  if (!Array.isArray(classified)) {
    throw new Error('evaluateD026Threshold: classified must be an array');
  }
  if (!(sourceByKey instanceof Map)) {
    throw new Error('evaluateD026Threshold: sourceByKey must be a Map');
  }

  // Count MIGRATABLE per entity. Collect MIGRATABLE customer keys.
  const counts = { customer: 0, project: 0, model: 0, makeup: 0 };
  const migratableCustomerKeys = new Set();
  for (const c of classified) {
    if (!c || c.classification !== 'MIGRATABLE') continue;
    if (!ENTITY_TYPES.includes(c.entity_type)) continue;
    counts[c.entity_type] += 1;
    if (c.entity_type === 'customer') {
      migratableCustomerKeys.add(c.record_key);
    }
  }

  // Count MIGRATABLE projects whose linked_customer_key resolves to a
  // MIGRATABLE customer in the same batch.
  let migratableProjectsWithMigratableCustomer = 0;
  for (const c of classified) {
    if (!c || c.classification !== 'MIGRATABLE') continue;
    if (c.entity_type !== 'project') continue;
    const source = sourceByKey.get(c.record_key);
    if (!source || !source.fields) continue;
    const linkedKey = source.fields.linked_customer_key;
    if (typeof linkedKey !== 'string' || linkedKey === '') continue;
    if (migratableCustomerKeys.has(linkedKey)) {
      migratableProjectsWithMigratableCustomer += 1;
    }
  }

  // Build per-entity threshold results.
  const thresholds = {};
  let allMet = true;
  for (const entity of ENTITY_TYPES) {
    const required = D026_THRESHOLDS[entity];
    const actual = counts[entity] || 0;
    const met = actual >= required;
    if (!met) allMet = false;
    thresholds[entity] = {
      required_migratable: required,
      actual_migratable: actual,
      threshold_met: met,
      shortfall: met ? 0 : required - actual,
    };
  }

  // Project-customer association check.
  const associationRequired = D026_PROJECT_ASSOCIATION_MIN;
  const associationMet =
    migratableProjectsWithMigratableCustomer >= associationRequired;
  if (!associationMet) allMet = false;
  const projectAssociation = {
    required_migratable_with_migratable_customer: associationRequired,
    actual_migratable_with_migratable_customer:
      migratableProjectsWithMigratableCustomer,
    met: associationMet,
    shortfall: associationMet
      ? 0
      : associationRequired - migratableProjectsWithMigratableCustomer,
  };

  const judgement = allMet
    ? 'PASS — All D-026 quantity thresholds met (including project-customer association). MIGRATION_PILOT_001 may be considered for approval (still requires explicit user approval).'
    : 'FAIL — One or more D-026 thresholds not met. MIGRATION_PILOT_001 MUST NOT start. Either MIGRATABLE counts are short, or fewer than 5 MIGRATABLE projects link to MIGRATABLE customers in this batch.';

  return {
    schema_version: 'r6-quantity-threshold-judgement-v1.1',
    decision_reference: 'D-026 (DECISION_LOG.md)',
    description:
      'D-026 Phase 1B-3 启动前置条件：Customer >= 5 MIGRATABLE / Project >= 5 MIGRATABLE / 至少 5 个 MIGRATABLE Project 关联到本轮 MIGRATABLE Customer / Model >= 10 MIGRATABLE / Makeup >= 10 MIGRATABLE. Migration pilot MUST NOT start until ALL thresholds are met.',
    all_thresholds_met: allMet,
    judgement,
    thresholds,
    project_association_check: projectAssociation,
  };
}

module.exports = {
  evaluateD026Threshold,
  D026_THRESHOLDS,
  D026_PROJECT_ASSOCIATION_MIN,
  ENTITY_TYPES,
};
