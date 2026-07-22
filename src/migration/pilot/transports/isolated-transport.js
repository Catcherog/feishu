'use strict';

// Isolated Pilot transport — for local dev, CI, and runner integration tests.
//
// FAMP-CONTRACT-ADOPTION-GATE-01-R1-FIX / RF-04
//
// 不调用真实飞书 API。返回确定性 record_id（recIsolated<N>），记录所有
// 调用以便测试断言。可作为 Stage B runner 的注入 transport 用于：
//   - 本地开发（无飞书凭据）
//   - CI 流水线
//   - 入口级集成测试（验证 runner → createPilotWriterV1 → transport 链路）

/**
 * Create an isolated transport that records calls and returns deterministic record_ids.
 *
 * @returns {{ calls: Array, fn: Function }}
 */
function createIsolatedTransport() {
  const calls = [];
  const fn = async (tableId, fields, idempotencyKey) => {
    const record_id = `recIsolated${1000 + calls.length + 1}`;
    calls.push({ tableId, fields, idempotencyKey, returned_record_id: record_id });
    return { record_id };
  };
  return { calls, fn };
}

module.exports = {
  createIsolatedTransport,
};
