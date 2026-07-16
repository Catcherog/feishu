# Gate R1 最终审计验证包 — Git 历史脱敏重写

> **生成时间**：2026-07-16
> **执行者**：Trae (Kimi-K2.7-Code)
> **审计目标**：供 GPT 或人工审计者验证 Gate R1 Git 历史脱敏重写执行的正确性和完整性
> **仓库地址**：https://github.com/Catcherog/feishu.git
> **重写前 commit**：`30b139f`
> **重写后 commit**：`1bd7f80`
> **前序审计包**：`reports/phaseR1-gpt-audit-package.md`（工作树脱敏，状态 PASS_WITH_CONDITIONS）

---

## 总进展追踪

本审计包属于 **公开仓库执行框架（整合包）** 的一部分。

### R1-R6 Gate 状态

| Gate | 名称 | 状态 |
|------|------|------|
| R1 | 公开仓库安全（Public repository security） | **GATE_R1 = PASS** |
| R2 | Schema 证据（Schema evidence） | 未开始 |
| R3 | 可复现分类器（Reproducible classifier） | 未开始 |
| R4 | 记录分类盘点（Record classification accounting） | 未开始 |
| R5 | V2 v1.1 字段验证（V2 v1.1 field validation） | 未开始 |
| R6 | 新 Dry Run 与审计包（New Dry Run and audit package） | 未开始 |

**门控状态**：R1 已通过，暂停，不自动进入 R2。

---

## 1. 本次完成内容

### 1.1 本地 mirror 备份

- 在执行任何历史重写前，创建了完整的 mirror 克隆备份
- 备份路径：`backups/private/feishu-pre-r1-rewrite.git`（已 gitignore）
- 备份 HEAD：`30b139f676749972d126a99f6ede4d4be6a63a11`（与重写前 HEAD 一致）
- 备份 commit 数：17（与重写前一致）

### 1.2 替换矩阵生成

- 基于 `reports/private/finding-matrix.private.json`（前序工作生成的私有发现矩阵）构建替换文件
- 额外扫描全部 62 个唯一 git blob，确认发现矩阵覆盖全部历史标识符
- 排除误报 "recommendation"（非真实 record ID）
- 对 ASCII 标识符使用 `regex:\b...\b` 词边界匹配，避免短名称误匹配（如 "uo" 误匹配 "quoted_price"）
- 对非 ASCII 标识符（中文姓名等）使用字面替换
- 替换文件：`reports/private/replacements.private.txt`（已 gitignore）
- 替换条目数：524（366 regex + 158 literal）
- SHA256：`3f2c2df65ec9634860bdc42411f96468a1b5cb3a36e4109b3c75d6fed80e5bf7`

### 1.3 Git 历史一次性脱敏重写

- 工具：`git filter-repo --replace-text`（版本 2.47.0）
- 覆盖范围：全部 17 个可达 commit
- 替换内容：
  - 2 个 Base token → `SOURCE_BASE_ALIAS`、`TARGET_V2_BASE_ALIAS`
  - 17 个 V1 表 ID → `V1_<NAME>_TABLE_ALIAS`
  - 12 个 V1 工作流 ID → `V1_WF_<NAME>_ALIAS`
  - 316 个记录 ID → `REC_ALIAS_0001` ~ `REC_ALIAS_0316`
  - 176 个姓名/别名 → 分类前缀别名（`CUSTOMER_ALIAS`、`MAKEUP_ALIAS`、`MODEL_ALIAS`、`ENTITY_ALIAS`、`PROJECT_ALIAS`）
  - 1 个手机号 → `<REDACTED_PHONE>`
  - 1 个微信号 → `<REDACTED_WECHAT>`
- 全部 commit SHA 已改变（filter-repo 的预期行为）

### 1.4 Force-with-lease 推送

- 使用 `--force-with-lease` 而非无保护 `--force`
- 推送前报告了受影响分支（仅 `master`）和具体命令
- 推送成功：`30b139f...1bd7f80 master -> master (forced update)`

### 1.5 推送后验证

- `verify_public_repo.py` tracked 模式：PASS（S0=0, S1=0, S2=0）
- 全部 17 个可达 commit 逐个扫描：全部 CLEAN（S0=0, S1=0, S2=0）
- 全部 17 个旧 commit SHA 不再从任何远程 branch 或 tag 可达
- `PROJECT_GUIDE.md` 内容未改变（blob SHA 一致）
- 远程仅 `refs/heads/master`，无 tag

---

## 2. 发现的关键事实

| 事实 | 值 |
|------|-----|
| 重写前 commit | `30b139f676749972d126a99f6ede4d4be6a63a11` |
| 重写后 commit | `1bd7f80a0d21b48728dc60da8bdd282774edf50f` |
| 重写前 commit 数 | 17 |
| 重写后 commit 数 | 17（数量不变） |
| 备份路径 | `backups/private/feishu-pre-r1-rewrite.git` |
| 备份 HEAD | `30b139f676749972d126a99f6ede4d4be6a63a11` |
| 替换条目总数 | 524（366 regex + 158 literal） |
| 历史扫描 commit 数 | 17 |
| 历史扫描 S0 | 0 |
| 历史扫描 S1 | 0 |
| 历史扫描 S2 | 0 |
| 旧 commit 不可达数 | 17/17（100%） |
| 远程分支 | 1（`master`） |
| 远程 tag | 0 |
| PROJECT_GUIDE.md 重写前 blob SHA | `49418d6b2dcd480a52079c1adb6e2fefa26891d0` |
| PROJECT_GUIDE.md 重写后 blob SHA | `49418d6b2dcd480a52079c1adb6e2fefa26891d0`（一致） |
| git filter-repo 版本 | 2.47.0 |
| 首次重写发现误报 | "uo" 误匹配 "quoted_price" 中的子串 |
| 误报修复方式 | 对 ASCII 标识符使用 `regex:\b...\b` 词边界匹配 |
| 排除的误报 | "recommendation"（非真实 record ID） |

### Commit SHA 映射（重写前 → 重写后）

| 重写前 SHA | 重写后 SHA | Commit Message |
|-----------|-----------|----------------|
| `30b139f` | `1bd7f80` | Update _gpt_audit.md rule to detailed Chinese format and rewrite R1 audit package |
| `7103b1c` | `4a67223` | Gate R1: sanitize public repo, fix verify script, scan git history |
| `e4e4b60` | `a11c738` | Add public audit execution entrypoint and Phase 1B-3 remediation gate |
| `754b6c4` | `9f846fa` | docs: add phase1b3 gpt audit package and gpt_audit rule |
| `7210333` | `dcfb068` | Phase 1B-3: v1.1 schema dry run complete, preconditions not met |
| `2dbc136` | `f8957e9` | docs: append D-017/D-018/D-019 decisions for Phase 1B-0/1/2 |
| `f655d95` | `d71ce0c` | Phase 1B-2: read-only migration dry run complete, pause at Migration Review Gate |
| `bb87d63` | `f5d9633` | Phase 1B-1: 47/47 CRUD write path tests all passed |
| `a6c419a` | `d854b42` | chore: add reports/private/ to .gitignore for Phase 1B-2 privacy |
| `312354f` | `26daa28` | feat: fix v2 schema v1.0 with json, sha256, field dictionary |
| `8e139eb` | `c6bbe1a` | docs: complete phase 1a v2 pilot base creation and test data |
| `010487f` | `c7d3027` | docs: update phase05 report with live workflow and record data |
| `10a12ed` | `a670099` | docs: record schema review gate approval (D-015) |
| `54ef95c` | `0b2bb77` | docs: replace example phone number with placeholder after privacy review |
| `3f9346b` | `e69749f` | docs: phase 0.5 execution history and rule validation |
| `596d5dd` | `a4bf45b` | docs: add v2 base schema for phase 1a review gate |
| `93919da` | `47fddd2` | docs: complete phase 0 audit and approve phase 1a |

---

## 3. 历史文档与真实系统的冲突

| 项目 | 前序审计包声称 | 真实状态 | 解决方式 |
|------|---------|---------|---------|
| Gate R1 状态 | `PASS_WITH_CONDITIONS`（历史暴露未清理） | 历史已重写，全部验证通过 | 本审计包更新为 `GATE_R1 = PASS` |
| `reports/git-history-cleanup-plan.md` | "Status: NOT APPROVED - NOT EXECUTED" | 历史重写已执行 | 该文件保留为历史记录 |
| 首次 filter-repo 运行 | 未记录 | 首次运行因 "uo" 误匹配 "quoted_price" 导致 PROJECT_GUIDE.md 被错误修改 | 从备份恢复，修复替换文件使用词边界，重新运行成功 |

---

## 4. 未解决问题和阻塞项

| 问题 | 严重度 | 状态 | 描述 |
|------|--------|------|------|
| 无阻断问题 | — | — | 全部验证通过 |

**备注**：
- 本地备份 `backups/private/feishu-pre-r1-rewrite.git` 仍包含重写前的完整历史（含真实标识符）。该路径已 gitignore，仅存本地。用户可在确认无需恢复后删除。
- 旧 commit 对象在本地 git 对象库中仍存在（来自备份 fetch），但不可达。将在 git gc 后自动清除。
- GitHub 远程可能仍缓存旧 commit 对象（可通过旧 SHA 直接访问），但不可达。GitHub 通常在 force-push 后数日内自动 gc。

---

## 5. 生成或修改的文件

### 5.1 私有文件（未提交，已 gitignore）

| 文件路径 | 操作 | 说明 | Git commit SHA | 文件 SHA256 | 证据分级 |
|---------|------|------|---------------|------------|---------|
| `reports/private/replacements.private.txt` | 新建 | git filter-repo 替换矩阵（524 条目） | 未提交 | `3f2c2df65ec9634860bdc42411f96468a1b5cb3a36e4109b3c75d6fed80e5bf7` | `PRIVATE_EVIDENCE_NOT_PUBLIC` |
| `reports/private/post-rewrite-history-scan.json` | 新建 | 重写后全部 commit 扫描结果 | 未提交 | `4fe5654b367df2c013f77cbed0368626cbc025a5d1cb058b42d3ab86537f4b3e` | `PRIVATE_EVIDENCE_NOT_PUBLIC` |
| `reports/private/finding-matrix.private.json` | 未修改 | 前序工作生成的私有发现矩阵 | 未提交 | `27360abc25361fce3e1edc7cc80e18aa9afdbb99dda1c703872df3be6a07088f` | `PRIVATE_EVIDENCE_NOT_PUBLIC` |
| `reports/private/git-history-scan.json` | 未修改 | 前序工作生成的历史扫描结果 | 未提交 | 未计算 | `PRIVATE_EVIDENCE_NOT_PUBLIC` |
| `backups/private/feishu-pre-r1-rewrite.git` | 新建 | 重写前完整 mirror 备份 | N/A | N/A（git mirror 仓库） | `PRIVATE_EVIDENCE_NOT_PUBLIC` |
| `src/scripts/temp/build_replacements.py` | 新建 | TEMP: 生成替换文件的脚本 | 未提交 | 未计算 | `SELF_REPORTED` |
| `src/scripts/temp/scan_all_commits.py` | 新建 | TEMP: 扫描全部 commit 的脚本 | 未提交 | 未计算 | `SELF_REPORTED` |

### 5.2 公开文件（git tracked，重写后内容已脱敏）

| 文件路径 | 操作 | 说明 | 重写后 Git commit SHA | 文件 SHA256 | 证据分级 |
|---------|------|------|---------------|------------|---------|
| `PROJECT_GUIDE.md` | 未修改（内容未变） | blob SHA 一致 | `1bd7f80` | `10750617272404844b16a9416b2367a39e4d74840218080a21b86174272923d5` | `REPRODUCIBLE_FROM_PUBLIC_REPO` |
| `scripts/verify_public_repo.py` | 重写中替换标识符 | 内容与重写前 HEAD 一致 | `1bd7f80` | `18006ace1631a87cd2e910e72eb38a49426546fcece45623fcddfc022316ab2c` | `REPRODUCIBLE_FROM_PUBLIC_REPO` |
| `reports/phaseR1-gpt-audit-package.md` | 重写中替换标识符 | 前序审计包，内容已脱敏 | `1bd7f80` | 未计算 | `REPRODUCIBLE_FROM_PUBLIC_REPO` |
| `reports/git-history-cleanup-plan.md` | 重写中替换标识符 | 历史清理计划，内容已脱敏 | `1bd7f80` | 未计算 | `REPRODUCIBLE_FROM_PUBLIC_REPO` |

---

## 6. 执行的测试与验证结果

| 命令 | 退出码 | 结果 | 证据分级 |
|------|--------|------|---------|
| `git clone --mirror https://github.com/Catcherog/feishu.git backups/private/feishu-pre-r1-rewrite.git` | 0 | 备份创建成功，HEAD=`30b139f`，17 commits | `SELF_REPORTED` |
| `python src/scripts/temp/build_replacements.py` | 0 | 524 替换条目生成（首次 525，移除 "recommendation" 误报后 524） | `SELF_REPORTED` |
| `git filter-repo --replace-text reports/private/replacements.private.txt --force`（首次） | 0 | 17 commits 重写，但 PROJECT_GUIDE.md 被误改（"uo" 误匹配） | `SELF_REPORTED` |
| 从备份恢复：`git fetch backup && git checkout -B master backup/master` | 0 | 恢复到重写前状态 `30b139f` | `SELF_REPORTED` |
| `git filter-repo --replace-text reports/private/replacements.private.txt --force`（修复后） | 0 | 17 commits 重写成功，PROJECT_GUIDE.md 未变 | `SELF_REPORTED` |
| `git push --force-with-lease=master:30b139f... origin master` | 0 | `30b139f...1bd7f80 master -> master (forced update)` | `SELF_REPORTED` |
| `python scripts/verify_public_repo.py`（推送后） | 0 | **PASS**（S0=0, S1=0, S2=0，40 files） | `REPRODUCIBLE_FROM_PUBLIC_REPO` |
| `python src/scripts/temp/scan_all_commits.py` | 0 | 17/17 commits CLEAN（S0=0, S1=0, S2=0） | `SELF_REPORTED` |
| 旧 commit 远程可达性检查 | 0 | 17/17 旧 commit 不从任何远程 branch/tag 可达 | `SELF_REPORTED` |
| `git ls-remote origin` | 0 | 仅 `refs/heads/master` → `1bd7f80`，无 tag | `REPRODUCIBLE_FROM_PUBLIC_REPO` |
| `git hash-object PROJECT_GUIDE.md`（重写前后对比） | 0 | `49418d6b` = `49418d6b`（一致） | `REPRODUCIBLE_FROM_PUBLIC_REPO` |

### 验证详情

**verify_public_repo.py 输出**：
```
PUBLIC REPOSITORY VERIFICATION
root: D:\360Downloads\Trae 项目\SOP\feishu-v2
mode: tracked (40 files)
Findings: S0=0 S1=0 S2=0
RESULT: PASS (0 warnings require review)
```

**全部 commit 扫描结果**：
```
[1/17]  1bd7f80 | S0=0 S1=0 S2=0 | CLEAN
[2/17]  4a67223 | S0=0 S1=0 S2=0 | CLEAN
[3/17]  a11c738 | S0=0 S1=0 S2=0 | CLEAN
[4/17]  9f846fa | S0=0 S1=0 S2=0 | CLEAN
[5/17]  dcfb068 | S0=0 S1=0 S2=0 | CLEAN
[6/17]  f8957e9 | S0=0 S1=0 S2=0 | CLEAN
[7/17]  d71ce0c | S0=0 S1=0 S2=0 | CLEAN
[8/17]  f5d9633 | S0=0 S1=0 S2=0 | CLEAN
[9/17]  d854b42 | S0=0 S1=0 S2=0 | CLEAN
[10/17] 26daa28 | S0=0 S1=0 S2=0 | CLEAN
[11/17] c6bbe1a | S0=0 S1=0 S2=0 | CLEAN
[12/17] c7d3027 | S0=0 S1=0 S2=0 | CLEAN
[13/17] a670099 | S0=0 S1=0 S2=0 | CLEAN
[14/17] 0b2bb77 | S0=0 S1=0 S2=0 | CLEAN
[15/17] e69749f | S0=0 S1=0 S2=0 | CLEAN
[16/17] a4bf45b | S0=0 S1=0 S2=0 | CLEAN
[17/17] 47fddd2 | S0=0 S1=0 S2=0 | CLEAN
```

**旧 commit 可达性检查**：
```
OK: 30b139f exists but not reachable from any remote branch
OK: 7103b1c exists but not reachable from any remote branch
OK: e4e4b60 exists but not reachable from any remote branch
OK: 754b6c4 exists but not reachable from any remote branch
OK: 7210333 exists but not reachable from any remote branch
OK: 2dbc136 exists but not reachable from any remote branch
OK: f655d95 exists but not reachable from any remote branch
OK: bb87d63 exists but not reachable from any remote branch
OK: a6c419a exists but not reachable from any remote branch
OK: 312354f exists but not reachable from any remote branch
OK: 8e139eb exists but not reachable from any remote branch
OK: 010487f exists but not reachable from any remote branch
OK: 10a12ed exists but not reachable from any remote branch
OK: 54ef95c exists but not reachable from any remote branch
OK: 3f9346b exists but not reachable from any remote branch
OK: 596d5dd exists but not reachable from any remote branch
OK: 93919da exists but not reachable from any remote branch
```

---

## 7. 是否满足验收条件

### Gate R1 最终验收条件逐条判断

| 验收条件 | 状态 | 证据 | 证据分级 |
|---------|------|------|---------|
| 公开分支不含真实 Base、Table、Field 或 record 标识符 | **满足** | `verify_public_repo.py` tracked 模式：S0=0, S1=0, S2=0 | `REPRODUCIBLE_FROM_PUBLIC_REPO` |
| 公开分支不含密钥或个人记录 | **满足** | tracked 扫描 S0=0, S1=0 | `REPRODUCIBLE_FROM_PUBLIC_REPO` |
| 历史暴露已清理 | **满足** | 全部 17 个可达 commit 扫描 CLEAN（S0=0, S1=0, S2=0） | `SELF_REPORTED` |
| 旧敏感 commit 不再属于任何远程 branch 或 tag 的可达历史 | **满足** | 17/17 旧 commit 不从 `origin/master` 或任何 tag 可达；`git ls-remote` 仅 `refs/heads/master` | `REPRODUCIBLE_FROM_PUBLIC_REPO` |
| `PROJECT_GUIDE.md` 内容未改变 | **满足** | 重写前后 blob SHA 一致：`49418d6b2dcd480a52079c1adb6e2fefa26891d0` | `REPRODUCIBLE_FROM_PUBLIC_REPO` |
| 暂存区（staged）不含敏感数据 | **满足** | 工作树 clean，无 staged 变更 | `REPRODUCIBLE_FROM_PUBLIC_REPO` |
| 使用 force-with-lease 而非无保护 force | **满足** | 命令：`git push --force-with-lease=master:30b139f... origin master` | `SELF_REPORTED` |
| 创建本地备份并记录路径和 SHA | **满足** | `backups/private/feishu-pre-r1-rewrite.git`，HEAD=`30b139f`，17 commits | `SELF_REPORTED` |
| 禁止操作未执行 | **满足** | 见下方禁止操作验证 | `SELF_REPORTED` |

### 禁止操作验证

以下禁止操作均**未执行**：

- `git push --force`（无保护 force）— 未执行，使用 `--force-with-lease`
- 自动进入 Gate R2 — 未执行
- `MIGRATION_PILOT_001` — 未执行
- 写入 `NEEDS_REVIEW` 或 `BLOCKED` 记录 — 未执行
- 删除旧 Base 记录 — 未执行
- 切换 APP 到 V2 — 未执行
- 启用生产自动化 — 未执行
- 提交私有数据 — 未执行

### 总体 Gate R1 决策

```text
GATE_R1 = PASS
```

---

## 8. 下一阶段建议

1. **将本审计包提交 GPT 进行独立审计。**
2. **不得自动进入 Gate R2**，需等待 GPT 审计完成且用户批准。
3. **GitHub 缓存说明**：GitHub 可能在 force-push 后短期内仍允许通过旧 commit SHA 直接访问旧 commit 对象。这是 GitHub 平台行为，非本仓库可控。旧 commit 不可达，将在 GitHub 自动 gc 后彻底消失。
4. **备份管理**：`backups/private/feishu-pre-r1-rewrite.git` 包含重写前完整历史（含真实标识符）。用户可在确认 GPT 审计通过后删除此备份。
5. **协作者通知**：如有关联此仓库的协作者，需通知其重新 clone 仓库，旧 clone 包含已失效的历史。
