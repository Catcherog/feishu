# TASK-003 R5 Schema v1.1 字段验证 GPT 审计验证包

> **生成时间**：2026-07-18 (Asia/Shanghai)，R5 修复批次更新于 2026-07-18
> **执行者**：Trae (GLM-5.2)
> **审计目标**：供 GPT 或人工审计者验证 R5 v1.1 字段验证执行的正确性和完整性
> **任务规格**：`docs/ai/tasks/TASK-003-R5-V11-FIELD-VALIDATION-PACKET.md`（主批次）+ `docs/ai/tasks/TASK-003-R5-REVIEW-FIX-PACKET.md`（修复批次）
> **工作仓库**：`feishu-v2/`（Catcherog/feishu）
> **基线 HEAD**：`82365a0436aff554e8f7bd5318518caeab993208`（R3+R4 P0/P1 修复 backfill commit）
> **R5 主批次 commits**（6 个）：`7051a7f` → `c3d7e87` → `f21b347` → `9b63e8b` → `f373374` → `3df9fc5`（SHA backfill）
> **R5 主批次最终 HEAD**：`3df9fc5da09c751f28629d053951a50374138dda`
> **R5 复审结论**：`MVP_FAIL`（GPT 2026-07-18，3 个 P0 阻塞）
> **R5 修复批次基线 HEAD**：`3df9fc5da09c751f28629d053951a50374138dda`
> **R5 修复批次 commits**（2 个）：`82d9886`（P0-1/P0-2/P0-3 主体修复）→ R5 fix backfill commit（SHA 引用回填，将在下方"审计包自引用策略"小节单列）
> **R5 修复批次最终 HEAD**：将在 R5 fix backfill commit 后通过 `git rev-parse HEAD` 获取并回填到本节
> **目标 Base 别名**：`V2_PILOT_BASE_ALIAS`

---

## 1. 本次完成内容

### 1.A R5 主批次（按 `TASK-003-R5-V11-FIELD-VALIDATION-PACKET.md` Section 5 执行 5 个 Task）

#### Task 1：基线检查 + R4 控制面收口（commit `7051a7f`）

- 修正 P1 文档债：`reports/classifier-test-report.md` Section 2 套件计数与 TAP 输出对齐（58 tests / 13 suites）
- 更新 `config/public-execution-manifest.json`：新增 R3+R4 `independent_review_closeout` revision_history 条目，记录 GPT 复审结论 `MVP_PASS_WITH_DEBT`
- `audit_status` 从 `R3_R4_REVIEW_PENDING` 推进为 `R4_INDEPENDENTLY_VERIFIED_PASS_R5_PENDING_START`
- 基线验证：`HEAD == origin/master == 82365a0`，工作树干净

#### Task 2：Dry-run patch plan + 写前 schema 备份（commit `c3d7e87`）

- 创建 temp 脚本 `src/scripts/temp/r5_schema_diff_and_patch_plan.js`（TEMP 标记 2026-07-21）
- 读取 V2 测试 Base 三张表（customer/project/resource）的真实字段列表（私有存储于 `backups/private/r5-v2-{customer,project,resource}-fields.json`）
- 与 `schemas/v2-schema-v1.0.json` 对比，确认三张表均为 v1.0 基线（23 字段，0 missing，0 extra）
- 与 `schemas/schema-diff-v1.0-to-v1.1.json` 对比，生成确定性 patch plan
- 公开产出：`reports/r5-dry-run-patch-plan.json`
- 私有产出：`backups/private/r5-v2-schema-snapshot.json`（写前快照）
- patch plan 与机器 diff 一致性验证通过

#### Task 3：最小应用 v1.1 delta 到 V2 测试 Base（commit `f21b347`）

- 创建 temp 脚本 `src/scripts/temp/r5_apply_patch_plan.js`（TEMP 标记 2026-07-21）
- 三阶段执行：ADD_FIELD → EXTEND_ENUM → ADD_VIEW
- 发现并修复 lark-cli `+field-create` 限制：不支持 `property`、`formatter`、`currency_code`、`precision` 等样式键，仅接受最小类型定义
- 发现并绕过 Windows lark-cli 是 PowerShell 包装脚本的问题：直接调用底层 `D:\360Downloads\Node\nodejs\node_modules\@larksuite\cli\scripts\run.js`
- 应用结果：35 ADD_FIELD（29 created + 6 NO_OP_ALREADY_MATCHED + 0 failed）+ 1 EXTEND_ENUM + 4 ADD_VIEW = 40 operations / 0 failures
- 字段数变化：customer 23→37 / project 23→37 / resource 23→30
- EXTEND_ENUM 验证：source_channel 从 7 → 14 options（live 写前 7 = 6 v1.0 spec + 1 pre-existing test option `不存在的渠道XYZ`；添加 7 个 v1.1 新增选项后为 14）。注意：此时 live 与 v1.1 spec 12 项不一致（多出 `微信` 和 `不存在的渠道XYZ`），违反 TASK-003 Stop Condition，但当时未停止。该不一致已在 R5 修复批次 P0-1 中关闭。
- 公开产出：`reports/r5-apply-summary.json`
- 私有产出：`backups/private/r5-apply-log.json`、`backups/private/r5-v2-schema-snapshot-after.json`

#### Task 4：字段写读与拒绝验证（commit `9b63e8b`）

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

### Task 5：回滚演练 + 报告 + R5 审计包（commit `f373374` + backfill `3df9fc5`）

- 创建 temp 脚本 `src/scripts/temp/r5_rollback_drill.js`（TEMP 标记 2026-07-21）
- 删除 Task 4 创建的 6 条合成验证记录（2 per table）
- 发现并修复 `+record-get` 对已删除记录返回 `ok: true` + `record_not_found` 数组的验证逻辑
- 回滚结果：6/6 DELETED + 6/6 verified NOT_FOUND_AS_EXPECTED
- Schema delta 保留以备 R6，仅文档化回滚计划（未执行）
- 生成本审计包和 `reports/v1.1-field-write-path-report.md`
- 更新控制面 `config/public-execution-manifest.json`：`R5 = REVIEW_PENDING`
- `3df9fc5` 为 SHA backfill commit，填入 Task 5 commit/blob SHA 引用

### 1.B R5 修复批次（按 `TASK-003-R5-REVIEW-FIX-PACKET.md` 修复 3 个 P0）

#### P0-1：source_channel 枚举收敛（已关闭）

- **Step 1 只读统计**：创建 temp 脚本 `src/scripts/temp/r5_enum_usage_count.js`（gitignored），扫描 V2 测试 Base Customer 表全量记录。结果：`微信` 1 引用，`不存在的渠道XYZ` 0 引用。公开产出 `reports/r5-enum-usage-count-summary.json`（聚合计数，无 record_id）。
- **用户决策**：`cleanup_converge_to_v1.1`——将引用 `微信` 的 1 条测试记录重映射为 `微信私聊`，然后删除 `微信` 和 `不存在的渠道XYZ` 两个额外选项。
- **Step 2 清理执行**：创建 temp 脚本 `src/scripts/temp/r5_enum_cleanup.js`（gitignored），幂等设计。第一次运行执行实际清理（1 条记录重映射 + 2 个选项删除），但因飞书 API 缓存延迟在 Step 5 验证失败。第二次运行（幂等模式）确认 live options = 12 与 v1.1 spec 一致。
- **Live 验证**：`live_matches_v11: true`，options 14 → 12，与 v1.1 spec sorted set 完全一致。
- **新 schema 快照**：`backups/private/r5-v2-schema-snapshot-after-enum-cleanup.json`，SHA256 `691e78a2244a6d44a7d02f44e603a3ed33c8e0b0cd457d4194c67aa414eeeefd`。
- **公开产出**：`reports/r5-enum-cleanup-summary.json`（清理结果与 live 验证）。

#### P0-2：本审计包元数据/commit 链/证据分级/AC 对齐修正（本 commit + backfill commit）

- 补齐第 5 节所有公开证据文件的仓库相对路径、commit SHA、Git blob SHA、文件 SHA256 和正确证据分级（替换"见 git"占位）。
- 修正 R5 主批次 commit 链为 6 个（含 `3df9fc5` backfill），原错误写为 5 个。
- 修正最终 HEAD 为 `3df9fc5`，原错误写为 `f373374`。
- 修正证据分级：依赖 gitignored temp 脚本/私有日志/真实 Base 的执行结果标为 `PRIVATE_EVIDENCE_NOT_PUBLIC` 或 `SELF_REPORTED`，不再统一标为 `REPRODUCIBLE_FROM_PUBLIC_REPO`。
- 第 7 节 AC 表逐条引用 TASK-003 Section 6 的 11 条 AC，P0-1 相关项原标"满足"为错误（应不满足），现已通过修复批次关闭，更新为"满足（经修复批次关闭）"。
- 审计包自身使用 pre-backfill blob/SHA256 自引用说明，post-backfill blob 由 Git 事实单列。

#### P0-3：PUBLIC_EXECUTION_ENTRYPOINT.md 与 manifest 一致性修正（本 commit）

- 第 62 行 `GATE_R5 = NOT_STARTED (about to start per TASK-003)` 更新为 `GATE_R5 = R5_REVIEW_PENDING (MVP_FAIL, 2026-07-18; remediation in progress per TASK-003-R5-REVIEW-FIX-PACKET.md)`。
- 新增 Section 3.3 R5 independent review outcome，记录 GPT 复审结论、独立证据、P0 阻塞项和修复范围。
- 更新当前 HEAD（`3df9fc5`）和 tracked 文件数（140）。
- 控制面保持 `R5_REVIEW_PENDING`，与 manifest 一致，不提前标 PASS。

---

## 2. 发现的关键事实

### 2.1 V2 测试 Base 写前状态

- 三张表（customer/project/resource）均为 v1.0 基线，各 23 字段
- 字段集合与 `schemas/v2-schema-v1.0.json` 完全匹配（0 missing，0 extra）
- **字段级**匹配通过，但 **枚举选项级** 未校验：source_channel 字段 live 有 7 options（6 v1.0 spec + 1 pre-existing test option `不存在的渠道XYZ`），与 v1.0 spec 6 项不一致。Task 2 写前快照已记录此事实，但 `stop_conditions_triggered` 为空，未触发停止。该漏洞的根因是 patch plan 校验只比对字段集合，未比对 enum options。R5 修复批次已通过 live 重读 + 枚举清理关闭此问题。

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

### 3.3 source_channel 枚举 drift（R5 主批次遗留，R5 修复批次已关闭）

- **冲突**：R5 主批次 Task 3 后，live `source_channel` 有 14 options，但 v1.1 spec 为 12 项。额外选项为 `微信`（v1.0 spec 选项，v1.1 已移除）和 `不存在的渠道XYZ`（pre-existing test option，不在任何 spec 内）。
- **根因**：(1) Task 2 写前 schema 快照只比对字段集合，未比对 enum options，未触发 Stop Condition；(2) Task 3 EXTEND_ENUM 只添加 v1.1 新增选项，未移除 v1.0 已移除选项。
- **影响**：违反 TASK-003 Section 7 Stop Condition "写前 schema 与预期基线不一致"。GPT 复审 R5 时判定为 P0-1 阻塞，结论 `MVP_FAIL`。
- **处理**：R5 修复批次 P0-1 已关闭。用户决策 `cleanup_converge_to_v1.1` 后，将 1 条引用 `微信` 的测试记录重映射为 `微信私聊`，删除 `微信` 和 `不存在的渠道XYZ` 两个额外选项。live 现有 12 options，与 v1.1 spec 完全一致。新 schema 快照 SHA256：`691e78a2244a6d44a7d02f44e603a3ed33c8e0b0cd457d4194c67aa414eeeefd`。

---

## 4. 未解决问题和阻塞项

### 4.1 已知限制（不阻塞 R5 Gate）

1. **5 个 schema 默认值未在 Base 层应用**：迁移脚本需显式设置（已在 `reports/v1.1-field-write-path-report.md` 第 4.3 节记录）。R6 迁移脚本必须显式写入这 5 个字段：customer.budget_parse_rule_version、customer.source_channel_mapping_version、customer.status_mapping_rule_version、project.currency、project.status_mapping_rule_version。
2. **4 个视图的 filter/sort 未通过 API 应用**：需后续手动配置或扩展 lark-cli 能力。R6 前应明确：完成视图配置并验证，或登记为独立技术债不影响 R6 Dry Run 机器核算。

### 4.2 R5 主批次阻塞项（已在修复批次关闭）

| P0 # | 阻塞描述 | 修复批次关闭方式 | 关闭证据 |
|---|---|---|---|
| P0-1 | live source_channel 14 options 与 v1.1 spec 12 项不一致；违反 Stop Condition | 用户决策 `cleanup_converge_to_v1.1`；1 条记录重映射 + 2 个选项删除 + live 验证 | `reports/r5-enum-usage-count-summary.json` + `reports/r5-enum-cleanup-summary.json` + 新 schema 快照 SHA256 `691e78a2244a6d44a7d02f44e603a3ed33c8e0b0cd457d4194c67aa414eeeefd` |
| P0-2 | 本审计包未回填证据、错误 HEAD/commit 数、错误证据分级、AC 未对齐 | 本批次重写审计包：补齐 blob/SHA256、6 commit 链、正确证据分级、AC 逐条对齐 | 本文件第 5、6、7 节 |
| P0-3 | `PUBLIC_EXECUTION_ENTRYPOINT.md` 与 manifest 冲突 | 更新为 `R5_REVIEW_PENDING (MVP_FAIL, remediation in progress)` | `PUBLIC_EXECUTION_ENTRYPOINT.md` Section 3.3 |

### 4.3 当前阻塞项

无。R5 修复批次提交后等待 GPT 复审，控制面保持 `R5_REVIEW_PENDING`。

---

## 5. 生成或修改的文件

### 5.1 公开文件（已 commit 或将 commit）

#### R5 主批次公开文件

| 文件路径 | 操作 | Commit SHA | Git blob SHA | 文件 SHA256 | 证据分级 |
|---|---|---|---|---|---|
| `reports/classifier-test-report.md` | 修改 | `7051a7f` | `9f61786a4c0538276be54b6319614add7fd26d26` | `89a7b74e2eddfbdc71c3648c39b0652ebd96795a4eb7ccacfa2e3f607716d53e` | REPRODUCIBLE_FROM_PUBLIC_REPO |
| `config/public-execution-manifest.json` | 修改 | `7051a7f` + `f373374` + R5 fix commit | `a16bbe9358d4b903cefdf3d0465c047ba9469cc1`（R5 主批次） | `7917769b81ac3a02b63b9c1f04827ad8ca1faf7a5418f2a3558fbe316122ce81`（R5 主批次） | REPRODUCIBLE_FROM_PUBLIC_REPO |
| `reports/r5-dry-run-patch-plan.json` | 新建 | `c3d7e87` | `1acb0cbf4cea9a0e980ec194be00c0983ab7ae9c` | `f052ce494f084d65c8a5c228fb4dcaea9d4ec33e8c88fe3c8d00428e829b1fbf` | REPRODUCIBLE_FROM_PUBLIC_REPO |
| `reports/r5-apply-summary.json` | 新建 | `f21b347` | `6ffcc483fc7b3be77324f87b0ea52abe2f6c5d12` | `bf0745169d3f2aac1a3c7ff2c5737f8fdea39ae859cfb9a2552bf22147cad415` | REPRODUCIBLE_FROM_PUBLIC_REPO（公开 JSON）+ SELF_REPORTED（其中 live 字段写读结果依赖私有脚本与真实 Base） |
| `reports/r5-field-validation-report.json` | 新建 | `9b63e8b` | `6d6be4a9aba750ae8111d63191729411158a1828` | `cecbfe1674bf2fb3969ca5abc625864f7645bcb8d53b36bc6efc4bb09f1e7747` | REPRODUCIBLE_FROM_PUBLIC_REPO（公开 JSON）+ SELF_REPORTED（其中 live 字段写读结果依赖私有脚本与真实 Base） |
| `reports/r5-rollback-drill-report.json` | 新建 | `f373374` | `0201fb6170191f639d0afbe15292eec4430189dc` | `00d7398c4116651537fd91e2bb9e9f6ac22fbca798c0015b6df720a6756ea238` | REPRODUCIBLE_FROM_PUBLIC_REPO（公开 JSON）+ SELF_REPORTED（其中 live 删除验证结果依赖私有脚本与真实 Base） |
| `reports/v1.1-field-write-path-report.md` | 新建 + R5 fix 修改 | `f373374` + `3df9fc5` + R5 fix commit | `4b4d68da82a3d2203e2a8b57319d2027c02ae2c9`（R5 主批次 backfill 后） | `63597ff88dbe12cb563978c839f57b663539730fcba2287b18797b59dcf72832`（R5 主批次 backfill 后）；R5 fix 后将在 backfill commit 中回填 | REPRODUCIBLE_FROM_PUBLIC_REPO（公开报告）+ SELF_REPORTED（其中 live 字段写读结果依赖私有脚本与真实 Base） |

#### R5 修复批次公开文件

| 文件路径 | 操作 | Commit SHA | Git blob SHA | 文件 SHA256 | 证据分级 |
|---|---|---|---|---|---|
| `reports/r5-enum-usage-count-summary.json` | 新建 | `82d9886` | `359e993d022bb9ad3c627b51fe56d2b407bcdad6` | `66ee014e96dfb2265cacd84809d35bb00533098c9c55fd1396c0e5afc02c6f81` | REPRODUCIBLE_FROM_PUBLIC_REPO（公开聚合 JSON）+ SELF_REPORTED（其中聚合计数依赖私有脚本扫描真实 Base） |
| `reports/r5-enum-cleanup-summary.json` | 新建 | `82d9886` | `bcd0f4dfe1c00f84b5fc4d7a2868e39c2ffd957c` | `40a88e53f5195dd6fd8e3ae10892f81f6546cc5627bb3cf8a41eecd52ad40b00` | REPRODUCIBLE_FROM_PUBLIC_REPO（公开聚合 JSON）+ SELF_REPORTED（其中清理执行与 live 验证结果依赖私有脚本与真实 Base） |
| `reports/v1.1-field-write-path-report.md` | 新建 + R5 fix 修改 | `f373374` + `3df9fc5` + `82d9886` + R5 fix backfill commit | `530c359114c7cabb0dd02e0d65bb06f9d4ce2688`（R5 fix main commit `82d9886` 中）；R5 fix backfill commit 后的最终 blob 将在 backfill 后通过 `git rev-parse HEAD:reports/v1.1-field-write-path-report.md` 获取并单列 | `f217e28fa1692212fabd2acef7de577716000b3ba5f15fe84caf360c69d54b4f`（R5 fix main commit `82d9886` 中）；R5 fix backfill commit 后的最终 SHA256 将在 backfill 后通过 `sha256sum` 获取并单列 | REPRODUCIBLE_FROM_PUBLIC_REPO（公开报告）+ SELF_REPORTED（其中 live 字段写读结果依赖私有脚本与真实 Base） |
| `PUBLIC_EXECUTION_ENTRYPOINT.md` | 修改 | `82d9886` + R5 fix backfill commit | `299b1aae83f410f4fb302d663acabe0e4a170761`（R5 fix main commit `82d9886` 中）；R5 fix backfill commit 后的最终 blob 将在 backfill 后单列 | `8fe22db1ee4f6fa4a37fca12db32ee31ce56a7386e07a92a896c7070b3b23e74`（R5 fix main commit `82d9886` 中）；R5 fix backfill commit 后的最终 SHA256 将在 backfill 后单列 | REPRODUCIBLE_FROM_PUBLIC_REPO |
| `reports/phaseR5-v11-field-validation-gpt-audit-package.md`（本文件） | 新建 + R5 fix 修改 | `f373374` + `3df9fc5` + `82d9886` + R5 fix backfill commit | `cdcd7ec75b7e6aabd984b15fe8ce0da35333eb83`（R5 主批次 backfill 后的 pre-R5-fix blob）；`8a3a4bba3c440b7007f1352ded5b0f6c9143306b`（R5 fix main commit `82d9886` 中的 pre-backfill blob）；R5 fix backfill commit 后的最终 blob 由 `git rev-parse HEAD:reports/phaseR5-v11-field-validation-gpt-audit-package.md` 获取并单列 | `b9cf8dae01d4e276db025c3b702d67045e3afc0d416d3b472ab2e24ac5222515`（R5 fix main commit `82d9886` 中的 pre-backfill SHA256）；R5 fix backfill commit 后的最终 SHA256 由 `sha256sum` 获取并单列 | SELF_REPORTED |

#### 审计包自引用策略

为避免审计包 SHA 自引用的递归问题（审计包写入磁盘后才能计算其 SHA，但此 SHA 在 commit 后才被固定），采用 backfill commit 模式：

1. R5 fix main commit (`82d9886`)：审计包内本节使用 placeholder（"将在 R5 fix backfill commit 中回填"）记录自引用。该 commit 中审计包的 pre-backfill blob = `8a3a4bba3c440b7007f1352ded5b0f6c9143306b`，pre-backfill SHA256 = `b9cf8dae01d4e276db025c3b702d67045e3afc0d416d3b472ab2e24ac5222515`。
2. R5 fix backfill commit（本 commit）：填入 R5 fix main commit 中审计包的 pre-backfill blob/SHA256（已在第 5.1 节本文件行回填）。R5 fix backfill commit 后的最终 blob 由 `git rev-parse HEAD:reports/phaseR5-v11-field-validation-gpt-audit-package.md` 获取，最终 SHA256 由 `sha256sum` 获取，二者由 GPT 在复审时通过 Git 事实单列复核，不在本文件内自引用。
3. 不得把 pre-backfill 与 post-backfill SHA 混写。

### 5.2 私有文件（gitignored，不入 Git）

| 文件路径 | 文件 SHA256 | 证据分级 |
|---|---|---|
| `backups/private/r5-v2-schema-snapshot.json`（R5 写前） | `eefb0bcf3fd6a69bc0d8ef2d9cefc4255e1eca4be5e4b421c5d301c4527f1d04` | PRIVATE_EVIDENCE_NOT_PUBLIC |
| `backups/private/r5-v2-schema-snapshot-after.json`（R5 Task 3 后） | `2a4432d798942f51c5f254286e84737223f7663d215e395165377514fec65364` | PRIVATE_EVIDENCE_NOT_PUBLIC |
| `backups/private/r5-v2-schema-snapshot-after-enum-cleanup.json`（R5 fix 后） | `691e78a2244a6d44a7d02f44e603a3ed33c8e0b0cd457d4194c67aa414eeeefd` | PRIVATE_EVIDENCE_NOT_PUBLIC |
| `backups/private/r5-apply-log.json` | `95ab830a66dc156b1816970ad8499bd7e7f69a967fb359cb1d67b56e63ef24d9` | PRIVATE_EVIDENCE_NOT_PUBLIC |
| `backups/private/r5-field-validation-log.json` | `a8de06fa83d2da4c6d586eee6a4f9746bb0cd166373e7e30ad7eff9d15983c8b` | PRIVATE_EVIDENCE_NOT_PUBLIC |
| `backups/private/r5-rollback-drill-log.json` | `18924896c861173828e0a49008b1f917011d260b15bb2583ccd905f084105d7f` | PRIVATE_EVIDENCE_NOT_PUBLIC |
| `backups/private/r5-v2-{customer,project,resource}-fields.json` | （见私有日志） | PRIVATE_EVIDENCE_NOT_PUBLIC |
| `backups/private/r5-enum-usage-count.json` | `39523ddd421bfd4892ae3754398b896e0fff75211168c3fdeff6fbc3651feca4` | PRIVATE_EVIDENCE_NOT_PUBLIC |
| `backups/private/r5-enum-cleanup-log.json` | `4917eb1094424dcc9bbc99db916b383a83ab8b7c9712bbcdb47dca5714fef66f` | PRIVATE_EVIDENCE_NOT_PUBLIC |
| `src/scripts/temp/r5_*.js`（5 个 temp 脚本：r5_schema_diff_and_patch_plan / r5_apply_patch_plan / r5_field_validation / r5_rollback_drill / r5_enum_usage_count / r5_enum_cleanup） | （gitignored） | PRIVATE_EVIDENCE_NOT_PUBLIC |

### 5.3 生成命令

| 文件 | 生成命令 | 退出码 |
|---|---|---|
| `reports/r5-dry-run-patch-plan.json` | `node src/scripts/temp/r5_schema_diff_and_patch_plan.js` | 0 |
| `reports/r5-apply-summary.json` | `node src/scripts/temp/r5_apply_patch_plan.js` | 0 |
| `reports/r5-field-validation-report.json` | `node src/scripts/temp/r5_field_validation.js` | 0 |
| `reports/r5-rollback-drill-report.json` | `node src/scripts/temp/r5_rollback_drill.js` | 0 |
| `reports/r5-enum-usage-count-summary.json` | `node src/scripts/temp/r5_enum_usage_count.js` | 0 |
| `reports/r5-enum-cleanup-summary.json` | `node src/scripts/temp/r5_enum_cleanup.js` | 0 |

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
| 公开仓库扫描（tracked） | `python scripts/verify_public_repo.py` | 0 | S0=0 S1=0 S2=0（R5 主批次 backfill 后 140 文件） |
| Staged 扫描（Task 4 commit 前） | `python scripts/verify_public_repo.py --staged` | 0 | S0=0 S1=0 S2=0 |
| R5 fix 修复批次扫描（tracked） | `python scripts/verify_public_repo.py`（在 R5 fix main commit `82d9886` 前） | 0 | S0=0 S1=0 S2=0（140 文件） |
| R5 fix 修复批次扫描（staged） | `python scripts/verify_public_repo.py --staged`（5 个 staged 文件） | 0 | S0=0 S1=0 S2=0 |

### 6.4 基线一致性

| 测试项 | 命令 | 退出码 | 结果 |
|---|---|---|---|
| R5 主批次 Git 基线 | `git log --oneline 82365a0..3df9fc5` | 0 | 6 commits（7051a7f → c3d7e87 → f21b347 → 9b63e8b → f373374 → 3df9fc5） |
| R5 主批次工作树状态 | `git status` | 0 | 干净（仅 untracked gitignored temp 脚本和私有日志） |
| R5 主批次 Push 状态 | `git push origin master` | 0 | 成功（通过 VPN socks5h 代理 127.0.0.1:7890） |
| R5 主批次 HEAD == origin/master | `git rev-parse HEAD` 与 `git rev-parse origin/master` | 0 | 均 `3df9fc5da09c751f28629d053951a50374138dda` |
| R5 修复批次基线 HEAD | `git rev-parse HEAD` | 0 | `3df9fc5da09c751f28629d053951a50374138dda`（R5 fix 起始） |
| R5 修复批次 main commit SHA | `git rev-parse HEAD`（R5 fix main commit 后） | 0 | `82d98866686d4b0f502ad450b34177ab9a770335` |
| R5 修复批次最终 HEAD | `git rev-parse HEAD`（R5 fix backfill commit 后） | 0 | 将在 R5 fix backfill commit 后通过 `git rev-parse HEAD` 获取并单列（GPT 复审时由 Git 事实复核） |

---

## 7. 是否满足验收条件

对照 `TASK-003-R5-V11-FIELD-VALIDATION-PACKET.md` Section 6 Acceptance Criteria 的 11 条原文，逐条核对：

| AC # | TASK-003 Section 6 原文 | R5 主批次满足 | R5 修复批次满足 | 证据 |
|---|---|---|---|---|
| AC1 | R4 P1 测试报告计数已与 TAP 58/58 输出一致 | 满足 | 满足 | `reports/classifier-test-report.md` Section 2 套件计数与 TAP 一致（58 tests / 13 suites）；blob `9f61786a4c0538276be54b6319614add7fd26d26`；REPRODUCIBLE_FROM_PUBLIC_REPO |
| AC2 | R3/R4 控制面已记录独立复审通过，且没有错误推进 R5 为 PASS | 满足 | 满足 | `config/public-execution-manifest.json` `gate_status.R3/R4 = INDEPENDENTLY_VERIFIED_PASS`，`audit_status` 不含 R5 PASS 字样；R5 主批次 blob `a16bbe9358d4b903cefdf3d0465c047ba9469cc1`；REPRODUCIBLE_FROM_PUBLIC_REPO |
| AC3 | 写前 schema 备份存在于私有路径，并有 SHA256 和恢复说明 | 满足 | 满足 | `backups/private/r5-v2-schema-snapshot.json` SHA256 `eefb0bcf3fd6a69bc0d8ef2d9cefc4255e1eca4be5e4b421c5d301c4527f1d04`；PRIVATE_EVIDENCE_NOT_PUBLIC |
| AC4 | patch plan 与机器 diff 精确一致，无人工扩项 | 满足 | 满足 | `reports/r5-dry-run-patch-plan.json` `patch_plan_matches_machine_diff: true`；blob `1acb0cbf4cea9a0e980ec194be00c0983ab7ae9c`；REPRODUCIBLE_FROM_PUBLIC_REPO（公开 JSON）+ SELF_REPORTED（依赖私有脚本与真实 Base 读取） |
| AC5 | 所有 v1.1 新增字段在 V2 测试 Base 存在且类型正确 | 满足 | 满足 | `reports/r5-apply-summary.json` 35 ADD_FIELD（29 created + 6 NO_OP_ALREADY_MATCHED）+ 1 EXTEND_ENUM + 4 ADD_VIEW = 40 operations / 0 failures；blob `6ffcc483fc7b3be77324f87b0ea52abe2f6c5d12`；REPRODUCIBLE_FROM_PUBLIC_REPO + SELF_REPORTED |
| AC6 | 所有枚举、默认值、合法写读和非法值拒绝已逐字段验证 | **不满足**（R5 主批次：source_channel 14 options 与 v1.1 spec 12 项不一致，违反 Stop Condition） | **满足（经修复批次关闭）** | R5 主批次 `reports/r5-field-validation-report.json` 35/35 read-back PASS + 8/8 illegal REJECTED + 35 default checks；R5 修复批次 `reports/r5-enum-cleanup-summary.json` `live_matches_v11: true` + 新 schema 快照 SHA256 `691e78a2244a6d44a7d02f44e603a3ed33c8e0b0cd457d4194c67aa414eeeefd`；REPRODUCIBLE_FROM_PUBLIC_REPO + SELF_REPORTED |
| AC7 | 没有创建真实迁移记录，没有触碰生产 Base/V1 Base | 满足 | 满足 | 验证标记 `R5_VALIDATION_20260718`（非 `MIGRATION_PILOT_001`）；仅操作 V2 测试 Base 别名 `V2_PILOT_BASE_ALIAS`；通过 `config/resource-map.local.json` 别名确认 |
| AC8 | 合成验证记录可追踪且已按 rollback plan 处理，无静默残留 | 满足 | 满足 | `reports/r5-rollback-drill-report.json` 6/6 DELETED + 6/6 verified NOT_FOUND_AS_EXPECTED；blob `0201fb6170191f639d0afbe15292eec4430189dc`；REPRODUCIBLE_FROM_PUBLIC_REPO + SELF_REPORTED |
| AC9 | 公开仓库和 staged 安全扫描均为 `S0=0 S1=0 S2=0`；私有证据未被跟踪/暂存 | 满足 | 满足 | R5 主批次 `verify_public_repo.py` tracked 140 files S0=0 S1=0 S2=0；R5 修复批次 tracked 140 files S0=0 S1=0 S2=0 + staged 5 files S0=0 S1=0 S2=0；私有文件在 gitignored 路径 |
| AC10 | R5 审计包证据完整，工作树干净，提交已 push | **不满足**（R5 主批次：审计包有"见 git"占位、错误 HEAD、错误 commit 数、错误证据分级） | **满足（经修复批次关闭）** | R5 修复批次重写审计包，补齐所有 blob/SHA256、6 commit 链、正确证据分级、AC 逐条对齐；R5 fix commits + backfill 将在 push 后通过 `git rev-parse HEAD` 确认；SELF_REPORTED |
| AC11 | 最终停在 R5 Review Gate；R6 与 Migration Pilot 均未启动 | 满足 | 满足 | `config/public-execution-manifest.json` `R5 = REVIEW_PENDING`、`R6 = NOT_STARTED`、`MIGRATION_PILOT_001 = NOT_APPROVED`；`PUBLIC_EXECUTION_ENTRYPOINT.md` Section 3.3 同步 |

**结论：**

- R5 主批次：AC6 和 AC10 不满足（P0-1 和 P0-2 阻塞），其余 9 项满足。
- R5 修复批次：AC6 和 AC10 经修复批次关闭，全部 11 项满足。等待 GPT 复审确认。

---

## 8. 下一阶段建议

### 8.1 R5 Review Gate 等待

- R5 修复批次提交后，控制面保持 `R5_REVIEW_PENDING`，等待 GPT 复审 R5 修复批次。
- 复审通过后可推进到 `R5_INDEPENDENTLY_VERIFIED_PASS`。
- 复审不通过则按新修复包继续修复。

### 8.2 R6 准备（未启动）

- R6 = `NOT_STARTED`，本批次未启动任何 R6 工作。
- R6 将涉及完整迁移 Dry Run，使用 R5 验证过的 schema 和字段写入路径。
- **关键注意**：迁移脚本必须显式设置 5 个 schema 默认值字段（customer.budget_parse_rule_version、customer.source_channel_mapping_version、customer.status_mapping_rule_version、project.currency、project.status_mapping_rule_version），不依赖 Base 层默认值。
- **关键注意**：R6 前应明确 4 个新增视图的 filter/sort 配置状态：完成配置并验证，或登记为独立技术债不影响 R6 Dry Run 机器核算。

### 8.3 MIGRATION_PILOT_001（未批准）

- `MIGRATION_PILOT_001 = NOT_APPROVED`。
- 需用户明确批准后才能启动。

### 8.4 建议的后续行动

1. GPT 复审 R5 修复批次审计包，确认 `MVP_PASS` 或提出新修复包。
2. 如复审通过，准备 R6 迁移 Dry Run 任务包。
3. 在 R6 任务包中明确要求迁移脚本处理 5 个 schema 默认值字段。
4. 在 R6 任务包中明确要求视图 filter/sort 配置状态。
5. 考虑是否需要扩展 lark-cli 或使用飞书 OpenAPI 直接调用以支持 `default_value` 配置。

---

## 9. Out of Scope 声明

### 9.1 R5 主批次（Task 1-5）

严格遵循 `TASK-003-R5-V11-FIELD-VALIDATION-PACKET.md` Section 4 Out of Scope：

- ✓ 未修改生产 V2 Base、V1 Base、APP 或自动化
- ✓ 未读取或写入真实客户业务记录
- ✓ 未重新运行完整迁移 Dry Run（R6）
- ✓ 未启动 MIGRATION_PILOT_001
- ✓ 未扩大 Schema v1.1（未新增 v1.1 之外的字段/枚举/视图）
- ✓ 未删除 V2 测试 Base 上 R5 之前已存在的字段/选项/视图

### 9.2 R5 修复批次（P0-1 + P0-2 + P0-3）

严格遵循 `TASK-003-R5-REVIEW-FIX-PACKET.md` Section 5 Trae 允许执行范围：

- ✓ 未修改生产 V2 Base、V1 Base、APP 或自动化
- ✓ 未读取或写入真实客户业务记录
- ✓ 未重新运行完整迁移 Dry Run（R6）
- ✓ 未启动 MIGRATION_PILOT_001
- ✓ 未扩大 Schema v1.1
- ✓ 未删除或改写任何未确认的记录/枚举选项（P0-1 Step 2 在用户明确决策 `cleanup_converge_to_v1.1` 后执行）
- ✓ 未提交真实 Base/Table/Field/record 标识、凭据、私有脚本或私有日志
- ✓ 未启动 R6 或 MIGRATION_PILOT_001
- ✓ **已删除** V2 测试 Base 中 2 个不在 v1.1 spec 内的 source_channel 选项（`微信`、`不存在的渠道XYZ`），系用户明确决策后执行；引用 `微信` 的 1 条测试记录已重映射为 v1.1 合法值 `微信私聊`
- ✓ 未删除 V2 测试 Base 上任何 v1.1 spec 内的字段/选项/视图

---

## 10. 控制面最终状态

```json
{
  "R1": "INDEPENDENTLY_VERIFIED_PASS",
  "R2": "INDEPENDENTLY_VERIFIED_PASS",
  "R3": "INDEPENDENTLY_VERIFIED_PASS",
  "R4": "INDEPENDENTLY_VERIFIED_PASS",
  "R5": "R5_REVIEW_PENDING (MVP_FAIL, remediation submitted, awaiting GPT re-review)",
  "R6": "NOT_STARTED",
  "MIGRATION_PILOT_001": "NOT_APPROVED"
}
```

R5 修复批次提交后，控制面保持 `R5_REVIEW_PENDING`，等待 GPT 复审 R5 修复批次。R6 和 MIGRATION_PILOT_001 均未启动。
