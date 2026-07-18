# R6 Views Filter/Sort Status (Tech Debt)

> 生成日期：2026-07-18
> 关联任务：TASK-004 R6 全量只读 Dry Run
> 关联决策：Schema v1.0 → v1.1 delta（`schemas/schema-diff-v1.0-to-v1.1.json` view_changes=4）
> 状态：TECH_DEBT — 不阻塞 R6 Gate，需在 MIGRATION_PILOT_001 启动前处理

## 1. 背景

Schema v1.1 在 v1.0 基础上新增 4 个视图（见 `schemas/schema-diff-v1.0-to-v1.1.json` 第 1266-1314 行）。R5 Task 3 已在 V2 测试 Base 上通过 `lark-cli +view-create` 创建这 4 个视图（commit `f21b347`，4 ADD_VIEW / 0 failures）。

**已知限制**：`lark-cli +view-create` 仅接受 `view_name` + `view_type` 两个参数，不支持通过 API 应用 `filter` 和 `sort` 配置（详见 `reports/phaseR5-v11-field-validation-gpt-audit-package.md` Section 3.2）。因此 4 个视图虽已在 V2 测试 Base 上创建，但 filter/sort 配置尚未应用。

## 2. 4 个新增视图的预期配置 vs 实际状态

| # | 表 | 视图名 | 视图类型 | 预期 filter | 预期 sort | 实际 filter | 实际 sort | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | customer | 迁移记录 | 表格 | migration_batch_id 不为空 | migrated_at 降序 | 未配置 | 未配置 | TECH_DEBT |
| 2 | project | 按付款状态分组 | 看板 | 无 | — | 未配置 | 未配置 | TECH_DEBT |
| 3 | project | 迁移记录 | 表格 | migration_batch_id 不为空 | migrated_at 降序 | 未配置 | 未配置 | TECH_DEBT |
| 4 | resource | 迁移记录 | 表格 | migration_batch_id 不为空 | migrated_at 降序 | 未配置 | 未配置 | TECH_DEBT |

## 3. 影响评估

### 3.1 对 R6 机器核算的影响

**无影响**。R6 Dry Run 完全使用 `src/migration/classifier/` 中的纯函数分类器和 `scripts/run_classification_accounting.js` 核算脚本，不依赖 V2 Base 视图的 filter/sort。视图仅用于人工查阅 V2 Base 的迁移记录，对分类逻辑、聚合结果、D-026 门槛判断等均无影响。

### 3.2 对 MIGRATION_PILOT_001 的影响

**需要在 MIGRATION_PILOT_001 启动前处理**。迁移试点启动后，运营人员需要通过 `迁移记录` 视图监控迁移进度，通过 `按付款状态分组` 视图核对项目付款状态分布。若 filter/sort 未配置，视图将显示全部记录（无 filter）并按默认顺序排列（无 sort），增加人工筛选成本。

### 3.3 对 R6 Gate 的影响

**不阻塞 R6 Gate**。R6 验收标准（见 `docs/ai/tasks/TASK-004-R6-READ-ONLY-DRY-RUN-PACKET.md` Section 6 AC6）明确"4 个新增视图的 filter/sort 状态明确记录；若不影响机器核算，可登记为技术债"。本报告满足该 AC。

## 4. 处理方案（不在本批次执行）

以下方案供后续处理参考，本批次不执行：

1. **方案 A（推荐）**：通过飞书 OpenAPI 直接调用 `PATCH /open-apis/bitable/v1/apps/:app_token/tables/:table_id/views/:view_id` 接口配置 filter/sort，绕过 lark-cli 限制。需要扩展 lark-cli 或编写独立 OpenAPI 调用脚本。
2. **方案 B**：在 MIGRATION_PILOT_001 启动前，由人工在飞书界面手动配置 4 个视图的 filter/sort。简单但不可复现。
3. **方案 C**：扩展 lark-cli `+view-create` 支持 `--filter` 和 `--sort` 参数。需要向上游提交 PR 或维护本地 patch。

## 5. 处理时机

- **R6 Gate 期间**：不处理，登记为技术债。
- **MIGRATION_PILOT_001 启动前**：必须处理（选择方案 A/B/C 之一），确保运营人员可使用视图监控迁移进度。
- **MIGRATION_PILOT_001 启动后**：若发现视图配置不正确，立即暂停迁移并修复。

## 6. 关联文件

- `schemas/schema-diff-v1.0-to-v1.1.json` — view_changes 数组定义 4 个新增视图
- `reports/r5-apply-summary.json` — R5 Task 3 应用结果（4 ADD_VIEW / 0 failures）
- `reports/phaseR5-v11-field-validation-gpt-audit-package.md` Section 3.2 — 已知限制记录
- `docs/v2-view-inventory.md` — 视图清单
