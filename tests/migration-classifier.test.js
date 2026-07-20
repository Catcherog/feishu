// Migration classifier test suite (R3 acceptance).
//
// Exercises the public classifier API against synthetic fixtures in
// tests/fixtures/migration/cases.json and the hand-written expected
// outputs in tests/fixtures/migration/expected.json.
//
// Run:  node --test tests/migration-classifier.test.js
//
// All fixtures are synthetic. No real Feishu record identifier, customer
// name, phone number or WeChat identifier is required to run this suite.

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const {
  classifyRecord,
  classifyBatch,
  parseBudget,
  buildAccountingSummary,
  REASON_CODES,
  REASON_PRIORITY_ORDER,
} = require('../src/migration/classifier');

const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'migration');
const CASES = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'cases.json'), 'utf8'));
const EXPECTED = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'expected.json'), 'utf8'));

const CASES_BY_KEY = new Map(CASES.cases.map((c) => [c.record_key, c]));
const EXPECTED_BY_KEY = new Map(EXPECTED.expected.map((e) => [e.record_key, e]));

function sha256OfBatchOutput(records) {
  const serialized = JSON.stringify(records);
  return crypto.createHash('sha256').update(serialized, 'utf8').digest('hex');
}

describe('classifier public surface', () => {
  it('exposes all required reason codes with stable priority order', () => {
    const expectedCodes = [
      'MISSING_NAME', 'MISSING_IDENTITY', 'LINKED_ENTITY_TYPE_MISMATCH',
      'PROJECT_SOURCE_MATCH_REQUIRED', 'LINKED_RELATION_UNRESOLVED',
      'ORPHAN_PROJECT',
      'CUSTOMER_UNRESOLVED', 'DUPLICATE_UNRESOLVED', 'STATUS_NEEDS_REVIEW',
      'SOURCE_UNMAPPED', 'BUDGET_AMBIGUOUS', 'PROJECT_TYPE_UNMAPPED',
      'PROJECT_TYPE_REQUIRED', 'ELIGIBLE',
    ];
    for (const code of expectedCodes) {
      assert.ok(REASON_CODES[code], `missing reason code: ${code}`);
    }
    const expectedOrder = expectedCodes;
    assert.deepEqual(
      REASON_PRIORITY_ORDER,
      expectedOrder,
      'REASON_PRIORITY_ORDER must follow the spec exactly',
    );
  });
});

describe('classifyBatch — full fixture correctness', () => {
  const batchOutput = classifyBatch(CASES.cases);

  it('classifies every fixture record', () => {
    assert.equal(batchOutput.length, CASES.cases.length, 'output length must match input length');
  });

  it('matches hand-written expected.json for every record', () => {
    const outputByKey = new Map(batchOutput.map((r) => [r.record_key, r]));
    for (const expected of EXPECTED.expected) {
      const actual = outputByKey.get(expected.record_key);
      assert.ok(actual, `no output for ${expected.record_key}`);
      assert.equal(actual.entity_type, expected.entity_type);
      assert.equal(actual.classification, expected.classification,
        `${expected.record_key} classification mismatch`);
      assert.equal(actual.primary_reason_code, expected.primary_reason_code,
        `${expected.record_key} primary_reason_code mismatch`);
      assert.deepEqual(actual.secondary_reason_codes, expected.secondary_reason_codes,
        `${expected.record_key} secondary_reason_codes mismatch`);
    }
  });
});

describe('acceptance criterion: every reason code has at least one independent case', () => {
  const batchOutput = classifyBatch(CASES.cases);

  for (const code of REASON_PRIORITY_ORDER) {
    it(`has at least one fixture with primary_reason_code = ${code}`, () => {
      const count = batchOutput.filter((r) => r.primary_reason_code === code).length;
      assert.ok(count >= 1, `reason code ${code} has no primary case in fixtures`);
    });
  }
});

describe('acceptance criterion: four entity types covered', () => {
  const batchOutput = classifyBatch(CASES.cases);

  for (const entityType of ['customer', 'project', 'model', 'makeup']) {
    it(`covers entity_type = ${entityType}`, () => {
      const count = batchOutput.filter((r) => r.entity_type === entityType).length;
      assert.ok(count >= 1, `entity_type ${entityType} not covered`);
    });
  }
});

describe('acceptance criterion: multi-reason conflicts, priority, sorting, dedup', () => {
  const batchOutput = classifyBatch(CASES.cases);
  const byKey = new Map(batchOutput.map((r) => [r.record_key, r]));

  it('CUSTOMER_ALIAS_002 produces MISSING_NAME primary with MISSING_IDENTITY + STATUS_NEEDS_REVIEW secondary', () => {
    const r = byKey.get('CUSTOMER_ALIAS_002');
    assert.equal(r.primary_reason_code, 'MISSING_NAME');
    assert.deepEqual(r.secondary_reason_codes, ['MISSING_IDENTITY', 'STATUS_NEEDS_REVIEW']);
  });

  it('PROJECT_ALIAS_006 produces CUSTOMER_UNRESOLVED primary with STATUS_NEEDS_REVIEW secondary', () => {
    const r = byKey.get('PROJECT_ALIAS_006');
    assert.equal(r.primary_reason_code, 'CUSTOMER_UNRESOLVED');
    assert.deepEqual(r.secondary_reason_codes, ['STATUS_NEEDS_REVIEW']);
  });

  it('PROJECT_ALIAS_008 produces ORPHAN_PROJECT primary with stable-priority secondary [STATUS_NEEDS_REVIEW, PROJECT_TYPE_UNMAPPED]', () => {
    const r = byKey.get('PROJECT_ALIAS_008');
    assert.equal(r.primary_reason_code, 'ORPHAN_PROJECT');
    assert.deepEqual(r.secondary_reason_codes, ['STATUS_NEEDS_REVIEW', 'PROJECT_TYPE_UNMAPPED']);
  });

  it('PROJECT_ALIAS_007 produces ORPHAN_PROJECT primary with PROJECT_TYPE_UNMAPPED secondary', () => {
    const r = byKey.get('PROJECT_ALIAS_007');
    assert.equal(r.primary_reason_code, 'ORPHAN_PROJECT');
    assert.deepEqual(r.secondary_reason_codes, ['PROJECT_TYPE_UNMAPPED']);
  });

  it('every record has exactly one primary_reason_code and no duplicate secondary codes', () => {
    for (const r of batchOutput) {
      assert.ok(r.primary_reason_code, `${r.record_key} missing primary_reason_code`);
      const uniqueSecondary = new Set(r.secondary_reason_codes);
      assert.equal(uniqueSecondary.size, r.secondary_reason_codes.length,
        `${r.record_key} has duplicate secondary codes`);
      assert.ok(!r.secondary_reason_codes.includes(r.primary_reason_code),
        `${r.record_key} primary code leaked into secondary`);
    }
  });

  it('secondary codes are always sorted by priority ascending', () => {
    for (const r of batchOutput) {
      const priorities = r.secondary_reason_codes.map((c) => REASON_CODES[c].priority);
      for (let i = 1; i < priorities.length; i += 1) {
        assert.ok(priorities[i - 1] < priorities[i],
          `${r.record_key} secondary codes not sorted by priority ascending`);
      }
    }
  });
});

describe('acceptance criterion: duplicate candidate decisions (SAME_ENTITY, DISTINCT_ENTITY, UNRESOLVED)', () => {
  const batchOutput = classifyBatch(CASES.cases);
  const byKey = new Map(batchOutput.map((r) => [r.record_key, r]));

  it('UNRESOLVED duplicate candidate yields DUPLICATE_UNRESOLVED (NEEDS_REVIEW, not BLOCKED)', () => {
    const r = byKey.get('CUSTOMER_ALIAS_004');
    assert.equal(r.classification, 'NEEDS_REVIEW');
    assert.equal(r.primary_reason_code, 'DUPLICATE_UNRESOLVED');
  });

  it('SAME_ENTITY duplicate candidate is not a blocker', () => {
    const r = byKey.get('CUSTOMER_ALIAS_006');
    assert.equal(r.classification, 'MIGRATABLE');
    assert.equal(r.primary_reason_code, 'ELIGIBLE');
  });

  it('DISTINCT_ENTITY duplicate candidate is not a blocker', () => {
    const r = byKey.get('CUSTOMER_ALIAS_014');
    assert.equal(r.classification, 'MIGRATABLE');
    assert.equal(r.primary_reason_code, 'ELIGIBLE');
  });
});

describe('acceptance criterion: budget parsing variants (D-025)', () => {
  it('empty budget -> unknown status, not a reason', () => {
    const r = parseBudget('');
    assert.equal(r.budget_parse_status, 'unknown');
    assert.equal(r.budget_min, null);
    assert.equal(r.budget_max, null);
  });

  it('面议 -> unknown status, not a reason', () => {
    const r = parseBudget('面议');
    assert.equal(r.budget_parse_status, 'unknown');
    assert.equal(r.budget_min, null);
    assert.equal(r.budget_max, null);
  });

  it('3000-5000 -> parsed, min=3000, max=5000', () => {
    const r = parseBudget('3000-5000');
    assert.equal(r.budget_parse_status, 'parsed');
    assert.equal(r.budget_min, 3000);
    assert.equal(r.budget_max, 5000);
  });

  it('3000以下 -> parsed, min=0, max=3000 (Chinese suffix form)', () => {
    const r = parseBudget('3000以下');
    assert.equal(r.budget_parse_status, 'parsed');
    assert.equal(r.budget_min, 0);
    assert.equal(r.budget_max, 3000);
  });

  it('5000以上 -> parsed, min=5000, max=null (Chinese suffix form)', () => {
    const r = parseBudget('5000以上');
    assert.equal(r.budget_parse_status, 'parsed');
    assert.equal(r.budget_min, 5000);
    assert.equal(r.budget_max, null);
  });

  it('5000+ -> parsed, min=5000, max=null (plus suffix form)', () => {
    const r = parseBudget('5000+');
    assert.equal(r.budget_parse_status, 'parsed');
    assert.equal(r.budget_min, 5000);
    assert.equal(r.budget_max, null);
  });

  // P0-1 regression: approved prefix-symbol bound forms. These were
  // previously rejected as ambiguous because the regex required the symbol
  // to appear AFTER the number.
  it('<3000 -> parsed, min=0, max=3000 (prefix-symbol form)', () => {
    const r = parseBudget('<3000');
    assert.equal(r.budget_parse_status, 'parsed');
    assert.equal(r.budget_min, 0);
    assert.equal(r.budget_max, 3000);
  });

  it('≤3000 -> parsed, min=0, max=3000 (prefix-symbol form)', () => {
    const r = parseBudget('≤3000');
    assert.equal(r.budget_parse_status, 'parsed');
    assert.equal(r.budget_min, 0);
    assert.equal(r.budget_max, 3000);
  });

  it('>5000 -> parsed, min=5000, max=null (prefix-symbol form)', () => {
    const r = parseBudget('>5000');
    assert.equal(r.budget_parse_status, 'parsed');
    assert.equal(r.budget_min, 5000);
    assert.equal(r.budget_max, null);
  });

  it('≥5000 -> parsed, min=5000, max=null (prefix-symbol form)', () => {
    const r = parseBudget('≥5000');
    assert.equal(r.budget_parse_status, 'parsed');
    assert.equal(r.budget_min, 5000);
    assert.equal(r.budget_max, null);
  });

  // P0-1 regression: disallowed reversed forms must NOT be parsed.
  // Previously they were accepted because the regex matched "number then
  // symbol". They must fall through to ambiguous.
  it('3000< (reversed) -> ambiguous, NOT parsed', () => {
    const r = parseBudget('3000<');
    assert.equal(r.budget_parse_status, 'ambiguous');
    assert.equal(r.budget_min, null);
    assert.equal(r.budget_max, null);
  });

  it('5000≥ (reversed) -> ambiguous, NOT parsed', () => {
    const r = parseBudget('5000≥');
    assert.equal(r.budget_parse_status, 'ambiguous');
    assert.equal(r.budget_min, null);
    assert.equal(r.budget_max, null);
  });

  it('3000≤ (reversed) -> ambiguous, NOT parsed', () => {
    const r = parseBudget('3000≤');
    assert.equal(r.budget_parse_status, 'ambiguous');
    assert.equal(r.budget_min, null);
    assert.equal(r.budget_max, null);
  });

  it('5000> (reversed) -> ambiguous, NOT parsed', () => {
    const r = parseBudget('5000>');
    assert.equal(r.budget_parse_status, 'ambiguous');
    assert.equal(r.budget_min, null);
    assert.equal(r.budget_max, null);
  });

  it('conflicting ranges "3000-5000 或 8000+" -> ambiguous', () => {
    const r = parseBudget('3000-5000 或 8000+');
    assert.equal(r.budget_parse_status, 'ambiguous');
    assert.equal(r.budget_min, null);
    assert.equal(r.budget_max, null);
  });

  it('always reports rule_version = budget-map-v1.0 and preserves raw text', () => {
    const r = parseBudget('3000-5000');
    assert.equal(r.budget_parse_rule_version, 'budget-map-v1.0');
    assert.equal(r.budget_range_raw, '3000-5000');
  });
});

describe('P0-2 regression: D-020 customer status inference propagates any unclear project status', () => {
  const batchOutput = classifyBatch(CASES.cases);
  const byKey = new Map(batchOutput.map((r) => [r.record_key, r]));

  it('CUSTOMER_ALIAS_020 (已拍摄 + linked project status "无法判断") -> STATUS_NEEDS_REVIEW', () => {
    // Previously this case was ELIGIBLE/MIGRATABLE because only the
    // "已完成 without evidence" branch of isProjectStatusUnclear was
    // consulted; any other non-V2 project status was silently accepted.
    const r = byKey.get('CUSTOMER_ALIAS_020');
    assert.equal(r.classification, 'NEEDS_REVIEW');
    assert.equal(r.primary_reason_code, 'STATUS_NEEDS_REVIEW');
  });

  it('PROJECT_ALIAS_014 (status "无法判断") -> STATUS_NEEDS_REVIEW itself', () => {
    const r = byKey.get('PROJECT_ALIAS_014');
    assert.equal(r.classification, 'NEEDS_REVIEW');
    assert.equal(r.primary_reason_code, 'STATUS_NEEDS_REVIEW');
  });

  it('CUSTOMER_ALIAS_009 (已拍摄 + linked project 已完成 without evidence) still STATUS_NEEDS_REVIEW', () => {
    // Existing case must continue to pass after the refactor.
    const r = byKey.get('CUSTOMER_ALIAS_009');
    assert.equal(r.classification, 'NEEDS_REVIEW');
    assert.equal(r.primary_reason_code, 'STATUS_NEEDS_REVIEW');
  });
});

describe('P0-3 regression: valid V2 project statuses 已交付 / 已归档 are not STATUS_NEEDS_REVIEW', () => {
  const batchOutput = classifyBatch(CASES.cases);
  const byKey = new Map(batchOutput.map((r) => [r.record_key, r]));

  it('PROJECT_ALIAS_012 (已交付) -> MIGRATABLE / ELIGIBLE', () => {
    // Previously 已交付 was missing from PROJECT_STATUS_DIRECT_MAP and
    // was incorrectly classified as STATUS_NEEDS_REVIEW.
    const r = byKey.get('PROJECT_ALIAS_012');
    assert.equal(r.classification, 'MIGRATABLE');
    assert.equal(r.primary_reason_code, 'ELIGIBLE');
  });

  it('PROJECT_ALIAS_013 (已归档) -> MIGRATABLE / ELIGIBLE', () => {
    const r = byKey.get('PROJECT_ALIAS_013');
    assert.equal(r.classification, 'MIGRATABLE');
    assert.equal(r.primary_reason_code, 'ELIGIBLE');
  });
});

describe('P0-4 regression: D-023 valid need summary counts as customer identity', () => {
  const batchOutput = classifyBatch(CASES.cases);
  const byKey = new Map(batchOutput.map((r) => [r.record_key, r]));

  it('CUSTOMER_ALIAS_019 (name + has_valid_need_summary=true, no phone/wechat/source) -> MIGRATABLE / ELIGIBLE', () => {
    // Previously this customer would have been BLOCKED with MISSING_IDENTITY
    // because the only identity signals were phone/wechat/source.
    const r = byKey.get('CUSTOMER_ALIAS_019');
    assert.equal(r.classification, 'MIGRATABLE');
    assert.equal(r.primary_reason_code, 'ELIGIBLE');
    assert.equal(r.secondary_reason_codes.includes('MISSING_IDENTITY'), false,
      'has_valid_need_summary=true must suppress MISSING_IDENTITY');
  });

  it('a customer with no identity and has_valid_need_summary=false still hits MISSING_IDENTITY', () => {
    // CUSTOMER_ALIAS_003 has name but no phone/wechat/source and no
    // has_valid_need_summary. It must still be BLOCKED with MISSING_IDENTITY.
    const r = byKey.get('CUSTOMER_ALIAS_003');
    assert.equal(r.classification, 'BLOCKED');
    assert.equal(r.primary_reason_code, 'MISSING_IDENTITY');
  });
});

describe('acceptance criterion: classifyRecord (single-record, no inter-record context)', () => {
  it('classifies a clean customer as ELIGIBLE without batch context', () => {
    const r = classifyRecord(CASES_BY_KEY.get('CUSTOMER_ALIAS_001'));
    assert.equal(r.classification, 'MIGRATABLE');
    assert.equal(r.primary_reason_code, 'ELIGIBLE');
  });

  it('does NOT add CUSTOMER_UNRESOLVED when called without batch context (P009 would be ELIGIBLE alone)', () => {
    const r = classifyRecord(CASES_BY_KEY.get('PROJECT_ALIAS_009'));
    assert.equal(r.classification, 'MIGRATABLE');
    assert.equal(r.primary_reason_code, 'ELIGIBLE');
  });

  it('still surfaces non-contextual reasons for single records (P005 -> ORPHAN_PROJECT)', () => {
    const r = classifyRecord(CASES_BY_KEY.get('PROJECT_ALIAS_005'));
    assert.equal(r.classification, 'BLOCKED');
    assert.equal(r.primary_reason_code, 'ORPHAN_PROJECT');
  });
});

describe('acceptance criterion: buildAccountingSummary reconciliation', () => {
  const batchOutput = classifyBatch(CASES.cases);
  const summary = buildAccountingSummary(batchOutput);

  it('reports one entity bucket per supported entity type', () => {
    for (const entityType of ['customer', 'project', 'model', 'makeup']) {
      assert.ok(summary.entities[entityType], `missing entity bucket: ${entityType}`);
    }
  });

  it('each entity reconciles: MIGRATABLE + NEEDS_REVIEW + BLOCKED = source_total', () => {
    for (const entityType of Object.keys(summary.entities)) {
      const bucket = summary.entities[entityType];
      const sum = bucket.by_classification.MIGRATABLE + bucket.by_classification.NEEDS_REVIEW + bucket.by_classification.BLOCKED;
      assert.equal(sum, bucket.source_total,
        `${entityType} classification counts do not reconcile: ${sum} vs ${bucket.source_total}`);
      assert.equal(bucket.reconciled, true, `${entityType} reconciled flag must be true`);
    }
  });

  it('primary_reason_total per entity equals source_total', () => {
    for (const entityType of Object.keys(summary.entities)) {
      const bucket = summary.entities[entityType];
      let primarySum = 0;
      for (const code of Object.keys(bucket.by_primary_reason_code)) {
        primarySum += bucket.by_primary_reason_code[code];
      }
      assert.equal(primarySum, bucket.source_total,
        `${entityType} primary reason total mismatch: ${primarySum} vs ${bucket.source_total}`);
    }
  });

  it('overall totals reconcile', () => {
    assert.equal(summary.overall.classified_total, summary.overall.source_total);
    assert.equal(summary.overall.primary_reason_total, summary.overall.source_total);
    assert.equal(summary.overall.reconciled, true);
  });
});

describe('acceptance criterion: deterministic output (same fixtures -> identical SHA256)', () => {
  it('produces identical SHA256 across two consecutive runs', () => {
    const run1 = classifyBatch(CASES.cases);
    const run2 = classifyBatch(CASES.cases);
    const hash1 = sha256OfBatchOutput(run1);
    const hash2 = sha256OfBatchOutput(run2);
    assert.equal(hash1, hash2, 'two consecutive runs produced different SHA256');
  });

  it('produces identical SHA256 when input array is reordered (no insertion-order dependence)', () => {
    const reversed = [...CASES.cases].reverse();
    const runForward = classifyBatch(CASES.cases);
    const runReversed = classifyBatch(reversed);
    const forwardByKey = new Map(runForward.map((r) => [r.record_key, r]));
    for (const r of runReversed) {
      const f = forwardByKey.get(r.record_key);
      assert.deepEqual(r, f, `${r.record_key} differs when input is reversed`);
    }
  });
});
