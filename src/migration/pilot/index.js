'use strict';

// Pilot Vertical Slice - public entry point.
//
// Aggregates the four Pilot adapter modules (writer / reader / cleanup /
// idempotency) into a single import surface. Per
// MIGRATION-VERTICAL-SLICE-ACCELERATION-01-R1 Required Correction 03,
// these are the minimum adapters needed to run an isolated, idempotent,
// cleanup-capable vertical slice.
//
// Stage A (this code) does NOT call Feishu APIs - all I/O is injected via
// transport functions. Stage B will wire real transports after Pilot Base
// isolation is proven.

const { createPilotWriter, PILOT_WRITER_VERSION } = require('./writer');
const { createPilotReader, PILOT_READER_VERSION } = require('./reader');
const { createPilotCleanup, PILOT_CLEANUP_VERSION } = require('./cleanup');
const {
  buildIdempotencyKey,
  IDEMPOTENCY_KEY_ALGORITHM,
  PILOT_RULE_VERSION,
} = require('./idempotency');

module.exports = {
  // Writer
  createPilotWriter,
  PILOT_WRITER_VERSION,
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
