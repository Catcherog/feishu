# TASK-003 R5 Review Gate FIX_PACKET

> 审计日期：2026-07-18  
> 审计者：GPT  
> 审计基线：`feishu-v2/` `3df9fc5da09c751f28629d053951a50374138dda`  
> 审计结论：`MVP_FAIL`  
> 当前 Gate：保持 `R5_REVIEW_PENDING`  

## 1. 结论

R5 的主要技术执行证据成立：公开测试 58/58 通过，Schema diff 单元测试 3/3 通过，tracked 140 文件安全扫描为 `S0=0 S1=0 S2=0`，35 个新增字段的合成写读报告、8 个非法写入拒绝报告和 6 条合成记录清理报告均存在，`HEAD == origin/master == 3df9fc5` 且 `feishu-v2/` 工作树干净。

但当前 V2 测试 Base 的 `source_channel` 枚举没有收敛到 Schema v1.1；执行过程在已检测到写前 schema 不一致后仍继续，违反 TASK-003 Stop Condition。R5 审计包同时存在未回填证据、错误最终 HEAD/commit 数、错误证据分级和控制面漂移。因此 R5 暂不批准，不得启动 R6 或 `MIGRATION_PILOT_001`。

## 2. P0 阻塞项

### P0-1：`source_channel` 当前枚举不符合 Schema v1.1，且违反写前 Stop Condition

证据：

- `schemas/v2-schema-v1.1.json` 规定 12 个选项：小红书、抖音、视频号、朋友圈、微信公众号、微信私聊、官网、小程序、转介绍、线下活动、其他、未知。
- 私有写后快照 `backups/private/r5-v2-schema-snapshot-after.json` 显示当前测试 Base 有 14 个选项，额外包含 `微信`、`不存在的渠道XYZ`。
- 公开 patch plan `reports/r5-dry-run-patch-plan.json` 已明确记录 `extra_options_in_live_not_in_v11 = ["微信", "不存在的渠道XYZ"]`，但 `stop_conditions_triggered` 仍为空。
- TASK-003 第 100/148 行要求：写前 schema 与预期 v1.0 基线不一致时立即停止。
- TASK-003 第 115 行要求：枚举只接受 v1.1 允许值。
- `reports/v1.1-field-write-path-report.md` 第 49 行把额外选项错误写成“`不存在的渠道XYZ` 和 `其他`”；`其他` 实际是 v1.1 合法选项，真正的第二个额外选项是 `微信`。

修复要求：

1. 先以只读查询统计 `微信`、`不存在的渠道XYZ` 在 V2 测试 Base Customer 表中的引用记录数；公开报告只写聚合计数，不写 record ID 或真实数据。
2. 若两者均为 0 引用：提交用户确认后，从**测试 Base** 删除这两个额外枚举选项，再重新读取字段定义证明 live options 与 v1.1 12 项完全一致。
3. 若存在引用：不得直接删除。输出聚合计数和处理建议，由用户决定是将测试记录映射为 `微信私聊`/其他合法值，还是保留 drift 并修改 Gate 目标。
4. 未获得用户确认前不得执行枚举删除或记录改写。
5. 修复后重新生成写后 schema 快照、SHA256、公开 apply summary 和主报告。

### P0-2：R5 审计包未满足证据元数据与事实准确性要求

文件：`feishu-v2/reports/phaseR5-v11-field-validation-gpt-audit-package.md`

当前问题：

- 第 162、163、168、169 行仍使用“见 git”“见 git log”等占位，未记录完整 blob SHA / 文件 SHA256。
- 第 9 行提交链漏掉 backfill commit `3df9fc5`。
- 第 222 行仍写 `82365a0..HEAD` 只有 4 commits，实际为 6 commits。
- 第 243 行写“5 commits + backfill”，实际应明确为 6 commits。
- `reports/v1.1-field-write-path-report.md` 第 8 行把 `f373374` 写成“含 SHA backfill”的最终 HEAD，实际最终 HEAD 为 `3df9fc5`。
- 审计包把依赖 gitignored temp 脚本、私有日志和真实 Base 的执行结果统一标为 `REPRODUCIBLE_FROM_PUBLIC_REPO`。这些结果不能从公开仓库单独重现；应按证据来源分别标为 `PRIVATE_EVIDENCE_NOT_PUBLIC`、`SELF_REPORTED`，或在独立只读复核后标为 `INDEPENDENTLY_VERIFIED`。
- 审计包第 7 节 AC 编号/内容没有逐条对应 TASK-003 Section 6，导致“所有 11 项满足”的结论不可核对。

修复要求：

1. 按 `.trae/rules/_gpt_audit.md` 补齐每个公开证据文件的仓库相对路径、最终 commit、Git blob SHA、生成命令、退出码、文件 SHA256 和正确证据分级。
2. 审计包自身使用明确的 pre-backfill blob/SHA256 自引用说明；backfill 后的最终 blob 由 Git 事实单列，不得把两者混写。
3. 修正最终 HEAD、完整 6 commit 链和所有 stale 计数。
4. 第 7 节逐字引用 TASK-003 的 11 条 Acceptance Criteria；P0-1 未关闭前，对应枚举/基线验收项必须标为“不满足”。
5. 不得仅凭公开 JSON 报告存在就把真实 Base 写读结果标为公开可复现。

### P0-3：公开控制面互相冲突

当前事实：

- `config/public-execution-manifest.json`：`R5 = REVIEW_PENDING`、`audit_status = R5_REVIEW_PENDING`。
- `PUBLIC_EXECUTION_ENTRYPOINT.md` 第 62 行：仍为 `GATE_R5 = NOT_STARTED (about to start per TASK-003)`。

修复要求：

- 将 `PUBLIC_EXECUTION_ENTRYPOINT.md` 同步为 R5 Review Gate，更新当前 HEAD、tracked 文件数和 R5 已执行但未通过外部复审的事实。
- P0 修复提交完成后，manifest 与 entrypoint 必须一致保持 `R5_REVIEW_PENDING`；不得提前写成 PASS。

## 3. P1 非阻塞技术债

### P1-1：5 个 Schema 默认值未在 Base 层应用

已验证的实际行为为 null：

- customer.budget_parse_rule_version
- customer.source_channel_mapping_version
- customer.status_mapping_rule_version
- project.currency
- project.status_mapping_rule_version

本项可不阻塞 R5，但必须：

- 在 R6 迁移脚本中显式写入这 5 个值。
- 为缺失任一显式默认值增加失败测试；不得依赖 Base 默认值。
- 在 R6 Gate 前把该约束写入正式迁移规则或测试，而不仅存在于人工报告。

### P1-2：4 个新增视图缺少计划中的 filter/sort/group 配置

视图名称已创建，但 patch plan 中的筛选、排序或分组没有实际应用。R5 的核心是字段写入路径，故暂列 P1；R6 前应明确：

- 完成视图配置并验证；或
- 将其登记为独立技术债，明确不影响 R6 Dry Run 的机器核算。

## 4. 独立复核已通过的证据

- `node --test tests/migration-classifier.test.js`：58/58 PASS，退出码 0。
- bundled Python `-m unittest tests.test_generate_schema_diff`：3/3 PASS，退出码 0。
- bundled Python `scripts/verify_public_repo.py`：tracked 140 files，`S0=0 S1=0 S2=0`，退出码 0。
- `git diff --check`：无错误。
- `HEAD == origin/master == 3df9fc5da09c751f28629d053951a50374138dda`。
- R5 相关私有日志、快照和 4 个 temp 脚本均被 Git ignore。
- 独立实时飞书字段查询本轮未完成：当前 user 授权缺少 `base:field:read`，返回 `need_user_authorization`。本结论中的 live 枚举事实来自 Trae 保存的私有写后快照，并与公开 patch plan 自报的两个 extra options 相互印证。

## 5. Trae 允许执行范围

允许：

- 只读统计两个额外枚举选项的引用数量。
- 在取得用户明确确认后，仅修复 V2 测试 Base 的枚举 drift。
- 重跑字段列表/Schema 对比、安全扫描和 R5 报告生成。
- 修正文档、审计包、manifest 和 entrypoint。
- 提交并 push R5 修复批次。

禁止：

- 不启动 R6。
- 不运行完整迁移 Dry Run。
- 不启动 `MIGRATION_PILOT_001`。
- 不修改生产 V2 Base、V1 Base、APP 或自动化。
- 不删除或改写任何未确认的记录/枚举选项。
- 不提交真实 Base/Table/Field/record 标识、凭据、私有脚本或私有日志。

## 6. 修复后验收条件

只有同时满足以下条件，才可重新提交 R5 Review Gate：

1. 用户已对两个额外枚举选项的处理作出明确决定。
2. 若决定收敛 Schema：live `source_channel` 与 v1.1 12 项完全一致，且有新的只读字段快照和 SHA256。
3. 若决定保留 drift：任务规格/Schema 或 Gate 目标已由用户明确修改，不得由 Trae 自行降级要求。
4. R5 审计包所有元数据、commit/blob/SHA256、命令、退出码和证据分级完整准确。
5. `PUBLIC_EXECUTION_ENTRYPOINT.md` 与 manifest 一致停在 R5 Review Gate。
6. tracked/staged 安全扫描为 `S0=0 S1=0 S2=0`，私有证据继续 ignored/untracked。
7. `feishu-v2/` 最终工作树干净，HEAD 与 origin/master 一致。
8. R6 与 `MIGRATION_PILOT_001` 均未启动。

## 7. 当前停止状态

```text
R1 = INDEPENDENTLY_VERIFIED_PASS
R2 = INDEPENDENTLY_VERIFIED_PASS
R3 = INDEPENDENTLY_VERIFIED_PASS
R4 = INDEPENDENTLY_VERIFIED_PASS
R5 = R5_REVIEW_PENDING (MVP_FAIL, remediation required)
R6 = NOT_STARTED
MIGRATION_PILOT_001 = NOT_APPROVED
```

