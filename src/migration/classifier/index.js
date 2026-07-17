'use strict';

// Public entry point for the migration classifier package.
//
// Re-exports the stable public surface defined in TASK-002.md:
//   classifyRecord(record, context?) -> classifiedRecord
//   classifyBatch(records)          -> Array<classifiedRecord>
//   parseBudget(rawText)            -> budgetParseResult
//   buildAccountingSummary(records) -> publicSummary
//   REASON_CODES, REASON_PRIORITY_ORDER

const {
  classifyRecord,
  classifyBatch,
} = require('./classifier');
const { parseBudget, BUDGET_RULE_VERSION } = require('./budget');
const { buildAccountingSummary } = require('./accounting');
const {
  REASON_CODES,
  REASON_PRIORITY_ORDER,
  sortAndDedupReasonCodes,
  selectPrimaryAndSecondary,
} = require('./reason-codes');

module.exports = {
  classifyRecord,
  classifyBatch,
  parseBudget,
  buildAccountingSummary,
  REASON_CODES,
  REASON_PRIORITY_ORDER,
  sortAndDedupReasonCodes,
  selectPrimaryAndSecondary,
  BUDGET_RULE_VERSION,
};
