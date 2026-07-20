# TASK-004 R6 Review Gate FIX_PACKET

> 审计日期：2026-07-18  
> 审计者：GPT  
> 审计基线：`feishu-v2/` `d1b2d0544eb6216b583a56667a0484ecccb38003`  
> R6 main commit：`0f3fb108c790b054251e67940761f99705a76c18`  
> R6 backfill commit：`d1b2d0544eb6216b583a56667a0484ecccb38003`  
> 审计结论：`FAIL_REMEDIATION_REQUIRED`  
> 当前 Gate：保持 `R6_REVIEW_PENDING`  
> 下一执行者：Trae

## 1. 结论

R6 的核心只读核算结果可信，且当前停止决定正确：GPT 在本轮独立重跑了 58 个 migration-classifier 测试和 23 个 Python 测试，tracked 153 文件安全扫描为 `S0=0 S1=0 S2=0`；304 条私有输入连续运行两次后，私有矩阵 SHA256 均为 `9401ba56f0d812e3f41e47a5450b0bbcf4f2aa25502cf15959e8bdfbb96200f2`，公开汇总 SHA256 均为 `548077756b9e50b883e2674c2268926849d67e86b13494b90b06673e2c49e632`，与已提交报告一致。`HEAD == origin/master == d1b2d0544eb6216b583a56667a0484ecccb38003`，工作树干净。

分类结果为 304 = 8 MIGRATABLE + 71 NEEDS_REVIEW + 225 BLOCKED。D-026 数量门槛明确失败：Customer 0/5、Project 0/5、Model 3/10、Makeup 5/10，因此 `MIGRATION_PILOT_001` 必须保持 `NOT_APPROVED`。

但 R6 尚不能通过外部 Review Gate。当前有两个实现级阻塞和三个证据/控制面准确性问题，需要 Trae 在一个集中修复批次中关闭后重新提交；不得把本次结论解释为允许启动 Pilot。

## 2. P0 阻塞项

### P0-1：5 个 Schema 默认字段只有文档声明，没有完整的可执行投影实现

TASK-004 In Scope 4 和 AC5 要求迁移规则显式填充以下 5 个字段，不依赖 Base 默认值：

- `customer.budget_parse_rule_version = budget-map-v1.0`
- `customer.source_channel_mapping_version = source-map-v1.0`
- `customer.status_mapping_rule_version = status-map-v1.0`
- `project.currency = CNY`
- `project.status_mapping_rule_version = status-map-v1.0`

当前证据：

- R6 main commit 没有修改 `src/migration/` 或新增迁移投影模块。
- `PUBLIC_EXECUTION_ENTRYPOINT.md` 和 R6 审计包列出了 5 个值，但这只是人工声明。
- 代码中只有 `parseBudget()` 实际返回 `budget_parse_rule_version`；其余 4 项没有可执行写入/投影路径。
- classifier 输出只包含分类与 reason codes，不包含目标 Customer/Project 字段。

修复要求：

1. 在 `src/migration/` 增加纯函数投影模块，将已判定为 `MIGRATABLE` 的规范化 Customer/Project 输入投影为目标字段 payload；不得调用飞书 API。
2. 由常量统一定义上述 5 个值，禁止由 Base default 隐式补全。
3. 增加合成测试，逐字段断言 Customer 三项和 Project 两项始终显式存在且值正确。
4. 增加失败/拒绝测试：缺少必要迁移上下文、输入实体类型不支持或分类不是 `MIGRATABLE` 时不得生成可写 payload。
5. R6 审计包 AC5 必须引用代码路径和测试，不得仅引用文档段落。

### P0-2：D-026 自动判定器遗漏 Project 与 Customer 的关联条件

D-026 不只要求 `Project MIGRATABLE >= 5`，还要求这 5 个 Project 关联“上述 Customer”。当前 `src/scripts/temp/r6_aggregations.js` 的 `buildThresholdJudgement()` 只读取四个实体的 MIGRATABLE 数量，完全没有校验 Project 到 MIGRATABLE Customer 的关联。

当前数据因 Customer=0、Project=0，最终 FAIL 结论仍然正确；但该实现可能在未来出现“数量都够、关联不满足”时错误给出 PASS，因此不能作为 Pilot 前的正式 Gate evaluator。

修复要求：

1. 将 D-026 判定迁移为 `src/migration/` 下的版本化纯函数，临时脚本只负责读取私有矩阵/输入和写公开聚合。
2. 判定同时验证：Customer >= 5、Project >= 5、至少 5 个 MIGRATABLE Project 明确关联到本轮 MIGRATABLE Customer 集合、Model >= 10、Makeup >= 10。
3. 公开报告只输出聚合数量，不输出 record key、record ID、姓名或关联明细。
4. 增加至少 4 类合成测试：全部满足；数量满足但 Project 关联到非 MIGRATABLE Customer；Project 无关联；当前类似的数量不足。
5. 即使 evaluator 在合成测试中可 PASS，真实 R6 数据仍必须输出 FAIL，并保持 `MIGRATION_PILOT_001 = NOT_APPROVED`。

## 3. P1 证据与控制面修正

### P1-1：测试总数口径错误

本轮独立实测为：

- `node --test tests/migration-classifier.test.js`：58/58。
- `python -m unittest tests.test_verify_public_repo tests.test_generate_schema_diff`：合计 23/23，其中 scanner 20、schema diff 3。
- 总计：81 PASS，不是 84 PASS。

修复所有把“23 个 Python 合计测试”再次拆出 3 个 schema 测试相加的文字。manifest 建议统一写成 `58 classifier + 20 scanner + 3 schema_diff = 81 PASS`。

### P1-2：R6 审计包缺少规则要求的 Git blob SHA

`.trae/rules/_gpt_audit.md` 要求公开证据记录 commit SHA、Git blob SHA、文件 SHA256、生成命令、退出码和证据分级。当前 R6 审计包 Section 5 只有 commit SHA 与文件 SHA256，没有 Git blob SHA；因此 AC10 的“证据完整”不能标记为满足。

修复要求：

1. 为所有 R6 公开证据补充 Git blob SHA。
2. 对 main commit 文件使用 `0f3fb108:<path>` 对应 blob；对修复批次新版本使用新的 main-fix commit blob。
3. 审计包自身采用 pre-backfill blob/SHA256 + backfill commit 的非自引用说明。
4. 回填并由 Git 事实写明：R6 原 backfill commit 与原最终 HEAD 均为 `d1b2d0544eb6216b583a56667a0484ecccb38003`。

### P1-3：控制面存在 stale 元数据

- `PUBLIC_EXECUTION_ENTRYPOINT.md` header 写 R6 closeout tracked files = 152，当前独立扫描为 153。
- manifest 的 `authoritative_files` 停在 R3/R4，未纳入 TASK-004、R5/R6 审计包及 R6 聚合结论。
- manifest `test_results` 的表述容易把 23 个 Python 合计测试误解为 23 scanner + 3 schema。

修复要求：同步 entrypoint、manifest 和 R6 审计包；控制状态继续保持 `R6_REVIEW_PENDING`，不得提前写成 PASS。

## 4. 已独立通过、无需重复改造的部分

- R6 两个提交和 push 事实成立：`0f3fb108` + `d1b2d054`，最终 `HEAD == origin/master == d1b2d054`。
- classifier 58/58 PASS。
- scanner + schema-diff 23/23 PASS；总测试数为 81。
- tracked 153 files：`S0=0 S1=0 S2=0`。
- P1 scanner debt 已关闭：`[0-9A-Fa-f]` 边界与 3 条回归测试存在并通过。
- 304 条核算连续两次完全一致，所有实体和 overall reconciliation 均为 true。
- 公开 R6 JSON 不含真实 record key/ID 或 PII；私有输入、矩阵和临时聚合脚本均被 Git ignore。
- 当前 D-026 FAIL 和禁止启动 Pilot 的结论正确。
- 4 个新增视图 filter/sort 未配置已明确登记为 Pilot 前技术债；本轮不要求调用飞书 API 修复。

## 5. Trae 单批次允许执行范围

允许一次完成：

1. 实现纯函数迁移投影与 5 个显式默认字段测试。
2. 实现关联感知的 D-026 纯函数 evaluator 与合成反例测试。
3. 使用现有 304 条私有输入重新运行两次只读核算和聚合；只写 gitignored 私有文件及脱敏公开汇总。
4. 修正测试计数、blob/SHA256 证据、原 backfill/final HEAD、tracked file count 和 authoritative files。
5. 重跑集中验证，生成修订版 R6 审计包。
6. 创建 main-fix commit + SHA backfill commit，并 push；最终仍停在 `R6_REVIEW_PENDING`。

禁止：

- 不启动 `MIGRATION_PILOT_001`。
- 不调用飞书写 API，不创建、修改或删除任何 Base 记录、字段、视图或自动化。
- 不处理真实 NEEDS_REVIEW/BLOCKED 数据，不调整 D-026 门槛。
- 不修改 classifier 已批准的业务分类逻辑，除非新测试证明当前逻辑与 D-020—D-026 冲突；出现此类冲突时停止并报告。
- 不执行 history rewrite、force push 或历史清理。
- 不提交私有输入、record-level 矩阵、真实飞书标识或 PII。

## 6. 修复后验收条件

1. 5 个默认字段由公开、纯函数、可测试的投影代码显式生成。
2. 非 MIGRATABLE 记录无法生成可写 payload。
3. D-026 evaluator 对“数量满足但 Project 未关联上述 Customer”的合成反例返回 FAIL。
4. 真实 304 条数据仍稳定核算为 8/71/225，D-026 仍为 FAIL，Pilot 仍为 NOT_APPROVED。
5. classifier 原 58 测试、原 23 个 Python 测试及新增投影/evaluator 测试全部通过；报告使用实际总数。
6. tracked 和两个 staged commit 扫描均为 `S0=0 S1=0 S2=0`。
7. R6 审计包逐条对应 11 项 AC，补齐 commit、blob、SHA256、命令、退出码与证据分级。
8. entrypoint、manifest、审计包相互一致，回填原 R6 backfill/final HEAD `d1b2d054...`。
9. 最终工作树干净，`HEAD == origin/master`，控制面保持 `R6_REVIEW_PENDING`。

## 7. 当前停止状态

```text
R1 = INDEPENDENTLY_VERIFIED_PASS
R2 = INDEPENDENTLY_VERIFIED_PASS
R3 = INDEPENDENTLY_VERIFIED_PASS
R4 = INDEPENDENTLY_VERIFIED_PASS
R5 = INDEPENDENTLY_VERIFIED_PASS
R6 = R6_REVIEW_PENDING (FAIL_REMEDIATION_REQUIRED)
MIGRATION_PILOT_001 = NOT_APPROVED
```
