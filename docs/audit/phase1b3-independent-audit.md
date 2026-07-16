# Phase 1B-3 GPT 独立审计结论

- 审计对象：`reports/phase1b3-gpt-audit-package.md`
- 审计包提交：`754b6c4`
- 被审计执行提交：`7210333`
- 审计结论：`FAIL / HOLD AT MIGRATION REVIEW GATE`
- 严重级别：1 个 Critical、4 个 Major、4 个 Minor

## 1. 总体结论

Dry Run 的核心 Gate 判断是正确的：当前仅有 1 个 Customer 和 1 个 Project 被分类为 MIGRATABLE，不满足 5+5 的 Pilot 前置条件，因此不得启动 `MIGRATION_PILOT_001`。

Schema v1.1 的关键字段可以在公开 Schema 中找到，SHA256 文件中的声明值与审计包中的声明一致。但当前审计包仍存在安全、可复现性、统计口径和证据完整性问题，不能判定 Phase 1B-3 已通过独立审计。

## 2. Critical

### C-01：公开仓库泄露真实 Base 资源标识

`reports/phase1b3-migration-review-gate.md` 在公开仓库中直接写出了源 Base 和目标 Base 的真实 Token/标识。

这与项目既定规则“公开文档只使用别名、不提交真实 Base token/内部资源 ID”冲突。

要求：

1. 立即将报告中的真实 Base 标识替换为 `SOURCE_BASE_ALIAS` / `TARGET_BASE_ALIAS`。
2. 扫描整个 Git 历史中的 `app_token`、Base Token、Table ID、Field ID、record_id。
3. 因仓库公开，建议使用 `git filter-repo` 或 BFG 清理历史，而不是只追加一次删除提交。
4. 清理后强制推送前先保存本地备份，并检查是否影响协作者。
5. Secret/App credentials 若曾与这些标识共同暴露，立即轮换；单独 Base 标识虽通常不能直接授权访问，也应按内部标识泄露处理。

## 3. Major

### M-01：审计包字段数量自相矛盾

审计包称：

- Project 新增 7 个字段；
- Customer 新增 12 个字段；
- 文件清单又称 Schema 共新增 19 个字段。

但审计包列出的 Customer 字段实际有 13 个，因此按文本相加为 20，不是 19。

要求：不要手工维护新增字段数量。增加机器生成的 `schema-diff-v1.0-to-v1.1.json`，至少包含：

- added_fields
- removed_fields
- changed_fields
- enum_changes
- required_changes
- view_changes

审计包直接引用机器 diff 统计。

### M-02：客户分类统计与原因叙述不闭合

统计为：

- MIGRATABLE 1
- NEEDS_REVIEW 1
- BLOCKED 34

但文字又称：

- 22 条空姓名；
- 13 条有姓名但缺身份信息，被 BLOCKED；
- 1 条 MIGRATABLE。

按文字为 35 BLOCKED + 1 MIGRATABLE，没有解释唯一 NEEDS_REVIEW 来自哪里。

要求：输出互斥的 `primary_reason_code` 统计，并允许附加非互斥 `secondary_reason_codes`。每个分类总数必须与记录数严格对账。

### M-03：审计无法独立复现 Dry Run

Dry Run 脚本位于 `src/scripts/temp/` 且被 gitignore，原始输入也在 private backup 中。公开审计者只能看到自报输出，无法重新执行分类逻辑。

要求：

1. 将稳定分类逻辑迁到 `src/migration/classifier/`，纳入版本控制。
2. 私密原始数据继续不提交。
3. 提交脱敏合成 fixtures，覆盖每个状态、来源、预算、孤儿和重复候选分支。
4. 提交 expected output 与自动化测试。
5. 生成规则覆盖率和 reason-code 覆盖报告。

### M-04：V2 Base 状态描述冲突

此前 Phase 1B-1 已完成 10 张表 47/47 CRUD 验证，但审计包写“V2 Base 表尚未创建”。两者不能同时成立。

更可能的准确表达是：

> V2 Base 已创建并完成 v1.0 写入链路验证，但 v1.1 新增字段尚未应用到真实 V2 Base，也未完成字段级写入验证。

要求：修正文案，并在 Pilot 前执行 v1.1 delta patch + 变更字段写入/读取/枚举/默认值验证。

## 4. Minor

### m-01：`project_memory.md` 未得到证据支持

Gate 条件要求 D-020~D-025 同时写入 `DECISION_LOG.md` 和 `project_memory.md`。审计包只证明 DECISION_LOG，公开仓库中也未见 project_memory。

处理：改为 `PARTIALLY_VERIFIED`，或提供 project_memory 的脱敏证据和哈希。

### m-02：`.trae/rules/_gpt_audit.md` 无法从提交 754b6c4 独立验证

提交页面显示 754b6c4 仅新增审计包一个文件。规则可能存在于本地或其他提交，但当前审计包未给出准确 commit 和 blob hash。

处理：在下一版审计包中记录 rule 文件的 commit、blob SHA 和规则版本。

### m-03：重复候选与 BLOCKED/NEEDS_REVIEW 语义需要分开

人工可确认的命名变体通常应属于 NEEDS_REVIEW；无稳定身份、无法判断的空壳记录才属于 BLOCKED 或 ARCHIVE_CANDIDATE。当前“39 条重复候选”与 10 NEEDS_REVIEW / 39 BLOCKED 的叙述容易混淆。

处理：为资源表输出按 reason code 的互斥统计，例如：

- `DUPLICATE_NAMING_VARIANT`
- `EMPTY_NAME_DUPLICATE_CONTACT`
- `EMPTY_SHELL_NO_IDENTITY`
- `MISSING_REQUIRED_FIELD`

### m-04：项目阻塞原因可能重叠但未注明

13 条无法匹配客户与 7 条“已完成但无交付证据”可能落在同一批记录中。审计包没有说明原因是否重叠。

处理：增加 record-level reason matrix，并明确 primary/secondary reason。

## 5. 已验证通过的部分

1. Gate 判断正确：客户和项目均仅 1 条 MIGRATABLE，不允许进入 Pilot。
2. 资源数量门槛满足：模特 67、化妆师 66 条 MIGRATABLE。
3. Schema 文件声明版本为 v1.1。
4. Project 的金额、币种、付款状态等关键新增字段在公开 Schema 中存在。
5. Customer 的来源原值、状态原值、预算解析和迁移审计字段在公开 Schema 中存在。
6. SHA256 文件的声明值与审计包中记录的值一致。
7. 旧 Base 关联字段严重缺失、客户身份信息质量不足的结论，与分类结果方向一致。

## 6. Gate 决策

当前状态：

```text
MIGRATION_PILOT_001 = NOT APPROVED
REMAIN_AT_MIGRATION_REVIEW_GATE = YES
```

允许执行：

- 修复公开仓库标识泄露
- 修正审计包矛盾
- 提交可复现分类器与脱敏 fixtures
- 人工补全客户身份和项目关联
- 应用 v1.1 Schema delta 到 V2 Pilot Base
- 执行 v1.1 字段级验证
- 重新运行只读 Dry Run

禁止执行：

- 真实 Pilot 写入
- 从 NEEDS_REVIEW 中直接抽样写入
- 清理或删除旧 Base 记录
- 切换 APP
- 部署生产自动化

## 7. 下一版审计包必须新增

1. `security-scan-report.md`
2. `schema-diff-v1.0-to-v1.1.json`
3. `classification-reason-summary.json`
4. `classification-record-matrix.private.json`（私密，不提交）
5. `classifier-test-report.md`
6. `v1.1-field-write-path-report.md`
7. 每个证据文件的 commit SHA、blob SHA、生成命令和退出码
8. 明确区分：独立验证 / 自报结果 / 未验证

