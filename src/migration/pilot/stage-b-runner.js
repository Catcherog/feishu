'use strict';

// Stage B Runner — Pilot 迁移执行入口。
//
// FAMP-CONTRACT-ADOPTION-GATE-01-R1-FIX / RF-04
//
// Stage A 在 src/migration/pilot/index.js 暴露了带 Candidate V1 合同门禁的
// createPilotWriterV1（仅 export，不接 transport）。Stage B runner 是
// 「实际执行入口」：负责构造或注入 transport，然后通过 createPilotWriterV1
// 创建 writer 并暴露 writeRecord / writeBatch 给调用方。
//
// 设计约束（来自 GPT RF-04）：
//   1. 必须 require pilot public index（不能直接 require pilot-writer-v1）
//   2. 必须调用 createPilotWriterV1（不能调用 createPilotWriter）
//   3. 注入 transport（真实 feishu-http-transport 或隔离 isolated-transport）
//   4. 暴露 writeRecord / writeBatch
//   5. 不得暴露 innerWriter / getRawWriter() / createPilotWriter — 任何降级到
//      无门禁 writer 的 accessor 都被显式拒绝
//
// Stage B runner 测试（tests/stage-b-runner.test.js）证明：
//   - runner 通过 V1 合同门禁（非法 candidate 抛错，transport 0 调用）
//   - runner 无法访问 innerWriter 或 createPilotWriter
//   - runner 在两种 transport（isolated / real HTTP）下都能工作

const pilot = require('./index');
const { createFeishuHttpTransport } = require('./transports/feishu-http-transport');
const { createIsolatedTransport } = require('./transports/isolated-transport');

const STAGE_B_RUNNER_VERSION = 'stage-b-runner-v1.0';

/**
 * Create a Stage B runner that wires transport (real or isolated) to
 * createPilotWriterV1.
 *
 * @param {object} options
 * @param {object} options.config - Pilot config (pilot_base_token, production_v2_base_token,
 *                                  pilot_base_alias, table_ids). 必填。
 *                                  注：config 中的 transport 字段会被 options.transport
 *                                  或自动构造的 transport 覆盖。
 * @param {Function} [options.transport] - 注入的 transport 函数（用于测试 / 本地 dev）。
 *                                         省略时：若环境变量 FEISHU_APP_ID +
 *                                         FEISHU_APP_SECRET + FEISHU_BASE_APP_TOKEN
 *                                         齐全，则构造 real Feishu HTTP transport；
 *                                         否则抛错（不静默降级到 NoOp / isolated）。
 * @param {Function} [options.fetchImpl] - 可注入 fetch（用于 transport 测试）
 * @returns {object} runner — 暴露 writeRecord(input, candidateV1) /
 *                            writeBatch(inputs, candidateV1s) 等。
 *                            不暴露 innerWriter / getRawWriter / createPilotWriter。
 */
function createStageBRunner(options) {
  if (!options || typeof options !== 'object') {
    throw new Error('createStageBRunner: options object is required');
  }
  const { config, transport, fetchImpl } = options;
  if (!config || typeof config !== 'object') {
    throw new Error('createStageBRunner: options.config is required');
  }

  // 决定 transport 来源：
  //   1. 显式注入（options.transport）— 测试 / 本地 dev
  //   2. 环境变量构造 real Feishu HTTP transport — 生产
  //   3. 都没有 → fail-closed 抛错（不静默降级）
  let resolvedTransport;
  if (typeof transport === 'function') {
    resolvedTransport = transport;
  } else {
    const appId = process.env.FEISHU_APP_ID;
    const appSecret = process.env.FEISHU_APP_SECRET;
    const appToken = process.env.FEISHU_BASE_APP_TOKEN;
    if (!appId || !appSecret || !appToken) {
      throw new Error(
        'createStageBRunner: no transport injected and FEISHU_APP_ID / FEISHU_APP_SECRET / ' +
        'FEISHU_BASE_APP_TOKEN env vars are not all set. Stage B runner requires either an ' +
        'explicit transport (for tests/dev) or real Feishu credentials (for prod). ' +
        'No silent fallback to isolated/NoOp transport.'
      );
    }
    resolvedTransport = createFeishuHttpTransport({
      appId, appSecret, appToken, fetchImpl,
    });
  }

  // 通过 pilot public index 创建 V1 writer — 不能直接调用 createPilotWriter。
  // pilot.createPilotWriterV1 是公开入口唯一暴露的 writer 工厂。
  const writer = pilot.createPilotWriterV1({
    ...config,
    transport: resolvedTransport,
  });

  // runner 公开接口：只暴露带门禁的 writeRecord / writeBatch。
  // 故意不暴露：
  //   - innerWriter / _writer / writer（防止通过 runner.writer.writeRecord 绕过）
  //   - createPilotWriter / createPilotWriterV1（防止调用方自行重新构造 writer）
  //   - getRawWriter() / getInnerWriter()（任何 accessor 都被拒绝）
  return Object.freeze({
    version: STAGE_B_RUNNER_VERSION,
    pilot_writer_version: pilot.PILOT_WRITER_V1_VERSION,
    pilot_base_alias: writer.pilot_base_alias,
    rule_version: writer.rule_version,

    /**
     * Write a single record through V1 contract gate.
     * @param {object} input - writeRecord input
     * @param {object} candidateV1 - Candidate V1（必填，校验失败抛 CandidateValidationError）
     */
    async writeRecord(input, candidateV1) {
      return writer.writeRecord(input, candidateV1);
    },

    /**
     * Write a batch of records through V1 contract gate (RF-03 fail-closed).
     * @param {Array} inputs - 非空数组
     * @param {Array} candidateV1s - 必填，长度 = inputs.length
     */
    async writeBatch(inputs, candidateV1s) {
      return writer.writeBatch(inputs, candidateV1s);
    },

    // 以下 accessors 显式不存在 — Object.freeze 后访问得到 undefined。
    // 测试套件断言这些属性为 undefined 以证明 runner 不会泄露 raw writer。
  });
}

module.exports = {
  createStageBRunner,
  STAGE_B_RUNNER_VERSION,
  // 暴露 transport 工厂以便测试 / CLI 构造
  createIsolatedTransport,
  createFeishuHttpTransport,
};
