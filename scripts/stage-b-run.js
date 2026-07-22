'use strict';

// Stage B Runner — 可执行 CLI 入口
//
// FAMP-CONTRACT-ADOPTION-GATE-01-R1-FIX / RF-FIX-03
//
// GPT R2 裁决 RF-FIX-03 要求：补齐真正可执行的 Stage B 入口证据。
// 本脚本是 createStageBRunner() 的真实 CLI 入口，可通过以下方式调用：
//
//   node scripts/stage-b-run.js --check     验证 runner 属性（无 raw writer 泄露）
//   node scripts/stage-b-run.js --dry-run   使用 isolated transport 构造 runner（不写飞书）
//   node scripts/stage-b-run.js             生产模式：需要 FEISHU_APP_ID/SECRET/TOKEN
//
// 退出码：
//   0 — 成功
//   1 — 参数错误 / runner 构造失败（fail-closed）
//   2 — raw writer 泄露检测失败（安全违规）
//
// 本脚本不直接执行写入操作（writeRecord/writeBatch 需要业务输入数据，
// 由后续 Task 接入）。它证明：
//   1. createStageBRunner 可通过 CLI 真实调用（不只是 import）
//   2. runner 不暴露 innerWriter / getRawWriter / createPilotWriter
//   3. 无 transport + 无环境变量时 fail-closed

const {
  createStageBRunner,
  STAGE_B_RUNNER_VERSION,
} = require('../src/migration/pilot/stage-b-runner');

const FORBIDDEN_ACCESSORS = [
  'innerWriter',
  '_writer',
  'writer',
  'getRawWriter',
  'getInnerWriter',
  '_getWriter',
  'createPilotWriter',
  'createPilotWriterV1',
];

function parseArgs(argv) {
  const args = argv.slice(2);
  return {
    check: args.includes('--check'),
    dryRun: args.includes('--dry-run'),
    help: args.includes('--help') || args.includes('-h'),
  };
}

function printHelp() {
  console.log([
    'Usage: node scripts/stage-b-run.js [mode]',
    '',
    'Modes:',
    '  --check      Verify runner properties (no raw writer leak), then exit',
    '  --dry-run    Construct runner with isolated transport (no Feishu writes)',
    '  (none)       Production mode: requires FEISHU_APP_ID/SECRET/TOKEN env vars',
    '',
    'Exit codes:',
    '  0  Success',
    '  1  Runner construction failed (fail-closed)',
    '  2  Raw writer leak detected (security violation)',
  ].join('\n'));
}

function checkRunnerSafety(runner) {
  const leaks = [];
  for (const accessor of FORBIDDEN_ACCESSORS) {
    if (runner[accessor] !== undefined) {
      leaks.push(accessor);
    }
  }
  if (leaks.length > 0) {
    console.error(`SECURITY_VIOLATION: runner exposes forbidden accessors: ${leaks.join(', ')}`);
    process.exit(2);
  }
  if (!Object.isFrozen(runner)) {
    console.error('SECURITY_VIOLATION: runner is not frozen (accessors could be added)');
    process.exit(2);
  }
}

function makeDryRunConfig() {
  return {
    pilot_base_token: 'DRY_RUN_PILOT_TOKEN_001',
    production_v2_base_token: 'DRY_RUN_PROD_TOKEN_002',
    pilot_base_alias: 'DRY_RUN_PILOT_ALIAS',
    table_ids: {
      customer: 'dryRunCustomerTbl',
      project: 'dryRunProjectTbl',
      model: 'dryRunModelTbl',
      makeup: 'dryRunMakeupTbl',
    },
  };
}

function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  let runner;
  try {
    if (args.dryRun) {
      // --dry-run: 使用 isolated transport，不需要真实凭据
      const { createIsolatedTransport } = require('../src/migration/pilot/transports/isolated-transport');
      const { fn } = createIsolatedTransport();
      runner = createStageBRunner({
        config: makeDryRunConfig(),
        transport: fn,
      });
    } else if (args.check) {
      // --check: 同样用 isolated transport 构造 runner，仅做属性验证
      const { createIsolatedTransport } = require('../src/migration/pilot/transports/isolated-transport');
      const { fn } = createIsolatedTransport();
      runner = createStageBRunner({
        config: makeDryRunConfig(),
        transport: fn,
      });
    } else {
      // 生产模式：依赖 FEISHU_* 环境变量构造 real HTTP transport
      // createStageBRunner 内部会校验环境变量，缺失时 fail-closed 抛错
      runner = createStageBRunner({
        config: {
          pilot_base_token: process.env.PILOT_BASE_TOKEN,
          production_v2_base_token: process.env.PRODUCTION_V2_BASE_TOKEN,
          pilot_base_alias: process.env.PILOT_BASE_ALIAS ?? 'PROD_PILOT',
          table_ids: {
            customer: process.env.TABLE_ID_CUSTOMER,
            project: process.env.TABLE_ID_PROJECT,
            model: process.env.TABLE_ID_MODEL,
            makeup: process.env.TABLE_ID_MAKEUP,
          },
        },
      });
    }
  } catch (err) {
    console.error(`FAIL_CLOSED: ${err.message}`);
    process.exit(1);
  }

  // 安全检查：runner 不应暴露任何 raw writer accessor
  checkRunnerSafety(runner);

  // 输出 runner 元数据（证明真实构造成功）
  console.log(JSON.stringify({
    status: 'RUNNER_READY',
    version: runner.version,
    pilot_writer_version: runner.pilot_writer_version,
    pilot_base_alias: runner.pilot_base_alias,
    rule_version: runner.rule_version,
    has_writeRecord: typeof runner.writeRecord === 'function',
    has_writeBatch: typeof runner.writeBatch === 'function',
    frozen: Object.isFrozen(runner),
  }, null, 2));

  process.exit(0);
}

main();
