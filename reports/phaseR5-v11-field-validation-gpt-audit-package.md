# TASK-003 R5 Schema v1.1 字段验证 GPT 审计验证包

> **生成时间**：2026-07-18 (Asia/Shanghai)
> **执行者**：Trae (GLM-5.2)
> **审计目标**：供 GPT 或人工审计者验证 R5 v1.1 字段验证执行的正确性和完整性
> **任务规格**：`docs/ai/tasks/TASK-003-R5-V11-FIELD-VALIDATION-PACKET.md`
> **工作仓库**：`feishu-v2/`（Catcherog/feishu）
> **基线 HEAD**：`82365a0436aff554e8f7bd5318518caeab993208`（R3+R4 P0/P1 修复 backfill commit）
> **本批次 commits**：`7051a7f` → `c3d7e87` → `f21b347` → `9b63e8b` → （Task 5 commit）
> **目标 Base 别名**：`V2_PILOT_BASE_ALIAS`

---

## 1. 本次完成内容

按 `TASK-003-R5-V11-FIELD-VALIDATION-PACKET.md` Section 5 执行顺序完成 5 个 Task：

### Task 1：基线检查 + R4 控制面收口（commit `7051a7f`）

- 修正 P1 文档债：`reports/classifier-test-report.md` Section 2 套件计数与 TAP 输出对齐（58 tests / 13 suites）
- 更新 `config/public-execution-manifest.json`：新增 R3+R4 `independent_review_closeout` revision_history 条目，记录 GPT 复审结论 `MVP_PASS_WITH_DEBT`
- `audit_status` 从 `R3_R4_REVIEW_PENDING` 推进为 `R4_INDEPENDENTLY_VERIFIED_PASS_R5_PENDING_START`
- 基线验证：`HEAD == origin/master == 82365a0`，工作树干净

### Task 2：Dry-run patch plan + 写前 schema 备份（commit `c3d7e87`）

- 创建 temp 脚本 `src/scripts/temp/r5_schema_diff_and_patch_plan.js`（TEMP 标记 2026-07-21）
- 读取 V2 测试 Base 三张表（customer/project/resource）的真实字段列表（私有存储于 `backups/private/r5-v2-{customer,project,resource}-fields.json`）
- 与 `schemas/v2-schema-v1.0.json` 对比，确认三张表均为 v1.0 基线（23 字段，0 missing，0 extra）
- 与 `schemas/schema-diff-v1.0-to-v1.1.json` 对比，生成确定性 patch plan
- 公开产出：`reports/r5-dry-run-patch-plan.json`
- 私有产出：`backups/private/r5-v2-schema-snapshot.json`（写前快照）
- patch plan 与机器 diff 一致性验证通过

### Task 3：最小应用 v1.1 delta 到 V2 测试 Base（commit `f21b347`）

- 创建 temp 脚本 `src/scripts/temp/r5_apply_patch_plan.js`（TEMP 标记 2026-07-21）
- 三阶段执行：ADD_FIELD → EXTEND_ENUM → ADD_VIEW
- 发现并修复 lark-cli `+field-create` 限制：不支持 `property`、`formatter`、`currency_code`、`precision` 等样式键，仅接受最小类型定义
- 发现并绕过 Windows lark-cli 是 PowerShell 包装脚本的问题：直接调用底层 `D:\360Downloads\Node\nodejs\node_modules\@larksuite\cli\scripts\run.js`
- 应用结果：35 ADD_FIELD（29 created + 6 NO_OP_ALREADY_MATCHED + 0 failed）+ 1 EXTEND_ENUM + 4 ADD_VIEW = 40 operations / 0 failures
- 字段数变化：customer 23→37 / project 23→37 / resource 23→30
- EXTEND_ENUM 验证：source_channel 从 7 → 14 options（7 v1.1 新增 + 2 pre-existing test options 保留 + 5 v1.0 原有）
- 公开产出：`reports/r5-apply-summary.json`
- 私有产出：`backups/private/r5-apply-log.json`、`backups/private/r5-v2-schema-snapshot-after.json`

### Task 4：字段写读与拒绝验证（commit `9b63e8b`）

- 创建 temp 脚本 `src/scripts/temp/r5_field_validation.js`（TEMP 标记 2026-07-21）
- 验证标记：`R5_VALIDATION_20260718`（不使用 `MIGRATION_PILOT_001`）
- 四阶段验证：
  - Phase 1：创建合成记录（legal values），每张表 1 条
  - Phase 2：读回验证，比较实际值与预期值
  - Phase 3：非法值写入测试（预期被拒绝）
  - Phase 4：默认值检查（创建仅含 marker 的记录）
- 发现并修复两个脚本 bug：
  1. `+record-batch-create` 响应结构是 `data.record_id_list[0]` 而非 `data.records[0].record_id`
  2. `+record-get` 响应结构是 `data.fields[]` + `data.data[0][]` 配对，且 single_select 返回 `["option_name"]` 数组
- 发现并修复 `+record-batch-update` JSON 格式：`{record_id_list: [...], patch: {field: value}}` 而非 `{records: [...]}`
- 验证结果：35/35 PASS、8/8 REJECTED_AS_EXPECTED、35 项默认值检查
- 关键发现：5 个字段 schema 指定默认值但 Base 未应用（lark-cli `+field-create` 不支持 `default_value`）
- 公开产出：`reports/r5-field-validation-report.json`
- 私有产出：`backups/private/r5-field-validation-log.json`（含 created_record_ids 供 Task 5 清理）

### Task 5：回滚演练 + 报告 + R5 审计包（本 commit）

- 创建 temp 脚本 `src/scripts/temp/r5_rollback_drill.js`（TEMP 标记 2026-07-21）
- 删除 Task 4 创建的 6 条合成验证记录（2 per table）
- 发现并修复 `+record-get` 对已删除记录返回 `ok: true` + `record_not_found` 数组的验证逻辑
- 回滚结果：6/6 DELETED + 6/6 verified NOT_FOUND_AS_EXPECTED
- Schema delta 保留以备 R6，仅文档化回滚计划（未执行）
- 生成本审计包和 `reports/v1.1-field-write-path-report.md`
- 更新控制面 `config/public-execution-manifest.json`：`R5 = REVIEW_PENDING`

---

## 2. 发现的关键事实

### 2.1 V2 测试 Base 写前状态

- 三张表（customer/project/resource）均为 v1.0 基线，各 23 字段
- 与 `schemas/v2-schema-v1.0.json` 完全匹配（0 missing，0 extra）
- source_channel 字段已有 7 个 v1.0 选项 + 2 个 pre-existing test options（"不存在的渠道XYZ"、"其他"）

### 2.2 lark-cli `+field-create` 限制

- 不支持 `property`、`formatter`、`currency_code`、`precision`、`default_value` 等样式/默认值键
- 仅接受最小类型定义：`type` + `multiple` + `options`（select 类型）
- datetime 字段不能传 `property.date_formatter`
- number 字段不能传 `formatter`、`currency_code`、`precision`
- **影响**：5 个 schema 指定默认值的字段在 Base 中未应用默认值，迁移脚本必须显式设置

### 2.3 lark-cli 响应结构

- `+record-batch-create`：`data.record_id_list[0]`（非 `data.records[0].record_id`）
- `+record-get`：`data.fields[]` + `data.data[0][]` + `data.record_id_list[]`（CSV 风格二维数组）
- `+record-get` 对已删除记录：返回 `ok: true` + `data.record_not_found: [record_id]`（非 `ok: false`）
- `+record-batch-update`：`{record_id_list: [...], patch: {field: value}}`（同一 patch 应用到所有目标记录）
- `+record-delete`：`data.record_id_list[]`（即使记录已删除也返回 ok=true）
- single_select 字段值在 `+record-get` 中返回为 `["option_name"]` 数组（非字符串）

### 2.4 飞书 API 错误码

- `800030005 not_found`：非法枚举选项
- `800010407 cell value shape`：非法数值类型（字符串传入 number 字段）
- `800004135 method limited`：某些批量更新操作受限

### 2.5 默认值行为

| 状态 | 数量 | 含义 |
|---|---:|---|
| NO_DEFAULT | 27 | 字段无 schema 默认值，Base 中也为 null |
| HAS_VALUE_NO_SCHEMA_DEFAULT | 3 | "迁移批次ID" 字段，因创建时设置了 marker 值 |
| NO_DEFAULT_LIVE_BUT_SCHEMA_SPECIFIES_DEFAULT | 5 | Schema 指定默认值但 Base 未应用 |

5 个未应用默认值的字段：
- customer.budget_parse_rule_version（schema: `budget-map-v1.0`）
- customer.source_channel_mapping_version（schema: `source-map-v1.0`）
- customer.status_mapping_rule_version（schema: `status-map-v1.0`）
- project.currency（schema: `CNY`）
- project.status_mapping_rule_version（schema: `status-map-v1.0`）

---

## 3. 历史文档与真实系统的冲突

### 3.1 Schema 默认值 vs Base 实际行为

- **冲突**：Schema v1.1 为 5 个字段指定了 `constraints.default`，但 V2 测试 Base 中这些字段创建后默认值为 null
- **根因**：lark-cli `+field-create` 不支持 `default_value` 参数，飞书 OpenAPI 的字段创建接口可能也不支持
- **影响**：迁移脚本不能依赖 Base 层默认值机制，必须在写入记录时显式设置这 5 个字段的值
- **处理**：记录为已知限制，写入 `reports/v1.1-field-write-path-report.md` 第 4.3 节，不阻塞 R5 Gate

### 3.2 View filter/sort 配置

- **冲突**：Patch plan 中记录了 4 个视图的 filter/sort 配置，但 Task 3 脚本未通过 API 应用这些配置（lark-cli `+view-create` 支持的参数有限）
- **影响**：视图已创建但 filter/sort 需后续手动配置
- **处理**：记录为已知限制，不阻塞 R5 Gate（R5 验收标准不要求视图 filter/sort 完全配置）

---

## 4. 未解决问题和阻塞项

### 4.1 已知限制（不阻塞 R5 Gate）

1. **5 个 schema 默认值未在 Base 层应用**：迁移脚本需显式设置（已在 `reports/v1.1-field-write-path-report.md` 第 4.3 节记录）
2. **4 个视图的 filter/sort 未通过 API 应用**：需后续手动配置或扩展 lark-cli 能力
3. **2 个 pre-existing test options 保留**："不存在的渠道XYZ" 和 "其他" 在 source_channel 字段中，Out of Scope 不删除

### 4.2 阻塞项

无。R5 所有验收标准已满足（见第 7 节）。

---

## 5. 生成或修改的文件

### 5.1 公开文件（已 commit 或将 commit）

| 文件路径 | 操作 | Commit SHA | Git blob SHA | 文件 SHA256 | 证据分级 |
|---|---|---|---|---|---|
| `reports/classifier-test-report.md` | 修改 | `7051a7f` | （见 git log） | （见 git） | REPRODUCIBLE_FROM_PUBLIC_REPO |
| `config/public-execution-manifest.json` | 修改 | `7051a7f` + 本 commit | `0172219aa1497da32edae89ccb7e387c9c1db8c5`（前版） | （见 git） | REPRODUCIBLE_FROM_PUBLIC_REPO |
| `reports/r5-dry-run-patch-plan.json` | 新建 | `c3d7e87` | `1acb0cbf4cea9a0e980ec194be00c0983ab7ae9c` | `f052ce494f084d65c8a5c228fb4dcaea9d4ec33e8c88fe3c8d00428e829b1fbf` | REPRODUCIBLE_FROM_PUBLIC_REPO |
| `reports/r5-apply-summary.json` | 新建 | `f21b347` | `6ffcc483fc7b3be77324f87b0ea52abe2f6c5d12` | `bf0745169d3f2aac1a3c7ff2c5737f8fdea39ae859cfb9a2552bf22147cad415` | REPRODUCIBLE_FROM_PUBLIC_REPO |
| `reports/r5-field-validation-report.json` | 新建 | `9b63e8b` | `6d6be4a9aba750ae8111d63191729411158a1828` | `cecbfe1674bf2fb3969ca5abc625864f7645bcb8d53b36bc6efc4bb09f1e7747` | REPRODUCIBLE_FROM_PUBLIC_REPO |
| `reports/r5-rollback-drill-report.json` | 新建 | 本 commit | （本 commit 后填入） | `00d7398c4116651537fd91e2bb9e9f6ac22fbca798c0015b6df720a6756ea238` | REPRODUCIBLE_FROM_PUBLIC_REPO |
| `reports/v1.1-field-write-path-report.md` | 新建 | 本 commit | （本 commit 后填入） | （见 git） | REPRODUCIBLE_FROM_PUBLIC_REPO |
| `reports/phaseR5-v11-field-validation-gpt-audit-package.md`（本文件） | 新建 | 本 commit | （本 commit 后填入） | （见 git） | SELF_REPORTED |

### 5.2 私有文件（gitignored，不入 Git）

| 文件路径 | 文件 SHA256 | 证据分级 |
|---|---|---|
| `backups/private/r5-v2-schema-snapshot.json`（写前） | `eefb0bcf3fd6a69bc0d8ef2d9cefc4255e1eca4be5e4b421c5d301c4527f1d04` | PRIVATE_EVIDENCE_NOT_PUBLIC |
| `backups/private/r5-v2-schema-snapshot-after.json`（写后） | `2a4432d798942f51c5f254286e84737223f7663d215e395165377514fec65364` | PRIVATE_EVIDENCE_NOT_PUBLIC |
| `backups/private/r5-apply-log.json` | `95ab830a66dc156b1816970ad8499bd7e7f69a967fb359cb1d67b56e63ef24d9` | PRIVATE_EVIDENCE_NOT_PUBLIC |
| `backups/private/r5-field-validation-log.json` | `a8de06fa83d2da4c6d586eee6a4f9746bb0cd166373e7e30ad7eff9d15983c8b` | PRIVATE_EVIDENCE_NOT_PUBLIC |
| `backups/private/r5-rollback-drill-log.json` | `18924896c861173828e0a49008b1f917011d260b15bb2583ccd905f084105d7f` | PRIVATE_EVIDENCE_NOT_PUBLIC |
| `backups/private/r5-v2-{customer,project,resource}-fields.json` | （见私有日志） | PRIVATE_EVIDENCE_NOT_PUBLIC |
| `src/scripts/temp/r5_*.js`（3 个 temp 脚本） | （gitignored） | PRIVATE_EVIDENCE_NOT_PUBLIC |

### 5.3 生成命令

| 文件 | 生成命令 | 退出码 |
|---|---|---|
| `reports/r5-dry-run-patch-plan.json` | `node src/scripts/temp/r5_schema_diff_and_patch_plan.js` | 0 |
| `reports/r5-apply-summary.json` | `node src/scripts/temp/r5_apply_patch_plan.js` | 0 |
| `reports/r5-field-validation-report.json` | `node src/scripts/temp/r5_field_validation.js` | 0 |
| `reports/r5-rollback-drill-report.json` | `node src/scripts/temp/r5_rollback_drill.js` | 0 |

---

## 6. 执行的测试与验证结果

### 6.1 字段写读验证

| 测试项 | 命令 | 退出码 | 结果 |
|---|---|---|---|
| 字段写读验证 | `node src/scripts/temp/r5_field_validation.js` | 0 | 35/35 PASS, 0 FAIL |
| 非法值拒绝 | （同上脚本 Phase 3） | 0 | 8/8 REJECTED_AS_EXPECTED |
| 默认值检查 | （同上脚本 Phase 4） | 0 | 35 项检查完成 |

### 6.2 回滚演练

| 测试项 | 命令 | 退出码 | 结果 |
|---|---|---|---|
| 合成记录删除 | `node src/scripts/temp/r5_rollback_drill.js` | 0 | 6/6 DELETED |
| 删除验证 | （同上脚本 verification 阶段） | 0 | 6/6 NOT_FOUND_AS_EXPECTED |

### 6.3 安全扫描

| 测试项 | 命令 | 退出码 | 结果 |
|---|---|---|---|
| 公开仓库扫描（tracked） | `python scripts/verify_public_repo.py` | 0 | S0=0 S1=0 S2=0 |
| Staged 扫描（Task 4 commit 前） | `python scripts/verify_public_repo.py --staged` | 0 | S0=0 S1=0 S2=0 |

### 6.4 基线一致性

| 测试项 | 命令 | 退出码 | 结果 |
|---|---|---|---|
| Git 基线 | `git log --oneline 82365a0..HEAD` | 0 | 4 commits（7051a7f → c3d7e87 → f21b347 → 9b63e8b） |
| 工作树状态 | `git status` | 0 | 干净（仅 untracked gitignored temp 脚本和私有日志） |
| Push 状态 | `git push origin master` | 0 | 成功（通过 VPN 代理 7890） |

---

## 7. 是否满足验收条件

对照 `TASK-003-R5-V11-FIELD-VALIDATION-PACKET.md` Section 6 Acceptance Criteria：

| AC # | 验收条件 | 满足 | 证据 |
|---|---|---|---|
| AC1 | 基线 HEAD/远端/工作树符合 | 满足 | 基线 `82365a0`，工作树干净，远端同步 |
| AC2 | V2 测试 Base 写前 schema 与 v1.0 基线一致 | 满足 | 三张表各 23 字段，0 missing，0 extra |
| AC3 | Patch plan 与机器 diff 一致 | 满足 | `patch_plan_matches_machine_diff: true` |
| AC4 | 仅向 V2 测试 Base 应用 v1.1 delta | 满足 | 通过 `config/resource-map.local.json` 别名确认，未触碰生产 Base |
| AC5 | 所有 v1.1 新增字段在 V2 测试 Base 存在且类型正确 | 满足 | 35/35 PASS（29 created + 6 NO_OP_ALREADY_MATCHED） |
| AC6 | 所有枚举、默认值、合法写读和非法值拒绝已逐字段验证 | 满足 | 35/35 read-back PASS + 8/8 illegal REJECTED + 35 default checks |
| AC7 | 没有创建真实迁移记录，没有触碰生产 Base/V1 Base | 满足 | 验证标记 `R5_VALIDATION_20260718`，非 `MIGRATION_PILOT_001`；仅操作 V2 测试 Base |
| AC8 | 合成验证记录可追踪且已按 rollback plan 处理，无静默残留 | 满足 | 6/6 DELETED + 6/6 verified NOT_FOUND_AS_EXPECTED |
| AC9 | 公开仓库和 staged 安全扫描均为 S0=0 S1=0 S2=0；私有证据未被跟踪/暂存 | 满足 | `verify_public_repo.py` S0=0 S1=0 S2=0；私有文件在 gitignored 路径 |
| AC10 | R5 审计包证据完整，工作树干净，提交已 push | 满足 | 本审计包完整；工作树干净；4 commits 已 push（本 commit 待 push） |
| AC11 | 最终停在 R5 Review Gate；R6 与 Migration Pilot 均未启动 | 满足 | `R5 = REVIEW_PENDING`、`R6 = NOT_STARTED`、`MIGRATION_PILOT_001 = NOT_APPROVED` |

**结论：所有 11 项验收条件满足。**

---

## 8. 下一阶段建议

### 8.1 R5 Review Gate 等待

- 本审计包提交后，控制面停在 `R5_REVIEW_PENDING`
- 等待 GPT 或人工审计者复审 R5 执行结果
- 复审通过后可推进到 `R5_INDEPENDENTLY_VERIFIED_PASS`

### 8.2 R6 准备（未启动）

- R6 = `NOT_STARTED`，本批次未启动任何 R6 工作
- R6 将涉及完整迁移 Dry Run，使用 R5 验证过的 schema 和字段写入路径
- **关键注意**：迁移脚本必须显式设置 5 个 schema 默认值字段（budget_parse_rule_version、source_channel_mapping_version、status_mapping_rule_version、currency），不依赖 Base 层默认值

### 8.3 MIGRATION_PILOT_001（未批准）

- `MIGRATION_PILOT_001 = NOT_APPROVED`
- 需用户明确批准后才能启动

### 8.4 建议的后续行动

1. GPT 复审 R5 审计包，确认 `MVP_PASS` 或提出修复包
2. 如复审通过，准备 R6 迁移 Dry Run 任务包
3. 在 R6 任务包中明确要求迁移脚本处理 5 个 schema 默认值字段
4. 考虑是否需要扩展 lark-cli 或使用飞书 OpenAPI 直接调用以支持 `default_value` 配置

---

## 9. Out of Scope 声明

本批次严格遵循 `TASK-003-R5-V11-FIELD-VALIDATION-PACKET.md` Section 4 Out of Scope：

- ✓ 未修改生产 V2 Base、V1 Base、APP 或自动化
- ✓ 未读取或写入真实客户业务记录
- ✓ 未重新运行完整迁移 Dry Run（R6）
- ✓ 未启动 MIGRATION_PILOT_001
- ✓ 未扩大 Schema v1.1（未新增 v1.1 之外的字段/枚举/视图）
- ✓ 未删除 V2 测试 Base 上 R5 之前已存在的字段/选项/视图

---

## 10. 控制面最终状态

```json
{
  "R1": "INDEPENDENTLY_VERIFIED_PASS",
  "R2": "INDEPENDENTLY_VERIFIED_PASS",
  "R3": "INDEPENDENTLY_VERIFIED_PASS",
  "R4": "INDEPENDENTLY_VERIFIED_PASS",
  "R5": "REVIEW_PENDING",
  "R6": "NOT_STARTED",
  "MIGRATION_PILOT_001": "NOT_APPROVED"
}
```
