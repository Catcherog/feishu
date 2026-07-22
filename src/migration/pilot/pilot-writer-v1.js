'use strict';

// Pilot Writer V1 — Contract Adoption Decorator
//
// FAMP-INTEGRATION-CONTRACT-01 Task 3 / AC-10 Adoption Gate
// 本文件为「SOP 迁移入口」的合同采用点。包装原 createPilotWriter，在调用
// writeRecord 前先校验 Candidate V1 合同，使合同成为迁移入口的运行时门禁。
//
// 装饰器模式（Additive, not refactoring）：
// - 不修改原 writer.js
// - 新增 createPilotWriterV1(config) 工厂
// - 返回的 writer.writeRecord(input, candidateV1) 在调用原 writeRecord 前
//   先调用 validateCandidateV1(candidateV1)
// - 校验失败抛 CandidateValidationError，原 writer 不被调用
// - 校验通过调用原 writeRecord(input)
//
// 无副作用保证：
// - 校验失败时不调用原 writeRecord，不产生飞书 Pilot Base 写入
// - 不直接调用任何飞书 SDK（原 writer 的 transport 由调用方注入）
//
// 模块系统说明：
// feishu-v2 是 CommonJS 模块岛（见 feishu-v2/package.json "type": "commonjs"）。
// SOP/src/contracts/candidate-v1.js 是 ESM 模块（SOP/package.json "type": "module"）。
// 使用动态 import() 从 CJS 加载 ESM 合同，懒加载并缓存。

const { createPilotWriter, PILOT_WRITER_VERSION } = require('./writer');

const PILOT_WRITER_V1_VERSION = 'pilot-writer-v1.0-contract-guard';

// ----------------------------------------------------------
// ESM 合同懒加载（CJS → ESM 桥接）
// ----------------------------------------------------------
let _contractsCache = null;

async function loadContracts() {
  if (!_contractsCache) {
    // 路径：feishu-v2/src/migration/pilot/ → SOP/src/contracts/
    // 上溯 4 级到 SOP/，再进入 src/contracts/candidate-v1.js
    const mod = await import('../../../../src/contracts/candidate-v1.js');
    _contractsCache = {
      validateCandidateV1: mod.validateCandidateV1,
      CandidateValidationError: mod.CandidateValidationError,
      CandidateValidationErrorCodes: mod.CandidateValidationErrorCodes,
    };
  }
  return _contractsCache;
}

// ----------------------------------------------------------
// 公共 API：createPilotWriterV1(config)
// ----------------------------------------------------------

/**
 * 创建带 Candidate V1 合同门禁的 Pilot Writer。
 *
 * @param {object} config - 与 createPilotWriter 相同的配置
 * @returns {object} 包装后的 writer，writeRecord(input, candidateV1) 增加合同校验
 */
function createPilotWriterV1(config) {
  // 内部创建原 writer（不变原逻辑）
  const innerWriter = createPilotWriter(config);

  /**
   * 带合同门禁的 writeRecord
   * @param {object} input - 与原 writeRecord 相同的输入
   * @param {object} candidateV1 - Candidate V1 合同对象，校验失败则抛错
   * @returns {Promise<object>} 原 writeRecord 的返回值
   * @throws {CandidateValidationError} 当 candidateV1 校验失败时
   */
  async function writeRecordWithGuard(input, candidateV1) {
    const { validateCandidateV1 } = await loadContracts();
    // 门禁：先校验合同。校验失败抛 CandidateValidationError，
    // 以下的 innerWriter.writeRecord 不会执行，无飞书写入副作用。
    validateCandidateV1(candidateV1);

    // 合同通过 → 委托原 writer
    return innerWriter.writeRecord(input);
  }

  /**
   * 带合同门禁的 writeBatch（RF-03 fail-closed 修复）
   *
   * FAMP-CONTRACT-ADOPTION-GATE-01-R1-FIX / RF-03
   *
   * 先校验全部 candidateV1s（fail-closed），任一失败则不写入；
   * 全部通过后委托原 writeBatch。
   *
   * RF-03 修复（之前版本允许通过省略 candidateV1s 或传空数组绕过门禁）：
   * - candidateV1s 现在是必填参数（不可省略）
   * - candidateV1s.length 必须等于 inputs.length（不允许数量不一致）
   * - inputs 非空时 candidateV1s 不得为空（不允许跳过门禁）
   * - 全部校验通过后才调用 innerWriter.writeBatch
   *
   * @param {Array} inputs - 与原 writeBatch 相同的输入数组（非空）
   * @param {Array} candidateV1s - 对应的 Candidate V1 数组（必填，长度与 inputs 一致）
   * @returns {Promise<object>} 原 writeBatch 的返回值
   * @throws {Error} 当 inputs/candidateV1s 形状不合法时
   * @throws {CandidateValidationError} 当任一 candidateV1 校验失败时
   */
  async function writeBatchWithGuard(inputs, candidateV1s) {
    // RF-03: inputs 必须是非空数组
    if (!Array.isArray(inputs)) {
      throw new Error('writeBatch: inputs must be an array');
    }
    if (inputs.length === 0) {
      throw new Error('writeBatch: inputs must not be empty (use writeRecord for single writes)');
    }
    // RF-03: candidateV1s 必填，必须是数组（不允许省略绕过门禁）
    if (!Array.isArray(candidateV1s)) {
      throw new Error(
        'writeBatch: candidateV1s is required and must be an array (RF-03: no bypass allowed)'
      );
    }
    // RF-03: candidateV1s 长度必须等于 inputs 长度（不允许空数组绕过门禁）
    if (candidateV1s.length !== inputs.length) {
      throw new Error(
        `writeBatch: candidateV1s length (${candidateV1s.length}) must match inputs length (${inputs.length}) (RF-03: no bypass allowed)`
      );
    }
    // RF-03: fail-closed — 先校验全部 candidates，任一失败则不写入
    const { validateCandidateV1 } = await loadContracts();
    for (let i = 0; i < candidateV1s.length; i++) {
      validateCandidateV1(candidateV1s[i]);
    }
    // 全部校验通过 → 委托原 writeBatch
    return innerWriter.writeBatch(inputs);
  }

  return Object.freeze({
    version: PILOT_WRITER_V1_VERSION,
    inner_version: PILOT_WRITER_VERSION,
    pilot_base_alias: innerWriter.pilot_base_alias,
    rule_version: innerWriter.rule_version,
    writeRecord: writeRecordWithGuard,
    writeBatch: writeBatchWithGuard,
  });
}

module.exports = {
  createPilotWriterV1,
  PILOT_WRITER_V1_VERSION,
  // 暴露懒加载函数（仅供测试用）
  _loadContracts: loadContracts,
};
