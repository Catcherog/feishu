# TASK-002 Migration Classifier Test Report

> **生成时间**：2026-07-18 (Asia/Shanghai)
> **工作仓库**：`feishu-v2/` (Catcherog/feishu)
> **基线提交**：`f2bb1ffb724c76d4aa5b95840f0460125d788290`
> **R3 提交**：`0a05378b8863dd14ce1b88d5803d654c2c4069cd`
> **R4 提交**：`e42e2a4`（首轮 R4 Review Gate，已被本轮 P0/P1 修复取代）
> **本轮修复基线**：`docs/ai/tasks/TASK-002-R4-FIX-PACKET.md`
> **规则源**：DECISION_LOG D-020 — D-025
> **执行者**：Trae

## 1. 概览

R3 实现了一个纯函数、确定性的迁移分类器，覆盖 Customer / Project / Model / Makeup 四类记录。R3 测试套件使用完全合成的 fixtures，无需访问私有导出即可在干净公开仓库上运行。

本轮在 R3+R4 首轮审计 MVP_FAIL 后，按 `TASK-002-R4-FIX-PACKET.md` 修复 5 个 P0 阻塞项 + 1 个 P1 文档准确性问题，并新增 P0 回归测试与 fixtures。

| 指标 | 值 |
|---|---|
| Test suites | 13 |
| Tests | 58 |
| Pass | 58 |
| Fail | 0 |
| Skipped | 0 |
| 总耗时 | ~110ms |
| Node.js 入口 | `node --test tests/migration-classifier.test.js` |
| 退出码 | 0 |

## 2. 测试套件结构

| Suite | Tests | 覆盖内容 |
|---|---|---|
| 1. classifier public surface | 5 | `classifyRecord` / `classifyBatch` / `parseBudget` / `buildAccountingSummary` 入口签名和最小输出形状 |
| 2. classifyBatch full fixture correctness | 1 | 对 `cases.json` 全量 fixture 与 `expected.json` 逐条对账 |
| 3. every reason code has primary case | 1 | 每个 reason code 至少在一条 fixture 中作为 `primary_reason_code` 出现 |
| 4. four entity types covered | 1 | customer / project / model / makeup 均在 fixtures 中出现 |
| 5. multi-reason conflicts | 5 | 同时命中多个原因时的优先级、稳定排序、去重 |
| 6. duplicate candidate decisions | 3 | `SAME_ENTITY` / `DISTINCT_ENTITY` / `UNRESOLVED` 三类决策 |
| 7. budget parsing variants | 1 | 空预算 / 合法范围 / 上下限 / 模糊预算 / 前缀符号形式 / 反向形式（D-025） |
| 8. classifyRecord single-record mode | 1 | 无 batch context 时 `CUSTOMER_UNRESOLVED` 不触发、`ORPHAN_PROJECT` 退化为 hint-assume |
| 9. buildAccountingSummary reconciliation | 1 | MIGRATABLE + NEEDS_REVIEW + BLOCKED = source_total，且主原因总和 = source_total |
| 10. deterministic output (SHA256) | 2 | 连续两次相同 fixtures 输出 SHA256 一致；乱序输入 SHA256 一致 |
| 11. P0-1 regression: budget prefix-symbol direction | 8 | `<3000`/`≤3000`/`>5000`/`≥5000` parsed；`3000<`/`5000≥`/`3000≤`/`5000>` ambiguous |
| 12. P0-2 regression: D-020 customer status inference | 3 | CUSTOMER_ALIAS_020/PROJECT_ALIAS_014/CUSTOMER_ALIAS_009 状态传播 |
| 13. P0-3 + P0-4 regression: 已交付/已归档 + has_valid_need_summary | 3 | PROJECT_ALIAS_012/013 ELIGIBLE；CUSTOMER_ALIAS_019 ELIGIBLE；CUSTOMER_ALIAS_003 仍 BLOCKED |

## 3. Fixtures 概况

| 文件 | 路径 | 用途 | 记录数 |
|---|---|---|---|
| cases.json | `tests/fixtures/migration/cases.json` | 合成输入 | 43 条（覆盖每个 reason code 单独命中 + 多原因组合 + P0 回归） |
| expected.json | `tests/fixtures/migration/expected.json` | 期望分类输出 | 43 条 |

fixtures 全部使用合成名称（`CUSTOMER_ALIAS_001`、`PROJECT_ALIAS_011` 等），与真实飞书记录无任何对应关系。真实飞书 record_id 仅出现在私有 `backups/private/classification-record-matrix.private.json`（gitignored），不出现在公开 fixtures 中。

本轮新增的 5 条 P0 回归 fixtures：

| Alias | 实体 | 用途 |
|---|---|---|
| `CUSTOMER_ALIAS_019` | customer | P0-4 验证：name + has_valid_need_summary=true，无 phone/wechat/source → ELIGIBLE |
| `CUSTOMER_ALIAS_020` | customer | P0-2 验证：status=已拍摄，linked_project_keys=[PROJECT_ALIAS_014（status=无法判断）] → STATUS_NEEDS_REVIEW |
| `PROJECT_ALIAS_012` | project | P0-3 验证：status=已交付 → ELIGIBLE |
| `PROJECT_ALIAS_013` | project | P0-3 验证：status=已归档 → ELIGIBLE |
| `PROJECT_ALIAS_014` | project | P0-2 验证：status=无法判断 → STATUS_NEEDS_REVIEW |

## 4. Reason Code 覆盖矩阵

下表为每条 reason code 选定一个"干净单独命中"的 fixture（primary_reason_code 为该 code 且 secondary_reason_codes 为空数组）。本表已与 `expected.json` 逐条对账修正，首轮报告中 DUPLICATE_UNRESOLVED / STATUS_NEEDS_REVIEW / SOURCE_UNMAPPED / BUDGET_AMBIGUOUS 的 fixture 引用错位问题（P1）已修复。

| Reason Code | Priority | Classification | 干净单独命中 fixture |
|---|---:|---|---|
| `MISSING_NAME` | 10 | BLOCKED | `PROJECT_ALIAS_004` |
| `MISSING_IDENTITY` | 20 | BLOCKED | `CUSTOMER_ALIAS_003` |
| `ORPHAN_PROJECT` | 30 | BLOCKED | `PROJECT_ALIAS_005` |
| `CUSTOMER_UNRESOLVED` | 40 | NEEDS_REVIEW | `PROJECT_ALIAS_002` |
| `DUPLICATE_UNRESOLVED` | 50 | NEEDS_REVIEW | `CUSTOMER_ALIAS_004` |
| `STATUS_NEEDS_REVIEW` | 60 | NEEDS_REVIEW | `CUSTOMER_ALIAS_009` |
| `SOURCE_UNMAPPED` | 70 | NEEDS_REVIEW | `CUSTOMER_ALIAS_010` |
| `BUDGET_AMBIGUOUS` | 80 | NEEDS_REVIEW | `CUSTOMER_ALIAS_011` |
| `PROJECT_TYPE_UNMAPPED` | 90 | NEEDS_REVIEW | `PROJECT_ALIAS_011` |
| `ELIGIBLE` | 100 | MIGRATABLE | `CUSTOMER_ALIAS_001` |

注：多原因组合 fixture（如 `CUSTOMER_ALIAS_002` = MISSING_NAME + [MISSING_IDENTITY, STATUS_NEEDS_REVIEW]）由测试套件 5 单独覆盖，不在此矩阵中重复列出。

## 5. 关键不变式验证

| 不变式 | 验证方式 | 结果 |
|---|---|---|
| 每条记录恰有一个 `primary_reason_code` | `buildAccountingSummary` 对缺失抛错；测试 9 验证 | ✓ |
| `secondary_reason_codes` 稳定排序且无重复 | `sortAndDedupReasonCodes` + 测试 5/10 验证 | ✓ |
| MIGRATABLE + NEEDS_REVIEW + BLOCKED = source_total | `buildAccountingSummary` 每实体校验 + 测试 9 | ✓ |
| 主原因计数总和 = source_total | `buildAccountingSummary` + 测试 9 | ✓ |
| 确定性（顺序无关） | 测试 10：乱序输入 SHA256 一致 | ✓ |
| 确定性（重跑一致） | 测试 10：连续两次 SHA256 一致 | ✓ |
| P0-1：前缀符号 `<`/`≤`/`>`/`≥` 必须在数字之前 | 测试套件 11（8 个测试） | ✓ |
| P0-2：客户状态推断传播关联项目的任意未知状态 | 测试套件 12（3 个测试） | ✓ |
| P0-3：合法 V2 状态 `已交付`/`已归档` 不应误判为 STATUS_NEEDS_REVIEW | 测试套件 13（PROJECT_ALIAS_012/013） | ✓ |
| P0-4：`has_valid_need_summary=true` 可作为身份证据 | 测试套件 13（CUSTOMER_ALIAS_019 ELIGIBLE；003 仍 BLOCKED） | ✓ |

## 6. R4 私有核算结果

R4 在私有导出（`backups/private/v1-raw-export-v1.1.json`，304 条真实记录）上运行同一公开分类器。本轮在 P0 修复后重新运行，结果如下：

| 实体 | source_total | MIGRATABLE | NEEDS_REVIEW | BLOCKED | reconciled |
|---|---:|---:|---:|---:|---|
| customer | 36 | 0 | 2 | 34 | ✓ |
| project | 47 | 0 | 0 | 47 | ✓ |
| model | 106 | 3 | 35 | 68 | ✓ |
| makeup | 115 | 5 | 34 | 76 | ✓ |
| **overall** | **304** | **8** | **71** | **225** | ✓ |

### 6.1 主原因计数分布（公开匿名汇总）

| 实体 | MISSING_NAME | MISSING_IDENTITY | ORPHAN_PROJECT | STATUS_NEEDS_REVIEW | ELIGIBLE | 合计 |
|---|---:|---:|---:|---:|---:|---:|
| customer | 23 | 11 | - | 2 | - | 36 |
| project | 25 | - | 22 | - | - | 47 |
| model | 38 | 30 | - | 35 | 3 | 106 |
| makeup | 39 | 37 | - | 34 | 5 | 115 |
| **合计** | **125** | **78** | **22** | **71** | **8** | **304** |

### 6.2 与首轮 R4 的差异

| 实体 | 指标 | 首轮 R4（commit `e42e2a4`） | 本轮 P0 修复后 | 差异 | 解释 |
|---|---|---:|---:|---|---|
| customer | NEEDS_REVIEW | 0 | 2 | +2 | P0-2 + P0-4：2 条客户原为 MISSING_IDENTITY/BLOCKED，现因 `has_valid_need_summary=true` 提供身份 + 关联项目状态不明确 → STATUS_NEEDS_REVIEW |
| customer | BLOCKED | 36 | 34 | -2 | 同上 |
| customer | MISSING_IDENTITY | 13 | 11 | -2 | 同上（2 条客户因 has_valid_need_summary 不再 MISSING_IDENTITY） |
| customer | STATUS_NEEDS_REVIEW | 0 | 2 | +2 | 同上 |
| project | (全部) | 0/0/47 | 0/0/47 | 0 | 项目分类未受 P0 修复影响（V1 项目数据无 `已交付`/`已归档`/`无法判断` 状态） |
| model | (全部) | 3/35/68 | 3/35/68 | 0 | 未受影响 |
| makeup | (全部) | 5/34/76 | 5/34/76 | 0 | 未受影响 |
| **overall** | NEEDS_REVIEW | 69 | 71 | +2 | 客户 +2 |
| **overall** | BLOCKED | 227 | 225 | -2 | 客户 -2 |

主原因计数总和仍等于 source_total（304），每实体 reconciled=true。

## 7. 确定性证据（R4 私有矩阵）

连续两次运行 CLI（在 P0 修复后的分类器上），私有矩阵和公开汇总 SHA256 完全一致：

| 文件 | 类别 | Run 1 SHA256 | Run 2 SHA256 | 一致 |
|---|---|---|---|---|
| `backups/private/classification-record-matrix.private.json` | PRIVATE_EVIDENCE_NOT_PUBLIC | `9401ba56f0d812e3f41e47a5450b0bbcf4f2aa25502cf15959e8bdfbb96200f2` | `9401ba56f0d812e3f41e47a5450b0bbcf4f2aa25502cf15959e8bdfbb96200f2` | ✓ |
| `reports/classification-reason-summary.json` | REPRODUCIBLE_FROM_PUBLIC_REPO | `548077756b9e50b883e2674c2268926849d67e86b13494b90b06673e2c49e632` | `548077756b9e50b883e2674c2268926849d67e86b13494b90b06673e2c49e632` | ✓ |

注：SHA256 显示为小写十六进制，与 PowerShell `Get-FileHash` 输出的大写形式等价。

## 8. Out of Scope 声明

Trae 明确声明未执行以下操作（与 `TASK-002-R4-FIX-PACKET.md` 一致）：

- 未启动 R5（v1.1 字段写入验证）
- 未启动 R6（完整 Dry Run + Gate 决策）
- 未启动 `MIGRATION_PILOT_001`
- 未修改 V2 Base、Schema、字段或视图
- 未调用飞书 API，未重新导出真实数据（仅使用既有 `backups/private/v1-raw-export-v1.1.json`）
- 未创建、修改或删除任何真实业务记录
- 未修改 APP 或部署自动化
- 未修改根 SOP 仓库既有的 6 个修改文件和 `TASK-001.md`
- 未修改历史 R2 审计包或独立复核报告
- 未执行 R5/R6 任何子步骤

## 9. 最终状态

| Gate | 状态 |
|---|---|
| R1 | INDEPENDENTLY_VERIFIED_PASS |
| R2 | INDEPENDENTLY_VERIFIED_PASS |
| R3 | R3_REVIEW_PENDING（本轮 P0 修复后重新提交，待 GPT 复审） |
| R4 | R4_REVIEW_PENDING（本轮 P0 修复后重新提交，待 GPT 复审） |
| R5 | NOT_STARTED |
| R6 | NOT_STARTED |
| MIGRATION_PILOT_001 | NOT_APPROVED |

停在 R4 Review Gate，等待 GPT/用户外部审计。
