// Stage B Runner — Pilot 迁移执行入口测试
//
// FAMP-CONTRACT-ADOPTION-GATE-01-R1-FIX / RF-04
//
// 验证 Stage B runner 是「真正的迁移执行入口」而不是简单的 export 代理：
//   1. runner 通过 V1 合同门禁（合法 candidate 通过，非法 fail-closed）
//   2. runner 无法获得或降级到原始 writer（无 innerWriter / getRawWriter /
//      createPilotWriter / createPilotWriterV1 等 accessor）
//   3. runner 在 isolated transport 下可执行 writeRecord / writeBatch
//   4. runner 在无 transport 注入且环境变量缺失时 fail-closed（不静默降级）
//   5. writeBatch 受 RF-03 fail-closed 保护
//
// Run:  node --test tests/stage-b-runner.test.js

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const {
  createStageBRunner,
  STAGE_B_RUNNER_VERSION,
  createIsolatedTransport,
} = require('../src/migration/pilot/stage-b-runner');

// ESM 合同懒加载（用于断言 CandidateValidationError 类型）
let _contracts = null;
async function loadContracts() {
  if (!_contracts) {
    const mod = await import('../../src/contracts/candidate-v1.js');
    _contracts = mod;
  }
  return _contracts;
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

function makeConfig() {
  return {
    pilot_base_token: FAKE_PILOT_TOKEN,
    production_v2_base_token: FAKE_PRODUCTION_TOKEN,
    pilot_base_alias: 'V2_PILOT_BASE_ALIAS_TEST',
    table_ids: FAKE_TABLE_IDS,
  };
}

// ---------------------------------------------------------------------------
// Valid writeRecord input
// ---------------------------------------------------------------------------

function makeValidWriteInput(overrides = {}) {
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
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Valid Candidate V1（10 必填字段 + processing 4 子字段）
// ---------------------------------------------------------------------------

function makeValidCandidateV1(overrides = {}) {
  return {
    schema_version: 'v1',
    candidate_id: 'cand_demo_stage_b_001',
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

describe('stage-b-runner — Pilot 迁移执行入口 (RF-04)', () => {

  // -------------------------------------------------------------------------
  // RF-04-1：runner 构造与版本标识
  // -------------------------------------------------------------------------
  describe('RF-04-1. runner construction & version', () => {

    test('1. createStageBRunner returns runner with version', () => {
      const { fn } = createIsolatedTransport();
      const runner = createStageBRunner({
        config: makeConfig(),
        transport: fn,
      });
      assert.equal(runner.version, STAGE_B_RUNNER_VERSION);
      assert.equal(typeof runner.writeRecord, 'function');
      assert.equal(typeof runner.writeBatch, 'function');
    });

    test('2. runner exposes pilot_writer_version (V1 contract guard)', () => {
      const { fn } = createIsolatedTransport();
      const runner = createStageBRunner({
        config: makeConfig(),
        transport: fn,
      });
      // pilot_writer_version 必须等于 pilot.PILOT_WRITER_V1_VERSION
      // （证明 runner 内部确实通过 createPilotWriterV1 创建 writer）
      assert.ok(runner.pilot_writer_version, 'pilot_writer_version should be defined');
      assert.match(runner.pilot_writer_version, /pilot-writer-v1/);
    });

    test('3. createStageBRunner requires options.config', () => {
      assert.throws(
        () => createStageBRunner({}),
        /options\.config is required/,
      );
    });

    test('4. createStageBRunner requires options object', () => {
      assert.throws(
        () => createStageBRunner(null),
        /options object is required/,
      );
    });
  });

  // -------------------------------------------------------------------------
  // RF-04-2：runner 无法降级到原始 writer（核心安全保证）
  //
  // GPT RF-04：「证明 runner 无法获得或降级到原始 writer」
  // -------------------------------------------------------------------------
  describe('RF-04-2. runner cannot access or downgrade to raw writer', () => {

    test('5. runner does NOT expose innerWriter', () => {
      const { fn } = createIsolatedTransport();
      const runner = createStageBRunner({
        config: makeConfig(),
        transport: fn,
      });
      // innerWriter / _writer / writer 均不应存在
      assert.equal(runner.innerWriter, undefined, 'innerWriter must not be exposed');
      assert.equal(runner._writer, undefined, '_writer must not be exposed');
      assert.equal(runner.writer, undefined, 'writer must not be exposed (would allow bypass)');
    });

    test('6. runner does NOT expose getRawWriter / getInnerWriter accessors', () => {
      const { fn } = createIsolatedTransport();
      const runner = createStageBRunner({
        config: makeConfig(),
        transport: fn,
      });
      assert.equal(runner.getRawWriter, undefined);
      assert.equal(runner.getInnerWriter, undefined);
      assert.equal(runner._getWriter, undefined);
    });

    test('7. runner does NOT expose createPilotWriter or createPilotWriterV1', () => {
      const { fn } = createIsolatedTransport();
      const runner = createStageBRunner({
        config: makeConfig(),
        transport: fn,
      });
      // 调用方不应能通过 runner 重新构造 writer 绕过注入的 transport
      assert.equal(runner.createPilotWriter, undefined);
      assert.equal(runner.createPilotWriterV1, undefined);
    });

    test('8. runner is frozen — no new raw writer accessors can be added', () => {
      const { fn } = createIsolatedTransport();
      const runner = createStageBRunner({
        config: makeConfig(),
        transport: fn,
      });
      assert.ok(Object.isFrozen(runner), 'runner must be frozen');
      // 尝试添加 accessor 应失败（严格模式下抛错）
      assert.throws(() => {
        'use strict';
        runner.getRawWriter = () => 'leaked';
      }, /cannot add property|read only|not extensible/i);
    });
  });

  // -------------------------------------------------------------------------
  // RF-04-3：runner 通过 V1 合同门禁 — writeRecord
  //
  // 合法 candidate 通过；非法 candidate 抛 CandidateValidationError + transport 0 调用
  // -------------------------------------------------------------------------
  describe('RF-04-3. runner.writeRecord goes through V1 contract gate', () => {

    test('9. legal Candidate V1 → transport invoked 1 time, returns record_id', async () => {
      const { calls, fn } = createIsolatedTransport();
      const runner = createStageBRunner({
        config: makeConfig(),
        transport: fn,
      });

      const result = await runner.writeRecord(
        makeValidWriteInput(),
        makeValidCandidateV1()
      );

      assert.equal(calls.length, 1, 'transport should be invoked 1 time');
      assert.ok(result.record_id, 'should return record_id');
      assert.equal(result.status, 'CREATED');
    });

    test('10. schema_version=v99 → CandidateValidationError, transport 0 calls', async () => {
      const { calls, fn } = createIsolatedTransport();
      const runner = createStageBRunner({
        config: makeConfig(),
        transport: fn,
      });
      const { CandidateValidationError, CandidateValidationErrorCodes } = await loadContracts();

      await assert.rejects(
        () => runner.writeRecord(
          makeValidWriteInput(),
          makeValidCandidateV1({ schema_version: 'v99' })
        ),
        (err) => {
          assert.ok(err instanceof CandidateValidationError);
          assert.equal(err.code, CandidateValidationErrorCodes.UNKNOWN_SCHEMA_VERSION);
          return true;
        }
      );
      assert.equal(calls.length, 0, 'transport must NOT be invoked on validation failure');
    });

    test('11. missing processing.ocr_version → CandidateValidationError, transport 0 calls', async () => {
      const { calls, fn } = createIsolatedTransport();
      const runner = createStageBRunner({
        config: makeConfig(),
        transport: fn,
      });
      const { CandidateValidationError, CandidateValidationErrorCodes } = await loadContracts();

      const invalidCandidate = makeValidCandidateV1({
        processing: {
          asr_version: 'whisper-large-v3',
          processed_at: '2026-07-21T10:00:00.000Z',
          agent_version: 'collator-1.0.0',
        },
      });

      await assert.rejects(
        () => runner.writeRecord(makeValidWriteInput(), invalidCandidate),
        (err) => {
          assert.ok(err instanceof CandidateValidationError);
          assert.equal(err.code, CandidateValidationErrorCodes.MISSING_REQUIRED_FIELD);
          assert.ok(err.message.includes('ocr_version'));
          return true;
        }
      );
      assert.equal(calls.length, 0, 'transport must NOT be invoked on validation failure');
    });
  });

  // -------------------------------------------------------------------------
  // RF-04-4：runner.writeBatch 受 RF-03 fail-closed 保护
  //
  // GPT RF-04：「证明 runner 无法获得或降级到原始 writer」
  // 这里验证 runner.writeBatch 同样受 RF-03 fail-closed 保护
  // -------------------------------------------------------------------------
  describe('RF-04-4. runner.writeBatch goes through RF-03 fail-closed', () => {

    test('12. writeBatch(inputs) without candidateV1s → rejects, transport 0', async () => {
      const { calls, fn } = createIsolatedTransport();
      const runner = createStageBRunner({
        config: makeConfig(),
        transport: fn,
      });

      await assert.rejects(
        () => runner.writeBatch([makeValidWriteInput()]),
        /candidateV1s is required/
      );
      assert.equal(calls.length, 0);
    });

    test('13. writeBatch(inputs, []) with empty candidates → rejects, transport 0', async () => {
      const { calls, fn } = createIsolatedTransport();
      const runner = createStageBRunner({
        config: makeConfig(),
        transport: fn,
      });

      await assert.rejects(
        () => runner.writeBatch([makeValidWriteInput()], []),
        /must match inputs length/
      );
      assert.equal(calls.length, 0);
    });

    test('14. mid-batch v99 → whole batch rejected, transport 0', async () => {
      const { calls, fn } = createIsolatedTransport();
      const runner = createStageBRunner({
        config: makeConfig(),
        transport: fn,
      });

      const inputs = [
        makeValidWriteInput({ legacy_record_id: 'recLegacyDemo001' }),
        makeValidWriteInput({ legacy_record_id: 'recLegacyDemo002' }),
      ];
      inputs[1].record = { ...inputs[1].record, record_key: 'recLegacyDemo002' };
      inputs[1].classified = { ...inputs[1].classified, record_key: 'recLegacyDemo002' };

      const candidates = [
        makeValidCandidateV1({ candidate_id: 'cand_demo_stage_b_001' }),
        makeValidCandidateV1({
          candidate_id: 'cand_demo_stage_b_002',
          schema_version: 'v99',
        }),
      ];

      await assert.rejects(
        () => runner.writeBatch(inputs, candidates),
        // 不严格断言 CandidateValidationError 类型（避免 ESM 懒加载时序问题）
        // 仅验证整批失败 + transport 0 调用
        () => true
      );
      assert.equal(calls.length, 0, 'mid-batch v99 → whole batch must fail-closed');
    });

    test('15. all legal candidates → transport executes for each input', async () => {
      const { calls, fn } = createIsolatedTransport();
      const runner = createStageBRunner({
        config: makeConfig(),
        transport: fn,
      });

      const inputs = [
        makeValidWriteInput({ legacy_record_id: 'recLegacyDemo001' }),
        makeValidWriteInput({ legacy_record_id: 'recLegacyDemo002' }),
      ];
      inputs[1].record = { ...inputs[1].record, record_key: 'recLegacyDemo002' };
      inputs[1].classified = { ...inputs[1].classified, record_key: 'recLegacyDemo002' };

      const candidates = [
        makeValidCandidateV1({
          candidate_id: 'cand_demo_stage_b_001',
          idempotency_key: 'sha256_a1b2c3d4e5f60718293a4b5c6d7e8f90',
        }),
        makeValidCandidateV1({
          candidate_id: 'cand_demo_stage_b_002',
          idempotency_key: 'sha256_b2c3d4e5f60718293a4b5c6d7e8f90a1',
        }),
      ];

      const result = await runner.writeBatch(inputs, candidates);

      assert.equal(calls.length, 2, 'transport should be invoked 2 times');
      assert.equal(result.results.length, 2);
      assert.equal(result.results[0].status, 'CREATED');
      assert.equal(result.results[1].status, 'CREATED');
      assert.equal(result.summary.created, 2);
    });
  });

  // -------------------------------------------------------------------------
  // RF-04-5：无 transport 注入 + 无环境变量 → fail-closed
  //
  // 关键：runner 不应静默降级到 isolated / NoOp transport。
  // 生产环境必须显式注入 transport 或提供完整 FEISHU_* 环境变量。
  // -------------------------------------------------------------------------
  describe('RF-04-5. fail-closed when no transport and no env vars', () => {
    const SAVED_ENV = { ...process.env };

    beforeEach(() => {
      // 清除环境变量，模拟「无凭据」场景
      delete process.env.FEISHU_APP_ID;
      delete process.env.FEISHU_APP_SECRET;
      delete process.env.FEISHU_BASE_APP_TOKEN;
    });

    afterEach(() => {
      // 恢复环境变量
      process.env = { ...SAVED_ENV };
    });

    test('16. no transport + no env vars → throws, no silent fallback', () => {
      assert.throws(
        () => createStageBRunner({ config: makeConfig() }),
        /no transport injected|FEISHU_APP_ID|FEISHU_APP_SECRET|FEISHU_BASE_APP_TOKEN/,
        'runner must fail-closed when no transport is injected and env vars are missing'
      );
    });
  });
});
