'use strict';

// Classification accounting CLI.
//
// Reads a normalized classifier-input file, runs the stable classifier
// (classifyBatch + buildAccountingSummary), and writes:
//   - a private, record-level matrix (gitignored)
//   - a public, anonymized reason summary (committed)
//
// Usage:
//   node scripts/run_classification_accounting.js \
//     --input backups/private/classification-input.private.json \
//     --private-output backups/private/classification-record-matrix.private.json \
//     --public-output reports/classification-reason-summary.json
//
// Exits non-zero when:
//   - required arguments are missing
//   - input file cannot be read or parsed
//   - any record is missing a stable record_key
//   - any record_key is duplicated
//   - any record has an unknown entity_type
//   - any record is missing a primary_reason_code after classification
//   - per-entity or overall reconciliation fails
//
// This script is the only place where file I/O and the classifier meet.
// The classifier itself remains a pure function.

const fs = require('fs');
const path = require('path');
const {
  classifyBatch,
  buildAccountingSummary,
} = require('../src/migration/classifier');

const ALLOWED_ENTITY_TYPES = new Set(['customer', 'project', 'model', 'makeup']);

/**
 * Parse CLI arguments of the form --key value.
 * @param {string[]} argv
 * @returns {Record<string, string>}
 */
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1];
      if (val === undefined || val.startsWith('--')) {
        throw new Error(`missing value for --${key}`);
      }
      out[key] = val;
      i++;
    }
  }
  return out;
}

/**
 * Read and parse JSON file.
 * @param {string} p
 * @returns {any}
 */
function readJson(p) {
  const raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw);
}

/**
 * Write JSON with stable formatting (2-space indent, trailing newline).
 * @param {string} p
 * @param {any} data
 */
function writeJson(p, data) {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const text = JSON.stringify(data, null, 2) + '\n';
  fs.writeFileSync(p, text, 'utf8');
}

/**
 * Validate the input cases before classification. Throws on any violation.
 * @param {any[]} cases
 */
function validateInput(cases) {
  if (!Array.isArray(cases)) {
    throw new Error('input.cases must be an array');
  }
  const seenKeys = new Set();
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const label = `cases[${i}]`;
    if (!c || typeof c !== 'object') {
      throw new Error(`${label} is not an object`);
    }
    const key = c.record_key;
    if (key === null || key === undefined || String(key).trim() === '') {
      throw new Error(`${label} missing stable record_key`);
    }
    const keyStr = String(key);
    if (seenKeys.has(keyStr)) {
      throw new Error(`duplicate record_key: ${keyStr}`);
    }
    seenKeys.add(keyStr);
    if (!ALLOWED_ENTITY_TYPES.has(c.entity_type)) {
      throw new Error(
        `${label} unknown entity_type: ${String(c.entity_type)}`);
    }
    if (!c.fields || typeof c.fields !== 'object') {
      throw new Error(`${label} missing or non-object fields`);
    }
  }
}

/**
 * Verify every classified record has exactly one primary_reason_code and
 * a stable, deduplicated secondary list. Throws on violation.
 * @param {Array<{record_key: string, primary_reason_code: string, secondary_reason_codes: string[]}>} classified
 */
function validateClassified(classified) {
  for (let i = 0; i < classified.length; i++) {
    const c = classified[i];
    const label = `classified[${i}] (record_key=${c.record_key})`;
    if (!c.primary_reason_code || typeof c.primary_reason_code !== 'string') {
      throw new Error(`${label} missing primary_reason_code`);
    }
    if (!Array.isArray(c.secondary_reason_codes)) {
      throw new Error(`${label} secondary_reason_codes is not an array`);
    }
    // Check for duplicates in secondary list.
    const seen = new Set();
    for (const code of c.secondary_reason_codes) {
      if (seen.has(code)) {
        throw new Error(`${label} duplicate secondary reason code: ${code}`);
      }
      seen.add(code);
    }
  }
}

/**
 * Verify reconciliation per entity and overall. Throws on violation.
 * This re-runs the same arithmetic as buildAccountingSummary, so that
 * the CLI fails loudly if the summary builder ever drifts.
 * @param {any} summary
 */
function verifyReconciliation(summary) {
  const errs = [];
  for (const entityType of Object.keys(summary.entities)) {
    const b = summary.entities[entityType];
    const classSum = (b.by_classification.MIGRATABLE || 0)
      + (b.by_classification.NEEDS_REVIEW || 0)
      + (b.by_classification.BLOCKED || 0);
    let primarySum = 0;
    for (const code of Object.keys(b.by_primary_reason_code)) {
      primarySum += b.by_primary_reason_code[code];
    }
    if (classSum !== b.source_total) {
      errs.push(`${entityType}: classification sum ${classSum} != source_total ${b.source_total}`);
    }
    if (primarySum !== b.source_total) {
      errs.push(`${entityType}: primary reason sum ${primarySum} != source_total ${b.source_total}`);
    }
    if (!b.reconciled) {
      errs.push(`${entityType}: reconciled=false`);
    }
  }
  const o = summary.overall;
  if (o.classified_total !== o.source_total) {
    errs.push(`overall: classified_total ${o.classified_total} != source_total ${o.source_total}`);
  }
  if (o.primary_reason_total !== o.source_total) {
    errs.push(`overall: primary_reason_total ${o.primary_reason_total} != source_total ${o.source_total}`);
  }
  if (!o.reconciled) {
    errs.push(`overall: reconciled=false`);
  }
  if (errs.length > 0) {
    throw new Error('reconciliation failed:\n  - ' + errs.join('\n  - '));
    }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const required = ['input', 'private-output', 'public-output'];
  for (const k of required) {
    if (!args[k]) {
      console.error(`error: missing required argument --${k}`);
      process.exit(2);
    }
  }

  let inputData;
  try {
    inputData = readJson(args['input']);
  } catch (e) {
    console.error(`error: cannot read input ${args['input']}: ${e.message}`);
    process.exit(1);
  }

  const cases = inputData && inputData.cases;
  try {
    validateInput(cases);
  } catch (e) {
    console.error(`error: input validation failed: ${e.message}`);
    process.exit(1);
  }

  let classified;
  try {
    classified = classifyBatch(cases);
  } catch (e) {
    console.error(`error: classification failed: ${e.message}`);
    process.exit(1);
  }

  try {
    validateClassified(classified);
  } catch (e) {
    console.error(`error: classified output validation failed: ${e.message}`);
    process.exit(1);
  }

  let summary;
  try {
    summary = buildAccountingSummary(classified);
  } catch (e) {
    console.error(`error: buildAccountingSummary failed: ${e.message}`);
    process.exit(1);
  }

  try {
    verifyReconciliation(summary);
  } catch (e) {
    console.error(`error: ${e.message}`);
    process.exit(1);
  }

  // Private matrix: record-level classified output + source metadata.
  // Real record_ids are present here; this file MUST stay gitignored.
  const privateMatrix = {
    schema_version: 'classification-matrix-v1.0',
    classifier_version: 'classifier-v1.0',
    source_export: inputData.source_export || null,
    source_rule_version: inputData.source_rule_version || null,
    source_case_count: cases.length,
    classified_count: classified.length,
    records: classified,
  };

  try {
    writeJson(args['private-output'], privateMatrix);
  } catch (e) {
    console.error(`error: cannot write private output ${args['private-output']}: ${e.message}`);
    process.exit(1);
  }

  try {
    writeJson(args['public-output'], summary);
  } catch (e) {
    console.error(`error: cannot write public output ${args['public-output']}: ${e.message}`);
    process.exit(1);
  }

  // Console summary (no real record ids).
  console.log('classification-accounting: ok');
  console.log(`  input: ${args['input']}`);
  console.log(`  private matrix: ${args['private-output']}`);
  console.log(`  public summary: ${args['public-output']}`);
  console.log(`  source_total: ${summary.overall.source_total}`);
  console.log(`  classified_total: ${summary.overall.classified_total}`);
  console.log(`  primary_reason_total: ${summary.overall.primary_reason_total}`);
  console.log(`  reconciled: ${summary.overall.reconciled}`);
  for (const entityType of Object.keys(summary.entities)) {
    const b = summary.entities[entityType];
    console.log(
      `  ${entityType}: source=${b.source_total} `
      + `M=${b.by_classification.MIGRATABLE} `
      + `NR=${b.by_classification.NEEDS_REVIEW} `
      + `B=${b.by_classification.BLOCKED} `
      + `reconciled=${b.reconciled}`);
  }
}

main();
