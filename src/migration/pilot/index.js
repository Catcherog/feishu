'use strict';

// Pilot Vertical Slice - public entry point.
//
// Aggregates the Pilot adapter modules (writer / reader / cleanup /
// idempotency) into a single import surface. Per
// MIGRATION-VERTICAL-SLICE-ACCELERATION-01-R1 Required Correction 03,
// these are the minimum adapters needed to run an isolated, idempotent,
// cleanup-capable vertical slice.
//
// FAMP-CONTRACT-ADOPTION-GATE-01-R1 / AC-R1-03 / AC-R1-06:
// 本入口仅导出带 Candidate V1 合同门禁的 createPilotWriterV1。原无门禁
// createPilotWriter 已从公开导出移除（AC-R1-06：不得保留无门禁 fallback）。
// 底层 createPilotWriter 仍存在于 ./writer 模块供单元测试直接引用，但不再
// 通过本公开入口暴露给生产调用方。
//
// Stage A (this code) does NOT call Feishu APIs - all I/O is injected via
// transport functions. Stage B will wire real transports after Pilot Base
// isolation is proven, and MUST use createPilotWriterV1 (not createPilotWriter).

const { createPilotReader, PILOT_READER_VERSION } = require('./reader');
const { createPilotCleanup, PILOT_CLEANUP_VERSION } = require('./cleanup');
const {
  buildIdempotencyKey,
  IDEMPOTENCY_KEY_ALGORITHM,
  PILOT_RULE_VERSION,
} = require('./idempotency');
const {
  createPilotWriterV1,
  PILOT_WRITER_V1_VERSION,
} = require('./pilot-writer-v1');

module.exports = {
  // Writer（带 Candidate V1 合同门禁，AC-R1-03/AC-R1-06 唯一公开 writer）
  createPilotWriterV1,
  PILOT_WRITER_V1_VERSION,
  // Reader
  createPilotReader,
  PILOT_READER_VERSION,
  // Cleanup
  createPilotCleanup,
  PILOT_CLEANUP_VERSION,
  // Idempotency
  buildIdempotencyKey,
  IDEMPOTENCY_KEY_ALGORITHM,
  PILOT_RULE_VERSION,
};
