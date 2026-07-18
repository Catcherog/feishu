# TASK-004：R5 独立复审结论与 R6 全量只读 Dry Run 执行包

> 生成日期：2026-07-18
> 规划/审计者：GPT
> 执行者：Trae
> 工作仓库：`feishu-v2/`
> 审计 HEAD：`8448e9ba74d792f5b227cf78c3399d1253ebe4c6`
> R5 结论：`MVP_PASS_WITH_DEBT`
> 下一允许 Gate：R6

## 1. R5 独立复审结论

R5 第三修复批次（commits `ea18cb6` + `8448e9b`）已通过 GPT 独立复审，结论 `MVP_PASS_WITH_DEBT`。R5 推进为 `INDEPENDENTLY_VERIFIED_PASS`。本轮独立复核证据：

- `feishu-v2/` 工作树干净，`HEAD == origin/master == 8448e9ba74d792f5b227cf78c3399d1253ebe4c6`。
- R5 第三修复批次 commits：`ea18cb69c9eee3ef798ba0bffb45b468c4ddc495`（主体修复）+ `8448e9ba74d792f5b227cf78c3399d1253ebe4c6`（SHA backfill）。
- `node --test tests/migration-classifier.test.js`：58/58 通过，13 suites，退出码 0。
- `python -m unittest tests.test_verify_public_repo tests.test_generate_schema_diff`：17/17 + 3/3 通过，退出码 0。
- `python scripts/verify_public_repo.py`：tracked 146 files，`S0=0 S1=0 S2=0`，退出码 0。
- 11 项 AC 全部满足；AC9（S2_EXEMPT_FILES 删除 + V1 文件脱敏）和 AC10（审计包证据完整 + push）由第三修复批次关闭。

### P1 debt 批准在 R6 审计包定稿前处理

- `phone_number` S1 模式 hex-aware 边界升级：从 `(?<![0-9a-f])...(?![0-9a-f])` 升级为 `(?<![0-9A-Fa-f])...(?![0-9A-Fa-f])`，使大写 SHA/blob hash 不误报。
- 新增回归测试：大写 SHA/blob hash 不误报 + 独立真实手机号仍报告。
- 不恢复任何整文件/路径豁免机制。

## 2. Objective

完成 Gate R6：使用现有 classifier 和 R5 验证过的 Schema v1.1 字段写入路径，对 V1 全量原始数据（304 条：36 customer + 47 project + 106 model + 115 makeup）执行只读 Dry Run，输出 MIGRATABLE / NEEDS_REVIEW / BLOCKED 分表、总量对账、重复候选与孤儿记录聚合、D-026 数量门槛判断；不得创建真实迁移记录，不得启动 `MIGRATION_PILOT_001`。

## 3. In Scope

1. 处理 P1 scanner debt：`phone_number` hex 边界升级 + 回归测试。
2. 完成 R5 closeout：manifest、PUBLIC_EXECUTION_ENTRYPOINT 和审计包同步为 `R5_INDEPENDENTLY_VERIFIED_PASS`；回填第三批次最终 HEAD；清除 stale 文字；修正审计包 337/338 计数冲突。
3. 按 D-020—D-026 和现有 classifier 执行 Customer/Project/Model/Makeup 全量核算。
4. 迁移规则显式填充 5 个默认字段（customer.budget_parse_rule_version、customer.source_channel_mapping_version、customer.status_mapping_rule_version、project.currency、project.status_mapping_rule_version），不依赖 Base 默认值。
5. 明确记录 4 个新增视图的 filter/sort 状态；若不影响机器核算，登记为技术债。
6. 输出 MIGRATABLE / NEEDS_REVIEW / BLOCKED 分表及总量对账、重复候选与孤儿记录聚合结果、D-026 数量门槛判断。
7. 使用私有原始数据时仅写入 gitignored 私有路径；公开仓库只保留脱敏聚合证据。
8. 生成 R6 GPT 审计包（8 点格式 + 证据分级）。
9. 控制面停在 `R6_REVIEW_PENDING`，等待 GPT 审计。

## 4. Out of Scope

- 不修改生产 V2 Base、V1 Base、APP 或自动化。
- 不读取或写入真实客户业务记录（只读原始数据不变更）。
- 不启动 `MIGRATION_PILOT_001`。
- 不写入 NEEDS_REVIEW 或 BLOCKED 分类的 Pilot 记录。
- 不处理 BLOCKED/NEEDS_REVIEW 数据质量问题（仅输出聚合结果供人工审核）。
- 不扩大 Schema v1.1。
- 不执行 history rewrite / force push。

## 5. 执行顺序

### Task 1：R5 closeout

- 更新 `config/public-execution-manifest.json`：`audit_status = R5_INDEPENDENTLY_VERIFIED_PASS`、`gate_status.R5 = INDEPENDENTLY_VERIFIED_PASS`；新增 revision_history 条目记录 GPT 复审结论和 P1 debt。
- 更新 `PUBLIC_EXECUTION_ENTRYPOINT.md`：header、Section 3 gate decision、新增 Section 3.6 R5 independent review outcome。
- 更新 `reports/phaseR5-v11-field-validation-gpt-audit-package.md`：Section 10 控制面最终状态、Section 8.1 R5 Review Gate 关闭、回填 8448e9b SHA、修正 337/338 计数。
- 清除 stale "待 push"、"待回填"、"第二修复批次等待复审" 等文字。

### Task 2：P1 scanner debt

- 修改 `scripts/verify_public_repo.py` 第 95 行：`(?<![0-9a-f])...(?![0-9a-f])` → `(?<![0-9A-Fa-f])...(?![0-9A-Fa-f])`。
- 修改 `tests/test_verify_public_repo.py`：新增大写 SHA hash 不误报测试 + 独立真实手机号仍报告测试 + 混合大小写 hash 不误报测试。
- 不恢复任何整文件/路径豁免机制。

### Task 3：R6 全量只读 Dry Run

- 复用 `scripts/run_classification_accounting.js` + `backups/private/classification-input.private.json`（304 cases）。
- 执行两次核算（验证 SHA256 一致性），私有矩阵输出到 `backups/private/r6-classification-record-matrix.private.json`。
- 公开汇总输出到 `reports/r6-classification-by-entity.json`（按实体分类的 MIGRATABLE / NEEDS_REVIEW / BLOCKED 计数和主原因分布）。
- 重复候选聚合输出到 `reports/r6-duplicate-candidates-summary.json`（按实体分类的 DUPLICATE_UNRESOLVED 计数 + 候选总数，无 record_id）。
- 孤儿记录聚合输出到 `reports/r6-orphan-records-summary.json`（按实体的 ORPHAN_PROJECT / CUSTOMER_UNRESOLVED 计数，无 record_id）。
- D-026 数量门槛判断输出到 `reports/r6-quantity-threshold-judgement.json`：
  - 5 Customer MIGRATABLE
  - 5 Project MIGRATABLE
  - 10 Model MIGRATABLE
  - 10 Makeup MIGRATABLE
- 4 个新增视图的 filter/sort 状态登记到 `reports/r6-views-filter-sort-status.md`（技术债，不阻塞 R6 Gate）。

### Task 4：集中最终验证

- 运行 `node --test tests/migration-classifier.test.js`（预期 58/58 PASS）。
- 运行 `python -m unittest tests.test_verify_public_repo tests.test_generate_schema_diff`（预期 20/20 + 3/3 PASS）。
- 运行 `python scripts/verify_public_repo.py`（tracked 期望 S0=0 S1=0 S2=0）。
- 运行 `python scripts/verify_public_repo.py --staged`（staged 期望 S0=0 S1=0 S2=0）。
- 生成 `reports/phaseR6-read-only-dry-run-gpt-audit-package.md`（8 点格式 + 证据分级）。
- 两次 commit（主体 + SHA backfill）+ push。
- 控制面停在 `R6_REVIEW_PENDING`。

## 6. Acceptance Criteria

| AC | 描述 |
|---|---|
| AC1 | P1 scanner debt 完成：phone_number hex 边界升级为 `[0-9A-Fa-f]`，新增 3 条回归测试（大写、混合大小写、JSON 中的真实手机号） |
| AC2 | R5 closeout 完成：manifest/entrypoint/审计包同步为 `R5_INDEPENDENTLY_VERIFIED_PASS`，8448e9b SHA 回填，337/338 计数修正 |
| AC3 | R6 Dry Run 使用现有 classifier + 304 cases 私有输入，两次运行 SHA256 一致 |
| AC4 | Customer/Project/Model/Makeup 全量核算完成，per-entity 和 overall reconciliation 通过 |
| AC5 | 迁移规则显式填充 5 个 schema 默认字段，文档化在 R6 审计包中 |
| AC6 | 4 个新增视图的 filter/sort 状态明确记录，登记为技术债 |
| AC7 | 输出 MIGRATABLE / NEEDS_REVIEW / BLOCKED 分表、重复候选聚合、孤儿记录聚合、D-026 数量门槛判断 |
| AC8 | 私有原始数据仅写入 gitignored 私有路径，公开仓库只保留脱敏聚合证据 |
| AC9 | 公开仓库和 staged 安全扫描均为 `S0=0 S1=0 S2=0` |
| AC10 | R6 审计包证据完整，工作树干净，提交已 push |
| AC11 | 最终停在 `R6_REVIEW_PENDING`；`MIGRATION_PILOT_001` 未启动 |

## 7. Stop Conditions

- 任何 reconciliation 失败 → 停止并报告。
- 任何 scanner S0/S1/S2 暴露 → 停止并修复。
- 任何私有数据写入公开仓库 → 停止并回滚。
- 任何真实迁移写入（写入 V2 测试 Base 之外的 Base） → 立即停止。
- 任何 history rewrite / force push → 禁止。

## 8. Implementation Constraints

- 复用现有 classifier（`src/migration/classifier/`），不修改分类逻辑。
- 复用现有 `run_classification_accounting.js` 脚本作为核算入口。
- 新增临时脚本（gitignored）仅用于生成本次 R6 特定输出（重复候选聚合、孤儿记录聚合、D-026 判断等）。
- 所有公开报告不得包含真实 record_id、客户姓名、手机号、微信号。
- 证据分级严格按 `docs/audit/PUBLIC_AUDIT_POLICY.md`。
