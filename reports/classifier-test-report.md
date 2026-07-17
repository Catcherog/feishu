# TASK-002 Migration Classifier Test Report

> **生成时间**：2026-07-17
> **工作仓库**：`feishu-v2/` (Catcherog/feishu)
> **基线提交**：`f2bb1ffb724c76d4aa5b95840f0460125d788290`
> **R3 提交**：`0a05378b8863dd14ce1b88d5803d654c2c4069cd`
> **规则源**：DECISION_LOG D-020 — D-025
> **执行者**：Trae

## 1. 概览

R3 实现了一个纯函数、确定性的迁移分类器，覆盖 Customer / Project / Model / Makeup 四类记录。R3 测试套件使用完全合成的 fixtures，无需访问私有导出即可在干净公开仓库上运行。

| 指标 | 值 |
|---|---|
| Test suites | 10 |
| Tests | 42 |
| Pass | 42 |
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
| 7. budget parsing variants | 1 | 空预算 / 合法范围 / 上下限 / 模糊预算（D-025） |
| 8. classifyRecord single-record mode | 1 | 无 batch context 时 `CUSTOMER_UNRESOLVED` 不触发、`ORPHAN_PROJECT` 退化为 hint-assume |
| 9. buildAccountingSummary reconciliation | 1 | MIGRATABLE + NEEDS_REVIEW + BLOCKED = source_total，且主原因总和 = source_total |
| 10. deterministic output (SHA256) | 2 | 连续两次相同 fixtures 输出 SHA256 一致；乱序输入 SHA256 一致 |

## 3. Fixtures 概况

| 文件 | 路径 | 用途 | 记录数 |
|---|---|---|---|
| cases.json | `tests/fixtures/migration/cases.json` | 合成输入 | 39 条（覆盖每个 reason code 单独命中 + 多原因组合） |
| expected.json | `tests/fixtures/migration/expected.json` | 期望分类输出 | 39 条 |

fixtures 全部使用合成名称（`CUSTOMER_ALIAS_001`、`PROJECT_ALIAS_011` 等），与真实飞书记录无任何对应关系。真实飞书 record_id 仅出现在私有 `backups/private/classification-record-matrix.private.json`（gitignored），不出现在公开 fixtures 中。

## 4. Reason Code 覆盖矩阵

| Reason Code | Priority | Classification | 单独命中 fixture |
|---|---:|---|---|
| `MISSING_NAME` | 10 | BLOCKED | `CUSTOMER_ALIAS_002` |
| `MISSING_IDENTITY` | 20 | BLOCKED | `CUSTOMER_ALIAS_003` |
| `ORPHAN_PROJECT` | 30 | BLOCKED | `PROJECT_ALIAS_004` |
| `CUSTOMER_UNRESOLVED` | 40 | NEEDS_REVIEW | `PROJECT_ALIAS_006` |
| `DUPLICATE_UNRESOLVED` | 50 | NEEDS_REVIEW | `CUSTOMER_ALIAS_007` |
| `STATUS_NEEDS_REVIEW` | 60 | NEEDS_REVIEW | `CUSTOMER_ALIAS_008` |
| `SOURCE_UNMAPPED` | 70 | NEEDS_REVIEW | `CUSTOMER_ALIAS_009` |
| `BUDGET_AMBIGUOUS` | 80 | NEEDS_REVIEW | `CUSTOMER_ALIAS_010` |
| `PROJECT_TYPE_UNMAPPED` | 90 | NEEDS_REVIEW | `PROJECT_ALIAS_011` |
| `ELIGIBLE` | 100 | MIGRATABLE | `CUSTOMER_ALIAS_001` |

## 5. 关键不变式验证

| 不变式 | 验证方式 | 结果 |
|---|---|---|
| 每条记录恰有一个 `primary_reason_code` | `buildAccountingSummary` 对缺失抛错；测试 9 验证 | ✓ |
| `secondary_reason_codes` 稳定排序且无重复 | `sortAndDedupReasonCodes` + 测试 5/10 验证 | ✓ |
| MIGRATABLE + NEEDS_REVIEW + BLOCKED = source_total | `buildAccountingSummary` 每实体校验 + 测试 9 | ✓ |
| 主原因计数总和 = source_total | `buildAccountingSummary` + 测试 9 | ✓ |
| 确定性（顺序无关） | 测试 10：乱序输入 SHA256 一致 | ✓ |
| 确定性（重跑一致） | 测试 10：连续两次 SHA256 一致 | ✓ |

## 6. R4 私有核算结果

R4 在私有导出（`backups/private/v1-raw-export-v1.1.json`，304 条真实记录）上运行同一公开分类器。结果如下：

| 实体 | source_total | MIGRATABLE | NEEDS_REVIEW | BLOCKED | reconciled |
|---|---:|---:|---:|---:|---|
| customer | 36 | 0 | 0 | 36 | ✓ |
| project | 47 | 0 | 0 | 47 | ✓ |
| model | 106 | 3 | 35 | 68 | ✓ |
| makeup | 115 | 5 | 34 | 76 | ✓ |
| **overall** | **304** | **8** | **69** | **227** | ✓ |

主原因计数分布见 `reports/classification-reason-summary.json`。

## 7. 确定性证据（R4 私有矩阵）

连续两次运行 CLI，私有矩阵和公开汇总 SHA256 完全一致：

| 文件 | 类别 | Run 1 SHA256 | Run 2 SHA256 | 一致 |
|---|---|---|---|---|
| `backups/private/classification-record-matrix.private.json` | PRIVATE_EVIDENCE_NOT_PUBLIC | `2f503916ee7e4dbc77666b701b30a52bc067c276ae231ce2c178ee2981a72244` | `2f503916ee7e4dbc77666b701b30a52bc067c276ae231ce2c178ee2981a72244` | ✓ |
| `reports/classification-reason-summary.json` | REPRODUCIBLE_FROM_PUBLIC_REPO | `5e78d6d64e48276a09519713b492716d4d4de2f71e7c0022a6adabf9e1f4165f` | `5e78d6d64e48276a09519713b492716d4d4de2f71e7c0022a6adabf9e1f4165f` | ✓ |

## 8. Out of Scope 声明

Trae 明确声明未执行以下操作（TASK-002 Out of Scope）：

- 未修改 V2 Base、Schema、字段或视图
- 未调用飞书 API，未重新导出真实数据
- 未创建、修改或删除任何真实业务记录
- 未执行 v1.1 字段写入验证（R5）
- 未执行新一轮完整 Dry Run 或 Gate 决策（R6）
- 未启动 `MIGRATION_PILOT_001`
- 未修改 APP 或部署自动化
- 未修改根 SOP 仓库既有的 6 个修改文件和 `TASK-001.md`
- 未修改历史 R2 审计包或独立复核报告

## 9. 最终状态

| Gate | 状态 |
|---|---|
| R1 | INDEPENDENTLY_VERIFIED_PASS |
| R2 | INDEPENDENTLY_VERIFIED_PASS |
| R3 | R3_REVIEW_PENDING |
| R4 | R4_REVIEW_PENDING |
| R5 | NOT_STARTED |
| R6 | NOT_STARTED |
| MIGRATION_PILOT_001 | NOT_APPROVED |

停在 R4 Review Gate，等待 GPT/用户外部审计。
