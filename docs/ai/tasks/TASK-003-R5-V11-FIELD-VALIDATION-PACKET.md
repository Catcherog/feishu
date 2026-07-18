# TASK-003：R4 独立复审结论与 R5 v1.1 字段验证执行包

> 生成日期：2026-07-18  
> 规划/审计者：GPT  
> 执行者：Trae  
> 工作仓库：`feishu-v2/`  
> 审计 HEAD：`82365a0436aff554e8f7bd5318518caeab993208`  
> R4 结论：`MVP_PASS_WITH_DEBT`  
> 下一允许 Gate：R5  

## 1. R4 独立复审结论

`TASK-002-R4-FIX-PACKET.md` 的 5 个 P0 已关闭，R3/R4 可由 Trae 在控制面更新为 `INDEPENDENTLY_VERIFIED_PASS`。本轮独立复核证据：

- `feishu-v2/` 为干净 `master`，`HEAD == origin/master == 82365a0436aff554e8f7bd5318518caeab993208`。
- 修复主体 commit 为 `402cb6e9dc96c98a7a2d3037bf7035fa532aa8a6`，backfill commit 为 `82365a0436aff554e8f7bd5318518caeab993208`。
- `node --test tests/migration-classifier.test.js`：58/58 通过，13 suites，退出码 0。
- 使用 Codex bundled Python 执行 `scripts/verify_public_repo.py`：tracked 134 files，`S0=0 S1=0 S2=0`，退出码 0。
- 分类核算 CLI 连续运行两次：304 条记录、四类实体及总体均精确对账。
- 私有矩阵 SHA256 两次一致：`9401ba56f0d812e3f41e47a5450b0bbcf4f2aa25502cf15959e8bdfbb96200f2`。
- 公开汇总 SHA256 两次一致：`548077756b9e50b883e2674c2268926849d67e86b13494b90b06673e2c49e632`。
- 3 条私有路径均已 gitignore，且不被 Git 跟踪。
- 审计包第 11 行已回填主体修复 commit；第 161 行记录的 `fd4ecec...` 确为 commit `402cb6e` 中审计包的 pre-backfill blob。当前 `82365a0` 中该文件 blob 为 `2d202745bb0b1997bf93ee4405a114fcd0a36e3d`，两者关系与文档说明一致。
- 控制面仍停在 R4 Review Gate；R5/R6 未启动，`MIGRATION_PILOT_001 = NOT_APPROVED`。

### 非阻塞 P1 文档债

`reports/classifier-test-report.md` 第 2 节的逐套件测试数仍未与真实 TAP 输出对齐。例如 `multi-reason conflicts` 实际 6 tests，报告写 5；其他多行也把断言覆盖数写成了测试数。此问题不影响分类器、核算结果或 R4 Gate，但必须在 R5 首个文档提交中修正。

真实套件计数为：

| Suite | Tests |
|---|---:|
| classifier public surface | 1 |
| classifyBatch full fixture correctness | 2 |
| every reason code has primary case | 10 |
| four entity types covered | 4 |
| multi-reason conflicts | 6 |
| duplicate candidate decisions | 3 |
| budget parsing variants | 16 |
| P0-2 customer status inference | 3 |
| P0-3 valid project statuses | 2 |
| P0-4 valid need summary | 2 |
| classifyRecord single-record mode | 3 |
| buildAccountingSummary reconciliation | 4 |
| deterministic output | 2 |
| **合计** | **58** |

## 2. Objective

完成 Gate R5：仅在既有 V2 **测试 Base** 上应用 Schema v1.0 → v1.1 的确定性 delta，验证新增字段的存在性、类型、枚举、默认值、合法写读、非法值拒绝和回滚方案；不得创建真实迁移记录，不得启动 R6 或 `MIGRATION_PILOT_001`。

## 3. In Scope

1. 先修正上述 P1 测试报告计数。
2. 将 R3/R4 独立复审结果同步到公开控制面和执行入口。
3. 从 `schemas/schema-diff-v1.0-to-v1.1.json` 生成 R5 dry-run patch plan。
4. 在任何写入前导出 V2 测试 Base 当前 schema 快照，并记录 Base 稳定别名、目标表别名和字段数量；公开报告不得写真实标识。
5. 仅向 V2 测试 Base 应用 v1.1 delta；禁止重建已有字段，禁止修改生产 Base。
6. 对每个新增字段验证：存在、类型、枚举、默认值、合法写入后读回、非法值拒绝。
7. 测试记录必须为合成数据并带唯一 R5 标记；验证结束后按 rollback plan 清理或恢复，不得混入真实迁移批次。
8. 生成 `reports/v1.1-field-write-path-report.md`、rollback plan、R5 GPT 审计包，并更新控制面停在 R5 Review Gate。

## 4. Out of Scope

- 不修改生产 V2 Base、V1 Base、APP 或自动化。
- 不读取或写入真实客户业务记录。
- 不重新运行完整迁移 Dry Run（R6）。
- 不启动 `MIGRATION_PILOT_001`。
- 不处理 BLOCKED/NEEDS_REVIEW 数据质量问题。
- 不扩大 Schema v1.1；若发现 delta 与真实测试 Base 冲突，停止并提交差异，不得静默改 Schema。

## 5. 执行顺序

### Task 1：基线与 R4 控制面收口

在 `feishu-v2/` 执行并记录：

```powershell
git status --porcelain=v1
git branch --show-current
git rev-parse HEAD
git rev-parse origin/master
node --test tests/migration-classifier.test.js
```

预期：工作树干净、分支 `master`、HEAD/远端均为 `82365a0...`、58/58 通过。随后：

- 修正 `reports/classifier-test-report.md` 第 2 节套件计数。
- 将 `config/public-execution-manifest.json` 的 R3/R4 更新为 `INDEPENDENTLY_VERIFIED_PASS`。
- `audit_status` 更新为能明确表达 R4 已独立通过、R5 尚未完成的状态。
- 更新 `PUBLIC_EXECUTION_ENTRYPOINT.md` 中已漂移的 Gate 状态和 tracked 文件数量。
- 不得把 R5 标记为 PASS。

### Task 2：R5 dry-run patch plan 与写前备份

- 读取 `schemas/schema-diff-v1.0-to-v1.1.json`，生成确定性 patch plan；字段集合必须与机器 diff 完全一致。
- 通过现有本地资源映射定位 **V2 测试 Base**；不得把真实 token/table/field ID 写入公开文件。
- 写入前导出测试 Base 当前 schema 到私有备份路径，并计算 SHA256。
- 若目标不是测试 Base、资源映射缺失、当前 schema 与预期 v1.0 基线不一致，立即停止。

### Task 3：最小应用 v1.1 delta

- 只创建机器 diff 中新增的字段/枚举项/视图变化。
- 每个写操作前检查目标是否已存在；已存在且定义相同则记录 `NO_OP_ALREADY_MATCHED`，定义不同则停止。
- 不删除、不重建、不重命名既有字段。
- 每步记录公开别名、操作类型、结果和私有证据引用。

### Task 4：字段写读与拒绝验证

使用合成 R5 验证记录，逐项验证：

- 合法值写入后可按相同语义读回。
- Number、DateTime、SingleSelect、LongText 等类型行为符合 schema。
- 枚举只接受 v1.1 允许值。
- 非法枚举/类型写入被拒绝，且不会留下部分脏数据。
- 默认值行为与 schema/飞书真实行为一致；没有默认值时明确记录 `NO_DEFAULT`，不得猜测。
- 验证记录带独立标记，不使用 `MIGRATION_PILOT_001`。

### Task 5：回滚演练、报告和 Gate 停止

- 形成可执行 rollback plan；演练范围仅限本轮合成验证记录和本轮新增 schema delta。
- 清理合成验证记录前先保存验证证据；不得删除任何任务前已存在的数据。
- 生成 `reports/v1.1-field-write-path-report.md` 和 R5 GPT 审计包。
- 审计包按 `.trae/rules/_gpt_audit.md` 八点格式记录 commit/blob/SHA256、命令、退出码、证据分级和 Out of Scope 声明。
- 控制面停在：`R5 = R5_REVIEW_PENDING`、`R6 = NOT_STARTED`、`MIGRATION_PILOT_001 = NOT_APPROVED`。

## 6. Acceptance Criteria

1. R4 P1 测试报告计数已与 TAP 58/58 输出一致。
2. R3/R4 控制面已记录独立复审通过，且没有错误推进 R5 为 PASS。
3. 写前 schema 备份存在于私有路径，并有 SHA256 和恢复说明。
4. patch plan 与机器 diff 精确一致，无人工扩项。
5. 所有 v1.1 新增字段在 V2 测试 Base 存在且类型正确。
6. 所有枚举、默认值、合法写读和非法值拒绝已逐字段验证。
7. 没有创建真实迁移记录，没有触碰生产 Base/V1 Base。
8. 合成验证记录可追踪且已按 rollback plan 处理，无静默残留。
9. 公开仓库和 staged 安全扫描均为 `S0=0 S1=0 S2=0`；私有证据未被跟踪/暂存。
10. R5 审计包证据完整，工作树干净，提交已 push。
11. 最终停在 R5 Review Gate；R6 与 Migration Pilot 均未启动。

## 7. Stop Conditions

出现任一情况立即停止，不得自行修复真实系统：

- 起始 HEAD/远端/工作树不符合基线。
- 无法证明目标为 V2 测试 Base。
- 写前 schema 与预期基线不一致。
- patch plan 与机器 diff 不一致。
- 需要删除、重建或重命名既有字段。
- 任一写入可能影响真实业务记录。
- 出现权限、429、5xx 或部分写入，且无法通过只读复核确认状态。
- 真实标识、凭据或私有记录进入公开文件或暂存区。
- 任一验收项无法提供证据。

## 8. Trae 最终回复要求

只报告：

- R4 控制面收口 commit。
- R5 schema 写前/写后摘要（使用稳定别名）。
- 字段验证通过/失败数量与失败原因。
- rollback 演练结果。
- 测试、安全扫描、私有隔离结果。
- R5 审计包路径、commit、push 状态。
- 明确声明 `R6 = NOT_STARTED`、`MIGRATION_PILOT_001 = NOT_APPROVED`。

完成后停下，等待 GPT/用户复审，不得自动进入 R6。
