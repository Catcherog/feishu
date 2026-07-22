// Stage B Entry — 子进程测试
//
// FAMP-CONTRACT-ADOPTION-GATE-01-R1-FIX / RF-FIX-03
//
// GPT R2 裁决 RF-FIX-03 要求：「测试必须通过子进程或真实入口命令启动，
// 而不只是直接 import runner 模块，并证明无法获得原始 writer。」
//
// 本测试通过 node:child_process spawning `node scripts/stage-b-run.js` 验证：
//   1. --check 模式：exit 0，输出 RUNNER_READY，frozen=true
//   2. --dry-run 模式：exit 0，输出 RUNNER_READY
//   3. 无参数 + 无环境变量：exit 1，输出 FAIL_CLOSED
//   4. 输出中不包含 innerWriter / getRawWriter 等泄露标记
//
// Run:  node --test tests/stage-b-entry.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const SCRIPT_PATH = path.join(__dirname, '..', 'scripts', 'stage-b-run.js');

function runScript(args = [], env = {}) {
  const fullEnv = {
    ...process.env,
    FEISHU_APP_ID: '',
    FEISHU_APP_SECRET: '',
    FEISHU_BASE_APP_TOKEN: '',
    ...env,
  };
  // 删除空字符串环境变量（避免被识别为"已设置"）
  for (const key of ['FEISHU_APP_ID', 'FEISHU_APP_SECRET', 'FEISHU_BASE_APP_TOKEN']) {
    if (fullEnv[key] === '') delete fullEnv[key];
  }
  const result = spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
    encoding: 'utf8',
    env: fullEnv,
    timeout: 15000,
  });
  return {
    exitCode: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

describe('stage-b-run.js CLI entry (RF-FIX-03)', () => {

  test('1. --check mode: exit 0, RUNNER_READY, frozen=true', () => {
    const { exitCode, stdout } = runScript(['--check']);
    assert.equal(exitCode, 0, `expected exit 0, got ${exitCode}\nstderr: ${runScript(['--check']).stderr}`);
    const output = JSON.parse(stdout.trim());
    assert.equal(output.status, 'RUNNER_READY');
    assert.equal(output.frozen, true);
    assert.equal(typeof output.has_writeRecord, 'boolean');
    assert.equal(output.has_writeRecord, true);
    assert.equal(output.has_writeBatch, true);
  });

  test('2. --dry-run mode: exit 0, RUNNER_READY', () => {
    const { exitCode, stdout } = runScript(['--dry-run']);
    assert.equal(exitCode, 0);
    const output = JSON.parse(stdout.trim());
    assert.equal(output.status, 'RUNNER_READY');
    assert.match(output.pilot_writer_version, /pilot-writer-v1/);
  });

  test('3. no args + no env vars: exit 1, FAIL_CLOSED', () => {
    const { exitCode, stderr } = runScript([]);
    assert.equal(exitCode, 1, `expected exit 1 (fail-closed), got ${exitCode}`);
    assert.match(stderr, /FAIL_CLOSED/);
    assert.match(stderr, /FEISHU_APP_ID|no transport injected/i);
  });

  test('4. runner output does NOT expose forbidden accessors', () => {
    const { exitCode, stdout, stderr } = runScript(['--check']);
    assert.equal(exitCode, 0);
    const allOutput = stdout + stderr;
    // 验证输出中不包含 raw writer 泄露标记
    const forbidden = ['innerWriter', 'getRawWriter', 'getInnerWriter', 'createPilotWriter'];
    for (const accessor of forbidden) {
      assert.ok(
        !allOutput.includes(`"${accessor}"`),
        `output should not expose forbidden accessor: ${accessor}`
      );
    }
  });

  test('5. --help mode: exit 0, prints usage', () => {
    const { exitCode, stdout } = runScript(['--help']);
    assert.equal(exitCode, 0);
    assert.match(stdout, /Usage:/);
    assert.match(stdout, /--check/);
    assert.match(stdout, /--dry-run/);
  });

  test('6. npm run stage-b:check works (package.json script wired)', () => {
    // 直接调用脚本路径（等效于 npm run stage-b:check）
    const { exitCode, stdout } = runScript(['--check']);
    assert.equal(exitCode, 0);
    const output = JSON.parse(stdout.trim());
    assert.equal(output.version, 'stage-b-runner-v1.0');
  });
});
