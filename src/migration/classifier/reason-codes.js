'use strict';

// Reason codes, priority order, and classification mapping.
//
// Source of truth: docs/ai/tasks/TASK-002.md "Reason codes and priority"
// and DECISION_LOG D-020 through D-025.
//
// Priority is a fixed integer; lower number = higher priority.
// The primary_reason_code is the applicable reason with the lowest priority
// number. All other applicable reasons become secondary_reason_codes,
// sorted by priority ascending and deduplicated.

/**
 * @typedef {Object} ReasonCodeDefinition
 * @property {number} priority   Fixed priority (lower = higher precedence).
 * @property {'MIGRATABLE'|'NEEDS_REVIEW'|'BLOCKED'} classification
 */

/** @type {Record<string, ReasonCodeDefinition>} */
const REASON_CODES = {
  MISSING_NAME:                  { priority: 10,  classification: 'BLOCKED' },
  MISSING_IDENTITY:              { priority: 20,  classification: 'BLOCKED' },
  ORPHAN_PROJECT:                { priority: 30,  classification: 'BLOCKED' },
  // New (PROJECT-TYPE-SOURCE-OF-TRUTH-CORRECTION-01): linked key points to
  // wrong entity type — e.g. a 样片 project has a Model record_key written
  // into the linked_customer_key field, or a 客片 project has a Customer
  // record_key written into the linked_model_key field. Lower priority
  // number than ORPHAN_PROJECT so the specific mismatch is surfaced first
  // when both could theoretically apply.
  LINKED_ENTITY_TYPE_MISMATCH:  { priority: 25,  classification: 'BLOCKED' },
  CUSTOMER_UNRESOLVED:          { priority: 40,  classification: 'NEEDS_REVIEW' },
  DUPLICATE_UNRESOLVED:          { priority: 50,  classification: 'NEEDS_REVIEW' },
  STATUS_NEEDS_REVIEW:           { priority: 60,  classification: 'NEEDS_REVIEW' },
  SOURCE_UNMAPPED:               { priority: 70,  classification: 'NEEDS_REVIEW' },
  BUDGET_AMBIGUOUS:              { priority: 80,  classification: 'NEEDS_REVIEW' },
  PROJECT_TYPE_UNMAPPED:         { priority: 90,  classification: 'NEEDS_REVIEW' },
  // New (PROJECT-TYPE-SOURCE-OF-TRUTH-CORRECTION-01): project_type_raw is
  // empty. The classifier must not infer the type or auto-pick a link
  // target. Higher priority number than PROJECT_TYPE_UNMAPPED (90) so
  // non-empty-but-invalid types take precedence over the empty case.
  PROJECT_TYPE_REQUIRED:         { priority: 95,  classification: 'NEEDS_REVIEW' },
  // New (PROJECT-TYPE-SOURCE-OF-TRUTH-CORRECTION-01-R1): project record
  // cannot be matched to the authoritative source (项目统计表). Such records
  // cannot be assigned an authoritative project_type and must not be
  // classified as ORPHAN_PROJECT (which assumes a known type). They enter
  // NEEDS_REVIEW pending user confirmation of identity / type / links.
  PROJECT_SOURCE_MATCH_REQUIRED: { priority: 27, classification: 'NEEDS_REVIEW' },
  // New (PROJECT-TYPE-SOURCE-OF-TRUTH-CORRECTION-01-R1): a V1 link field
  // references a record_id that cannot be resolved in the batch (the
  // referenced record is missing). The relation cannot be verified, so
  // the record is BLOCKED. Distinct from ORPHAN_PROJECT (which means no
  // link key is present at all) and LINKED_ENTITY_TYPE_MISMATCH (which
  // means the target exists but has the wrong entity_type).
  LINKED_RELATION_UNRESOLVED:    { priority: 28, classification: 'BLOCKED' },
  ELIGIBLE:                      { priority: 100, classification: 'MIGRATABLE' },
};

/**
 * Stable priority order. Hard-coded to guarantee determinism regardless of
 * object key iteration order.
 *
 * PROJECT_SOURCE_MATCH_REQUIRED (P27) sits between LINKED_ENTITY_TYPE_MISMATCH
 * (P25) and ORPHAN_PROJECT (P30) so that a record whose authoritative source
 * match failed surfaces as NEEDS_REVIEW (not BLOCKED), and never collapses
 * into ORPHAN_PROJECT (which assumes the type is known but the link is
 * missing).
 *
 * LINKED_RELATION_UNRESOLVED (P28) sits between PROJECT_SOURCE_MATCH_REQUIRED
 * (P27) and ORPHAN_PROJECT (P30) — when a V1 link field references a
 * record_id that cannot be resolved in the batch, the record is BLOCKED with
 * a specific reason, distinct from ORPHAN_PROJECT (no link key present at
 * all) and LINKED_ENTITY_TYPE_MISMATCH (target exists but wrong type).
 * @type {readonly string[]}
 */
const REASON_PRIORITY_ORDER = [
  'MISSING_NAME',
  'MISSING_IDENTITY',
  'LINKED_ENTITY_TYPE_MISMATCH',
  'PROJECT_SOURCE_MATCH_REQUIRED',
  'LINKED_RELATION_UNRESOLVED',
  'ORPHAN_PROJECT',
  'CUSTOMER_UNRESOLVED',
  'DUPLICATE_UNRESOLVED',
  'STATUS_NEEDS_REVIEW',
  'SOURCE_UNMAPPED',
  'BUDGET_AMBIGUOUS',
  'PROJECT_TYPE_UNMAPPED',
  'PROJECT_TYPE_REQUIRED',
  'ELIGIBLE',
];

/**
 * Sort a list of reason codes by priority ascending, then deduplicate.
 * Stable and independent of insertion order.
 * @param {string[]} codes
 * @returns {string[]}
 */
function sortAndDedupReasonCodes(codes) {
  const seen = new Set();
  const unique = [];
  for (const code of codes) {
    if (!seen.has(code)) {
      seen.add(code);
      unique.push(code);
    }
  }
  unique.sort((a, b) => REASON_CODES[a].priority - REASON_CODES[b].priority);
  return unique;
}

/**
 * Select the primary reason (lowest priority number) and return the rest as
 * the stable-sorted, deduplicated secondary list.
 * @param {string[]} codes
 * @returns {{primary: string, secondary: string[]}}
 */
function selectPrimaryAndSecondary(codes) {
  const ordered = sortAndDedupReasonCodes(codes);
  if (ordered.length === 0) {
    return { primary: 'ELIGIBLE', secondary: [] };
  }
  const [primary, ...rest] = ordered;
  return { primary, secondary: rest };
}

module.exports = {
  REASON_CODES,
  REASON_PRIORITY_ORDER,
  sortAndDedupReasonCodes,
  selectPrimaryAndSecondary,
};
