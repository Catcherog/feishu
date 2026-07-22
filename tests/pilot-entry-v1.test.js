// Pilot Entry V1 — Migration Entry Point Contract Adoption Test Suite
//
// FAMP-CONTRACT-ADOPTION-GATE-01-R1
// 验证 feishu-v2 迁移入口（pilot/index.js 公开导出）的合同采用：
//   AC-A05: 实际迁移入口必须创建 createPilotWriterV1()（不能直接使用 createPilotWriter）
//   AC-A06: 迁移入口不得保留无合同门禁 fallback（公开导出不含 createPilotWriter）
//   AC-A07: v99 / 缺必填字段 / redacted=false 都 fail closed
//   AC-A08: 失败时不调用 transport（无飞书写入副作用）
//
// 与 pilot-writer-v1.test.js 的区别：
//   - pilot-writer-v1.test.js 直接 require pilot-writer-v1.js（内部模块）
//   - 本测试 require pilot/index.js（公开入口），验证真实迁移入口路径
//   - 本测试额外验证 AC-A06：公开导出不含 createPilotWriter（无门禁 fallback）
//
// Run:  node --test tests/pilot-entry-v1.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// 通过公开入口 require（AC-A05：实际迁移入口路径）
const pilot = require('../src/migration/pilot');

// ESM 合同懒加载（用于断言 CandidateValidationError 类型）
let _contracts = null;
async function loadContracts() {
  if (!_contracts) {
    // 路径：feishu-v2/tests/ → SOP/src/contracts/candidate-v1.js
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
// Valid writeRecord input（与 pilot-writer-v1.test.js 结构一致）
// ---------------------------------------------------------------------------

function makeValidWriteInput() {
  return {
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
    candidate_id: 'cand_demo_pilot_entry_001',
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

describe('pilot entry v1 — migration entry point contract adoption', () => {

  // -------------------------------------------------------------------------
  // AC-A05: 实际迁移入口必须创建 createPilotWriterV1()
  // AC-A06: 迁移入口不得保留无合同门禁 fallback
  // -------------------------------------------------------------------------

  describe('AC-A05/A06: public entry exports createPilotWriterV1, not createPilotWriter', () => {

    test('1. public index exports createPilotWriterV1 function', () => {
      assert.equal(
        typeof pilot.createPilotWriterV1,
        'function',
        'public index must export createPilotWriterV1 as a function',
      );
    });

    test('2. public index exports PILOT_WRITER_V1_VERSION string', () => {
      assert.equal(typeof pilot.PILOT_WRITER_V1_VERSION, 'string');
      assert.ok(pilot.PILOT_WRITER_V1_VERSION.length > 0);
    });

    test('3. AC-A06: public index does NOT export createPilotWriter (no fallback)', () => {
      // 迁移入口不得保留无合同门禁 fallback
      assert.equal(
        pilot.createPilotWriter,
        undefined,
        'createPilotWriter must NOT be exported from public index (AC-A06: no fallback without contract gate)',
      );
    });

    test('4. AC-A06: public index does NOT export PILOT_WRITER_VERSION (legacy version)', () => {
      assert.equal(
        pilot.PILOT_WRITER_VERSION,
        undefined,
        'PILOT_WRITER_VERSION must NOT be exported from public index (legacy, no contract gate)',
      );
    });

    test('5. AC-A05: createPilotWriterV1(config) returns writer with writeRecord', () => {
      const transport = makeFakeTransport();
      const writer = pilot.createPilotWriterV1(makeConfig(transport.fn));

      assert.equal(typeof writer.writeRecord, 'function');
      assert.equal(typeof writer.writeBatch, 'function');
      assert.equal(writer.version, pilot.PILOT_WRITER_V1_VERSION);
    });
  });

  // -------------------------------------------------------------------------
  // AC-A07: v99 / 缺必填字段 / redacted=false 都 fail closed
  // AC-A08: 失败时不调用 transport（无飞书写入副作用）
  //
  // 通过公开入口 createPilotWriterV1() 调用，验证真实迁移入口路径的 fail-closed
  // -------------------------------------------------------------------------

  describe('AC-A07/A08: fail-closed through public entry point', () => {

    test('6. legal Candidate V1 through entry point: writer called, transport invoked 1 time', async () => {
      const transport = makeFakeTransport();
      const writer = pilot.createPilotWriterV1(makeConfig(transport.fn));

      const result = await writer.writeRecord(
        makeValidWriteInput(),
        makeValidCandidateV1(),
      );

      assert.equal(transport.calls.length, 1, 'transport should be invoked 1 time');
      assert.ok(result.record_id, 'should return record_id');
      assert.equal(result.status, 'CREATED');
    });

    test('7. AC-A07: schema_version=v99 → CandidateValidationError, transport 0 calls', async () => {
      const transport = makeFakeTransport();
      const writer = pilot.createPilotWriterV1(makeConfig(transport.fn));
      const { CandidateValidationError, CandidateValidationErrorCodes } = await loadContracts();

      const invalidCandidate = makeValidCandidateV1({ schema_version: 'v99' });

      await assert.rejects(
        () => writer.writeRecord(makeValidWriteInput(), invalidCandidate),
        (err) => {
          assert.ok(err instanceof CandidateValidationError, 'should be CandidateValidationError');
          assert.equal(err.code, CandidateValidationErrorCodes.UNKNOWN_SCHEMA_VERSION);
          return true;
        },
      );

      // AC-A08: 失败时不调用 transport
      assert.equal(transport.calls.length, 0, 'transport must NOT be invoked on validation failure');
    });

    test('8. AC-A07: missing processing.ocr_version → CandidateValidationError, transport 0 calls', async () => {
      const transport = makeFakeTransport();
      const writer = pilot.createPilotWriterV1(makeConfig(transport.fn));
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
          assert.ok(err instanceof CandidateValidationError, 'should be CandidateValidationError');
          assert.equal(err.code, CandidateValidationErrorCodes.MISSING_REQUIRED_FIELD);
          assert.ok(err.message.includes('ocr_version'));
          return true;
        },
      );

      // AC-A08: 失败时不调用 transport
      assert.equal(transport.calls.length, 0, 'transport must NOT be invoked on validation failure');
    });

    test('9. AC-A07: raw_evidence.redacted=false → CandidateValidationError, transport 0 calls', async () => {
      const transport = makeFakeTransport();
      const writer = pilot.createPilotWriterV1(makeConfig(transport.fn));
      const { CandidateValidationError, CandidateValidationErrorCodes } = await loadContracts();

      // redacted=false：违反强制脱敏标记
      const invalidCandidate = makeValidCandidateV1({
        raw_evidence: { redacted: false },
      });

      await assert.rejects(
        () => writer.writeRecord(makeValidWriteInput(), invalidCandidate),
        (err) => {
          assert.ok(err instanceof CandidateValidationError, 'should be CandidateValidationError');
          // SOP candidate-v1.js 有专门的 REDACTION_NOT_APPLIED 错误码
          assert.equal(err.code, CandidateValidationErrorCodes.REDACTION_NOT_APPLIED);
          return true;
        },
      );

      // AC-A08: 失败时不调用 transport
      assert.equal(transport.calls.length, 0, 'transport must NOT be invoked on validation failure');
    });

    test('10. AC-A07: invalid idempotency_key format → CandidateValidationError, transport 0 calls', async () => {
      const transport = makeFakeTransport();
      const writer = pilot.createPilotWriterV1(makeConfig(transport.fn));
      const { CandidateValidationError } = await loadContracts();

      const invalidCandidate = makeValidCandidateV1({
        idempotency_key: 'not-a-sha256-key',
      });

      await assert.rejects(
        () => writer.writeRecord(makeValidWriteInput(), invalidCandidate),
        (err) => {
          assert.ok(err instanceof CandidateValidationError, 'should be CandidateValidationError');
          return true;
        },
      );

      // AC-A08: 失败时不调用 transport
      assert.equal(transport.calls.length, 0, 'transport must NOT be invoked on validation failure');
    });

    test('11. AC-A08: multiple invalid inputs in sequence never invoke transport; state not polluted', async () => {
      const transport = makeFakeTransport();
      const writer = pilot.createPilotWriterV1(makeConfig(transport.fn));

      // 11a. 非法 schema_version
      await assert.rejects(
        () => writer.writeRecord(
          makeValidWriteInput(),
          makeValidCandidateV1({ schema_version: 'v99' }),
        ),
        () => true,
      );
      assert.equal(transport.calls.length, 0, 'after v99: transport should be 0');

      // 11b. 缺失 processing
      await assert.rejects(
        () => writer.writeRecord(
          makeValidWriteInput(),
          makeValidCandidateV1({ processing: undefined }),
        ),
        () => true,
      );
      assert.equal(transport.calls.length, 0, 'after missing processing: transport should be 0');

      // 11c. redacted=false
      await assert.rejects(
        () => writer.writeRecord(
          makeValidWriteInput(),
          makeValidCandidateV1({ raw_evidence: { redacted: false } }),
        ),
        () => true,
      );
      assert.equal(transport.calls.length, 0, 'after redacted=false: transport should be 0');

      // 11d. 非法 idempotency_key
      await assert.rejects(
        () => writer.writeRecord(
          makeValidWriteInput(),
          makeValidCandidateV1({ idempotency_key: 'bad-key' }),
        ),
        () => true,
      );
      assert.equal(transport.calls.length, 0, 'after bad idempotency_key: transport should be 0');

      // 11e. 全部非法尝试后，合法输入仍能正常写入（writer 状态未被污染）
      const validResult = await writer.writeRecord(
        makeValidWriteInput(),
        makeValidCandidateV1(),
      );
      assert.equal(transport.calls.length, 1, 'after legal input: transport should be 1');
      assert.ok(validResult.record_id, 'legal input should return record_id');
      assert.equal(validResult.status, 'CREATED');
    });
  });
});
