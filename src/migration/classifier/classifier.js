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
  // Added per P0-3 fix (TASK-002-R4-FIX-PACKET.md).
  // These are valid V2 project_status values per docs/v2-field-dictionary.md
  // and were previously missing from this set, causing them to be
  // incorrectly classified as STATUS_NEEDS_REVIEW.
  '已交付', '已归档',
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

const PROJECT_TYPE_ENUM = new Set(['客片', '样片', '品牌', '其他']);

// V1 → V2 project-type normalization (PROJECT-TYPE-SOURCE-OF-TRUTH-CORRECTION-01).
// V1 uses "创作" for sample / creative shoots; V2 uses "样片". The
// classifier treats both as the same logical type for enum membership
// and association checks, but never silently infers type when source
// value is empty (that case is PROJECT_TYPE_REQUIRED, not normalization).
const PROJECT_TYPE_NORMALIZATION = new Map([
  ['创作', '样片'],
]);

/**
 * Normalize a V1 project_type_raw string to its V2 canonical form.
 * Returns '' for empty input. Unknown values pass through unchanged
 * (PROJECT_TYPE_UNMAPPED handles them downstream).
 * @param {string|null|undefined} v1Type
 * @returns {string}
 */
function normalizeProjectType(v1Type) {
  const trimmed = str(v1Type);
  if (trimmed === '') return '';
  if (PROJECT_TYPE_NORMALIZATION.has(trimmed)) {
    return PROJECT_TYPE_NORMALIZATION.get(trimmed);
  }
  return trimmed;
}

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
 * Project status requires review per D-020:
 *   - empty status
 *   - 已完成 without delivery or archive evidence
 *   - any status not in the direct map and not an alias
 *
 * This is the canonical "project status is unclear / cannot be mapped"
 * predicate. Customer-status inference (D-020) MUST reuse this function
 * instead of a narrower subset, so that any linked project whose status
 * cannot be determined (not just "已完成 without evidence") propagates
 * NEEDS_REVIEW to the inferred customer status.
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
 * Customer status requires review per D-020:
 *   - empty status
 *   - inference status (已拍摄/拍摄完成) with no usable linked project info
 *     — "usable" means the linked project's status can be mapped
 *     (i.e. projectStatusNeedsReview returns false). Any linked project
 *     whose status cannot be determined causes the customer to need review.
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
      // Reuse the full project-status clarity check so that ANY
      // unclear project status propagates NEEDS_REVIEW to the customer.
      // Previously only the "已完成 without evidence" case was checked,
      // which let customers with status=已拍摄 linked to projects whose
      // status_raw was a non-V2 value (e.g. "无法判断") be classified
      // as ELIGIBLE / MIGRATABLE.
      if (projectStatusNeedsReview(project)) return true;
    }
    return false;
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
 * no phone, no wechat, no source channel, no valid need summary.
 *
 * Per D-023, a customer with a name or 称呼 can be migrated if at least one
 * of the following is present:
 *   - 联系方式 (phone)
 *   - 来源 (source_channel_raw)
 *   - 有效需求摘要 (has_valid_need_summary)
 *
 * The `has_valid_need_summary` field is a deterministic boolean produced by
 * the private normalizer from approved V1 field mappings. The classifier
 * never inspects raw text or arbitrary 备注; it only consumes the boolean.
 *
 * Independent of MISSING_NAME: a record may be missing both a name and an
 * identity. In that case both reason codes are produced so that the
 * reviewer can see each defect.
 */
function customerMissingIdentity(record) {
  const f = record.fields || {};
  const hasIdentity = nonEmpty(f.phone)
    || nonEmpty(f.wechat_id)
    || nonEmpty(f.source_channel_raw)
    || f.has_valid_need_summary === true;
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
 * Project is an orphan per D-023 and PROJECT-TYPE-SOURCE-OF-TRUTH-CORRECTION-01.
 *
 * Business rule (authoritative source: 项目统计表):
 *   - 客片 project: must link to a Customer (linked_customer_key required).
 *     Missing Customer → ORPHAN_PROJECT.
 *   - 样片 project (V1 "创作" normalized to "样片"): must link to a Model
 *     (linked_model_key required). Missing Customer is NOT an orphan
 *     condition — Customer is optional for 样片.
 *   - Empty project_type_raw: never flag as orphan. PROJECT_TYPE_REQUIRED
 *     handles the missing-type case separately.
 *   - Other types (品牌/其他/unmapped): default to Customer-link check
 *     (preserves existing behavior for non-sample types).
 *
 * In single-record mode (no context), a present hint (for 客片) or present
 * model key (for 样片) is assumed to match.
 */
function isOrphanProject(record, context) {
  const f = record.fields || {};
  const rawType = str(f.project_type_raw);
  if (rawType === '') return false; // let PROJECT_TYPE_REQUIRED handle it
  const normalizedType = normalizeProjectType(rawType);

  if (normalizedType === '样片') {
    // 样片 must link to a Model. Customer is optional.
    const modelKey = str(f.linked_model_key);
    if (modelKey !== '') {
      if (context && context.recordsByKey) {
        const model = context.recordsByKey.get(modelKey);
        if (!model) return true; // referenced model missing from batch
      }
      return false; // assume resolvable
    }
    // No model key at all — even if linked_customer_key is present, a 样片
    // without linked_model_key is orphan (model link is the required one).
    return true;
  }

  // Default branch: 客片 / 品牌 / 其他 / unmapped-non-empty.
  // Check linked_customer_key (existing behavior).
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
 * Linked entity type mismatch (PROJECT-TYPE-SOURCE-OF-TRUTH-CORRECTION-01).
 *
 * Detects when a project's linked_*_key field points to a record of the
 * wrong entity_type:
 *   - 样片 project with linked_customer_key pointing to a Model record
 *     (Model key written into Customer field)
 *   - 样片 project with linked_model_key pointing to a Customer record
 *     (Customer key written into Model field)
 *   - 客片 project with linked_model_key pointing to a Customer record
 *   - 客片 project with linked_customer_key pointing to a Model record
 *
 * Only detectable in batch mode (requires context.recordsByKey to look up
 * the linked record's entity_type). Single-record mode returns false.
 */
function isLinkedEntityTypeMismatch(record, context) {
  if (!context || !context.recordsByKey) return false;
  const f = record.fields || {};
  const rawType = str(f.project_type_raw);
  if (rawType === '') return false;
  const normalizedType = normalizeProjectType(rawType);

  const customerKey = str(f.linked_customer_key);
  const modelKey = str(f.linked_model_key);

  if (normalizedType === '样片') {
    // 样片 should link to Model, not Customer.
    // Flag if linked_customer_key points to a Model record (Model key
    // written into Customer field) OR linked_model_key points to a
    // Customer record (Customer key written into Model field).
    if (customerKey !== '') {
      const linked = context.recordsByKey.get(customerKey);
      if (linked && linked.entity_type === 'model') return true;
    }
    if (modelKey !== '') {
      const linked = context.recordsByKey.get(modelKey);
      if (linked && linked.entity_type === 'customer') return true;
    }
  } else if (normalizedType === '客片') {
    // 客片 should link to Customer, not Model.
    if (modelKey !== '') {
      const linked = context.recordsByKey.get(modelKey);
      if (linked && linked.entity_type === 'customer') return true;
    }
    if (customerKey !== '') {
      const linked = context.recordsByKey.get(customerKey);
      if (linked && linked.entity_type === 'model') return true;
    }
  }

  return false;
}

/**
 * Project source match required (PROJECT-TYPE-SOURCE-OF-TRUTH-CORRECTION-01-R1).
 *
 * Detects when a project record cannot be matched to the authoritative
 * source (项目统计表). Such records cannot be assigned an authoritative
 * project_type and must NOT be classified as ORPHAN_PROJECT (which assumes
 * a known type). They enter NEEDS_REVIEW pending user confirmation.
 *
 * The match status is provided by the caller (normalizer / pre-classifier
 * match step) via `record.fields.authoritative_match_status`. Valid values:
 *   - 'MATCHED'         — record matched to a row in 项目统计表
 *   - 'MATCH_NOT_FOUND' — record could not be matched
 *   - undefined / null — match not attempted (legacy / single-record mode);
 *                         do not trigger this reason code (backward compat)
 *
 * Per user decision (PROJECT-TYPE-SOURCE-OF-TRUTH-CORRECTION-01-R1):
 *   - MATCH_NOT_FOUND records do NOT enter the MIGRATABLE project count
 *     for D-026 statistics (handled in d026-evaluator.js).
 *   - MATCH_NOT_FOUND records do NOT enter the per-type association
 *     completeness denominator.
 *   - They are never classified as ORPHAN_PROJECT.
 */
function isProjectSourceMatchRequired(record) {
  const status = (record.fields || {}).authoritative_match_status;
  return status === 'MATCH_NOT_FOUND';
}

/**
 * Linked relation unresolved (PROJECT-TYPE-SOURCE-OF-TRUTH-CORRECTION-01-R1).
 *
 * Detects when a V1 link field references a record_id that cannot be
 * resolved in the batch (the referenced record is missing). The relation
 * cannot be verified, so the record is BLOCKED with a specific reason.
 *
 * Distinct from:
 *   - ORPHAN_PROJECT: no link key is present at all
 *   - LINKED_ENTITY_TYPE_MISMATCH: target exists but has wrong entity_type
 *
 * Only detectable in batch mode (requires context.recordsByKey to look up
 * the target record). Single-record mode returns false because the
 * referenced record may exist outside the batch.
 *
 * Checks both linked_customer_key and linked_model_key when non-empty.
 * Does NOT trigger when both are empty (that case is ORPHAN_PROJECT).
 */
function isLinkedRelationUnresolved(record, context) {
  if (!context || !context.recordsByKey) return false;
  const f = record.fields || {};
  const customerKey = str(f.linked_customer_key);
  const modelKey = str(f.linked_model_key);

  // If no link keys present at all, ORPHAN_PROJECT handles it (not this code).
  if (customerKey === '' && modelKey === '') return false;

  // For each present link key, check if the target exists in the batch.
  // If any present key points to a missing record, the relation is unresolved.
  if (customerKey !== '') {
    if (!context.recordsByKey.has(customerKey)) return true;
  }
  if (modelKey !== '') {
    if (!context.recordsByKey.has(modelKey)) return true;
  }
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
 * Normalizes V1 "创作" to V2 "样片" before enum membership check
 * (PROJECT-TYPE-SOURCE-OF-TRUTH-CORRECTION-01 AC-03).
 */
function isProjectTypeUnmapped(record) {
  const type = str((record.fields || {}).project_type_raw);
  if (type === '') return false; // empty handled by isProjectTypeRequired
  const normalized = normalizeProjectType(type);
  return !PROJECT_TYPE_ENUM.has(normalized);
}

/**
 * Project type is empty (PROJECT-TYPE-SOURCE-OF-TRUTH-CORRECTION-01 AC-06).
 * The classifier must NOT infer the type or auto-pick a link target.
 * Triggers PROJECT_TYPE_REQUIRED reason code (NEEDS_REVIEW).
 */
function isProjectTypeRequired(record) {
  const type = str((record.fields || {}).project_type_raw);
  return type === '';
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

  // P25: LINKED_ENTITY_TYPE_MISMATCH (project only, batch only)
  // Detects Model key written into Customer field, or vice versa.
  if (record.entity_type === 'project'
    && isLinkedEntityTypeMismatch(record, context || null)) {
    reasons.push('LINKED_ENTITY_TYPE_MISMATCH');
  }

  // P27: PROJECT_SOURCE_MATCH_REQUIRED (project only)
  // (PROJECT-TYPE-SOURCE-OF-TRUTH-CORRECTION-01-R1)
  // Project cannot be matched to authoritative source (项目统计表).
  // Such records enter NEEDS_REVIEW and must NOT be classified as
  // ORPHAN_PROJECT (which assumes the type is known).
  if (record.entity_type === 'project' && isProjectSourceMatchRequired(record)) {
    reasons.push('PROJECT_SOURCE_MATCH_REQUIRED');
  }

  // P28: LINKED_RELATION_UNRESOLVED (project only, batch only)
  // (PROJECT-TYPE-SOURCE-OF-TRUTH-CORRECTION-01-R1)
  // A V1 link field references a record_id that cannot be resolved in
  // the batch. Distinct from ORPHAN_PROJECT (no link key present at all)
  // and LINKED_ENTITY_TYPE_MISMATCH (target exists but wrong type).
  if (record.entity_type === 'project'
    && isLinkedRelationUnresolved(record, context || null)) {
    reasons.push('LINKED_RELATION_UNRESOLVED');
  }

  // P30: ORPHAN_PROJECT (project only)
  // Skip ORPHAN_PROJECT if PROJECT_SOURCE_MATCH_REQUIRED already triggered
  // (MATCH_NOT_FOUND records cannot be assigned a type, so orphan check
  // is meaningless — it would falsely assume a type and flag missing link).
  // Also skip if LINKED_RELATION_UNRESOLVED already triggered — that reason
  // means a link key IS present but points to a record missing from the
  // batch, which is semantically distinct from ORPHAN_PROJECT (no link key
  // present at all). Triggering both would double-count the same defect.
  if (record.entity_type === 'project'
    && !reasons.includes('PROJECT_SOURCE_MATCH_REQUIRED')
    && !reasons.includes('LINKED_RELATION_UNRESOLVED')
    && isOrphanProject(record, context || null)) {
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

  // P90: PROJECT_TYPE_UNMAPPED (project only, non-empty type not in V2 enum)
  if (record.entity_type === 'project' && isProjectTypeUnmapped(record)) {
    reasons.push('PROJECT_TYPE_UNMAPPED');
  }

  // P95: PROJECT_TYPE_REQUIRED (project only, empty type — never infer)
  // (PROJECT-TYPE-SOURCE-OF-TRUTH-CORRECTION-01 AC-06)
  if (record.entity_type === 'project' && isProjectTypeRequired(record)) {
    reasons.push('PROJECT_TYPE_REQUIRED');
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
  _normalizeProjectType: normalizeProjectType,
  _isProjectSourceMatchRequired: isProjectSourceMatchRequired,
  _isLinkedRelationUnresolved: isLinkedRelationUnresolved,
  _isLinkedEntityTypeMismatch: isLinkedEntityTypeMismatch,
  _isOrphanProject: isOrphanProject,
  _CUSTOMER_STATUS_DIRECT_MAP: CUSTOMER_STATUS_DIRECT_MAP,
  _PROJECT_STATUS_DIRECT_MAP: PROJECT_STATUS_DIRECT_MAP,
  _SOURCE_CHANNEL_ENUM: SOURCE_CHANNEL_ENUM,
  _PROJECT_TYPE_ENUM: PROJECT_TYPE_ENUM,
  _PROJECT_TYPE_NORMALIZATION: PROJECT_TYPE_NORMALIZATION,
  _COOPERATION_STATUS_ENUM: COOPERATION_STATUS_ENUM,
};
