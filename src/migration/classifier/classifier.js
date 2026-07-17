'use strict';

// Migration record classifier. Pure functions, no I/O, no time, no random.
//
// Implements the stable classification rules derived from
// DECISION_LOG D-020 (status mapping), D-021 (source channel),
// D-022 (duplicate candidates), D-023 (orphan records),
// D-024 (schema v1.1) and D-025 (budget parsing).
//
// Public surface (see TASK-002.md "Public interfaces"):
//   classifyRecord(record, context?) -> classifiedRecord
//   classifyBatch(records)          -> Array<classifiedRecord>
//
// Output shape:
//   { record_key, entity_type, classification,
//     primary_reason_code, secondary_reason_codes }

const {
  REASON_CODES,
  selectPrimaryAndSecondary,
} = require('./reason-codes');
const { parseBudget } = require('./budget');

// ---------------------------------------------------------------------------
// V2 enum sets (source: docs/v2-field-dictionary.md v1.1).
// Membership tests use exact match after trim.
// ---------------------------------------------------------------------------

const CUSTOMER_STATUS_DIRECT_MAP = new Set([
  '新线索', '跟进中', '已确认需求', '待定金', '已成交',
  '服务中', '已完成', '复购/转介绍', '已流失',
]);

// Customer legacy statuses that require inference from linked projects (D-020).
const CUSTOMER_STATUS_INFERENCE = new Set(['已拍摄', '拍摄完成']);

const PROJECT_STATUS_DIRECT_MAP = new Set([
  '草稿', '策划中', '策划已批准', '资源确认中', '待拍摄',
  '拍摄完成', '后期制作', '客户确认',
]);

// 待立项 -> 草稿 (per D-020).
const PROJECT_STATUS_ALIAS = new Map([['待立项', '草稿']]);

const COOPERATION_STATUS_ENUM = new Set([
  '未联系', '沟通中', '已合作', '暂停', '黑名单',
]);

const SOURCE_CHANNEL_ENUM = new Set([
  '小红书', '抖音', '视频号', '朋友圈', '微信公众号',
  '微信私聊', '官网', '小程序', '转介绍', '线下活动',
  '其他', '未知',
]);

const PROJECT_TYPE_ENUM = new Set(['客片', '创作', '品牌', '其他']);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * @param {string|null|undefined} v
 * @returns {string} trimmed string, empty if null/undefined
 */
function str(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

/**
 * @param {string|null|undefined} v
 * @returns {boolean} true if non-empty after trim
 */
function nonEmpty(v) {
  return str(v).length > 0;
}

/**
 * Project status is "unclear" when legacy status is 已完成 but no delivery
 * or archive evidence is present (D-020).
 */
function isProjectStatusUnclear(fields) {
  const status = str(fields && fields.status_raw);
  if (status !== '已完成') return false;
  return !(fields && (fields.has_delivery_evidence || fields.has_archive_evidence));
}

/**
 * Customer status requires review per D-020:
 *   - empty status
 *   - inference status (已拍摄/拍摄完成) with no usable linked project info
 *   - any status not in the direct map and not an inference status
 */
function customerStatusNeedsReview(record, context) {
  const fields = record.fields || {};
  const status = str(fields.status_raw);
  if (status === '') return true;
  if (CUSTOMER_STATUS_DIRECT_MAP.has(status)) return false;
  if (CUSTOMER_STATUS_INFERENCE.has(status)) {
    const linkedKeys = Array.isArray(fields.linked_project_keys) ? fields.linked_project_keys : [];
    if (linkedKeys.length === 0) return true;
    if (!context || !context.recordsByKey) return true;
    for (const key of linkedKeys) {
      const project = context.recordsByKey.get(key);
      if (!project) return true;
      if (isProjectStatusUnclear(project.fields || {})) return true;
    }
    return false;
  }
  return true;
}

/**
 * Project status requires review per D-020:
 *   - empty status
 *   - 已完成 without delivery or archive evidence
 *   - any status not in the direct map and not an alias
 */
function projectStatusNeedsReview(record) {
  const fields = record.fields || {};
  const status = str(fields.status_raw);
  if (status === '') return true;
  if (PROJECT_STATUS_DIRECT_MAP.has(status)) return false;
  if (PROJECT_STATUS_ALIAS.has(status)) return false;
  if (status === '已完成') {
    return !(fields.has_delivery_evidence || fields.has_archive_evidence);
  }
  return true;
}

/**
 * Resource cooperation status requires review when not in the V2 enum.
 */
function resourceStatusNeedsReview(record) {
  const status = str((record.fields || {}).status_raw);
  if (status === '') return true;
  return !COOPERATION_STATUS_ENUM.has(status);
}

/**
 * Customer has no identifying information (D-023):
 * no phone, no wechat, no source channel.
 *
 * Independent of MISSING_NAME: a record may be missing both a name and an
 * identity. In that case both reason codes are produced so that the
 * reviewer can see each defect.
 */
function customerMissingIdentity(record) {
  const f = record.fields || {};
  const hasIdentity = nonEmpty(f.phone) || nonEmpty(f.wechat_id) || nonEmpty(f.source_channel_raw);
  return !hasIdentity;
}

/**
 * Resource (Model/Makeup) has no identifying information:
 * no phone, no wechat, no portfolio, no xiaohongshu account.
 *
 * Independent of MISSING_NAME (see customerMissingIdentity).
 */
function resourceMissingIdentity(record) {
  const f = record.fields || {};
  const hasIdentity = nonEmpty(f.phone) || nonEmpty(f.wechat_id)
    || nonEmpty(f.portfolio_url) || nonEmpty(f.xiaohongshu_account);
  return !hasIdentity;
}

/**
 * Project is an orphan per D-023:
 *   - no linked_customer_key, and either no hint or hint does not match any
 *     customer name in the batch
 *   - or linked_customer_key points to a customer that is not in the batch
 *
 * In single-record mode (no context), a present hint is assumed to match.
 */
function isOrphanProject(record, context) {
  const f = record.fields || {};
  const key = str(f.linked_customer_key);
  const hint = str(f.linked_customer_name_hint);

  if (key !== '') {
    // Has a customer key. In batch mode, verify the customer exists.
    if (context && context.recordsByKey) {
      const customer = context.recordsByKey.get(key);
      if (!customer) return true; // referenced customer missing from batch
    }
    return false; // assume resolvable
  }

  // No customer key. Check hint.
  if (hint === '') return true; // no key, no hint -> orphan
  if (context && context.customerNames) {
    return !context.customerNames.has(hint);
  }
  // Single-record mode: assume hint is resolvable.
  return false;
}

/**
 * Project's linked customer is itself unresolved (NEEDS_REVIEW or BLOCKED).
 * Only detectable in batch mode.
 */
function isCustomerUnresolved(record, context) {
  if (!context || !context.classifiedByKey) return false;
  const f = record.fields || {};
  const key = str(f.linked_customer_key);
  if (key === '') return false;
  const customerClassification = context.classifiedByKey.get(key);
  if (!customerClassification) return false;
  return customerClassification.classification === 'NEEDS_REVIEW'
    || customerClassification.classification === 'BLOCKED';
}

/**
 * Record has at least one duplicate candidate with decision UNRESOLVED (D-022).
 */
function hasUnresolvedDuplicate(record) {
  const candidates = (record.fields || {}).duplicate_candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return false;
  return candidates.some((c) => c && c.decision === 'UNRESOLVED');
}

/**
 * Source channel is non-empty but not in the V2 enum (D-021).
 */
function isSourceUnmapped(record) {
  const source = str((record.fields || {}).source_channel_raw);
  if (source === '') return false;
  return !SOURCE_CHANNEL_ENUM.has(source);
}

/**
 * Budget parse status is ambiguous (D-025).
 */
function isBudgetAmbiguous(record) {
  const raw = (record.fields || {}).budget_range_raw;
  if (str(raw) === '') return false;
  const parsed = parseBudget(raw);
  return parsed.budget_parse_status === 'ambiguous';
}

/**
 * Project type is non-empty but not in the V2 enum (D-024).
 */
function isProjectTypeUnmapped(record) {
  const type = str((record.fields || {}).project_type_raw);
  if (type === '') return false;
  return !PROJECT_TYPE_ENUM.has(type);
}

// ---------------------------------------------------------------------------
// Core classification
// ---------------------------------------------------------------------------

/**
 * Collect all applicable reason codes for a single record.
 * @param {Object} record
 * @param {{recordsByKey?: Map, customerNames?: Set, classifiedByKey?: Map}|null} context
 * @returns {string[]}
 */
function collectReasons(record, context) {
  const reasons = [];
  const f = record.fields || {};

  // P10: MISSING_NAME
  if (str(f.name) === '') reasons.push('MISSING_NAME');

  // P20: MISSING_IDENTITY (customer or resource only)
  if (record.entity_type === 'customer' && customerMissingIdentity(record)) {
    reasons.push('MISSING_IDENTITY');
  } else if ((record.entity_type === 'model' || record.entity_type === 'makeup')
    && resourceMissingIdentity(record)) {
    reasons.push('MISSING_IDENTITY');
  }

  // P30: ORPHAN_PROJECT (project only)
  if (record.entity_type === 'project' && isOrphanProject(record, context || null)) {
    reasons.push('ORPHAN_PROJECT');
  }

  // P40: CUSTOMER_UNRESOLVED (project only, batch only)
  if (record.entity_type === 'project' && isCustomerUnresolved(record, context || null)) {
    reasons.push('CUSTOMER_UNRESOLVED');
  }

  // P50: DUPLICATE_UNRESOLVED
  if (hasUnresolvedDuplicate(record)) reasons.push('DUPLICATE_UNRESOLVED');

  // P60: STATUS_NEEDS_REVIEW
  let statusNeedsReview = false;
  if (record.entity_type === 'customer') {
    statusNeedsReview = customerStatusNeedsReview(record, context || null);
  } else if (record.entity_type === 'project') {
    statusNeedsReview = projectStatusNeedsReview(record);
  } else if (record.entity_type === 'model' || record.entity_type === 'makeup') {
    statusNeedsReview = resourceStatusNeedsReview(record);
  }
  if (statusNeedsReview) reasons.push('STATUS_NEEDS_REVIEW');

  // P70: SOURCE_UNMAPPED (customer only)
  if (record.entity_type === 'customer' && isSourceUnmapped(record)) {
    reasons.push('SOURCE_UNMAPPED');
  }

  // P80: BUDGET_AMBIGUOUS (customer only)
  if (record.entity_type === 'customer' && isBudgetAmbiguous(record)) {
    reasons.push('BUDGET_AMBIGUOUS');
  }

  // P90: PROJECT_TYPE_UNMAPPED (project only)
  if (record.entity_type === 'project' && isProjectTypeUnmapped(record)) {
    reasons.push('PROJECT_TYPE_UNMAPPED');
  }

  // P100: ELIGIBLE (if no other reasons)
  if (reasons.length === 0) reasons.push('ELIGIBLE');

  return reasons;
}

/**
 * Classify a single record. Without batch context, CUSTOMER_UNRESOLVED is
 * never produced and ORPHAN_PROJECT hint verification is skipped.
 *
 * @param {Object} record
 * @param {{recordsByKey?: Map, customerNames?: Set, classifiedByKey?: Map}|null} [context]
 * @returns {{record_key: string, entity_type: string, classification: string, primary_reason_code: string, secondary_reason_codes: string[]}}
 */
function classifyRecord(record, context) {
  const reasons = collectReasons(record, context || null);
  const { primary, secondary } = selectPrimaryAndSecondary(reasons);
  return {
    record_key: record.record_key,
    entity_type: record.entity_type,
    classification: REASON_CODES[primary].classification,
    primary_reason_code: primary,
    secondary_reason_codes: secondary,
  };
}

/**
 * Classify a batch of records. Performs a two-pass evaluation so that
 * CUSTOMER_UNRESOLVED can be added to projects whose linked customer is
 * classified as NEEDS_REVIEW or BLOCKED.
 *
 * Deterministic: the output is independent of input array order.
 *
 * @param {Object[]} records
 * @returns {Array<{record_key: string, entity_type: string, classification: string, primary_reason_code: string, secondary_reason_codes: string[]}>}
 */
function classifyBatch(records) {
  const recordsByKey = new Map();
  const customerNames = new Set();
  for (const r of records) {
    recordsByKey.set(r.record_key, r);
    if (r.entity_type === 'customer') {
      const name = str((r.fields || {}).name);
      if (name !== '') customerNames.add(name);
    }
  }

  // First pass: no classifiedByKey yet, so CUSTOMER_UNRESOLVED is never added.
  const firstPassContext = { recordsByKey, customerNames };
  const firstPass = records.map((r) => classifyRecord(r, firstPassContext));

  // Build classifiedByKey for second pass.
  const classifiedByKey = new Map();
  for (const c of firstPass) classifiedByKey.set(c.record_key, c);

  // Second pass: with classifiedByKey, CUSTOMER_UNRESOLVED can be added.
  const secondPassContext = { recordsByKey, customerNames, classifiedByKey };
  return records.map((r) => classifyRecord(r, secondPassContext));
}

module.exports = {
  classifyRecord,
  classifyBatch,
  // Exported for testing / introspection. Not part of the stable public API.
  _collectReasons: collectReasons,
  _CUSTOMER_STATUS_DIRECT_MAP: CUSTOMER_STATUS_DIRECT_MAP,
  _PROJECT_STATUS_DIRECT_MAP: PROJECT_STATUS_DIRECT_MAP,
  _SOURCE_CHANNEL_ENUM: SOURCE_CHANNEL_ENUM,
  _PROJECT_TYPE_ENUM: PROJECT_TYPE_ENUM,
  _COOPERATION_STATUS_ENUM: COOPERATION_STATUS_ENUM,
};
