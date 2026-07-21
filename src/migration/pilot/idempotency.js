'use strict';

// Pilot Vertical Slice - Idempotency key generator.
//
// Generates a deterministic idempotency key for Pilot Base write operations
// to prevent duplicate records when the same input is written twice.
//
// Per MIGRATION-VERTICAL-SLICE-ACCELERATION-01-R1 Required Correction 03:
//   Stable source identifier composition:
//     legacy_source + legacy_record_id + target_entity_type + rule_version
//
// The key is a SHA-256 hash of the composed input. The plaintext composition
// is also returned so callers can store it alongside the record for audit.
//
// Public surface:
//   buildIdempotencyKey(input) -> { key, composition, algorithm }
//   IDEMPOTENCY_KEY_ALGORITHM
//   PILOT_RULE_VERSION
//
// Pure function. No I/O. No PII in the key itself (the key is a hash; the
// composition may contain legacy_record_id which is a stable alias - callers
// must ensure they do not log raw PII into composition).

const crypto = require('crypto');

const IDEMPOTENCY_KEY_ALGORITHM = 'sha256';
const PILOT_RULE_VERSION = 'pilot-vertical-slice-v1.0';

const ALLOWED_ENTITY_TYPES = Object.freeze([
  'customer',
  'project',
  'model',
  'makeup',
]);

const ALLOWED_LEGACY_SOURCES = Object.freeze([
  'v1-clients',
  'v1-projects',
  'v1-model',
  'v1-makeup',
]);

function str(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function nonEmpty(v) {
  return str(v).length > 0;
}

/**
 * Build a deterministic idempotency key for a Pilot Base write.
 *
 * @param {{legacy_source: string, legacy_record_id: string, target_entity_type: string, rule_version?: string}} input
 * @returns {{key: string, composition: string, algorithm: string, rule_version: string}}
 * @throws {Error} if any required field is empty or disallowed
 */
function buildIdempotencyKey(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('buildIdempotencyKey: input must be a non-null object');
  }
  const legacySource = str(input.legacy_source);
  const legacyRecordId = str(input.legacy_record_id);
  const targetEntityType = str(input.target_entity_type);
  const ruleVersion = str(input.rule_version) || PILOT_RULE_VERSION;

  if (!nonEmpty(legacySource)) {
    throw new Error('buildIdempotencyKey: legacy_source is required');
  }
  if (!nonEmpty(legacyRecordId)) {
    throw new Error('buildIdempotencyKey: legacy_record_id is required');
  }
  if (!nonEmpty(targetEntityType)) {
    throw new Error('buildIdempotencyKey: target_entity_type is required');
  }
  if (!ALLOWED_ENTITY_TYPES.includes(targetEntityType)) {
    throw new Error(
      `buildIdempotencyKey: target_entity_type "${targetEntityType}" is not allowed (allowed: ${ALLOWED_ENTITY_TYPES.join(', ')})`,
    );
  }
  if (!ALLOWED_LEGACY_SOURCES.includes(legacySource)) {
    throw new Error(
      `buildIdempotencyKey: legacy_source "${legacySource}" is not allowed (allowed: ${ALLOWED_LEGACY_SOURCES.join(', ')})`,
    );
  }

  const composition = `${legacySource}|${legacyRecordId}|${targetEntityType}|${ruleVersion}`;
  const key = crypto
    .createHash(IDEMPOTENCY_KEY_ALGORITHM)
    .update(composition, 'utf8')
    .digest('hex');

  return {
    key,
    composition,
    algorithm: IDEMPOTENCY_KEY_ALGORITHM,
    rule_version: ruleVersion,
  };
}

module.exports = {
  buildIdempotencyKey,
  IDEMPOTENCY_KEY_ALGORITHM,
  PILOT_RULE_VERSION,
  ALLOWED_ENTITY_TYPES,
  ALLOWED_LEGACY_SOURCES,
};
