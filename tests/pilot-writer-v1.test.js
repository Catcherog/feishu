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

// ===========================================================================
// FAMP-CONTRACT-ADOPTION-GATE-01-R1-FIX / RF-03
// writeBatch fail-closed 测试矩阵
//
// GPT 审查 RF-03 要求：
//   1. writeBatch(inputs) → 拒绝，transport 0
//   2. writeBatch(inputs, []) → 拒绝，transport 0
//   3. 数量不一致 → 拒绝，transport 0
//   4. 中间一条 v99 → 整批拒绝，transport 0
//   5. 全部合法 → transport 才执行
// ===========================================================================

describe('pilot-writer-v1 writeBatch fail-closed (RF-03)', () => {

  // -------------------------------------------------------------------------
  // 测试 RF-03-1：writeBatch(inputs) 省略 candidateV1s → 拒绝，transport 0
  // -------------------------------------------------------------------------
  test('RF-03-1. writeBatch(inputs) without candidateV1s → rejects, transport 0', async () => {
    const transport = makeFakeTransport();
    const writer = createPilotWriterV1(makeConfig(transport.fn));

    await assert.rejects(
      () => writer.writeBatch([makeValidWriteInput()]),
      (err) => {
        assert.ok(err.message.includes('candidateV1s is required'), `错误消息应说明 candidateV1s 必填，实际: ${err.message}`);
        return true;
      }
    );

    // 关键：transport 调用次数为 0
    assert.equal(transport.calls.length, 0, '省略 candidateV1s 时 transport 应为 0');
  });

  // -------------------------------------------------------------------------
  // 测试 RF-03-2：writeBatch(inputs, []) 空数组 → 拒绝，transport 0
  // -------------------------------------------------------------------------
  test('RF-03-2. writeBatch(inputs, []) with empty candidates → rejects, transport 0', async () => {
    const transport = makeFakeTransport();
    const writer = createPilotWriterV1(makeConfig(transport.fn));

    await assert.rejects(
      () => writer.writeBatch([makeValidWriteInput()], []),
      (err) => {
        assert.ok(err.message.includes('must match inputs length'), `错误消息应说明长度不匹配，实际: ${err.message}`);
        return true;
      }
    );

    // 关键：transport 调用次数为 0
    assert.equal(transport.calls.length, 0, '空 candidateV1s 时 transport 应为 0');
  });

  // -------------------------------------------------------------------------
  // 测试 RF-03-3：candidateV1s.length !== inputs.length → 拒绝，transport 0
  // -------------------------------------------------------------------------
  test('RF-03-3. candidateV1s length mismatch → rejects, transport 0', async () => {
    const transport = makeFakeTransport();
    const writer = createPilotWriterV1(makeConfig(transport.fn));

    // 2 inputs, 1 candidate
    await assert.rejects(
      () => writer.writeBatch(
        [makeValidWriteInput(), makeValidWriteInput()],
        [makeValidCandidateV1()]
      ),
      (err) => {
        assert.ok(err.message.includes('must match inputs length'), `错误消息应说明长度不匹配，实际: ${err.message}`);
        return true;
      }
    );

    // 关键：transport 调用次数为 0
    assert.equal(transport.calls.length, 0, '长度不匹配时 transport 应为 0');
  });

  // -------------------------------------------------------------------------
  // 测试 RF-03-4：中间一条 v99 → 整批拒绝，transport 0
  // 关键：fail-closed 必须"先全量校验、后写入"，任一失败则整批不执行
  // -------------------------------------------------------------------------
  test('RF-03-4. mid-batch v99 candidate → whole batch rejected, transport 0', async () => {
    const transport = makeFakeTransport();
    const writer = createPilotWriterV1(makeConfig(transport.fn));
    const { CandidateValidationError, CandidateValidationErrorCodes } = await loadContracts();

    // 2 inputs, 2 candidates: 第 1 个合法，第 2 个 v99 非法
    const inputs = [makeValidWriteInput(), makeValidWriteInput()];
    const candidates = [
      makeValidCandidateV1(),
      makeValidCandidateV1({ schema_version: 'v99' }),
    ];

    await assert.rejects(
      () => writer.writeBatch(inputs, candidates),
      (err) => {
        assert.ok(err instanceof CandidateValidationError, '应为 CandidateValidationError');
        assert.equal(err.code, CandidateValidationErrorCodes.UNKNOWN_SCHEMA_VERSION);
        return true;
      }
    );

    // 关键：整批 fail-closed — transport 调用次数为 0（即使第 1 个 candidate 合法，也不写入）
    assert.equal(transport.calls.length, 0, '中间一条非法时整批应 fail-closed，transport 应为 0');
  });

  // -------------------------------------------------------------------------
  // 测试 RF-03-5：全部合法 → transport 才执行
  //
  // 注意：innerWriter.writeBatch 基于 (legacy_source, legacy_record_id,
  // target_entity_type) 派生 in-process idempotency key 并去重。
  // 若两个 input 的 legacy_record_id 相同，第 2 个会被标记为
  // DUPLICATE_SKIPPED，transport 只调用 1 次。为了让本测试验证「transport
  // 被调用 2 次 = 门禁通过后两个 input 都真正写入」，必须使用不同的
  // legacy_record_id（和对应的 record_key）以避开去重路径。
  // -------------------------------------------------------------------------
  test('RF-03-5. all legal candidates → transport executes for each input', async () => {
    const transport = makeFakeTransport();
    const writer = createPilotWriterV1(makeConfig(transport.fn));

    const inputs = [
      {
        ...makeValidWriteInput(),
        legacy_record_id: 'recLegacyDemo001',
        record: { ...makeValidWriteInput().record, record_key: 'recLegacyDemo001' },
        classified: { ...makeValidWriteInput().classified, record_key: 'recLegacyDemo001' },
      },
      {
        ...makeValidWriteInput(),
        legacy_record_id: 'recLegacyDemo002',
        record: { ...makeValidWriteInput().record, record_key: 'recLegacyDemo002' },
        classified: { ...makeValidWriteInput().classified, record_key: 'recLegacyDemo002' },
      },
    ];
    const candidates = [
      makeValidCandidateV1({
        candidate_id: 'cand_demo_pilot_001',
        idempotency_key: 'sha256_a1b2c3d4e5f60718293a4b5c6d7e8f90',
      }),
      makeValidCandidateV1({
        candidate_id: 'cand_demo_pilot_002',
        idempotency_key: 'sha256_b2c3d4e5f60718293a4b5c6d7e8f90a1',
      }),
    ];

    const result = await writer.writeBatch(inputs, candidates);

    // transport 被调用 2 次（每个 input 一次 — 无去重）
    assert.equal(transport.calls.length, 2, '全部合法时 transport 应被调用 2 次');
    // writeBatch 返回 results 数组
    assert.ok(result.results, '应返回 results 数组');
    assert.equal(result.results.length, 2, '应返回 2 个结果');
    // 两条均为 CREATED（无 DUPLICATE_SKIPPED）
    assert.equal(result.results[0].status, 'CREATED', '第 1 条应 CREATED');
    assert.equal(result.results[1].status, 'CREATED', '第 2 条应 CREATED');
    // summary 字段存在且 created=2
    assert.ok(result.summary, '应返回 summary');
    assert.equal(result.summary.created, 2, 'summary.created 应为 2');
  });
});
