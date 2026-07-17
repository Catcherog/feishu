'use strict';

// Accounting summary builder. Pure function, no I/O.
//
// Aggregates classified records into a public, anonymized summary that
// reconciles per-entity and overall:
//   MIGRATABLE + NEEDS_REVIEW + BLOCKED = source_total
//   sum(by_primary_reason_code)       = source_total

const ENTITY_TYPES = ['customer', 'project', 'model', 'makeup'];
const CLASSIFICATIONS = ['MIGRATABLE', 'NEEDS_REVIEW', 'BLOCKED'];

/**
 * Build a public, anonymized accounting summary from classified records.
 *
 * @param {Array<{record_key: string, entity_type: string, classification: string, primary_reason_code: string, secondary_reason_codes: string[]}>} classifiedRecords
 * @returns {{
 *   schema_version: string,
 *   classifier_version: string,
 *   entities: Object<string, {
 *     source_total: number,
 *     by_classification: Object<string, number>,
 *     by_primary_reason_code: Object<string, number>,
 *     reconciled: boolean
 *   }>,
 *   overall: {
 *     source_total: number,
 *     classified_total: number,
 *     primary_reason_total: number,
 *     reconciled: boolean
 *   }
 * }}
 */
function buildAccountingSummary(classifiedRecords) {
  const entities = {};
  for (const entityType of ENTITY_TYPES) {
    entities[entityType] = {
      source_total: 0,
      by_classification: { MIGRATABLE: 0, NEEDS_REVIEW: 0, BLOCKED: 0 },
      by_primary_reason_code: {},
      reconciled: false,
    };
  }

  let overallSource = 0;

  for (const r of classifiedRecords) {
    const bucket = entities[r.entity_type];
    if (!bucket) {
      throw new Error(`unknown entity_type: ${r.entity_type}`);
    }
    bucket.source_total += 1;
    overallSource += 1;

    if (r.record_key === null || r.record_key === undefined || r.record_key === '') {
      throw new Error('record missing stable record_key');
    }

    if (!CLASSIFICATIONS.includes(r.classification)) {
      throw new Error(`unknown classification: ${r.classification}`);
    }
    bucket.by_classification[r.classification] += 1;

    if (!r.primary_reason_code) {
      throw new Error(`record ${r.record_key} missing primary_reason_code`);
    }
    bucket.by_primary_reason_code[r.primary_reason_code] =
      (bucket.by_primary_reason_code[r.primary_reason_code] || 0) + 1;
  }

  // Reconciliation per entity.
  let overallClassified = 0;
  let overallPrimary = 0;
  let overallReconciled = true;
  for (const entityType of ENTITY_TYPES) {
    const bucket = entities[entityType];
    const classSum = CLASSIFICATIONS
      .reduce((acc, c) => acc + (bucket.by_classification[c] || 0), 0);
    let primarySum = 0;
    for (const code of Object.keys(bucket.by_primary_reason_code)) {
      primarySum += bucket.by_primary_reason_code[code];
    }
    const reconciled = classSum === bucket.source_total && primarySum === bucket.source_total;
    bucket.reconciled = reconciled;
    overallClassified += classSum;
    overallPrimary += primarySum;
    if (!reconciled) overallReconciled = false;
  }

  return {
    schema_version: 'classification-summary-v1.0',
    classifier_version: 'classifier-v1.0',
    entities,
    overall: {
      source_total: overallSource,
      classified_total: overallClassified,
      primary_reason_total: overallPrimary,
      reconciled: overallReconciled,
    },
  };
}

module.exports = {
  buildAccountingSummary,
  ENTITY_TYPES,
  CLASSIFICATIONS,
};
