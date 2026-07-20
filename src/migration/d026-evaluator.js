'use strict';

// D-026 quantity threshold evaluator (Phase 1B-3 启动前置条件).
//
// Pure function. No I/O. No PII in output.
//
// Replaces the ad-hoc `buildThresholdJudgement()` in the R6 temp script
// `src/scripts/temp/r6_aggregations.js`. Per TASK-004 P0-2, the previous
// evaluator only counted MIGRATABLE records per entity and omitted the
// D-026 requirement that "至少 5 个 MIGRATABLE Project 明确关联到本轮
// MIGRATABLE Customer 集合". Per PROJECT-TYPE-SOURCE-OF-TRUTH-CORRECTION-01
// (AC-08 / AC-09), the association check is now split by project type:
//   - 客片 projects must link to a MIGRATABLE Customer (entity_type=customer)
//   - 样片 projects (V1 "创作" normalized) must link to a MIGRATABLE Model
//     (entity_type=model). Customer link is optional for 样片.
//   - 关联实体类型正确性: linked_customer_key must point to a customer record
//     and linked_model_key must point to a model record. A type mismatch
//     (e.g. Model key written into linked_customer_key field) fails the gate.
//
// Public surface:
//   evaluateD026Threshold(classified, sourceByKey) -> judgement
//   D026_THRESHOLDS, D026_PROJECT_ASSOCIATION_MIN
//
// Source of truth: DECISION_LOG D-026 Phase 1B-3 启动前置条件.

// V1 → V2 project-type normalization (mirror of the map in
// classifier/classifier.js and projection.js — kept local to avoid
// circular dependency). Both maps must stay in sync.
const PROJECT_TYPE_NORMALIZATION = new Map([
  ['创作', '样片'],
]);

function _normalizeProjectTypeImpl(v1Type) {
  if (v1Type === null || v1Type === undefined) return '';
  const trimmed = String(v1Type).trim();
  if (trimmed === '') return '';
  if (PROJECT_TYPE_NORMALIZATION.has(trimmed)) {
    return PROJECT_TYPE_NORMALIZATION.get(trimmed);
  }
  return trimmed;
}

const D026_THRESHOLDS = Object.freeze({
  customer: 5,
  project: 5,
  model: 10,
  makeup: 10,
});

// D-026 requires at least 5 MIGRATABLE projects with valid association
// links in the same batch. Per AC-08/AC-09, this is now split into:
//   - 客片 projects with linked_customer_key → MIGRATABLE Customer
//   - 样片 projects with linked_model_key → MIGRATABLE Model
// The combined count must reach this threshold. Either branch
// contributing 0 is allowed (e.g. a pilot with only 客片 candidates),
// but the SUM must meet the minimum.
const D026_PROJECT_ASSOCIATION_MIN = 5;

// AC-09: 关联实体类型正确性 — a project with linked_customer_key pointing
// to a non-customer record (e.g. a Model record) is a type mismatch and
// fails the gate regardless of MIGRATABLE counts. Same for linked_model_key
// pointing to a non-model record.
const D026_ALLOWED_TYPE_MISMATCHES = 0;

const ENTITY_TYPES = ['customer', 'project', 'model', 'makeup'];

/**
 * Evaluate D-026 Phase 1B-3 启动前置条件.
 *
 * Required conditions (ALL must be met for PASS):
 *   1. customer MIGRATABLE count >= 5
 *   2. project MIGRATABLE count >= 5
 *   3. model MIGRATABLE count >= 10
 *   4. makeup MIGRATABLE count >= 10
 *   5. (AC-08/AC-09) Combined MIGRATABLE-project-with-valid-association
 *      count >= 5, where valid association means:
 *        - 客片 project: linked_customer_key → MIGRATABLE Customer record
 *        - 样片 project (V1 "创作" normalized): linked_model_key → MIGRATABLE Model record
 *      The two branches are counted separately and summed.
 *   6. (AC-09) 关联实体类型正确性: zero projects with a linked key pointing
 *      to the wrong entity_type (e.g. Model key written into Customer field).
 *
 * The output is fully anonymized: only aggregate counts, no record keys,
 * no record IDs, no names, no linked-customer detail.
 *
 * @param {Array<{record_key: string, entity_type: string, classification: string, primary_reason_code: string, secondary_reason_codes: string[]}>} classified
 * @param {Map<string, {record_key: string, entity_type: string, fields: {project_type_raw?: string, linked_customer_key?: string, linked_model_key?: string}}>} sourceByKey
 *   Source records keyed by `record_key`. Used to look up project_type_raw
 *   and the type-specific link field. Only these fields are accessed;
 *   no other source field is read.
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
 *     required_combined: number,
 *     kepian_customer_pairs: number,
 *     yangpian_model_pairs: number,
 *     combined_pairs: number,
 *     met: boolean,
 *     shortfall: number
 *   },
 *   entity_type_correctness_check: {
 *     allowed_mismatches: number,
 *     actual_mismatches: number,
 *     met: boolean
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

  // Count MIGRATABLE per entity. Collect MIGRATABLE customer and model keys.
  const counts = { customer: 0, project: 0, model: 0, makeup: 0 };
  const migratableCustomerKeys = new Set();
  const migratableModelKeys = new Set();
  for (const c of classified) {
    if (!c || c.classification !== 'MIGRATABLE') continue;
    if (!ENTITY_TYPES.includes(c.entity_type)) continue;
    counts[c.entity_type] += 1;
    if (c.entity_type === 'customer') {
      migratableCustomerKeys.add(c.record_key);
    } else if (c.entity_type === 'model') {
      migratableModelKeys.add(c.record_key);
    }
  }

  // Iterate MIGRATABLE projects: split by normalized project_type and
  // verify the type-specific link resolves to a MIGRATABLE record of the
  // correct entity_type. Also count type mismatches for AC-09 check.
  let kepianCustomerPairs = 0;   // 客片 + linked_customer_key → MIGRATABLE Customer
  let yangpianModelPairs = 0;    // 样片 + linked_model_key → MIGRATABLE Model
  let typeMismatches = 0;        // linked_*_key points to wrong entity_type

  for (const c of classified) {
    if (!c || c.classification !== 'MIGRATABLE') continue;
    if (c.entity_type !== 'project') continue;
    const source = sourceByKey.get(c.record_key);
    if (!source || !source.fields) continue;
    const f = source.fields;
    const rawType = (f.project_type_raw === null || f.project_type_raw === undefined)
      ? '' : String(f.project_type_raw).trim();
    if (rawType === '') continue; // PROJECT_TYPE_REQUIRED — not assoc. testable
    const normalizedType = _normalizeProjectTypeImpl(rawType);

    const customerKey = (f.linked_customer_key === null || f.linked_customer_key === undefined)
      ? '' : String(f.linked_customer_key).trim();
    const modelKey = (f.linked_model_key === null || f.linked_model_key === undefined)
      ? '' : String(f.linked_model_key).trim();

    if (normalizedType === '样片') {
      // 样片 MUST link to a Model. Customer link is optional.
      if (modelKey !== '') {
        const linked = sourceByKey.get(modelKey);
        if (linked) {
          if (linked.entity_type === 'model') {
            if (migratableModelKeys.has(modelKey)) {
              yangpianModelPairs += 1;
            }
          } else {
            // Model key points to a non-model record — type mismatch.
            typeMismatches += 1;
          }
        }
      }
      // Optional: if 样片 also has a customerKey, verify type
      if (customerKey !== '') {
        const linked = sourceByKey.get(customerKey);
        if (linked && linked.entity_type !== 'customer') {
          typeMismatches += 1;
        }
      }
    } else if (normalizedType === '客片' || normalizedType === '品牌' || normalizedType === '其他') {
      // 客片 / 品牌 / 其他 MUST link to a Customer. Model link optional.
      if (customerKey !== '') {
        const linked = sourceByKey.get(customerKey);
        if (linked) {
          if (linked.entity_type === 'customer') {
            if (migratableCustomerKeys.has(customerKey)) {
              kepianCustomerPairs += 1;
            }
          } else {
            // Customer key points to a non-customer record — type mismatch.
            typeMismatches += 1;
          }
        }
      }
      // Optional: if 客片 also has a modelKey, verify type
      if (modelKey !== '') {
        const linked = sourceByKey.get(modelKey);
        if (linked && linked.entity_type !== 'model') {
          typeMismatches += 1;
        }
      }
    }
    // Unmapped types: skip association check (classifier handles as
    // PROJECT_TYPE_UNMAPPED; such projects would not be MIGRATABLE anyway).
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

  // AC-08/AC-09: combined project-association check.
  const combinedPairs = kepianCustomerPairs + yangpianModelPairs;
  const associationMet = combinedPairs >= D026_PROJECT_ASSOCIATION_MIN;
  if (!associationMet) allMet = false;
  const projectAssociation = {
    // Combined threshold (preserved for backwards compat with v1.1 schema).
    required_migratable_with_migratable_customer: D026_PROJECT_ASSOCIATION_MIN,
    actual_migratable_with_migratable_customer: combinedPairs,
    met: associationMet,
    shortfall: associationMet
      ? 0
      : D026_PROJECT_ASSOCIATION_MIN - combinedPairs,
    // New per-type split fields (PROJECT-TYPE-SOURCE-OF-TRUTH-CORRECTION-01).
    required_combined: D026_PROJECT_ASSOCIATION_MIN,
    kepian_customer_pairs: kepianCustomerPairs,
    yangpian_model_pairs: yangpianModelPairs,
    combined_pairs: combinedPairs,
  };

  // AC-09: entity_type correctness check.
  const typeCorrectnessMet = typeMismatches <= D026_ALLOWED_TYPE_MISMATCHES;
  if (!typeCorrectnessMet) allMet = false;
  const entityTypeCorrectness = {
    allowed_mismatches: D026_ALLOWED_TYPE_MISMATCHES,
    actual_mismatches: typeMismatches,
    met: typeCorrectnessMet,
  };

  const judgement = allMet
    ? 'PASS — All D-026 quantity thresholds met (including split project-association check and entity-type correctness). MIGRATION_PILOT_001 may be considered for approval (still requires explicit user approval).'
    : 'FAIL — One or more D-026 thresholds not met. MIGRATION_PILOT_001 MUST NOT start. Possible causes: MIGRATABLE counts short, fewer than 5 MIGRATABLE projects with valid type-specific associations, or one or more linked keys point to the wrong entity_type.';

  return {
    schema_version: 'r6-quantity-threshold-judgement-v1.1',
    decision_reference: 'D-026 (DECISION_LOG.md)',
    description:
      'D-026 Phase 1B-3 启动前置条件（PROJECT-TYPE-SOURCE-OF-TRUTH-CORRECTION-01）：Customer >= 5 / Project >= 5 / Model >= 10 / Makeup >= 10 / 合计 >= 5 MIGRATABLE Project 持有按类型合规关联（客片→MIGRATABLE Customer，样片→MIGRATABLE Model）/ 关联实体类型零错配。Migration pilot MUST NOT start until ALL thresholds are met.',
    all_thresholds_met: allMet,
    judgement,
    thresholds,
    project_association_check: projectAssociation,
    entity_type_correctness_check: entityTypeCorrectness,
  };
}

module.exports = {
  evaluateD026Threshold,
  D026_THRESHOLDS,
  D026_PROJECT_ASSOCIATION_MIN,
  D026_ALLOWED_TYPE_MISMATCHES,
  ENTITY_TYPES,
};
