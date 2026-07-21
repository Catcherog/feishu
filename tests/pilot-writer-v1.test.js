// Pilot Writer V1 — Contract Adoption Decorator Test Suite
//
// FAMP-INTEGRATION-CONTRACT-01 Task 3 / AC-10 Adoption Gate
// 验证 Candidate V1 合同被 SOP 迁移入口（pilot-writer-v1.js）实际引用。
//
// 测试矩阵（CONTRACTS.md 第 7 节）：
//   1. guard 通过：合法 V1 → 原 writer 被调用
//   2. guard 拒绝非 v1：schema_version=v99 → CandidateValidationError + 原 writer 未被调用
//   3. guard 缺失子字段 fail closed：processing 缺 ocr_version → CandidateValidationError + 原 writer 未被调用
//   4. guard 失败时 pilot writer 未被调用：transport 调用次数为 0
//
// Run:  node --test tests/pilot-writer-v1.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  createPilotWriterV1,
  PILOT_WRITER_V1_VERSION,
} = require('../src/migration/pilot/pilot-writer-v1');

// ESM 合同懒加载（用于断言 CandidateValidationError 类型）
let _contracts = null;
async function loadContracts() {
  if (!_contracts) {
    // 路径：feishu-v2/tests/ → SOP/src/contracts/candidate-v1.js
    // 上溯 2 级到 SOP/，再进入 src/contracts/
    const mod = await import('../../src/contracts/candidate-v1.js');
    _contracts = mod;
  }
  return _contracts;
}

// ---------------------------------------------------------------------------
// Fake transport：记录调用次数，返回确定性 record_id
// ---------------------------------------------------------------------------

function makeFakeTransport() {
  const calls = [];
  const fn = async (tableId, fields, idempotencyKey) => {
    calls.push({ tableId, fields, idempotencyKey });
    return { record_id: `recFake${1000 + calls.length}` };
  };
  return { calls, fn };
}

// ---------------------------------------------------------------------------
// Fake config：使用占位 token（与原 pilot 测试一致，避免真实飞书标识）
// ---------------------------------------------------------------------------

const FAKE_PILOT_TOKEN = 'fake-pilot-token-DO-NOT-USE-IN-PROD-001';
const FAKE_PRODUCTION_TOKEN = 'fake-prod-v2-token-DO-NOT-USE-IN-PILOT-001';
const FAKE_TABLE_IDS = Object.freeze({
  customer: 'fakeCustomerTbl0001',
  project: 'fakeProjectTbl0001',
  model: 'fakeModelTbl0001',
  makeup: 'fakeMakeupTbl0001',
});

function makeConfig(transport) {
  return {
    pilot_base_token: FAKE_PILOT_TOKEN,
    production_v2_base_token: FAKE_PRODUCTION_TOKEN,
    pilot_base_alias: 'V2_PILOT_BASE_ALIAS_TEST',
    transport,
    table_ids: FAKE_TABLE_IDS,
  };
}

// ---------------------------------------------------------------------------
// Valid writeRecord input（与原 pilot 测试结构一致）
// ---------------------------------------------------------------------------

function makeValidWriteInput() {
  return {
    // legacy_source 必须为 idempotency.js 允许的枚举值
    legacy_source: 'v1-projects',
    legacy_record_id: 'recLegacyDemo001',
    target_entity_type: 'project',
    record: {
      record_key: 'recLegacyDemo001',
      entity_type: 'project',
      fields: { project_name: 'demo_project' },
    },
    classified: {
      record_key: 'recLegacyDemo001',
      entity_type: 'project',
      classification: 'MIGRATABLE',
    },
    payload: {
      project_name: 'demo_project',
      project_type: 'client',
    },
  };
}

// ---------------------------------------------------------------------------
// Valid Candidate V1（10 必填字段 + processing 4 子字段）
// ---------------------------------------------------------------------------

function makeValidCandidateV1(overrides = {}) {
  return {
    schema_version: 'v1',
    candidate_id: 'cand_demo_pilot_001',
    ingestion_id: 'ing_demo_001',
    source: {
      system: 'feishu_bitable',
      table: 'projects_demo',
      record_id: 'rec_demo_001',
    },
    entity_type: 'project',
    raw_evidence: { redacted: true },
    normalized_fields: {
      project_type: 'client',
      customer_ref: 'cust_demo_001',
      model_ref: null,
      shoot_date: '2026-07-21',
    },
    quality: {
      status: 'PASS',
      issues: [],
      score: 0.95,
    },
    processing: {
      ocr_version: 'tesseract-5.3.0',
      asr_version: 'whisper-large-v3',
      processed_at: '2026-07-21T10:00:00.000Z',
      agent_version: 'collator-1.0.0',
    },
    idempotency_key: 'sha256_a1b2c3d4e5f60718293a4b5c6d7e8f90',
    ...overrides,
  };
}

// ===========================================================================
// 测试套件
// ===========================================================================

describe('pilot-writer-v1 contract guard', () => {

  // -------------------------------------------------------------------------
  // 测试 1：guard 通过 → 原 writer 被调用
  // -------------------------------------------------------------------------
  test('1. 合法 Candidate V1 通过 guard：原 writeRecord 被调用，返回 record_id', async () => {
    const transport = makeFakeTransport();
    const writer = createPilotWriterV1(makeConfig(transport.fn));

    const result = await writer.writeRecord(
      makeValidWriteInput(),
      makeValidCandidateV1()
    );

    // 原 writer 被调用（transport 被调用 1 次）
    assert.equal(transport.calls.length, 1, 'transport 应被调用 1 次');
    // 返回 record_id
    assert.ok(result.record_id, '应返回 record_id');
    assert.equal(result.status, 'CREATED');
    assert.ok(result.idempotency_key, '应返回 idempotency_key');
    // 版本号标识为 V1 装饰器
    assert.equal(writer.version, PILOT_WRITER_V1_VERSION);
  });

  // -------------------------------------------------------------------------
  // 测试 2：guard 拒绝非 v1 → CandidateValidationError + 原 writer 未被调用
  // -------------------------------------------------------------------------
  test('2. 非法 schema_version=v99：抛 CandidateValidationError，原 writer 未被调用', async () => {
    const transport = makeFakeTransport();
    const writer = createPilotWriterV1(makeConfig(transport.fn));
    const { CandidateValidationError, CandidateValidationErrorCodes } = await loadContracts();

    const invalidCandidate = makeValidCandidateV1({ schema_version: 'v99' });

    await assert.rejects(
      () => writer.writeRecord(makeValidWriteInput(), invalidCandidate),
      (err) => {
        assert.ok(err instanceof CandidateValidationError, '应为 CandidateValidationError');
        assert.equal(err.code, CandidateValidationErrorCodes.UNKNOWN_SCHEMA_VERSION);
        return true;
      }
    );

    // 关键：原 writer 未被调用（transport 调用次数为 0）
    assert.equal(transport.calls.length, 0, 'guard 失败时 transport 不应被调用');
  });

  // -------------------------------------------------------------------------
  // 测试 3：guard 缺失子字段 fail closed
  // -------------------------------------------------------------------------
  test('3. 缺失 processing.ocr_version：抛 CandidateValidationError，原 writer 未被调用', async () => {
    const transport = makeFakeTransport();
    const writer = createPilotWriterV1(makeConfig(transport.fn));
    const { CandidateValidationError, CandidateValidationErrorCodes } = await loadContracts();

    const invalidCandidate = makeValidCandidateV1({
      processing: {
        asr_version: 'whisper-large-v3',
        processed_at: '2026-07-21T10:00:00.000Z',
        agent_version: 'collator-1.0.0',
      },
    });

    await assert.rejects(
      () => writer.writeRecord(makeValidWriteInput(), invalidCandidate),
      (err) => {
        assert.ok(err instanceof CandidateValidationError, '应为 CandidateValidationError');
        assert.equal(err.code, CandidateValidationErrorCodes.MISSING_REQUIRED_FIELD);
        assert.ok(err.message.includes('ocr_version'));
        return true;
      }
    );

    // 关键：原 writer 未被调用
    assert.equal(transport.calls.length, 0, 'guard 失败时 transport 不应被调用');
  });

  // -------------------------------------------------------------------------
  // 测试 4：guard 失败时 pilot writer 未被调用（无副作用验证）
  // 综合：多种非法输入下 transport 始终为 0，且 writer 状态未被污染
  // -------------------------------------------------------------------------
  test('4. 无副作用：多种非法输入下 transport 调用次数始终为 0', async () => {
    const transport = makeFakeTransport();
    const writer = createPilotWriterV1(makeConfig(transport.fn));

    // 4a. 非法 schema_version
    await assert.rejects(
      () => writer.writeRecord(makeValidWriteInput(), makeValidCandidateV1({ schema_version: 'v99' })),
      () => true
    );
    assert.equal(transport.calls.length, 0, '非法 schema_version 后 transport 应为 0');

    // 4b. 缺失必填子字段
    await assert.rejects(
      () => writer.writeRecord(
        makeValidWriteInput(),
        makeValidCandidateV1({ processing: undefined })
      ),
      () => true
    );
    assert.equal(transport.calls.length, 0, '缺失 processing 后 transport 应为 0');

    // 4c. raw_evidence.redacted=false（强制脱敏失败）
    await assert.rejects(
      () => writer.writeRecord(
        makeValidWriteInput(),
        makeValidCandidateV1({ raw_evidence: { redacted: false } })
      ),
      () => true
    );
    assert.equal(transport.calls.length, 0, 'redacted=false 后 transport 应为 0');

    // 4d. 非法 idempotency_key 格式
    await assert.rejects(
      () => writer.writeRecord(
        makeValidWriteInput(),
        makeValidCandidateV1({ idempotency_key: 'not-a-sha256-key' })
      ),
      () => true
    );
    assert.equal(transport.calls.length, 0, '非法 idempotency_key 后 transport 应为 0');

    // 4e. 全部非法尝试后，合法输入仍能正常写入（writer 状态未被污染）
    const validResult = await writer.writeRecord(
      makeValidWriteInput(),
      makeValidCandidateV1()
    );
    assert.equal(transport.calls.length, 1, '合法输入后 transport 应为 1');
    assert.ok(validResult.record_id, '合法输入应返回 record_id');
    assert.equal(validResult.status, 'CREATED');
  });
});
