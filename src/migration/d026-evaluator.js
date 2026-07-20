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
// PROJECT-TYPE-SOURCE-OF-TRUTH-CORRECTION-01-R1 corrections:
//   - Replaced combined threshold (kepian + yangpian >= 5) with per-type
//     100% completeness check. Either type may have 0 MIGRATABLE projects,
//     but if any MIGRATABLE project of type X lacks its required
//     type-specific association to a MIGRATABLE record, the gate FAILs.
//     This prevents a single type's completeness from being masked by
//     the other type's quantity.
//   - Added explicit detection-coverage evidence to entity_type_correctness_check:
//       * checked_relation_count: total link relations inspected
//       * unresolved_relation_count: links pointing to records missing
//         from the batch (LINKED_RELATION_UNRESOLVED cases)
//       * type_mismatch_count: links pointing to wrong entity_type
//     When checked_relation_count == 0, "0 mismatch" is a no-coverage
//     zero, not a positive verification.
//   - Added source_match_check to track how many projects were matched to
//     the authoritative 项目统计表 vs MATCH_NOT_FOUND. Per user decision,
//     MATCH_NOT_FOUND projects do NOT enter the MIGRATABLE project count
//     threshold (they are NEEDS_REVIEW, classified by PROJECT_SOURCE_MATCH_REQUIRED).
//   - Retained the overall MIGRATABLE project count threshold (>= 5) and
//     per-entity thresholds.
//
// PROJECT-TYPE-SOURCE-OF-TRUTH-CORRECTION-01-R2 corrections:
//   - Decoupled per-type association completeness denominator from
//     `final_classification === 'MIGRATABLE'`. The denominator now includes
//     ALL projects with `authoritative_match_status !== 'MATCH_NOT_FOUND'`
//     AND non-empty normalized project_type — regardless of whether the
//     project ended up MIGRATABLE / BLOCKED / NEEDS_REVIEW. This closes the
//     "self-proving loop" where a project missing its link would first be
//     classified as BLOCKED/ORPHAN_PROJECT and then be excluded from the
//     per-type completeness denominator, masking the defect.
//   - Removed `MIGRATABLE` requirement from the "correct pair" definition.
//     A pair is now defined purely by structural validity:
//       * linked_*_key is present (non-empty)
//       * the key resolves to a record in the batch
//       * the resolved record's entity_type matches the expected type
//         (customer for 客片 / 品牌 / 其他; model for 样片)
//       * no type mismatch (a Model key in the Customer field, etc.)
//     Whether the linked record is itself MIGRATABLE is irrelevant for
//     per-type completeness — that concern is covered by the per-entity
//     MIGRATABLE count threshold (Customer >= 5, Model >= 10, etc.).
//   - The four D-026 gates are now INDEPENDENT:
//       1. Per-entity MIGRATABLE count threshold (Customer/Project/Model/Makeup)
//       2. Per-type 100% association completeness (structural validity only)
//       3. Entity-type correctness (zero mismatches + detection coverage)
//       4. Combined correct pairs count (>= 5)
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

// D-026 requires at least 5 MIGRATABLE projects in total. Per
// PROJECT-TYPE-SOURCE-OF-TRUTH-CORRECTION-01-R1, this is the OVERALL
// MIGRATABLE project count threshold (excluding MATCH_NOT_FOUND projects
// which are NEEDS_REVIEW and cannot be MIGRATABLE). The per-type
// completeness check (100% each) is a SEPARATE gate — both must pass.
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
 *   2. project MIGRATABLE count >= 5 (MATCH_NOT_FOUND projects are
 *      NEEDS_REVIEW and excluded from this count by classifier logic)
 *   3. model MIGRATABLE count >= 10
 *   4. makeup MIGRATABLE count >= 10
 *   5. (AC-08/AC-09, R2) Per-type 100% association completeness check.
 *      Denominator is decoupled from final_classification:
 *      - A project enters the denominator iff:
 *          * entity_type === 'project'
 *          * authoritative_match_status !== 'MATCH_NOT_FOUND'
 *            (undefined is treated as 'MATCHED' for legacy compat)
 *          * normalized project_type is non-empty AND is one of:
 *              客片 / 品牌 / 其他  → enters kepian_customer_total
 *              样片 (V1 "创作" normalized) → enters yangpian_model_total
 *      - A project counts as a "correct pair" iff its required
 *        type-specific linked_*_key:
 *          * is present (non-empty)
 *          * resolves to a record in the batch
 *          * the resolved record's entity_type matches the expected type
 *            (customer for 客片/品牌/其他; model for 样片)
 *          * no type mismatch (covered by entity_type_correctness_check)
 *        Whether the linked record is itself MIGRATABLE is IRRELEVANT
 *        for the per-type completeness gate — that is covered by the
 *        per-entity MIGRATABLE count threshold (gates 1 and 3).
 *      - Either type may have 0 denominator projects (vacuous PASS), but
 *        if any denominator project of a given type lacks its required
 *        type-specific association, the completeness gate FAILs for
 *        that type.
 *   6. (AC-09) 关联实体类型正确性: zero projects with a linked key pointing
 *      to the wrong entity_type (e.g. Model key written into Customer field).
 *      Coverage evidence (checked_relation_count) is reported; a 0 result
 *      with 0 relations checked is NOT a positive verification.
 *   7. (R2) Combined correct pairs count >= 5. This is the OVERALL batch
 *      size requirement (independent of per-type completeness).
 *
 * The output is fully anonymized: only aggregate counts, no record keys,
 * no record IDs, no names, no linked-customer detail.
 *
 * @param {Array<{record_key: string, entity_type: string, classification: string, primary_reason_code: string, secondary_reason_codes: string[]}>} classified
 * @param {Map<string, {record_key: string, entity_type: string, fields: {project_type_raw?: string, linked_customer_key?: string, linked_model_key?: string, authoritative_match_status?: string}}>} sourceByKey
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
 *   source_match_check: {
 *     matched_project_count: number,
 *     match_not_found_project_count: number,
 *     total_project_count: number
 *   },
 *   project_association_check: {
 *     required_combined: number,
 *     kepian_customer_pairs: number,
 *     kepian_customer_total: number,
 *     kepian_completeness_met: boolean,
 *     yangpian_model_pairs: number,
 *     yangpian_model_total: number,
 *     yangpian_completeness_met: boolean,
 *     combined_pairs: number,
 *     combined_pairs_met: boolean,
 *     per_type_completeness_met: boolean,
 *     met: boolean,
 *     shortfall: number,
 *     // Backwards-compat fields (deprecated, retained for schema stability)
 *     actual_migratable_with_migratable_customer: number
 *   },
 *   entity_type_correctness_check: {
 *     allowed_mismatches: number,
 *     actual_mismatches: number,
 *     checked_relation_count: number,
 *     unresolved_relation_count: number,
 *     type_mismatch_count: number,
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

  // Gate 1: Count MIGRATABLE per entity. This is the per-entity quantity
  // threshold (Customer >= 5, Project >= 5, Model >= 10, Makeup >= 10).
  // MIGRATABLE determination is independent of per-type association
  // completeness (R2: gates are independent).
  const counts = { customer: 0, project: 0, model: 0, makeup: 0 };
  for (const c of classified) {
    if (!c || c.classification !== 'MIGRATABLE') continue;
    if (!ENTITY_TYPES.includes(c.entity_type)) continue;
    counts[c.entity_type] += 1;
  }

  // Gate 2/3: Per-type 100% association completeness + entity-type
  // correctness with detection coverage.
  //
  // R2 key change: denominator is decoupled from final_classification.
  // A project enters the denominator iff:
  //   - entity_type === 'project'
  //   - authoritative_match_status !== 'MATCH_NOT_FOUND'
  //     (undefined is treated as 'MATCHED' for legacy compat)
  //   - normalized project_type is non-empty AND one of:
  //       客片 / 品牌 / 其他 → kepian_customer_total
  //       样片               → yangpian_model_total
  //
  // A project counts as a "correct pair" iff its required type-specific
  // linked_*_key is present, resolves to a record in the batch, and the
  // resolved record's entity_type matches the expected type. Whether the
  // linked record is itself MIGRATABLE is IRRELEVANT — that is covered
  // by the per-entity MIGRATABLE count threshold.
  let kepianCustomerPairs = 0;   // 客片 + linked_customer_key → Customer (any classification)
  let kepianCustomerTotal = 0;   // total MATCHED 客片/品牌/其他 projects (any classification)
  let yangpianModelPairs = 0;    // 样片 + linked_model_key → Model (any classification)
  let yangpianModelTotal = 0;    // total MATCHED 样片 projects (any classification)
  let typeMismatches = 0;        // linked_*_key points to wrong entity_type
  let checkedRelations = 0;     // total link relations inspected
  let unresolvedRelations = 0;   // link keys pointing to records missing from batch

  // Track MATCH_NOT_FOUND project counts (per R1 user decision, these do
  // not enter MIGRATABLE project statistics — they are NEEDS_REVIEW).
  let matchedProjectCount = 0;
  let matchNotFoundProjectCount = 0;
  let totalProjectCount = 0;

  for (const c of classified) {
    if (!c) continue;
    if (c.entity_type !== 'project') continue;

    // source_match_check counts ALL projects (regardless of classification
    // or match_status). This is informational — it shows how many projects
    // are in the batch and how they were categorized by match_status.
    totalProjectCount += 1;
    const source = sourceByKey.get(c.record_key);
    const matchStatus = source && source.fields
      ? source.fields.authoritative_match_status
      : undefined;
    if (matchStatus === 'MATCH_NOT_FOUND') {
      matchNotFoundProjectCount += 1;
      // MATCH_NOT_FOUND projects do NOT enter the per-type association
      // denominator. They are NEEDS_REVIEW / PROJECT_SOURCE_MATCH_REQUIRED
      // and cannot be assigned an authoritative project_type.
      continue;
    }
    // 'MATCHED' or undefined (legacy single-record mode) counts as matched
    matchedProjectCount += 1;

    // Per-type association check: requires source.fields with non-empty
    // normalized project_type. Empty type → PROJECT_TYPE_REQUIRED handles
    // it at classifier level; not assoc-testable, skip denominator.
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
      yangpianModelTotal += 1;
      // 样片 MUST link to a Model. Customer link is optional.
      if (modelKey !== '') {
        checkedRelations += 1;
        const linked = sourceByKey.get(modelKey);
        if (!linked) {
          // Model key references a record not in the batch — unresolved
          unresolvedRelations += 1;
        } else if (linked.entity_type === 'model') {
          // R2: pair does NOT require linked Model to be MIGRATABLE.
          // MIGRATABLE count is a separate per-entity threshold (gate 1).
          yangpianModelPairs += 1;
        } else {
          // Model key points to a non-model record — type mismatch.
          typeMismatches += 1;
        }
      }
      // Optional: if 样片 also has a customerKey, verify type
      if (customerKey !== '') {
        checkedRelations += 1;
        const linked = sourceByKey.get(customerKey);
        if (!linked) {
          unresolvedRelations += 1;
        } else if (linked.entity_type !== 'customer') {
          typeMismatches += 1;
        }
      }
    } else if (normalizedType === '客片' || normalizedType === '品牌' || normalizedType === '其他') {
      kepianCustomerTotal += 1;
      // 客片 / 品牌 / 其他 MUST link to a Customer. Model link optional.
      if (customerKey !== '') {
        checkedRelations += 1;
        const linked = sourceByKey.get(customerKey);
        if (!linked) {
          unresolvedRelations += 1;
        } else if (linked.entity_type === 'customer') {
          // R2: pair does NOT require linked Customer to be MIGRATABLE.
          kepianCustomerPairs += 1;
        } else {
          // Customer key points to a non-customer record — type mismatch.
          typeMismatches += 1;
        }
      }
      // Optional: if 客片 also has a modelKey, verify type
      if (modelKey !== '') {
        checkedRelations += 1;
        const linked = sourceByKey.get(modelKey);
        if (!linked) {
          unresolvedRelations += 1;
        } else if (linked.entity_type !== 'model') {
          typeMismatches += 1;
        }
      }
    }
    // Unmapped types: skip association check (classifier handles as
    // PROJECT_TYPE_UNMAPPED; not assoc-testable).
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

  // AC-08/AC-09 R1: per-type 100% completeness check.
  // Each type with at least 1 MIGRATABLE project must have ALL projects
  // correctly associated with a MIGRATABLE record of the right entity_type.
  // Either type may have 0 MIGRATABLE projects (vacuous PASS).
  const kepianCompletenessMet = kepianCustomerTotal === 0
    || kepianCustomerPairs === kepianCustomerTotal;
  const yangpianCompletenessMet = yangpianModelTotal === 0
    || yangpianModelPairs === yangpianModelTotal;

  // Combined pair count must still meet the minimum overall threshold
  // (this is the original D-026 project-association-count requirement,
  // retained for backwards compatibility and as a minimum batch size).
  const combinedPairs = kepianCustomerPairs + yangpianModelPairs;
  const combinedPairsMet = combinedPairs >= D026_PROJECT_ASSOCIATION_MIN;

  // The per-type completeness gate requires BOTH types to be 100% complete.
  // This is the NEW gate that replaces the old combined-only threshold.
  const perTypeCompletenessMet = kepianCompletenessMet && yangpianCompletenessMet;

  // The overall association gate now requires BOTH:
  //   - per-type 100% completeness (no type's defects masked by the other)
  //   - combined pair count >= minimum (overall batch size requirement)
  const associationMet = perTypeCompletenessMet && combinedPairsMet;
  if (!associationMet) allMet = false;

  const projectAssociation = {
    // New R1 per-type completeness fields (primary gate).
    required_combined: D026_PROJECT_ASSOCIATION_MIN,
    kepian_customer_pairs: kepianCustomerPairs,
    kepian_customer_total: kepianCustomerTotal,
    kepian_completeness_met: kepianCompletenessMet,
    yangpian_model_pairs: yangpianModelPairs,
    yangpian_model_total: yangpianModelTotal,
    yangpian_completeness_met: yangpianCompletenessMet,
    combined_pairs: combinedPairs,
    combined_pairs_met: combinedPairsMet,
    per_type_completeness_met: perTypeCompletenessMet,
    met: associationMet,
    shortfall: associationMet
      ? 0
      : Math.max(0, D026_PROJECT_ASSOCIATION_MIN - combinedPairs),
    // Backwards-compat field (deprecated — use combined_pairs + per_type_completeness_met)
    required_migratable_with_migratable_customer: D026_PROJECT_ASSOCIATION_MIN,
    actual_migratable_with_migratable_customer: combinedPairs,
  };

  // AC-09 R1: entity_type correctness check with detection-coverage evidence.
  const typeCorrectnessMet = typeMismatches <= D026_ALLOWED_TYPE_MISMATCHES;
  if (!typeCorrectnessMet) allMet = false;
  const entityTypeCorrectness = {
    allowed_mismatches: D026_ALLOWED_TYPE_MISMATCHES,
    actual_mismatches: typeMismatches,
    // New R1 detection-coverage evidence fields.
    checked_relation_count: checkedRelations,
    unresolved_relation_count: unresolvedRelations,
    type_mismatch_count: typeMismatches,
    met: typeCorrectnessMet,
  };

  // R1: source-match check — track how many projects matched the
  // authoritative 项目统计表 vs MATCH_NOT_FOUND. MATCH_NOT_FOUND projects
  // are NEEDS_REVIEW and excluded from MIGRATABLE project statistics.
  const sourceMatchCheck = {
    matched_project_count: matchedProjectCount,
    match_not_found_project_count: matchNotFoundProjectCount,
    total_project_count: totalProjectCount,
  };

  const judgement = allMet
    ? 'PASS — All D-026 quantity thresholds met (including per-type 100% completeness check and entity-type correctness with detection coverage). MIGRATION_PILOT_001 may be considered for approval (still requires explicit user approval).'
    : 'FAIL — One or more D-026 thresholds not met. MIGRATION_PILOT_001 MUST NOT start. Possible causes: MIGRATABLE counts short, per-type association completeness < 100% (客片 Customer / 样片 Model), combined pair count < 5, or one or more linked keys point to the wrong entity_type / unresolved record.';

  return {
    schema_version: 'r6-quantity-threshold-judgement-v1.3',
    decision_reference: 'D-026 (DECISION_LOG.md)',
    description:
      'D-026 Phase 1B-3 启动前置条件（PROJECT-TYPE-SOURCE-OF-TRUTH-CORRECTION-01-R2）：Customer >= 5 / Project >= 5 / Model >= 10 / Makeup >= 10 / 客片 Customer 完整率 100% / 样片 Model 完整率 100% / 合计正确关联对 >= 5 / 关联实体类型零错配 / 检测覆盖证据齐全。R2: 分母基于权威身份而非 final_classification；MATCH_NOT_FOUND 项目不进入分类型完整性分母。Migration pilot MUST NOT start until ALL thresholds are met.',
    all_thresholds_met: allMet,
    judgement,
    thresholds,
    source_match_check: sourceMatchCheck,
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
