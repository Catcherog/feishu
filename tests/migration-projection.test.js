// Migration projection + D-026 evaluator test suite (TASK-004 P0-1 + P0-2).
//
// Verifies:
//   - The 5 explicit schema-default fields are always present in
//     projected customer / project payloads (P0-1).
//   - Non-MIGRATABLE records never produce a writable payload (P0-1).
//   - Unsupported entity types (model / makeup) do not produce a
//     projection payload from this module (P0-1).
//   - D-026 evaluator fails when Project MIGRATABLE count is sufficient
//     but the projects do not link to MIGRATABLE customers in the batch
//     (P0-2 synthetic reverse-test).
//   - D-026 evaluator correctly identifies PASS vs FAIL across the four
//     required synthetic scenarios (P0-2).
//
// All fixtures are synthetic and use stable aliases (CUSTOMER_ALIAS_NNN,
// PROJECT_ALIAS_NNN, MODEL_ALIAS_NNN, MAKEUP_ALIAS_NNN) as record_key
// values. No real Feishu record identifier is required to run this suite.
//
// Run:  node --test tests/migration-projection.test.js

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  projectCustomer,
  projectProject,
  projectBatch,
  MIGRATION_DEFAULTS,
  SOURCE_CHANNEL_MAPPING_VERSION,
  STATUS_MAPPING_RULE_VERSION,
  PROJECT_CURRENCY,
} = require('../src/migration/projection');

const {
  evaluateD026Threshold,
  D026_THRESHOLDS,
  D026_PROJECT_ASSOCIATION_MIN,
} = require('../src/migration/d026-evaluator');

// ---------------------------------------------------------------------------
// Helpers for building synthetic records and classifications.
// ---------------------------------------------------------------------------

function makeCustomer(key, fields) {
  return {
    record_key: key,
    entity_type: 'customer',
    fields: Object.assign({
      name: 'fixture-customer',
      status_raw: '已成交',
      source_channel_raw: '小红书',
      budget_range_raw: '3000-5000',
      phone: '10000000001',
      wechat_id: 'fixture_wechat_' + key.toLowerCase(),
      portfolio_url: null,
      xiaohongshu_account: null,
      project_type_raw: null,
      linked_project_keys: [],
      linked_customer_key: null,
      linked_customer_name_hint: null,
      duplicate_candidates: [],
      has_delivery_evidence: false,
      has_archive_evidence: false,
    }, fields || {}),
  };
}

function makeProject(key, fields) {
  return {
    record_key: key,
    entity_type: 'project',
    fields: Object.assign({
      name: 'fixture-project',
      status_raw: '策划中',
      source_channel_raw: null,
      budget_range_raw: null,
      phone: null,
      wechat_id: null,
      portfolio_url: null,
      xiaohongshu_account: null,
      project_type_raw: '客片',
      linked_project_keys: [],
      linked_customer_key: null,
      linked_customer_name_hint: null,
      linked_model_key: null,
      duplicate_candidates: [],
      has_delivery_evidence: false,
      has_archive_evidence: false,
    }, fields || {}),
  };
}

function makeClassified(key, entityType, classification) {
  return {
    record_key: key,
    entity_type: entityType,
    classification,
    primary_reason_code: classification === 'MIGRATABLE' ? 'ELIGIBLE' : 'OTHER',
    secondary_reason_codes: [],
  };
}

// ---------------------------------------------------------------------------
// P0-1: Migration projection — explicit defaults
// ---------------------------------------------------------------------------

describe('P0-1: projectCustomer — explicit defaults for MIGRATABLE customer', () => {
  const record = makeCustomer('CUSTOMER_ALIAS_P001', {
    budget_range_raw: '3000-5000',
  });
  const classified = makeClassified('CUSTOMER_ALIAS_P001', 'customer', 'MIGRATABLE');
  const payload = projectCustomer(record, classified);

  it('returns a non-null payload for MIGRATABLE customer', () => {
    assert.ok(payload !== null, 'payload must not be null for MIGRATABLE customer');
  });

  it('payload includes budget_parse_rule_version = budget-map-v1.0', () => {
    assert.equal(payload.budget_parse_rule_version, 'budget-map-v1.0');
    assert.equal(
      payload.budget_parse_rule_version,
      MIGRATION_DEFAULTS.customer.budget_parse_rule_version,
    );
  });

  it('payload includes source_channel_mapping_version = source-map-v1.0', () => {
    assert.equal(payload.source_channel_mapping_version, 'source-map-v1.0');
    assert.equal(
      payload.source_channel_mapping_version,
      MIGRATION_DEFAULTS.customer.source_channel_mapping_version,
    );
    assert.equal(SOURCE_CHANNEL_MAPPING_VERSION, 'source-map-v1.0');
  });

  it('payload includes status_mapping_rule_version = status-map-v1.0', () => {
    assert.equal(payload.status_mapping_rule_version, 'status-map-v1.0');
    assert.equal(
      payload.status_mapping_rule_version,
      MIGRATION_DEFAULTS.customer.status_mapping_rule_version,
    );
    assert.equal(STATUS_MAPPING_RULE_VERSION, 'status-map-v1.0');
  });

  it('payload includes parsed budget fields (min=3000, max=5000, status=parsed)', () => {
    assert.equal(payload.budget_min, 3000);
    assert.equal(payload.budget_max, 5000);
    assert.equal(payload.budget_parse_status, 'parsed');
    assert.equal(payload.budget_range_raw, '3000-5000');
  });

  it('payload preserves source business fields (name, phone, wechat_id, status_raw, source_channel_raw)', () => {
    assert.equal(payload.name, 'fixture-customer');
    assert.equal(payload.status_raw, '已成交');
    assert.equal(payload.source_channel_raw, '小红书');
    assert.equal(payload.phone, '10000000001');
    assert.equal(payload.wechat_id, 'fixture_wechat_customer_alias_p001');
  });
});

describe('P0-1: projectProject — explicit defaults for MIGRATABLE project', () => {
  const record = makeProject('PROJECT_ALIAS_P001', {
    linked_customer_key: 'CUSTOMER_ALIAS_P001',
  });
  const classified = makeClassified('PROJECT_ALIAS_P001', 'project', 'MIGRATABLE');
  const payload = projectProject(record, classified);

  it('returns a non-null payload for MIGRATABLE project', () => {
    assert.ok(payload !== null, 'payload must not be null for MIGRATABLE project');
  });

  it('payload includes currency = CNY', () => {
    assert.equal(payload.currency, 'CNY');
    assert.equal(payload.currency, MIGRATION_DEFAULTS.project.currency);
    assert.equal(PROJECT_CURRENCY, 'CNY');
  });

  it('payload includes status_mapping_rule_version = status-map-v1.0', () => {
    assert.equal(payload.status_mapping_rule_version, 'status-map-v1.0');
    assert.equal(
      payload.status_mapping_rule_version,
      MIGRATION_DEFAULTS.project.status_mapping_rule_version,
    );
  });

  it('payload preserves linked_customer_key', () => {
    assert.equal(payload.linked_customer_key, 'CUSTOMER_ALIAS_P001');
  });

  it('payload preserves business fields (name, status_raw, project_type_raw)', () => {
    assert.equal(payload.name, 'fixture-project');
    assert.equal(payload.status_raw, '策划中');
    assert.equal(payload.project_type_raw, '客片');
  });
});

// ---------------------------------------------------------------------------
// P0-1: Non-MIGRATABLE records never produce a writable payload
// ---------------------------------------------------------------------------

describe('P0-1: projectCustomer / projectProject — non-MIGRATABLE records return null', () => {
  it('projectCustomer returns null for NEEDS_REVIEW customer', () => {
    const record = makeCustomer('CUSTOMER_ALIAS_P002', {});
    const classified = makeClassified('CUSTOMER_ALIAS_P002', 'customer', 'NEEDS_REVIEW');
    assert.equal(projectCustomer(record, classified), null);
  });

  it('projectCustomer returns null for BLOCKED customer', () => {
    const record = makeCustomer('CUSTOMER_ALIAS_P003', {});
    const classified = makeClassified('CUSTOMER_ALIAS_P003', 'customer', 'BLOCKED');
    assert.equal(projectCustomer(record, classified), null);
  });

  it('projectProject returns null for NEEDS_REVIEW project', () => {
    const record = makeProject('PROJECT_ALIAS_P002', {});
    const classified = makeClassified('PROJECT_ALIAS_P002', 'project', 'NEEDS_REVIEW');
    assert.equal(projectProject(record, classified), null);
  });

  it('projectProject returns null for BLOCKED project', () => {
    const record = makeProject('PROJECT_ALIAS_P003', {});
    const classified = makeClassified('PROJECT_ALIAS_P003', 'project', 'BLOCKED');
    assert.equal(projectProject(record, classified), null);
  });
});

// ---------------------------------------------------------------------------
// P0-1: Error cases — missing context, entity mismatch, key mismatch
// ---------------------------------------------------------------------------

describe('P0-1: projection rejects mismatched inputs', () => {
  it('projectCustomer throws when record_key values do not match', () => {
    const record = makeCustomer('CUSTOMER_ALIAS_P004', {});
    const classified = makeClassified('CUSTOMER_ALIAS_DIFFERENT', 'customer', 'MIGRATABLE');
    assert.throws(() => projectCustomer(record, classified), /record_key mismatch/);
  });

  it('projectCustomer throws when entity_type is not customer', () => {
    const record = makeProject('PROJECT_ALIAS_P005', {});
    const classified = makeClassified('PROJECT_ALIAS_P005', 'project', 'MIGRATABLE');
    assert.throws(() => projectCustomer(record, classified), /entity_type customer/);
  });

  it('projectProject throws when entity_type is not project', () => {
    const record = makeCustomer('CUSTOMER_ALIAS_P006', {});
    const classified = makeClassified('CUSTOMER_ALIAS_P006', 'customer', 'MIGRATABLE');
    assert.throws(() => projectProject(record, classified), /entity_type project/);
  });

  it('projectBatch throws when a record has no matching classification', () => {
    const record = makeCustomer('CUSTOMER_ALIAS_P007', {});
    const classified = makeClassified('CUSTOMER_ALIAS_DIFFERENT', 'customer', 'MIGRATABLE');
    assert.throws(() => projectBatch([record], [classified]), /no classification for/);
  });
});

// ---------------------------------------------------------------------------
// P0-1: projectBatch — batch behavior
// ---------------------------------------------------------------------------

describe('P0-1: projectBatch — batch behavior', () => {
  const records = [
    makeCustomer('CUSTOMER_ALIAS_B001', { budget_range_raw: '3000-5000' }),
    makeProject('PROJECT_ALIAS_B001', { linked_customer_key: 'CUSTOMER_ALIAS_B001' }),
    makeCustomer('CUSTOMER_ALIAS_B002', { name: '' }), // will be BLOCKED
    makeProject('PROJECT_ALIAS_B002', {}), // no linked customer, will not be projected if BLOCKED
  ];
  const classified = [
    makeClassified('CUSTOMER_ALIAS_B001', 'customer', 'MIGRATABLE'),
    makeClassified('PROJECT_ALIAS_B001', 'project', 'MIGRATABLE'),
    makeClassified('CUSTOMER_ALIAS_B002', 'customer', 'BLOCKED'),
    makeClassified('PROJECT_ALIAS_B002', 'project', 'BLOCKED'),
  ];
  const batch = projectBatch(records, classified);

  it('returns one entry per input record (deterministic order)', () => {
    assert.equal(batch.length, records.length);
    assert.deepEqual(
      batch.map((b) => b.record_key),
      records.map((r) => r.record_key),
    );
  });

  it('MIGRATABLE customer entry has non-null payload with 3 explicit defaults', () => {
    const entry = batch.find((b) => b.record_key === 'CUSTOMER_ALIAS_B001');
    assert.ok(entry);
    assert.ok(entry.payload !== null);
    assert.equal(entry.payload.budget_parse_rule_version, 'budget-map-v1.0');
    assert.equal(entry.payload.source_channel_mapping_version, 'source-map-v1.0');
    assert.equal(entry.payload.status_mapping_rule_version, 'status-map-v1.0');
  });

  it('MIGRATABLE project entry has non-null payload with 2 explicit defaults', () => {
    const entry = batch.find((b) => b.record_key === 'PROJECT_ALIAS_B001');
    assert.ok(entry);
    assert.ok(entry.payload !== null);
    assert.equal(entry.payload.currency, 'CNY');
    assert.equal(entry.payload.status_mapping_rule_version, 'status-map-v1.0');
  });

  it('BLOCKED customer entry has null payload', () => {
    const entry = batch.find((b) => b.record_key === 'CUSTOMER_ALIAS_B002');
    assert.ok(entry);
    assert.equal(entry.payload, null);
  });

  it('BLOCKED project entry has null payload', () => {
    const entry = batch.find((b) => b.record_key === 'PROJECT_ALIAS_B002');
    assert.ok(entry);
    assert.equal(entry.payload, null);
  });

  it('model and makeup MIGRATABLE records return null payload (not projected by this module)', () => {
    const modelRecord = { record_key: 'MODEL_ALIAS_B001', entity_type: 'model', fields: {} };
    const makeupRecord = { record_key: 'MAKEUP_ALIAS_B001', entity_type: 'makeup', fields: {} };
    const modelClassified = makeClassified('MODEL_ALIAS_B001', 'model', 'MIGRATABLE');
    const makeupClassified = makeClassified('MAKEUP_ALIAS_B001', 'makeup', 'MIGRATABLE');
    const batch2 = projectBatch([modelRecord, makeupRecord], [modelClassified, makeupClassified]);
    assert.equal(batch2[0].payload, null);
    assert.equal(batch2[1].payload, null);
  });
});

// ---------------------------------------------------------------------------
// P0-2: D-026 evaluator — synthetic reverse-test cases
// ---------------------------------------------------------------------------

describe('P0-2: D-026 evaluator — schema and constants', () => {
  it('D026_THRESHOLDS matches D-026 (customer 5, project 5, model 10, makeup 10)', () => {
    assert.equal(D026_THRESHOLDS.customer, 5);
    assert.equal(D026_THRESHOLDS.project, 5);
    assert.equal(D026_THRESHOLDS.model, 10);
    assert.equal(D026_THRESHOLDS.makeup, 10);
  });

  it('D026_PROJECT_ASSOCIATION_MIN = 5 (matches customer and project minimums)', () => {
    assert.equal(D026_PROJECT_ASSOCIATION_MIN, 5);
  });

  it('evaluator rejects non-array classified input', () => {
    assert.throws(
      () => evaluateD026Threshold(null, new Map()),
      /classified must be an array/,
    );
  });

  it('evaluator rejects non-Map sourceByKey input', () => {
    assert.throws(
      () => evaluateD026Threshold([], {}),
      /sourceByKey must be a Map/,
    );
  });
});

describe('P0-2: D-026 evaluator — Scenario A: all thresholds met (PASS)', () => {
  // 5 MIGRATABLE customers, 5 MIGRATABLE projects all linking to those
  // customers, 10 MIGRATABLE models, 10 MIGRATABLE makeups. PASS.
  const customers = [];
  const projects = [];
  const models = [];
  const makeups = [];
  const classified = [];
  const sourceByKey = new Map();
  for (let i = 0; i < 5; i++) {
    const ck = `CUSTOMER_ALIAS_D026_A_${i}`;
    const c = makeCustomer(ck, {});
    customers.push(c);
    classified.push(makeClassified(ck, 'customer', 'MIGRATABLE'));
    sourceByKey.set(ck, c);
    const pk = `PROJECT_ALIAS_D026_A_${i}`;
    const p = makeProject(pk, { linked_customer_key: ck });
    projects.push(p);
    classified.push(makeClassified(pk, 'project', 'MIGRATABLE'));
    sourceByKey.set(pk, p);
  }
  for (let i = 0; i < 10; i++) {
    const mk = `MODEL_ALIAS_D026_A_${i}`;
    const m = { record_key: mk, entity_type: 'model', fields: {} };
    models.push(m);
    classified.push(makeClassified(mk, 'model', 'MIGRATABLE'));
    sourceByKey.set(mk, m);
    const mk2 = `MAKEUP_ALIAS_D026_A_${i}`;
    const m2 = { record_key: mk2, entity_type: 'makeup', fields: {} };
    makeups.push(m2);
    classified.push(makeClassified(mk2, 'makeup', 'MIGRATABLE'));
    sourceByKey.set(mk2, m2);
  }

  const result = evaluateD026Threshold(classified, sourceByKey);

  it('all_thresholds_met = true (PASS)', () => {
    assert.equal(result.all_thresholds_met, true);
    assert.match(result.judgement, /^PASS/);
  });

  it('customer threshold met (5/5)', () => {
    assert.equal(result.thresholds.customer.actual_migratable, 5);
    assert.equal(result.thresholds.customer.threshold_met, true);
    assert.equal(result.thresholds.customer.shortfall, 0);
  });

  it('project threshold met (5/5)', () => {
    assert.equal(result.thresholds.project.actual_migratable, 5);
    assert.equal(result.thresholds.project.threshold_met, true);
    assert.equal(result.thresholds.project.shortfall, 0);
  });

  it('model threshold met (10/10)', () => {
    assert.equal(result.thresholds.model.actual_migratable, 10);
    assert.equal(result.thresholds.model.threshold_met, true);
  });

  it('makeup threshold met (10/10)', () => {
    assert.equal(result.thresholds.makeup.actual_migratable, 10);
    assert.equal(result.thresholds.makeup.threshold_met, true);
  });

  it('project_association_check met (5 MIGRATABLE projects -> MIGRATABLE customers)', () => {
    assert.equal(result.project_association_check.actual_migratable_with_migratable_customer, 5);
    assert.equal(result.project_association_check.met, true);
    assert.equal(result.project_association_check.shortfall, 0);
  });
});

describe('P0-2: D-026 evaluator — Scenario B: quantity met but projects link to non-MIGRATABLE customer (FAIL)', () => {
  // 5 MIGRATABLE customers AND 5 BLOCKED customers.
  // 5 MIGRATABLE projects, but each links to a BLOCKED customer key,
  // NOT to any of the 5 MIGRATABLE customers. So project quantity is met
  // (5 MIGRATABLE) but association is 0. FAIL.
  const customers = [];
  const projects = [];
  const classified = [];
  const sourceByKey = new Map();
  for (let i = 0; i < 5; i++) {
    const ck = `CUSTOMER_ALIAS_D026_B_MIG_${i}`;
    const c = makeCustomer(ck, {});
    customers.push(c);
    classified.push(makeClassified(ck, 'customer', 'MIGRATABLE'));
    sourceByKey.set(ck, c);
  }
  for (let i = 0; i < 5; i++) {
    const ck = `CUSTOMER_ALIAS_D026_B_BLK_${i}`;
    const c = makeCustomer(ck, {});
    customers.push(c);
    classified.push(makeClassified(ck, 'customer', 'BLOCKED'));
    sourceByKey.set(ck, c);
  }
  for (let i = 0; i < 5; i++) {
    const pk = `PROJECT_ALIAS_D026_B_${i}`;
    // Each project links to a BLOCKED customer — not to any MIGRATABLE one
    const p = makeProject(pk, { linked_customer_key: `CUSTOMER_ALIAS_D026_B_BLK_${i}` });
    projects.push(p);
    classified.push(makeClassified(pk, 'project', 'MIGRATABLE'));
    sourceByKey.set(pk, p);
  }
  // 10 MIGRATABLE models and 10 MIGRATABLE makeups so other thresholds pass
  for (let i = 0; i < 10; i++) {
    const mk = `MODEL_ALIAS_D026_B_${i}`;
    const m = { record_key: mk, entity_type: 'model', fields: {} };
    classified.push(makeClassified(mk, 'model', 'MIGRATABLE'));
    sourceByKey.set(mk, m);
    const mk2 = `MAKEUP_ALIAS_D026_B_${i}`;
    const m2 = { record_key: mk2, entity_type: 'makeup', fields: {} };
    classified.push(makeClassified(mk2, 'makeup', 'MIGRATABLE'));
    sourceByKey.set(mk2, m2);
  }

  const result = evaluateD026Threshold(classified, sourceByKey);

  it('all_thresholds_met = false (FAIL)', () => {
    assert.equal(result.all_thresholds_met, false);
    assert.match(result.judgement, /^FAIL/);
  });

  it('customer threshold met (5/5) — quantity alone does not fail gate', () => {
    assert.equal(result.thresholds.customer.actual_migratable, 5);
    assert.equal(result.thresholds.customer.threshold_met, true);
  });

  it('project threshold met on quantity (5/5) — but association fails', () => {
    assert.equal(result.thresholds.project.actual_migratable, 5);
    assert.equal(result.thresholds.project.threshold_met, true);
  });

  it('project_association_check fails — 0 projects link to MIGRATABLE customer', () => {
    assert.equal(result.project_association_check.actual_migratable_with_migratable_customer, 0);
    assert.equal(result.project_association_check.met, false);
    assert.equal(result.project_association_check.shortfall, 5);
  });

  it('model and makeup thresholds met (10/10)', () => {
    assert.equal(result.thresholds.model.threshold_met, true);
    assert.equal(result.thresholds.makeup.threshold_met, true);
  });
});

describe('P0-2: D-026 evaluator — Scenario C: projects have no linked_customer_key (FAIL)', () => {
  // 5 MIGRATABLE customers, 5 MIGRATABLE projects WITHOUT linked_customer_key,
  // 10 MIGRATABLE models, 10 MIGRATABLE makeups. The project threshold on
  // quantity is met, but no project links to a MIGRATABLE customer. FAIL.
  const classified = [];
  const sourceByKey = new Map();
  for (let i = 0; i < 5; i++) {
    const ck = `CUSTOMER_ALIAS_D026_C_${i}`;
    const c = makeCustomer(ck, {});
    classified.push(makeClassified(ck, 'customer', 'MIGRATABLE'));
    sourceByKey.set(ck, c);
    const pk = `PROJECT_ALIAS_D026_C_${i}`;
    // linked_customer_key stays null (default from makeProject)
    const p = makeProject(pk, {});
    classified.push(makeClassified(pk, 'project', 'MIGRATABLE'));
    sourceByKey.set(pk, p);
  }
  for (let i = 0; i < 10; i++) {
    const mk = `MODEL_ALIAS_D026_C_${i}`;
    const m = { record_key: mk, entity_type: 'model', fields: {} };
    classified.push(makeClassified(mk, 'model', 'MIGRATABLE'));
    sourceByKey.set(mk, m);
    const mk2 = `MAKEUP_ALIAS_D026_C_${i}`;
    const m2 = { record_key: mk2, entity_type: 'makeup', fields: {} };
    classified.push(makeClassified(mk2, 'makeup', 'MIGRATABLE'));
    sourceByKey.set(mk2, m2);
  }

  const result = evaluateD026Threshold(classified, sourceByKey);

  it('all_thresholds_met = false (FAIL)', () => {
    assert.equal(result.all_thresholds_met, false);
    assert.match(result.judgement, /^FAIL/);
  });

  it('project quantity threshold met (5/5)', () => {
    assert.equal(result.thresholds.project.actual_migratable, 5);
    assert.equal(result.thresholds.project.threshold_met, true);
  });

  it('project_association_check fails — 0 projects have any linked_customer_key', () => {
    assert.equal(result.project_association_check.actual_migratable_with_migratable_customer, 0);
    assert.equal(result.project_association_check.met, false);
  });
});

describe('P0-2: D-026 evaluator — Scenario D: current-like quantity shortfall (FAIL)', () => {
  // Mirrors the real R6 data distribution: customer 0/5, project 0/5,
  // model 3/10, makeup 5/10. FAIL on all four counts and on association.
  const classified = [];
  const sourceByKey = new Map();
  // 36 BLOCKED customers (no MIGRATABLE)
  for (let i = 0; i < 36; i++) {
    const ck = `CUSTOMER_ALIAS_D026_D_${i}`;
    const c = makeCustomer(ck, {});
    classified.push(makeClassified(ck, 'customer', 'BLOCKED'));
    sourceByKey.set(ck, c);
  }
  // 47 BLOCKED projects (no MIGRATABLE)
  for (let i = 0; i < 47; i++) {
    const pk = `PROJECT_ALIAS_D026_D_${i}`;
    const p = makeProject(pk, {});
    classified.push(makeClassified(pk, 'project', 'BLOCKED'));
    sourceByKey.set(pk, p);
  }
  // 3 MIGRATABLE models (short of 10)
  for (let i = 0; i < 3; i++) {
    const mk = `MODEL_ALIAS_D026_D_${i}`;
    const m = { record_key: mk, entity_type: 'model', fields: {} };
    classified.push(makeClassified(mk, 'model', 'MIGRATABLE'));
    sourceByKey.set(mk, m);
  }
  // 5 MIGRATABLE makeups (short of 10)
  for (let i = 0; i < 5; i++) {
    const mk2 = `MAKEUP_ALIAS_D026_D_${i}`;
    const m2 = { record_key: mk2, entity_type: 'makeup', fields: {} };
    classified.push(makeClassified(mk2, 'makeup', 'MIGRATABLE'));
    sourceByKey.set(mk2, m2);
  }

  const result = evaluateD026Threshold(classified, sourceByKey);

  it('all_thresholds_met = false (FAIL)', () => {
    assert.equal(result.all_thresholds_met, false);
    assert.match(result.judgement, /^FAIL/);
  });

  it('customer threshold fails (0/5)', () => {
    assert.equal(result.thresholds.customer.actual_migratable, 0);
    assert.equal(result.thresholds.customer.threshold_met, false);
    assert.equal(result.thresholds.customer.shortfall, 5);
  });

  it('project threshold fails (0/5)', () => {
    assert.equal(result.thresholds.project.actual_migratable, 0);
    assert.equal(result.thresholds.project.threshold_met, false);
    assert.equal(result.thresholds.project.shortfall, 5);
  });

  it('model threshold fails (3/10)', () => {
    assert.equal(result.thresholds.model.actual_migratable, 3);
    assert.equal(result.thresholds.model.threshold_met, false);
    assert.equal(result.thresholds.model.shortfall, 7);
  });

  it('makeup threshold fails (5/10)', () => {
    assert.equal(result.thresholds.makeup.actual_migratable, 5);
    assert.equal(result.thresholds.makeup.threshold_met, false);
    assert.equal(result.thresholds.makeup.shortfall, 5);
  });

  it('project_association_check fails (0/5)', () => {
    assert.equal(result.project_association_check.actual_migratable_with_migratable_customer, 0);
    assert.equal(result.project_association_check.met, false);
    assert.equal(result.project_association_check.shortfall, 5);
  });
});

// ---------------------------------------------------------------------------
// P0-2: D-026 evaluator — schema_version sanity check
// ---------------------------------------------------------------------------

describe('P0-2: D-026 evaluator — output schema', () => {
  it('output schema_version is r6-quantity-threshold-judgement-v1.1', () => {
    const result = evaluateD026Threshold([], new Map());
    assert.equal(result.schema_version, 'r6-quantity-threshold-judgement-v1.1');
    assert.equal(result.decision_reference, 'D-026 (DECISION_LOG.md)');
  });

  it('empty input returns FAIL (all thresholds short)', () => {
    const result = evaluateD026Threshold([], new Map());
    assert.equal(result.all_thresholds_met, false);
    assert.match(result.judgement, /^FAIL/);
  });
});

// ---------------------------------------------------------------------------
// R6 minimum final fix batch: fail-closed reverse tests
//
// Verifies the new fail-closed validators added to projectCustomer /
// projectProject:
//   - classified.entity_type MUST match record.entity_type (general invariant,
//     checked before MIGRATABLE filter).
//   - Customer MIGRATABLE projection requires: fields object, non-empty name,
//     and identity context (phone / wechat_id / source_channel_raw /
//     has_valid_need_summary=true).
//   - Project MIGRATABLE projection requires: fields object, non-empty
//     name / status_raw / project_type_raw / linked_customer_key.
//   - Missing context MUST throw — never generate a writable payload.
// ---------------------------------------------------------------------------

describe('R6 fail-closed: projectCustomer rejects incomplete context', () => {
  it('throws when fields is empty object {} (no name, no identity)', () => {
    const record = {
      record_key: 'CUSTOMER_ALIAS_R6_REV_001',
      entity_type: 'customer',
      fields: {},
    };
    const classified = makeClassified('CUSTOMER_ALIAS_R6_REV_001', 'customer', 'MIGRATABLE');
    assert.throws(
      () => projectCustomer(record, classified),
      /name must be non-empty|identity context missing|fields must be a non-null object/,
    );
  });

  it('throws when customer identity context is missing (all four identity sources null/false)', () => {
    const record = makeCustomer('CUSTOMER_ALIAS_R6_REV_002', {
      name: 'fixture-customer',
      phone: null,
      wechat_id: null,
      source_channel_raw: null,
      has_valid_need_summary: false,
    });
    const classified = makeClassified('CUSTOMER_ALIAS_R6_REV_002', 'customer', 'MIGRATABLE');
    assert.throws(
      () => projectCustomer(record, classified),
      /identity context missing/,
    );
  });

  it('throws when classified.entity_type does not match record.entity_type', () => {
    // record is customer, classified is project — mismatch
    const record = makeCustomer('CUSTOMER_ALIAS_R6_REV_003', {});
    const classified = makeClassified('CUSTOMER_ALIAS_R6_REV_003', 'project', 'MIGRATABLE');
    assert.throws(
      () => projectCustomer(record, classified),
      /entity_type mismatch/,
    );
  });

  it('throws when fields is undefined', () => {
    const record = {
      record_key: 'CUSTOMER_ALIAS_R6_REV_004',
      entity_type: 'customer',
      fields: undefined,
    };
    const classified = makeClassified('CUSTOMER_ALIAS_R6_REV_004', 'customer', 'MIGRATABLE');
    assert.throws(
      () => projectCustomer(record, classified),
      /fields must be a non-null object/,
    );
  });

  it('throws when fields is an array (not a plain object)', () => {
    const record = {
      record_key: 'CUSTOMER_ALIAS_R6_REV_005',
      entity_type: 'customer',
      fields: [],
    };
    const classified = makeClassified('CUSTOMER_ALIAS_R6_REV_005', 'customer', 'MIGRATABLE');
    assert.throws(
      () => projectCustomer(record, classified),
      /fields must be a non-null object/,
    );
  });
});

describe('R6 fail-closed: projectProject rejects incomplete context', () => {
  it('throws when fields is empty object {} (no name, no status_raw, no project_type_raw, no linked_customer_key)', () => {
    const record = {
      record_key: 'PROJECT_ALIAS_R6_REV_001',
      entity_type: 'project',
      fields: {},
    };
    const classified = makeClassified('PROJECT_ALIAS_R6_REV_001', 'project', 'MIGRATABLE');
    assert.throws(
      () => projectProject(record, classified),
      /name must be non-empty|status_raw must be non-empty|project_type_raw must be non-empty|linked_customer_key must be non-empty/,
    );
  });

  it('throws when linked_customer_key is null (missing)', () => {
    const record = makeProject('PROJECT_ALIAS_R6_REV_002', {
      linked_customer_key: null,
    });
    const classified = makeClassified('PROJECT_ALIAS_R6_REV_002', 'project', 'MIGRATABLE');
    assert.throws(
      () => projectProject(record, classified),
      /linked_customer_key must be non-empty/,
    );
  });

  it('throws when linked_customer_key is empty string', () => {
    const record = makeProject('PROJECT_ALIAS_R6_REV_003', {
      linked_customer_key: '',
    });
    const classified = makeClassified('PROJECT_ALIAS_R6_REV_003', 'project', 'MIGRATABLE');
    assert.throws(
      () => projectProject(record, classified),
      /linked_customer_key must be non-empty/,
    );
  });

  it('throws when classified.entity_type does not match record.entity_type', () => {
    // record is project, classified is customer — mismatch
    const record = makeProject('PROJECT_ALIAS_R6_REV_004', {
      linked_customer_key: 'CUSTOMER_ALIAS_X',
    });
    const classified = makeClassified('PROJECT_ALIAS_R6_REV_004', 'customer', 'MIGRATABLE');
    assert.throws(
      () => projectProject(record, classified),
      /entity_type mismatch/,
    );
  });

  it('throws when status_raw is empty (with linked_customer_key present)', () => {
    const record = makeProject('PROJECT_ALIAS_R6_REV_005', {
      status_raw: '',
      linked_customer_key: 'CUSTOMER_ALIAS_X',
    });
    const classified = makeClassified('PROJECT_ALIAS_R6_REV_005', 'project', 'MIGRATABLE');
    assert.throws(
      () => projectProject(record, classified),
      /status_raw must be non-empty/,
    );
  });

  it('throws when project_type_raw is empty (with status_raw and linked_customer_key present)', () => {
    const record = makeProject('PROJECT_ALIAS_R6_REV_006', {
      project_type_raw: '',
      linked_customer_key: 'CUSTOMER_ALIAS_X',
    });
    const classified = makeClassified('PROJECT_ALIAS_R6_REV_006', 'project', 'MIGRATABLE');
    assert.throws(
      () => projectProject(record, classified),
      /project_type_raw must be non-empty/,
    );
  });
});

describe('R6 fail-closed: projectBatch propagates projection errors', () => {
  it('projectBatch throws when a MIGRATABLE project in the batch has no linked_customer_key', () => {
    const record = makeProject('PROJECT_ALIAS_R6_REV_BATCH_001', {});
    const classified = makeClassified('PROJECT_ALIAS_R6_REV_BATCH_001', 'project', 'MIGRATABLE');
    assert.throws(
      () => projectBatch([record], [classified]),
      /linked_customer_key must be non-empty/,
    );
  });

  it('projectBatch throws when a MIGRATABLE customer in the batch has fields={}', () => {
    const record = {
      record_key: 'CUSTOMER_ALIAS_R6_REV_BATCH_001',
      entity_type: 'customer',
      fields: {},
    };
    const classified = makeClassified('CUSTOMER_ALIAS_R6_REV_BATCH_001', 'customer', 'MIGRATABLE');
    assert.throws(
      () => projectBatch([record], [classified]),
      /name must be non-empty|identity context missing/,
    );
  });
});

// ---------------------------------------------------------------------------
// R6-MINIMUM-FINAL-FIX-02: projectBatch entity_type consistency check
// BEFORE classification branch (BLOCKED / NEEDS_REVIEW mismatches must throw)
//
// Verifies that projectBatch now calls ensureEntityTypeConsistency BEFORE
// the `if (c.classification === 'MIGRATABLE')` branch. A non-MIGRATABLE
// record (BLOCKED / NEEDS_REVIEW) with a mismatched classified.entity_type
// MUST throw instead of silently returning a null payload that masks a
// caller bug.
// ---------------------------------------------------------------------------

describe('R6-MINIMUM-FINAL-FIX-02: projectBatch entity_type consistency for non-MIGRATABLE records', () => {
  it('BLOCKED customer + classified.entity_type=project throws (consistency checked before classification branch)', () => {
    // record is customer, classified is project — mismatch
    const record = makeCustomer('CUSTOMER_ALIAS_R6_MFF_001', {});
    const classified = makeClassified('CUSTOMER_ALIAS_R6_MFF_001', 'project', 'BLOCKED');
    assert.throws(
      () => projectBatch([record], [classified]),
      /entity_type mismatch/,
    );
  });

  it('NEEDS_REVIEW project + classified.entity_type=customer throws (consistency checked before classification branch)', () => {
    // record is project, classified is customer — mismatch
    const record = makeProject('PROJECT_ALIAS_R6_MFF_002', {
      linked_customer_key: 'CUSTOMER_ALIAS_X',
    });
    const classified = makeClassified('PROJECT_ALIAS_R6_MFF_002', 'customer', 'NEEDS_REVIEW');
    assert.throws(
      () => projectBatch([record], [classified]),
      /entity_type mismatch/,
    );
  });

  it('BLOCKED customer + classified.entity_type=customer returns null payload (no mismatch, no throw)', () => {
    // Sanity check: matching entity_type on a BLOCKED record still returns
    // null payload without throwing.
    const record = makeCustomer('CUSTOMER_ALIAS_R6_MFF_003', {});
    const classified = makeClassified('CUSTOMER_ALIAS_R6_MFF_003', 'customer', 'BLOCKED');
    const batch = projectBatch([record], [classified]);
    assert.equal(batch.length, 1);
    assert.equal(batch[0].payload, null);
  });

  it('NEEDS_REVIEW project + classified.entity_type=project returns null payload (no mismatch, no throw)', () => {
    // Sanity check: matching entity_type on a NEEDS_REVIEW record still
    // returns null payload without throwing.
    const record = makeProject('PROJECT_ALIAS_R6_MFF_004', {});
    const classified = makeClassified('PROJECT_ALIAS_R6_MFF_004', 'project', 'NEEDS_REVIEW');
    const batch = projectBatch([record], [classified]);
    assert.equal(batch.length, 1);
    assert.equal(batch[0].payload, null);
  });
});

// ---------------------------------------------------------------------------
// PROJECT-TYPE-SOURCE-OF-TRUTH-CORRECTION-01: 9 required test cases
//
// Verifies that projection + D-026 evaluator correctly handle the
// per-project-type association rules:
//   - 客片 requires linked_customer_key (Customer)
//   - 样片 (V1 "创作") requires linked_model_key (Model); Customer optional
//   - empty project_type_raw throws (PROJECT_TYPE_REQUIRED handles at
//     classifier level, but projection fails closed if reached)
//   - linked key pointing to wrong entity_type fails the D-026 gate
// ---------------------------------------------------------------------------

describe('PROJECT-TYPE-SOURCE-OF-TRUTH-CORRECTION-01: 9 required test cases', () => {
  // Test 1: 客片 + Customer → MIGRATABLE
  it('1. 客片 project with Customer link → MIGRATABLE projection succeeds', () => {
    const record = makeProject('PROJECT_ALIAS_PTC_001', {
      project_type_raw: '客片',
      linked_customer_key: 'CUSTOMER_ALIAS_PTC_001',
    });
    const classified = makeClassified('PROJECT_ALIAS_PTC_001', 'project', 'MIGRATABLE');
    const payload = projectProject(record, classified);
    assert.ok(payload !== null);
    assert.equal(payload.project_type_raw, '客片');
    assert.equal(payload.linked_customer_key, 'CUSTOMER_ALIAS_PTC_001');
  });

  // Test 2: 客片无 Customer → BLOCKED (projection throws)
  it('2. 客片 project without Customer link → projection throws (BLOCKED at classifier)', () => {
    const record = makeProject('PROJECT_ALIAS_PTC_002', {
      project_type_raw: '客片',
      linked_customer_key: null,
    });
    const classified = makeClassified('PROJECT_ALIAS_PTC_002', 'project', 'MIGRATABLE');
    assert.throws(
      () => projectProject(record, classified),
      /linked_customer_key must be non-empty/,
    );
  });

  // Test 3: 创作/样片 + Model → MIGRATABLE
  it('3. 创作 (样片) project with Model link → MIGRATABLE projection succeeds', () => {
    const record = makeProject('PROJECT_ALIAS_PTC_003', {
      project_type_raw: '创作',
      linked_customer_key: null, // 样片: Customer optional
      linked_model_key: 'MODEL_ALIAS_PTC_001',
    });
    const classified = makeClassified('PROJECT_ALIAS_PTC_003', 'project', 'MIGRATABLE');
    const payload = projectProject(record, classified);
    assert.ok(payload !== null);
    assert.equal(payload.project_type_raw, '创作');
    assert.equal(payload.linked_model_key, 'MODEL_ALIAS_PTC_001');
    // linked_customer_key should NOT be present (was empty in source)
    assert.ok(!('linked_customer_key' in payload),
      '样片 without linked_customer_key must NOT emit that field in payload');
  });

  // Test 4: 创作/样片无 Customer但有Model → MIGRATABLE (same as #3, explicit)
  it('4. 创作 (样片) project with Model link but no Customer → MIGRATABLE (Customer optional)', () => {
    const record = makeProject('PROJECT_ALIAS_PTC_004', {
      project_type_raw: '创作',
      linked_customer_key: '',
      linked_model_key: 'MODEL_ALIAS_PTC_002',
    });
    const classified = makeClassified('PROJECT_ALIAS_PTC_004', 'project', 'MIGRATABLE');
    const payload = projectProject(record, classified);
    assert.ok(payload !== null);
    assert.equal(payload.linked_model_key, 'MODEL_ALIAS_PTC_002');
    // Customer should not be in payload (was empty)
    assert.ok(!('linked_customer_key' in payload));
  });

  // Test 5: 创作/样片只有Customer无Model → BLOCKED (projection throws)
  it('5. 创作 (样片) project with only Customer, no Model → projection throws (BLOCKED at classifier)', () => {
    const record = makeProject('PROJECT_ALIAS_PTC_005', {
      project_type_raw: '创作',
      linked_customer_key: 'CUSTOMER_ALIAS_PTC_005',
      linked_model_key: null,
    });
    const classified = makeClassified('PROJECT_ALIAS_PTC_005', 'project', 'MIGRATABLE');
    assert.throws(
      () => projectProject(record, classified),
      /样片 project linked_model_key must be non-empty/,
    );
  });

  // Test 6: 类型为空 → NEEDS_REVIEW (projection throws because type unknown)
  it('6. Empty project_type_raw → projection throws (NEEDS_REVIEW at classifier)', () => {
    const record = makeProject('PROJECT_ALIAS_PTC_006', {
      project_type_raw: '',
      linked_customer_key: 'CUSTOMER_ALIAS_PTC_006',
    });
    const classified = makeClassified('PROJECT_ALIAS_PTC_006', 'project', 'MIGRATABLE');
    assert.throws(
      () => projectProject(record, classified),
      /project_type_raw must be non-empty/,
    );
  });

  // Test 7: Model key 写入 Customer 字段 → D-026 entity_type mismatch (FAIL)
  it('7. 样片 project with Model key written into Customer field → D-026 type mismatch fails gate', () => {
    // Build a small batch: 1 样片 project, 1 model record referenced via
    // linked_customer_key (wrong field), minimal other entities to isolate
    // the type-mismatch check.
    const modelKey = 'MODEL_ALIAS_PTC_007';
    const modelRecord = {
      record_key: modelKey,
      entity_type: 'model',
      fields: { name: 'fixture-model' },
    };
    const projectKey = 'PROJECT_ALIAS_PTC_007';
    const projectRecord = {
      record_key: projectKey,
      entity_type: 'project',
      fields: {
        name: 'fixture-project',
        status_raw: '策划中',
        project_type_raw: '创作', // 样片 after normalization
        linked_customer_key: modelKey, // WRONG: Model key in Customer field
        linked_model_key: '',
      },
    };
    const classified = [
      makeClassified(modelKey, 'model', 'MIGRATABLE'),
      makeClassified(projectKey, 'project', 'MIGRATABLE'),
    ];
    const sourceByKey = new Map([
      [modelKey, modelRecord],
      [projectKey, projectRecord],
    ]);
    const result = evaluateD026Threshold(classified, sourceByKey);
    // Type mismatch detected → entity_type_correctness_check fails
    assert.equal(result.entity_type_correctness_check.actual_mismatches, 1,
      'expected 1 type mismatch (Model key in Customer field)');
    assert.equal(result.entity_type_correctness_check.met, false);
    assert.equal(result.all_thresholds_met, false);
  });

  // Test 8: Customer key 写入 Model 字段 → D-026 entity_type mismatch (FAIL)
  it('8. 客片 project with Customer key written into Model field → D-026 type mismatch fails gate', () => {
    const customerKey = 'CUSTOMER_ALIAS_PTC_008';
    const customerRecord = {
      record_key: customerKey,
      entity_type: 'customer',
      fields: { name: 'fixture-customer' },
    };
    const projectKey = 'PROJECT_ALIAS_PTC_008';
    const projectRecord = {
      record_key: projectKey,
      entity_type: 'project',
      fields: {
        name: 'fixture-project',
        status_raw: '策划中',
        project_type_raw: '客片',
        linked_customer_key: customerKey, // correct: Customer in Customer field
        linked_model_key: customerKey, // WRONG: Customer key in Model field
      },
    };
    const classified = [
      makeClassified(customerKey, 'customer', 'MIGRATABLE'),
      makeClassified(projectKey, 'project', 'MIGRATABLE'),
    ];
    const sourceByKey = new Map([
      [customerKey, customerRecord],
      [projectKey, projectRecord],
    ]);
    const result = evaluateD026Threshold(classified, sourceByKey);
    // Type mismatch detected → entity_type_correctness_check fails
    assert.equal(result.entity_type_correctness_check.actual_mismatches, 1,
      'expected 1 type mismatch (Customer key in Model field)');
    assert.equal(result.entity_type_correctness_check.met, false);
    assert.equal(result.all_thresholds_met, false);
  });

  // Test 9: 原有 Customer/Model/Makeup 分类无非预期退化
  it('9. Existing Customer/Model/Makeup classifications do not regress with new type-aware logic', () => {
    // Customer classification: should still produce standard MIGRATABLE
    // payload with the 3 explicit defaults.
    const customerRecord = makeCustomer('CUSTOMER_ALIAS_PTC_009', {
      budget_range_raw: '3000-5000',
    });
    const customerClassified = makeClassified('CUSTOMER_ALIAS_PTC_009', 'customer', 'MIGRATABLE');
    const customerPayload = projectCustomer(customerRecord, customerClassified);
    assert.ok(customerPayload !== null);
    assert.equal(customerPayload.budget_parse_rule_version, 'budget-map-v1.0');
    assert.equal(customerPayload.source_channel_mapping_version, 'source-map-v1.0');
    assert.equal(customerPayload.status_mapping_rule_version, 'status-map-v1.0');
    assert.equal(customerPayload.budget_min, 3000);
    assert.equal(customerPayload.budget_max, 5000);

    // Model / Makeup classification: projectBatch returns null payload
    // for resource entity types (resource projection is out of scope).
    const modelRecord = {
      record_key: 'MODEL_ALIAS_PTC_009',
      entity_type: 'model',
      fields: { name: 'fixture-model' },
    };
    const modelClassified = makeClassified('MODEL_ALIAS_PTC_009', 'model', 'MIGRATABLE');
    const makeupRecord = {
      record_key: 'MAKEUP_ALIAS_PTC_009',
      entity_type: 'makeup',
      fields: { name: 'fixture-makeup' },
    };
    const makeupClassified = makeClassified('MAKEUP_ALIAS_PTC_009', 'makeup', 'MIGRATABLE');
    const batch = projectBatch([modelRecord, makeupRecord], [modelClassified, makeupClassified]);
    assert.equal(batch[0].payload, null);
    assert.equal(batch[1].payload, null);

    // 客片 project classification: should still produce MIGRATABLE payload
    // with linked_customer_key preserved.
    const kepianProject = makeProject('PROJECT_ALIAS_PTC_009_KEPIAN', {
      project_type_raw: '客片',
      linked_customer_key: 'CUSTOMER_ALIAS_PTC_009',
    });
    const kepianClassified = makeClassified('PROJECT_ALIAS_PTC_009_KEPIAN', 'project', 'MIGRATABLE');
    const kepianPayload = projectProject(kepianProject, kepianClassified);
    assert.ok(kepianPayload !== null);
    assert.equal(kepianPayload.linked_customer_key, 'CUSTOMER_ALIAS_PTC_009');
    assert.equal(kepianPayload.currency, 'CNY');
    assert.equal(kepianPayload.status_mapping_rule_version, 'status-map-v1.0');
  });
});

// ---------------------------------------------------------------------------
// PROJECT-TYPE-SOURCE-OF-TRUTH-CORRECTION-01: D-026 split association check
// ---------------------------------------------------------------------------

describe('PROJECT-TYPE-SOURCE-OF-TRUTH-CORRECTION-01: D-026 split association check', () => {
  // Scenario: PASS with mix of 客片-Customer and 样片-Model pairs (combined >= 5)
  it('D-026 PASSes when 客片-Customer + 样片-Model combined pairs >= 5', () => {
    const classified = [];
    const sourceByKey = new Map();
    // 5 MIGRATABLE customers
    for (let i = 0; i < 5; i++) {
      const ck = `CUSTOMER_ALIAS_PTC_D026_${i}`;
      const c = makeCustomer(ck, {});
      classified.push(makeClassified(ck, 'customer', 'MIGRATABLE'));
      sourceByKey.set(ck, c);
    }
    // 10 MIGRATABLE models (D-026 threshold is 10)
    for (let i = 0; i < 10; i++) {
      const mk = `MODEL_ALIAS_PTC_D026_${i}`;
      const m = { record_key: mk, entity_type: 'model', fields: {} };
      classified.push(makeClassified(mk, 'model', 'MIGRATABLE'));
      sourceByKey.set(mk, m);
    }
    // 3 客片 projects (each linking to a customer) + 2 样片 projects (each linking to a model)
    for (let i = 0; i < 3; i++) {
      const ck = `CUSTOMER_ALIAS_PTC_D026_${i}`;
      const pk = `PROJECT_ALIAS_PTC_D026_KP_${i}`;
      const p = makeProject(pk, {
        project_type_raw: '客片',
        linked_customer_key: ck,
      });
      classified.push(makeClassified(pk, 'project', 'MIGRATABLE'));
      sourceByKey.set(pk, p);
    }
    for (let i = 0; i < 2; i++) {
      const mk = `MODEL_ALIAS_PTC_D026_${i}`;
      const pk = `PROJECT_ALIAS_PTC_D026_YP_${i}`;
      const p = makeProject(pk, {
        project_type_raw: '创作', // V1 for 样片
        linked_customer_key: null,
        linked_model_key: mk,
      });
      classified.push(makeClassified(pk, 'project', 'MIGRATABLE'));
      sourceByKey.set(pk, p);
    }
    // 10 MIGRATABLE makeups
    for (let i = 0; i < 10; i++) {
      const mk2 = `MAKEUP_ALIAS_PTC_D026_${i}`;
      const m2 = { record_key: mk2, entity_type: 'makeup', fields: {} };
      classified.push(makeClassified(mk2, 'makeup', 'MIGRATABLE'));
      sourceByKey.set(mk2, m2);
    }
    const result = evaluateD026Threshold(classified, sourceByKey);
    assert.equal(result.project_association_check.kepian_customer_pairs, 3);
    assert.equal(result.project_association_check.yangpian_model_pairs, 2);
    assert.equal(result.project_association_check.combined_pairs, 5);
    assert.equal(result.project_association_check.met, true);
    assert.equal(result.entity_type_correctness_check.actual_mismatches, 0);
    assert.equal(result.entity_type_correctness_check.met, true);
    assert.equal(result.all_thresholds_met, true);
    assert.match(result.judgement, /^PASS/);
  });

  // Scenario: 样片 projects pass even without any Customer link
  it('D-026 样片 projects pass association check without any Customer link (Customer optional)', () => {
    const classified = [];
    const sourceByKey = new Map();
    // 5 MIGRATABLE customers (still required for customer threshold >= 5)
    for (let i = 0; i < 5; i++) {
      const ck = `CUSTOMER_ALIAS_PTC_NO_CUST_${i}`;
      const c = makeCustomer(ck, {});
      classified.push(makeClassified(ck, 'customer', 'MIGRATABLE'));
      sourceByKey.set(ck, c);
    }
    // 10 MIGRATABLE models (D-026 threshold is 10)
    for (let i = 0; i < 10; i++) {
      const mk = `MODEL_ALIAS_PTC_NO_CUST_${i}`;
      const m = { record_key: mk, entity_type: 'model', fields: {} };
      classified.push(makeClassified(mk, 'model', 'MIGRATABLE'));
      sourceByKey.set(mk, m);
    }
    // 5 样片 projects, each linking to a Model, none linking to Customer
    for (let i = 0; i < 5; i++) {
      const mk = `MODEL_ALIAS_PTC_NO_CUST_${i}`;
      const pk = `PROJECT_ALIAS_PTC_NO_CUST_${i}`;
      const p = makeProject(pk, {
        project_type_raw: '创作',
        linked_customer_key: null, // no Customer link at all
        linked_model_key: mk,
      });
      classified.push(makeClassified(pk, 'project', 'MIGRATABLE'));
      sourceByKey.set(pk, p);
    }
    for (let i = 0; i < 10; i++) {
      const mk2 = `MAKEUP_ALIAS_PTC_NO_CUST_${i}`;
      const m2 = { record_key: mk2, entity_type: 'makeup', fields: {} };
      classified.push(makeClassified(mk2, 'makeup', 'MIGRATABLE'));
      sourceByKey.set(mk2, m2);
    }
    const result = evaluateD026Threshold(classified, sourceByKey);
    assert.equal(result.project_association_check.kepian_customer_pairs, 0);
    assert.equal(result.project_association_check.yangpian_model_pairs, 5);
    assert.equal(result.project_association_check.combined_pairs, 5);
    assert.equal(result.project_association_check.met, true);
    assert.equal(result.all_thresholds_met, true);
    assert.match(result.judgement, /^PASS/);
  });
});
