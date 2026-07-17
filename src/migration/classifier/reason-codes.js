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
  MISSING_NAME:           { priority: 10,  classification: 'BLOCKED' },
  MISSING_IDENTITY:        { priority: 20,  classification: 'BLOCKED' },
  ORPHAN_PROJECT:          { priority: 30,  classification: 'BLOCKED' },
  CUSTOMER_UNRESOLVED:    { priority: 40,  classification: 'NEEDS_REVIEW' },
  DUPLICATE_UNRESOLVED:    { priority: 50,  classification: 'NEEDS_REVIEW' },
  STATUS_NEEDS_REVIEW:     { priority: 60,  classification: 'NEEDS_REVIEW' },
  SOURCE_UNMAPPED:         { priority: 70,  classification: 'NEEDS_REVIEW' },
  BUDGET_AMBIGUOUS:        { priority: 80,  classification: 'NEEDS_REVIEW' },
  PROJECT_TYPE_UNMAPPED:   { priority: 90,  classification: 'NEEDS_REVIEW' },
  ELIGIBLE:                { priority: 100, classification: 'MIGRATABLE' },
};

/**
 * Stable priority order. Hard-coded to guarantee determinism regardless of
 * object key iteration order.
 * @type {readonly string[]}
 */
const REASON_PRIORITY_ORDER = [
  'MISSING_NAME',
  'MISSING_IDENTITY',
  'ORPHAN_PROJECT',
  'CUSTOMER_UNRESOLVED',
  'DUPLICATE_UNRESOLVED',
  'STATUS_NEEDS_REVIEW',
  'SOURCE_UNMAPPED',
  'BUDGET_AMBIGUOUS',
  'PROJECT_TYPE_UNMAPPED',
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
