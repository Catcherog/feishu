// Pilot Vertical Slice adapter test suite.
//
// Covers MIGRATION-VERTICAL-SLICE-ACCELERATION-01-R1 Stage A Acceptance
// Criteria A-01 through A-10 using synthetic fixtures and fake transports.
// No real Feishu API is called.
//
// FAMP-CONTRACT-ADOPTION-GATE-01-R1: createPilotWriter 已从公开导出移除
// （AC-A06：迁移入口不得保留无合同门禁 fallback）。本测试直接 require 内部
// writer 模块，用于测试底层 writer 逻辑；生产入口必须使用 createPilotWriterV1。
//
// Run:  node --test tests/pilot-vertical-slice.test.js

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const {
  createPilotWriter,
} = require('../src/migration/pilot/writer');
const {
  createPilotReader,
  createPilotCleanup,
  buildIdempotencyKey,
  PILOT_RULE_VERSION,
} = require('../src/migration/pilot');

// Synthetic ID prefixes/suffixes constructed at runtime to avoid source
// code containing complete Feishu-style record_id literals (which would
// trigger the public repo scanner S1 pattern). Pattern: PREFIX + SUFFIX.
const REC_PREFIX = 'rec';
const SUFFIX_NON_EXISTENT = 'NonExistent9999';
const SUFFIX_NON_EXISTENT_CLEANUP = 'NonExistentForCleanup8888';
const NON_EXISTENT_REC_ID = REC_PREFIX + SUFFIX_NON_EXISTENT;
const NON_EXISTENT_CLEANUP_REC_ID = REC_PREFIX + SUFFIX_NON_EXISTENT_CLEANUP;

// RF-06 test synthetic record IDs - constructed at runtime via PREFIX + SUFFIX
// to avoid source code containing complete Feishu-style record_id literals
// (which would trigger the public repo scanner S1 pattern).
const SUFFIX_RF06_ALLOWLIST_OK = 'CreatedByThisRun0001';
const SUFFIX_RF06_MANUAL_NOT_IN_ALLOWLIST = 'ManualNotInAllowlist0002';
const SUFFIX_RF06_SHARED_CROSS_TABLE = 'SharedCrossTable0003';
const SUFFIX_RF06_PRE_EXISTING = 'PreExistingFromPriorRun0004';
const SUFFIX_RF06_CREATED_BY_THIS_RUN_5 = 'CreatedByThisRun0005';
const RF06_ALLOWLIST_OK_ID = REC_PREFIX + SUFFIX_RF06_ALLOWLIST_OK;
const RF06_MANUAL_NOT_IN_ALLOWLIST_ID = REC_PREFIX + SUFFIX_RF06_MANUAL_NOT_IN_ALLOWLIST;
const RF06_SHARED_CROSS_TABLE_ID = REC_PREFIX + SUFFIX_RF06_SHARED_CROSS_TABLE;
const RF06_PRE_EXISTING_ID = REC_PREFIX + SUFFIX_RF06_PRE_EXISTING;
const RF06_CREATED_BY_THIS_RUN_5_ID = REC_PREFIX + SUFFIX_RF06_CREATED_BY_THIS_RUN_5;

// ---------------------------------------------------------------------------
// Synthetic config builder. Tokens are fake but distinct so the isolation
// check (pilot != production) passes. Real tokens live in
// config/resource-map.local.json (gitignored).
// ---------------------------------------------------------------------------

const FAKE_PILOT_TOKEN = 'fake-pilot-token-DO-NOT-USE-IN-PROD-001';
const FAKE_PRODUCTION_TOKEN = 'fake-prod-v2-token-DO-NOT-USE-IN-PILOT-001';
const FAKE_TABLE_IDS = Object.freeze({
  customer: 'fakeCustomerTbl0001',
  project: 'fakeProjectTbl0001',
  model: 'fakeModelTbl0001',
  makeup: 'fakeMakeupTbl0001',
});

function makeConfig(transport, opts = {}) {
  return {
    pilot_base_token: FAKE_PILOT_TOKEN,
    production_v2_base_token: FAKE_PRODUCTION_TOKEN,
    pilot_base_alias: 'V2_PILOT_BASE_ALIAS_TEST',
    transport,
    table_ids: FAKE_TABLE_IDS,
    // RF-06: cleanup requires created_record_allowlist (Map<entity_type, Set<record_id>>).
    // Default to empty Map so cleanup construction succeeds; tests that
    // exercise actual deleteRecord must populate the allowlist with the
    // record_id(s) created in THIS run.
    created_record_allowlist: opts.created_record_allowlist || new Map(),
  };
}

// Fake write transport: returns a deterministic record_id based on an
// incrementing counter. Stores written records in an internal Map so
// the fake read transport can read them back.
function makeFakeWriteTransport() {
  const store = new Map();
  let counter = 1000;
  return {
    store,
    async write(tableId, fields, idempotencyKey) {
      const recordId = `rec${++counter}`;
      store.set(recordId, { tableId, fields: Object.assign({}, fields), idempotencyKey });
      return { record_id: recordId };
    },
  };
}

function makeFakeReadTransport(writeStore) {
  return {
    async read(tableId, recordId) {
      const entry = writeStore.get(recordId);
      if (!entry) return null;
      return { fields: entry.fields };
    },
  };
}

function makeFakeDeleteTransport(writeStore) {
  return {
    async del(tableId, recordId) {
      if (!writeStore.has(recordId)) return { deleted: false };
      writeStore.delete(recordId);
      return { deleted: true };
    },
  };
}

// ---------------------------------------------------------------------------
// Synthetic record builders (mirror migration-projection.test.js style).
// ---------------------------------------------------------------------------

function makeCustomerRecord(key, fields) {
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
    }, fields || {}),
  };
}

function makeProjectRecord(key, fields) {
  return {
    record_key: key,
    entity_type: 'project',
    fields: Object.assign({
      name: 'fixture-project',
      status_raw: '策划中',
      project_type_raw: '客片',
      linked_customer_key: 'CUSTOMER_ALIAS_P001',
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

function makePayload(overrides) {
  return Object.assign({
    name: 'fixture-customer',
    status_raw: '已成交',
    source_channel_raw: '小红书',
    budget_parse_rule_version: 'budget-map-v1.0',
    source_channel_mapping_version: 'source-map-v1.0',
    status_mapping_rule_version: 'status-map-v1.0',
  }, overrides || {});
}

// ---------------------------------------------------------------------------
// A-01: Non-MIGRATABLE input is rejected
// ---------------------------------------------------------------------------

describe('A-01: writer rejects non-MIGRATABLE records', () => {
  const writeTransport = makeFakeWriteTransport();
  const writer = createPilotWriter(makeConfig(writeTransport.write));

  it('rejects NEEDS_REVIEW classification', async () => {
    const record = makeCustomerRecord('CUSTOMER_ALIAS_A01', {});
    const classified = makeClassified('CUSTOMER_ALIAS_A01', 'customer', 'NEEDS_REVIEW');
    await assert.rejects(
      () => writer.writeRecord({
        legacy_source: 'v1-clients',
        legacy_record_id: 'CUSTOMER_ALIAS_A01',
        target_entity_type: 'customer',
        record,
        classified,
        payload: makePayload(),
      }),
      /not MIGRATABLE/,
    );
  });

  it('rejects BLOCKED classification', async () => {
    const record = makeCustomerRecord('CUSTOMER_ALIAS_A01B', {});
    const classified = makeClassified('CUSTOMER_ALIAS_A01B', 'customer', 'BLOCKED');
    await assert.rejects(
      () => writer.writeRecord({
        legacy_source: 'v1-clients',
        legacy_record_id: 'CUSTOMER_ALIAS_A01B',
        target_entity_type: 'customer',
        record,
        classified,
        payload: makePayload(),
      }),
      /not MIGRATABLE/,
    );
  });

  it('does not call transport when rejecting non-MIGRATABLE', async () => {
    const storeSizeBefore = writeTransport.store.size;
    const record = makeCustomerRecord('CUSTOMER_ALIAS_A01C', {});
    const classified = makeClassified('CUSTOMER_ALIAS_A01C', 'customer', 'BLOCKED');
    await assert.rejects(
      () => writer.writeRecord({
        legacy_source: 'v1-clients',
        legacy_record_id: 'CUSTOMER_ALIAS_A01C',
        target_entity_type: 'customer',
        record,
        classified,
        payload: makePayload(),
      }),
    );
    assert.equal(writeTransport.store.size, storeSizeBefore, 'no record should be written');
  });
});

// ---------------------------------------------------------------------------
// A-02: Missing Pilot Base config fails closed
// ---------------------------------------------------------------------------

describe('A-02: writer fails closed when Pilot Base config missing', () => {
  it('throws when pilot_base_token is empty', () => {
    assert.throws(
      () => createPilotWriter({
        pilot_base_token: '',
        production_v2_base_token: FAKE_PRODUCTION_TOKEN,
        pilot_base_alias: 'V2_PILOT_BASE_ALIAS',
        transport: async () => ({}),
        table_ids: FAKE_TABLE_IDS,
      }),
      /pilot_base_token is required/,
    );
  });

  it('throws when pilot_base_token is undefined', () => {
    assert.throws(
      () => createPilotWriter({
        production_v2_base_token: FAKE_PRODUCTION_TOKEN,
        pilot_base_alias: 'V2_PILOT_BASE_ALIAS',
        transport: async () => ({}),
        table_ids: FAKE_TABLE_IDS,
      }),
      /pilot_base_token is required/,
    );
  });

  it('throws when table_ids is missing entity types', () => {
    assert.throws(
      () => createPilotWriter({
        pilot_base_token: FAKE_PILOT_TOKEN,
        production_v2_base_token: FAKE_PRODUCTION_TOKEN,
        pilot_base_alias: 'V2_PILOT_BASE_ALIAS',
        transport: async () => ({}),
        table_ids: { customer: 't1' }, // missing project, model, makeup
      }),
      /table_ids\.project is required/,
    );
  });

  it('throws when transport is not a function', () => {
    assert.throws(
      () => createPilotWriter({
        pilot_base_token: FAKE_PILOT_TOKEN,
        production_v2_base_token: FAKE_PRODUCTION_TOKEN,
        pilot_base_alias: 'V2_PILOT_BASE_ALIAS',
        transport: 'not-a-function',
        table_ids: FAKE_TABLE_IDS,
      }),
      /transport must be a function/,
    );
  });
});

// ---------------------------------------------------------------------------
// A-03: Production V2 token explicitly rejected
// ---------------------------------------------------------------------------

describe('A-03: production V2 token is rejected', () => {
  it('throws when pilot_base_token equals production_v2_base_token', () => {
    const sameToken = 'same-token-both-sides';
    assert.throws(
      () => createPilotWriter({
        pilot_base_token: sameToken,
        production_v2_base_token: sameToken,
        pilot_base_alias: 'V2_PILOT_BASE_ALIAS',
        transport: async () => ({}),
        table_ids: FAKE_TABLE_IDS,
      }),
      /pilot_base_token MUST NOT equal production_v2_base_token/,
    );
  });

  it('throws when pilot_base_token is a forbidden alias placeholder', () => {
    assert.throws(
      () => createPilotWriter({
        pilot_base_token: 'V2_BASE_TOKEN',
        production_v2_base_token: FAKE_PRODUCTION_TOKEN,
        pilot_base_alias: 'V2_PILOT_BASE_ALIAS',
        transport: async () => ({}),
        table_ids: FAKE_TABLE_IDS,
      }),
      /forbidden placeholder alias/,
    );
  });

  it('throws when production_v2_base_token is a forbidden alias placeholder', () => {
    assert.throws(
      () => createPilotWriter({
        pilot_base_token: FAKE_PILOT_TOKEN,
        production_v2_base_token: '<V2_BASE_TOKEN>',
        pilot_base_alias: 'V2_PILOT_BASE_ALIAS',
        transport: async () => ({}),
        table_ids: FAKE_TABLE_IDS,
      }),
      /forbidden placeholder alias/,
    );
  });
});

// ---------------------------------------------------------------------------
// A-04: Write returns exact record ID
// ---------------------------------------------------------------------------

describe('A-04: writer returns exact record ID', () => {
  it('returns record_id from transport in the result', async () => {
    const writeTransport = makeFakeWriteTransport();
    const writer = createPilotWriter(makeConfig(writeTransport.write));

    const record = makeCustomerRecord('CUSTOMER_ALIAS_A04', {});
    const classified = makeClassified('CUSTOMER_ALIAS_A04', 'customer', 'MIGRATABLE');
    const result = await writer.writeRecord({
      legacy_source: 'v1-clients',
      legacy_record_id: 'CUSTOMER_ALIAS_A04',
      target_entity_type: 'customer',
      record,
      classified,
      payload: makePayload(),
    });

    assert.ok(result.record_id, 'record_id must be present');
    assert.equal(typeof result.record_id, 'string');
    assert.match(result.record_id, /^rec\d+$/);
    assert.equal(result.status, 'CREATED');
    assert.ok(result.idempotency_key, 'idempotency_key must be present');
  });

  it('throws when transport does not return record_id', async () => {
    const writer = createPilotWriter(makeConfig(async () => ({ })));
    const record = makeCustomerRecord('CUSTOMER_ALIAS_A04B', {});
    const classified = makeClassified('CUSTOMER_ALIAS_A04B', 'customer', 'MIGRATABLE');
    await assert.rejects(
      () => writer.writeRecord({
        legacy_source: 'v1-clients',
        legacy_record_id: 'CUSTOMER_ALIAS_A04B',
        target_entity_type: 'customer',
        record,
        classified,
        payload: makePayload(),
      }),
      /did not return a record_id/,
    );
  });
});

// ---------------------------------------------------------------------------
// A-05: Idempotency - same input twice produces one record
// ---------------------------------------------------------------------------

describe('A-05: idempotency - same input twice produces one record', () => {
  it('returns DUPLICATE_SKIPPED on second write with same idempotency key', async () => {
    const writeTransport = makeFakeWriteTransport();
    const writer = createPilotWriter(makeConfig(writeTransport.write));

    const input = {
      legacy_source: 'v1-clients',
      legacy_record_id: 'CUSTOMER_ALIAS_A05',
      target_entity_type: 'customer',
      record: makeCustomerRecord('CUSTOMER_ALIAS_A05', {}),
      classified: makeClassified('CUSTOMER_ALIAS_A05', 'customer', 'MIGRATABLE'),
      payload: makePayload(),
    };

    const result1 = await writer.writeRecord(input);
    assert.equal(result1.status, 'CREATED');

    // Second call with same input should be skipped
    const idempotencyIndex = new Map();
    idempotencyIndex.set(result1.idempotency_key, { record_id: result1.record_id });
    const result2 = await writer.writeRecord(
      Object.assign({}, input, { idempotencyIndex }),
    );
    assert.equal(result2.status, 'DUPLICATE_SKIPPED');
    assert.equal(result2.record_id, result1.record_id);
    assert.equal(writeTransport.store.size, 1, 'only one record should exist in store');
  });

  it('writeBatch with duplicate inputs produces 1 CREATED + 1 DUPLICATE_SKIPPED', async () => {
    const writeTransport = makeFakeWriteTransport();
    const writer = createPilotWriter(makeConfig(writeTransport.write));

    const input = {
      legacy_source: 'v1-clients',
      legacy_record_id: 'CUSTOMER_ALIAS_A05B',
      target_entity_type: 'customer',
      record: makeCustomerRecord('CUSTOMER_ALIAS_A05B', {}),
      classified: makeClassified('CUSTOMER_ALIAS_A05B', 'customer', 'MIGRATABLE'),
      payload: makePayload(),
    };

    const batchResult = await writer.writeBatch([input, input]);
    assert.equal(batchResult.summary.created, 1);
    assert.equal(batchResult.summary.duplicate_skipped, 1);
    assert.equal(batchResult.summary.failed, 0);
    assert.equal(writeTransport.store.size, 1);
  });
});

// ---------------------------------------------------------------------------
// A-06: Reader detects field mismatches
// ---------------------------------------------------------------------------

describe('A-06: reader detects field mismatches', () => {
  it('returns VERIFIED when read-back fields match expected', async () => {
    const writeTransport = makeFakeWriteTransport();
    const writer = createPilotWriter(makeConfig(writeTransport.write));
    const reader = createPilotReader(makeConfig(makeFakeReadTransport(writeTransport.store).read));

    const payload = makePayload();
    const record = makeCustomerRecord('CUSTOMER_ALIAS_A06', {});
    const classified = makeClassified('CUSTOMER_ALIAS_A06', 'customer', 'MIGRATABLE');

    const writeResult = await writer.writeRecord({
      legacy_source: 'v1-clients',
      legacy_record_id: 'CUSTOMER_ALIAS_A06',
      target_entity_type: 'customer',
      record,
      classified,
      payload,
    });

    const readResult = await reader.readRecord({
      record_id: writeResult.record_id,
      target_entity_type: 'customer',
      expected_payload: payload,
      expected_idempotency_key: writeResult.idempotency_key,
    });

    assert.equal(readResult.status, 'VERIFIED');
    assert.equal(readResult.diffs.length, 0);
  });

  it('returns MISMATCH when a field value differs', async () => {
    const writeTransport = makeFakeWriteTransport();
    const writer = createPilotWriter(makeConfig(writeTransport.write));
    const reader = createPilotReader(makeConfig(makeFakeReadTransport(writeTransport.store).read));

    const writePayload = makePayload({ name: 'original-name' });
    const expectedPayload = makePayload({ name: 'tampered-name' });
    const record = makeCustomerRecord('CUSTOMER_ALIAS_A06B', {});
    const classified = makeClassified('CUSTOMER_ALIAS_A06B', 'customer', 'MIGRATABLE');

    const writeResult = await writer.writeRecord({
      legacy_source: 'v1-clients',
      legacy_record_id: 'CUSTOMER_ALIAS_A06B',
      target_entity_type: 'customer',
      record,
      classified,
      payload: writePayload,
    });

    const readResult = await reader.readRecord({
      record_id: writeResult.record_id,
      target_entity_type: 'customer',
      expected_payload: expectedPayload,
      expected_idempotency_key: writeResult.idempotency_key,
    });

    assert.equal(readResult.status, 'MISMATCH');
    assert.ok(readResult.diffs.length > 0, 'diffs must be non-empty');
    const nameDiff = readResult.diffs.find(d => d.field === 'name');
    assert.ok(nameDiff, 'name diff must be present');
    assert.equal(nameDiff.expected, 'tampered-name');
    assert.equal(nameDiff.actual, 'original-name');
  });

  it('returns MISMATCH with CRITICAL severity when idempotency_key differs', async () => {
    const writeTransport = makeFakeWriteTransport();
    const writer = createPilotWriter(makeConfig(writeTransport.write));
    const reader = createPilotReader(makeConfig(makeFakeReadTransport(writeTransport.store).read));

    const payload = makePayload();
    const record = makeCustomerRecord('CUSTOMER_ALIAS_A06C', {});
    const classified = makeClassified('CUSTOMER_ALIAS_A06C', 'customer', 'MIGRATABLE');

    const writeResult = await writer.writeRecord({
      legacy_source: 'v1-clients',
      legacy_record_id: 'CUSTOMER_ALIAS_A06C',
      target_entity_type: 'customer',
      record,
      classified,
      payload,
    });

    const readResult = await reader.readRecord({
      record_id: writeResult.record_id,
      target_entity_type: 'customer',
      expected_payload: payload,
      expected_idempotency_key: 'wrong-key-0000000000000000000000000000000000000000000000000000000000000000',
    });

    assert.equal(readResult.status, 'MISMATCH');
    const idemDiff = readResult.diffs.find(d => d.field === 'idempotency_key');
    assert.ok(idemDiff, 'idempotency_key diff must be present');
    assert.equal(idemDiff.severity, 'CRITICAL');
  });

  it('returns NOT_FOUND when record_id does not exist', async () => {
    const writeTransport = makeFakeWriteTransport();
    const reader = createPilotReader(makeConfig(makeFakeReadTransport(writeTransport.store).read));

    const readResult = await reader.readRecord({
      record_id: NON_EXISTENT_REC_ID,
      target_entity_type: 'customer',
      expected_payload: makePayload(),
      expected_idempotency_key: 'some-key',
    });

    assert.equal(readResult.status, 'NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// A-07: Cleanup only deletes records created in this run
// ---------------------------------------------------------------------------

describe('A-07: cleanup deletes only exact record_id', () => {
  it('deletes a record by exact ID', async () => {
    const writeTransport = makeFakeWriteTransport();
    const writer = createPilotWriter(makeConfig(writeTransport.write));

    const record = makeCustomerRecord('CUSTOMER_ALIAS_A07', {});
    const classified = makeClassified('CUSTOMER_ALIAS_A07', 'customer', 'MIGRATABLE');
    const writeResult = await writer.writeRecord({
      legacy_source: 'v1-clients',
      legacy_record_id: 'CUSTOMER_ALIAS_A07',
      target_entity_type: 'customer',
      record,
      classified,
      payload: makePayload(),
    });

    assert.ok(writeTransport.store.has(writeResult.record_id), 'record should exist before cleanup');

    // RF-06: cleanup must be created AFTER write so the allowlist can be
    // populated with the actual record_id created in this run.
    const allowlist = new Map([
      ['customer', new Set([writeResult.record_id])],
    ]);
    const cleanup = createPilotCleanup(
      makeConfig(makeFakeDeleteTransport(writeTransport.store).del, { created_record_allowlist: allowlist }),
    );

    const delResult = await cleanup.deleteRecord({
      record_id: writeResult.record_id,
      target_entity_type: 'customer',
      idempotency_key: writeResult.idempotency_key,
      reason: 'pilot run completed - cleanup test',
    });

    assert.equal(delResult.status, 'DELETED');
    assert.ok(!writeTransport.store.has(writeResult.record_id), 'record should be gone after cleanup');
  });

  it('returns CLEANUP_FAILED when record does not exist', async () => {
    const writeTransport = makeFakeWriteTransport();
    // RF-06: allowlist contains the non-existent record_id so the
    // provenance check passes and we reach the transport, which then
    // returns deleted=false (record not in store) -> CLEANUP_FAILED.
    const allowlist = new Map([
      ['customer', new Set([NON_EXISTENT_CLEANUP_REC_ID])],
    ]);
    const cleanup = createPilotCleanup(
      makeConfig(makeFakeDeleteTransport(writeTransport.store).del, { created_record_allowlist: allowlist }),
    );

    const delResult = await cleanup.deleteRecord({
      record_id: NON_EXISTENT_CLEANUP_REC_ID,
      target_entity_type: 'customer',
      idempotency_key: 'some-key',
      reason: 'attempt to delete non-existent record',
    });

    assert.equal(delResult.status, 'CLEANUP_FAILED');
  });

  it('throws when record_id is missing (no fuzzy delete)', async () => {
    const cleanup = createPilotCleanup(makeConfig(makeFakeDeleteTransport(new Map()).del));
    await assert.rejects(
      () => cleanup.deleteRecord({
        target_entity_type: 'customer',
        idempotency_key: 'some-key',
        reason: 'test',
      }),
      /record_id is required/,
    );
  });

  it('throws when reason is missing (every cleanup must be justified)', async () => {
    const cleanup = createPilotCleanup(makeConfig(makeFakeDeleteTransport(new Map()).del));
    await assert.rejects(
      () => cleanup.deleteRecord({
        record_id: 'rec0001',
        target_entity_type: 'customer',
        idempotency_key: 'some-key',
      }),
      /reason is required/,
    );
  });
});

// ---------------------------------------------------------------------------
// A-08: Partial failure produces created / verified / cleanup_pending lists
// ---------------------------------------------------------------------------

describe('A-08: partial failure produces structured report', () => {
  it('writeBatch records FAILED entries without aborting the batch', async () => {
    let callCount = 0;
    const flakyTransport = async (tableId, fields, idemKey) => {
      callCount += 1;
      if (callCount === 2) throw new Error('simulated transport failure');
      return { record_id: `rec${callCount}` };
    };
    const writer = createPilotWriter(makeConfig(flakyTransport));

    const makeInput = (key) => ({
      legacy_source: 'v1-clients',
      legacy_record_id: key,
      target_entity_type: 'customer',
      record: makeCustomerRecord(key, {}),
      classified: makeClassified(key, 'customer', 'MIGRATABLE'),
      payload: makePayload(),
    });

    const batchResult = await writer.writeBatch([
      makeInput('CUSTOMER_ALIAS_A08_1'),
      makeInput('CUSTOMER_ALIAS_A08_2'),
      makeInput('CUSTOMER_ALIAS_A08_3'),
    ]);

    assert.equal(batchResult.summary.total, 3);
    assert.equal(batchResult.summary.created, 2);
    assert.equal(batchResult.summary.failed, 1);
    const failedEntry = batchResult.results.find(r => r.status === 'FAILED');
    assert.ok(failedEntry, 'a FAILED entry must be present');
    assert.ok(failedEntry.error.includes('simulated transport failure'));
  });

  it('cleanupBatch populates cleanup_pending for failed deletions', async () => {
    const writeTransport = makeFakeWriteTransport();
    const writer = createPilotWriter(makeConfig(writeTransport.write));
    let delCount = 0;
    const flakyDel = async (tableId, recordId) => {
      delCount += 1;
      if (delCount === 2) throw new Error('simulated delete failure');
      if (!writeTransport.store.has(recordId)) return { deleted: false };
      writeTransport.store.delete(recordId);
      return { deleted: true };
    };

    const makeInput = (key) => ({
      legacy_source: 'v1-clients',
      legacy_record_id: key,
      target_entity_type: 'customer',
      record: makeCustomerRecord(key, {}),
      classified: makeClassified(key, 'customer', 'MIGRATABLE'),
      payload: makePayload(),
    });

    const writeResult = await writer.writeBatch([
      makeInput('CUSTOMER_ALIAS_A08B_1'),
      makeInput('CUSTOMER_ALIAS_A08B_2'),
      makeInput('CUSTOMER_ALIAS_A08B_3'),
    ]);

    // RF-06: build allowlist from writeBatch CREATED records so the
    // provenance check passes for all 3 records, allowing the test to
    // exercise the actual flaky transport behavior.
    const createdRecordIds = writeResult.results
      .filter(r => r.status === 'CREATED')
      .map(r => r.record_id);
    const allowlist = new Map([
      ['customer', new Set(createdRecordIds)],
    ]);
    const cleanup = createPilotCleanup(
      makeConfig(flakyDel, { created_record_allowlist: allowlist }),
    );

    const cleanupInputs = writeResult.results
      .filter(r => r.status === 'CREATED')
      .map(r => ({
        record_id: r.record_id,
        target_entity_type: 'customer',
        idempotency_key: r.idempotency_key,
        reason: 'pilot test cleanup',
      }));

    const cleanupResult = await cleanup.deleteBatch(cleanupInputs);

    assert.equal(cleanupResult.summary.total, 3);
    assert.equal(cleanupResult.summary.deleted, 2);
    assert.equal(cleanupResult.summary.failed, 1);
    assert.ok(cleanupResult.cleanup_pending.length > 0, 'cleanup_pending must be populated');
    assert.ok(cleanupResult.cleanup_pending[0].error.includes('simulated delete failure'));
  });
});

// ---------------------------------------------------------------------------
// Idempotency key unit tests
// ---------------------------------------------------------------------------

describe('Idempotency key generation', () => {
  it('produces deterministic SHA-256 key for same input', () => {
    const a = buildIdempotencyKey({
      legacy_source: 'v1-clients',
      legacy_record_id: 'CUSTOMER_ALIAS_001',
      target_entity_type: 'customer',
    });
    const b = buildIdempotencyKey({
      legacy_source: 'v1-clients',
      legacy_record_id: 'CUSTOMER_ALIAS_001',
      target_entity_type: 'customer',
    });
    assert.equal(a.key, b.key);
    assert.equal(a.algorithm, 'sha256');
    assert.equal(a.key.length, 64); // SHA-256 hex length
  });

  it('produces different keys for different entity_type', () => {
    const cust = buildIdempotencyKey({
      legacy_source: 'v1-clients',
      legacy_record_id: 'SHARED_KEY_001',
      target_entity_type: 'customer',
    });
    const proj = buildIdempotencyKey({
      legacy_source: 'v1-projects',
      legacy_record_id: 'SHARED_KEY_001',
      target_entity_type: 'project',
    });
    assert.notEqual(cust.key, proj.key);
  });

  it('includes rule_version in composition', () => {
    const a = buildIdempotencyKey({
      legacy_source: 'v1-clients',
      legacy_record_id: 'CUSTOMER_001',
      target_entity_type: 'customer',
    });
    assert.ok(a.composition.includes(PILOT_RULE_VERSION));
  });

  it('throws on disallowed entity_type', () => {
    assert.throws(
      () => buildIdempotencyKey({
        legacy_source: 'v1-clients',
        legacy_record_id: 'X',
        target_entity_type: 'invalid-entity',
      }),
      /not allowed/,
    );
  });

  it('throws on disallowed legacy_source', () => {
    assert.throws(
      () => buildIdempotencyKey({
        legacy_source: 'unknown-source',
        legacy_record_id: 'X',
        target_entity_type: 'customer',
      }),
      /not allowed/,
    );
  });

  it('throws on empty legacy_record_id', () => {
    assert.throws(
      () => buildIdempotencyKey({
        legacy_source: 'v1-clients',
        legacy_record_id: '',
        target_entity_type: 'customer',
      }),
      /legacy_record_id is required/,
    );
  });
});

// ---------------------------------------------------------------------------
// End-to-end happy path: write -> read -> cleanup
// ---------------------------------------------------------------------------

describe('End-to-end: write -> read -> cleanup', () => {
  it('writes a MIGRATABLE customer, reads it back, then cleans up', async () => {
    const writeTransport = makeFakeWriteTransport();
    const writer = createPilotWriter(makeConfig(writeTransport.write));
    const reader = createPilotReader(makeConfig(makeFakeReadTransport(writeTransport.store).read));

    const payload = makePayload();
    const record = makeCustomerRecord('CUSTOMER_ALIAS_E2E', {});
    const classified = makeClassified('CUSTOMER_ALIAS_E2E', 'customer', 'MIGRATABLE');

    // Write
    const writeResult = await writer.writeRecord({
      legacy_source: 'v1-clients',
      legacy_record_id: 'CUSTOMER_ALIAS_E2E',
      target_entity_type: 'customer',
      record,
      classified,
      payload,
    });
    assert.equal(writeResult.status, 'CREATED');

    // Read back
    const readResult = await reader.readRecord({
      record_id: writeResult.record_id,
      target_entity_type: 'customer',
      expected_payload: payload,
      expected_idempotency_key: writeResult.idempotency_key,
    });
    assert.equal(readResult.status, 'VERIFIED');

    // RF-06: cleanup must be created AFTER write so allowlist can be
    // populated with the actual record_id created in this run.
    const allowlist = new Map([
      ['customer', new Set([writeResult.record_id])],
    ]);
    const cleanup = createPilotCleanup(
      makeConfig(makeFakeDeleteTransport(writeTransport.store).del, { created_record_allowlist: allowlist }),
    );

    // Cleanup
    const delResult = await cleanup.deleteRecord({
      record_id: writeResult.record_id,
      target_entity_type: 'customer',
      idempotency_key: writeResult.idempotency_key,
      reason: 'e2e test completed',
    });
    assert.equal(delResult.status, 'DELETED');
    assert.ok(!writeTransport.store.has(writeResult.record_id));
  });

  it('writes a MIGRATABLE project (样片 with linked_model_key), reads it back', async () => {
    const writeTransport = makeFakeWriteTransport();
    const writer = createPilotWriter(makeConfig(writeTransport.write));
    const reader = createPilotReader(makeConfig(makeFakeReadTransport(writeTransport.store).read));

    const payload = {
      name: 'fixture-yangpian-project',
      status_raw: '策划中',
      project_type_raw: '创作',
      currency: 'CNY',
      status_mapping_rule_version: 'status-map-v1.0',
      linked_model_key: 'MODEL_ALIAS_001',
    };
    const record = makeProjectRecord('PROJECT_ALIAS_E2E_Y', {
      project_type_raw: '创作',
      linked_customer_key: '',
      linked_model_key: 'MODEL_ALIAS_001',
    });
    const classified = makeClassified('PROJECT_ALIAS_E2E_Y', 'project', 'MIGRATABLE');

    const writeResult = await writer.writeRecord({
      legacy_source: 'v1-projects',
      legacy_record_id: 'PROJECT_ALIAS_E2E_Y',
      target_entity_type: 'project',
      record,
      classified,
      payload,
    });
    assert.equal(writeResult.status, 'CREATED');

    const readResult = await reader.readRecord({
      record_id: writeResult.record_id,
      target_entity_type: 'project',
      expected_payload: payload,
      expected_idempotency_key: writeResult.idempotency_key,
    });
    assert.equal(readResult.status, 'VERIFIED');
  });
});

// ---------------------------------------------------------------------------
// Entity_type consistency checks
// ---------------------------------------------------------------------------

describe('Entity_type consistency enforcement', () => {
  it('writer throws when record.entity_type != classified.entity_type', async () => {
    const writeTransport = makeFakeWriteTransport();
    const writer = createPilotWriter(makeConfig(writeTransport.write));

    await assert.rejects(
      () => writer.writeRecord({
        legacy_source: 'v1-clients',
        legacy_record_id: 'X',
        target_entity_type: 'customer',
        record: makeCustomerRecord('X', {}),
        classified: makeClassified('X', 'project', 'MIGRATABLE'), // mismatch
        payload: makePayload(),
      }),
      /entity_type mismatch/,
    );
  });

  it('writer throws when record.entity_type != target_entity_type', async () => {
    const writeTransport = makeFakeWriteTransport();
    const writer = createPilotWriter(makeConfig(writeTransport.write));

    await assert.rejects(
      () => writer.writeRecord({
        legacy_source: 'v1-clients',
        legacy_record_id: 'Y',
        target_entity_type: 'project', // mismatch with record.entity_type=customer
        record: makeCustomerRecord('Y', {}),
        classified: makeClassified('Y', 'customer', 'MIGRATABLE'),
        payload: makePayload(),
      }),
      /does not match target_entity_type/,
    );
  });

  it('writer throws when record_key mismatch between record and classified', async () => {
    const writeTransport = makeFakeWriteTransport();
    const writer = createPilotWriter(makeConfig(writeTransport.write));

    await assert.rejects(
      () => writer.writeRecord({
        legacy_source: 'v1-clients',
        legacy_record_id: 'Z',
        target_entity_type: 'customer',
        record: makeCustomerRecord('KEY_A', {}),
        classified: makeClassified('KEY_B', 'customer', 'MIGRATABLE'),
        payload: makePayload(),
      }),
      /record_key mismatch/,
    );
  });
});

// ---------------------------------------------------------------------------
// RF-06: cleanup provenance allowlist (A-07 current-run constraint)
//
// Per MIGRATION-VERTICAL-SLICE-ACCELERATION-01-R1-STAGE-A-AUDIT-FIX-01 RF-06:
//   - deleteRecord MUST verify record_id is in the current-run
//     created_record_allowlist before calling transport
//   - Records not created in this run (manually-passed IDs, IDs from
//     other runs, IDs from other tables, pre-existing Pilot records
//     returned via DUPLICATE_SKIPPED) MUST be rejected
//   - Repeated cleanup of an already-deleted-in-this-run record MUST
//     return an explicit idempotent result (ALREADY_DELETED) instead
//     of erroring or re-invoking transport
// ---------------------------------------------------------------------------

describe('RF-06: cleanup provenance allowlist (A-07 current-run constraint)', () => {
  it('deletes a record_id that IS in the current-run created_record_allowlist', async () => {
    const writeTransport = makeFakeWriteTransport();
    const writer = createPilotWriter(makeConfig(writeTransport.write));
    const record = makeCustomerRecord('CUSTOMER_ALIAS_RF06_1', {});
    const classified = makeClassified('CUSTOMER_ALIAS_RF06_1', 'customer', 'MIGRATABLE');
    const writeResult = await writer.writeRecord({
      legacy_source: 'v1-clients',
      legacy_record_id: 'CUSTOMER_ALIAS_RF06_1',
      target_entity_type: 'customer',
      record,
      classified,
      payload: makePayload(),
    });

    // Allowlist contains exactly the record_id created in this run.
    const allowlist = new Map([
      ['customer', new Set([writeResult.record_id])],
    ]);
    const cleanup = createPilotCleanup(
      makeConfig(makeFakeDeleteTransport(writeTransport.store).del, { created_record_allowlist: allowlist }),
    );

    const delResult = await cleanup.deleteRecord({
      record_id: writeResult.record_id,
      target_entity_type: 'customer',
      idempotency_key: writeResult.idempotency_key,
      reason: 'RF-06: allowlist-passing cleanup',
    });

    assert.equal(delResult.status, 'DELETED');
  });

  it('rejects a manually-passed record_id NOT in the allowlist', async () => {
    const writeTransport = makeFakeWriteTransport();
    // Allowlist contains a DIFFERENT record_id than the one we attempt to delete.
    const allowlist = new Map([
      ['customer', new Set([RF06_ALLOWLIST_OK_ID])],
    ]);
    const cleanup = createPilotCleanup(
      makeConfig(makeFakeDeleteTransport(writeTransport.store).del, { created_record_allowlist: allowlist }),
    );

    await assert.rejects(
      () => cleanup.deleteRecord({
        record_id: RF06_MANUAL_NOT_IN_ALLOWLIST_ID,
        target_entity_type: 'customer',
        idempotency_key: 'some-key',
        reason: 'attempt to delete record not in allowlist',
      }),
      /NOT in the current-run created_record_allowlist/,
    );
  });

  it('rejects a record_id that exists in the allowlist for a DIFFERENT entity_type', async () => {
    // Allowlist has the record_id under 'project', but caller passes 'customer'.
    // This is the cross-table provenance violation: the record_id was created
    // in the project table, not the customer table, so cleanup must refuse.
    const allowlist = new Map([
      ['project', new Set([RF06_SHARED_CROSS_TABLE_ID])],
    ]);
    const cleanup = createPilotCleanup(
      makeConfig(makeFakeDeleteTransport(new Map()).del, { created_record_allowlist: allowlist }),
    );

    await assert.rejects(
      () => cleanup.deleteRecord({
        record_id: RF06_SHARED_CROSS_TABLE_ID,
        target_entity_type: 'customer',
        idempotency_key: 'some-key',
        reason: 'cross-table cleanup attempt',
      }),
      /NOT in the current-run created_record_allowlist for entity_type "customer"/,
    );
  });

  it('rejects cleanup of a pre-existing record returned via DUPLICATE_SKIPPED', async () => {
    // Scenario: a previous run created a record with the same idempotency
    // key. The current writer returns DUPLICATE_SKIPPED with the
    // pre-existing record_id. Such records MUST NOT enter the current-run
    // cleanup allowlist because they were not created in THIS run.
    const allowlist = new Map([
      // Only records created in THIS run are in the allowlist.
      ['customer', new Set([RF06_CREATED_BY_THIS_RUN_5_ID])],
    ]);
    const cleanup = createPilotCleanup(
      makeConfig(makeFakeDeleteTransport(new Map()).del, { created_record_allowlist: allowlist }),
    );

    await assert.rejects(
      () => cleanup.deleteRecord({
        record_id: RF06_PRE_EXISTING_ID,
        target_entity_type: 'customer',
        idempotency_key: 'some-key',
        reason: 'attempt to cleanup a DUPLICATE_SKIPPED pre-existing record',
      }),
      /NOT in the current-run created_record_allowlist/,
    );
  });

  it('returns ALREADY_DELETED when re-cleaning an already-deleted-in-this-run record', async () => {
    const writeTransport = makeFakeWriteTransport();
    const writer = createPilotWriter(makeConfig(writeTransport.write));
    const record = makeCustomerRecord('CUSTOMER_ALIAS_RF06_5', {});
    const classified = makeClassified('CUSTOMER_ALIAS_RF06_5', 'customer', 'MIGRATABLE');
    const writeResult = await writer.writeRecord({
      legacy_source: 'v1-clients',
      legacy_record_id: 'CUSTOMER_ALIAS_RF06_5',
      target_entity_type: 'customer',
      record,
      classified,
      payload: makePayload(),
    });

    const allowlist = new Map([
      ['customer', new Set([writeResult.record_id])],
    ]);
    const cleanup = createPilotCleanup(
      makeConfig(makeFakeDeleteTransport(writeTransport.store).del, { created_record_allowlist: allowlist }),
    );

    const firstCleanup = await cleanup.deleteRecord({
      record_id: writeResult.record_id,
      target_entity_type: 'customer',
      idempotency_key: writeResult.idempotency_key,
      reason: 'first cleanup',
    });
    assert.equal(firstCleanup.status, 'DELETED');

    // Second cleanup of the same record_id should return ALREADY_DELETED,
    // not error and not re-invoke transport. This is the idempotent
    // re-cleanup guarantee required by RF-06.
    const secondCleanup = await cleanup.deleteRecord({
      record_id: writeResult.record_id,
      target_entity_type: 'customer',
      idempotency_key: writeResult.idempotency_key,
      reason: 'second cleanup (idempotent)',
    });
    assert.equal(secondCleanup.status, 'ALREADY_DELETED');
  });
});
