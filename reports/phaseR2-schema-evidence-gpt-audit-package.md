# Phase R2 Schema Evidence GPT Audit Package (v2 — Plan B applied)

> **生成时间**：2026-07-17 (time of commit, local Beijing time)
> **执行者**：Trae (GLM-5.2)
> **审计目标**：供 GPT 或人工审计者验证 Phase 1B-3 Gate R2（Schema evidence）执行的正确性和完整性
> **任务文件**：`docs/ai/tasks/TASK-001.md` (SOP root)
> **工作仓库**：`feishu-v2/` (`Catcherog/feishu`)
> **R2 第一次提交**：`0462ea496d1bffabc93da86a5b565b76c51f9e15`（HOLD_SCHEMA_VIEW_DRIFT）
> **R2 第二次提交**：(本审计包提交后填入)（方案 B 执行，SCHEMA_VIEW_DRIFT 已解决）
> **Gate decision**：`GATE_R2 = R2_REVIEW_PENDING`（技术工作完成，等待外部审计，**不进入 R3**）

## 0. 版本说明

本审计包是 R2 的第二版（v2），取代 v1（commit `0462ea4`）。v1 因发现 `SCHEMA_VIEW_DRIFT` 而 HOLD。用户批准方案 B 后，本版执行了以下变更：
- 向 `schemas/v2-schema-v1.1.json` 添加 4 个视图（方案 B）。
- 统一采用 LF 规范化 SHA256 口径重新生成 `schemas/v2-schema-v1.1.sha256`。
- 更新 `tests/test_generate_schema_diff.py` 的 `test_public_v1_0_to_v1_1_machine_facts` 预期值（`view_changes` 从 0 改为 4）。
- 重新生成 `schemas/schema-diff-v1.0-to-v1.1.json`。
- 添加 `__pycache__/` 和 `*.pyc` 到 `.gitignore`。
- 更新控制面（Manifest + Entry Point）状态为 `R2_REVIEW_PENDING`。

v1 审计包中报告的"v1.0 sha256 文件漂移"经核查为**误报**：`schemas/v2-schema-v1.0.sha256` 文件本身就是用 LF 规范化口径生成的，v1 审计包中用 `Get-FileHash`（raw 字节）计算导致误判。统一 LF 口径后 v1.0.sha256 无需修改，已正确。

## 1. 本次完成内容

### 1.1 R2 v1（commit `0462ea4`）已完成内容（保留）

1. 创建 `docs/audit/phaseR1-independent-verification-2026-07-17.md`。
2. TDD 流程：合成 fixture + 失败测试 → 实现 `scripts/generate_schema_diff.py` → 3/3 测试通过。
3. 生成 `schemas/schema-diff-v1.0-to-v1.1.json`（v1 版本，view_changes=0）。
4. 发现 `SCHEMA_VIEW_DRIFT` 并 HOLD。
5. 更新 Manifest 和 Entry Point 为 `HOLD_SCHEMA_VIEW_DRIFT`。

### 1.2 R2 v2（本次提交）完成内容

6. **方案 B 执行**：向 `schemas/v2-schema-v1.1.json` 添加 4 个视图：
   - `customer` 表末尾添加"迁移记录"视图（表格，`migration_batch_id 不为空`，`migrated_at 降序`）。
   - `project` 表末尾添加"迁移记录"视图（表格，`migration_batch_id 不为空`，`migrated_at 降序`）。
   - `project` 表末尾添加"按付款状态分组"视图（看板，`无` filter，`payment_status 分组`）。
   - `resource` 表末尾添加"迁移记录"视图（表格，`migration_batch_id 不为空`，`migrated_at 降序`）。
   - 视图定义与 `docs/v2-view-inventory.md` 声明完全一致。
7. **LF 规范化 SHA256 口径统一**：
   - 验证 `schemas/v2-schema-v1.0.sha256` 文件内容（`71aa8a04...`）与 v1.0.json 的 LF 规范化 SHA256 一致，无需修改。
   - 重新生成 `schemas/v2-schema-v1.1.sha256`（LF 规范化口径）：`f0b70e0b3e7249f6ad8ba0b020e1d1762e6d9adc6609f8e58d2ff8f917bff6a5`。
8. **更新测试预期值**：`tests/test_generate_schema_diff.py` 中 `test_public_v1_0_to_v1_1_machine_facts` 的 `view_changes` 从 0 改为 4。
9. **重新生成 schema-diff**：`schemas/schema-diff-v1.0-to-v1.1.json` 重新生成，新 SHA256：`791b501eed5b2368e13cbc62f0a3dfe5c97cf0a682ebf4f1ecd36d0fe3ef8d69`。
10. **添加 __pycache__ 排除**：`.gitignore` 新增 `__pycache__/` 和 `*.pyc` 规则。
11. **更新控制面**：Manifest `audit_status` 从 `HOLD_SCHEMA_VIEW_DRIFT` 推进到 `R2_REVIEW_PENDING`；Entry Point 第 3 节同步更新。
12. **重写审计包**：本文件取代 v1 审计包，反映方案 B 执行后的新机器事实。

未执行 Out of Scope 操作（详见第 7.10 节）。

## 2. 发现的关键事实

### 2.1 R1 独立复核结论（不变）

详见 `docs/audit/phaseR1-independent-verification-2026-07-17.md`：113 文件、20 commits、`S0=0 S1=0 S2=0`、17 pre-rewrite commits 不可达、Pilot 未批准。

### 2.2 Schema v1.0 → v1.1 机器差异（方案 B 后，deterministic, byte-stable）

| 分类 | 数量 | 说明 |
|------|------|------|
| `added_fields` | 35 | Customer 14 + Project 14 + Resource 7 |
| `removed_fields` | 0 | 无字段被删除 |
| `changed_fields` | 0 | 无字段定义（非 options/required）发生变化 |
| `enum_changes` | 1 | `customer.source_channel` 选项 6→12（D-021） |
| `required_changes` | 0 | 无字段必填属性变化 |
| `view_changes` | 4 | Customer 迁移记录 + Project 迁移记录 + Project 按付款状态分组 + Resource 迁移记录（方案 B 新增） |
| `state_machine_changes` | 2 | `customer_relationship_status` + `project_status`（D-020） |
| `global_enum_changes` | 1 | `enums.source_channel` 6→12 选项（D-021） |

### 2.3 view_changes 详情（方案 B 新增的 4 个视图）

```json
[
  {"table": "customer", "view_name": "迁移记录", "action": "added", "definition": {"view_type": "表格", "filter": "migration_batch_id 不为空", "sort": "migrated_at 降序", "description": "按迁移批次查看"}},
  {"table": "project", "view_name": "按付款状态分组", "action": "added", "definition": {"view_type": "看板", "filter": "无", "sort": "—", "description": "payment_status 分组"}},
  {"table": "project", "view_name": "迁移记录", "action": "added", "definition": {"view_type": "表格", "filter": "migration_batch_id 不为空", "sort": "migrated_at 降序", "description": "按迁移批次查看"}},
  {"table": "resource", "view_name": "迁移记录", "action": "added", "definition": {"view_type": "表格", "filter": "migration_batch_id 不为空", "sort": "migrated_at 降序", "description": "按迁移批次查看"}}
]
```

所有 4 个视图定义与 `docs/v2-view-inventory.md` 声明完全一致。`SCHEMA_VIEW_DRIFT` 已解决。

### 2.4 确定性证据

- `schemas/schema-diff-v1.0-to-v1.1.json` 两次连续生成 SHA256 完全相同：`791b501eed5b2368e13cbc62f0a3dfe5c97cf0a682ebf4f1ecd36d0fe3ef8d69`。
- 测试 `test_render_is_byte_deterministic` 显式校验同一输入两次渲染字节一致且 SHA256 一致。

### 2.5 LF 规范化 SHA256 口径

- **v1.0.json**：
  - raw（CRLF）SHA256：`213580580176c05dd8f53478465980b44c0a2eb8a923062d2623b8ac13185d97`
  - LF 规范化 SHA256：`71aa8a0406fbe9911a1fe3dfbcd3bca5c8308ac540d95599af39ec726ad08ec7`
  - `v1.0.sha256` 文件内容：`71aa8a0406fbe9911a1fe3dfbcd3bca5c8308ac540d95599af39ec726ad08ec7`
  - **结论**：v1.0.sha256 文件本来就是 LF 口径，v1 审计包中的"漂移"报告是误报（用了 raw 字节计算）。
- **v1.1.json**（方案 B 后）：
  - raw（CRLF）SHA256：`9de8bef81f83955beec05f181c1c42e08c98055187921775ec2b4d6143176d8a`
  - LF 规范化 SHA256：`f0b70e0b3e7249f6ad8ba0b020e1d1762e6d9adc6609f8e58d2ff8f917bff6a5`
  - `v1.1.sha256` 文件内容（重新生成）：`f0b70e0b3e7249f6ad8ba0b020e1d1762e6d9adc6609f8e58d2ff8f917bff6a5`
  - **结论**：v1.1.sha256 已更新为 LF 口径，与 v1.1.json（含 4 个新视图）一致。

### 2.6 字段数人工计数冲突（仍需在后续 Gate 处理）

- `reports/phase1b3-gpt-audit-package.md` line 132 声称"新增 19 个字段"，机器事实为 35 字段。
- 该冲突属于历史审计包的人工计数错误，**不在 R2 范围内修复**（修复需要更新或取代 phase1b3 审计包，属于 R6 范围）。
- R2 仅确保本审计包中使用机器事实，不引入新的人工计数冲突。

## 3. 历史文档与真实系统的冲突

### 3.1 `SCHEMA_VIEW_DRIFT` — 已解决 ✅

- **v1 状态**：Schema JSON 的 `views` 数组无变化（view_changes=0），但视图清单声明 4 个新视图。
- **v2 状态**：方案 B 已将 4 个视图添加到 `schemas/v2-schema-v1.1.json`，机器 diff 现在显示 `view_changes=4`，与 `docs/v2-view-inventory.md` 一致。
- **结论**：`SCHEMA_VIEW_DRIFT` 已解决。

### 3.2 字段数人工计数冲突 — 未修复（超出 R2 范围）

- `reports/phase1b3-gpt-audit-package.md` line 132 声称 19 字段，机器事实 35 字段。
- 属于历史审计包错误，建议在 R6（新 Dry Run 和审计包）中以新审计包取代。

### 3.3 v1.0 sha256 文件"漂移" — 已澄清（误报）

- v1 审计包报告 `schemas/v2-schema-v1.0.sha256` 与 v1.0.json 不一致。
- 经核查：sha256 文件使用 LF 规范化口径，v1 审计包用 raw 字节（CRLF）计算导致误判。
- 统一 LF 口径后，v1.0.sha256 已正确，无需修改。

## 4. 未解决问题和阻塞项

### 4.1 R2 Review Gate — 等待外部审计

R2 技术工作已完成（SCHEMA_VIEW_DRIFT 已解决，所有测试通过，确定性验证通过），但仍停在 R2 Review Gate 等待 GPT/用户独立审计。R3 不得自动启动。

### 4.2 历史审计包字段数错误（非阻塞，留待 R6）

`reports/phase1b3-gpt-audit-package.md` line 132 的"19 字段"与机器事实"35 字段"冲突。建议在 R6 以新审计包取代，不在 R2 修复。

## 5. 生成或修改的文件

### 5.1 R2 v1 提交（commit `0462ea4`）已入库的文件

| 文件路径 | 操作 | 说明 | Git commit SHA | 文件 SHA256 | 证据分级 |
|---|---|---|---|---|---|
| `docs/audit/phaseR1-independent-verification-2026-07-17.md` | 新建 | R1 独立复核结论 | `0462ea4` | `be9108f1a36c0ecf0e550a018048f5fc976b84428f359e943a4e625787124ddb` | `REPRODUCIBLE_FROM_PUBLIC_REPO` |
| `tests/__init__.py` | 新建 | Python 包标识 | `0462ea4` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `REPRODUCIBLE_FROM_PUBLIC_REPO` |
| `tests/fixtures/schema-diff/v1.0.json` | 新建 | 合成 v1.0 fixture | `0462ea4` | `d2c5c39e4bc1acad233d33ccf688b34c9549adb8c4f55092726787f2061a24f4` | `REPRODUCIBLE_FROM_PUBLIC_REPO` |
| `tests/fixtures/schema-diff/v1.1.json` | 新建 | 合成 v1.1 fixture | `0462ea4` | `010600e2bed91fb9294639cc042d48092db51bd9c114e569d612338936bbbac3` | `REPRODUCIBLE_FROM_PUBLIC_REPO` |
| `scripts/generate_schema_diff.py` | 新建 | 确定性 diff 生成器 | `0462ea4` | `a030ce6a826fb6685c00e1420256868e422a5ea47a65c820ed23d82af3ac05ea` | `REPRODUCIBLE_FROM_PUBLIC_REPO` |

### 5.2 R2 v2 提交（本次）修改/新建的文件

| 文件路径 | 操作 | 说明 | Git commit SHA | 文件 SHA256（raw） | Git blob SHA | 证据分级 |
|---|---|---|---|---|---|---|
| `schemas/v2-schema-v1.1.json` | 修改 | 添加 4 个视图（方案 B） | (本提交后填入) | `9de8bef81f83955beec05f181c1c42e08c98055187921775ec2b4d6143176d8a` | `a098f9ebfd2e13bc3131a97c67c09992acebb9fb` | `REPRODUCIBLE_FROM_PUBLIC_REPO` |
| `schemas/v2-schema-v1.1.sha256` | 修改 | LF 口径重新生成 | (本提交后填入) | `de298b71ffdf1280c324440d6a3f44e6fce46e490afd295fc9be7f9d32549379` | `eb0883dc03460ab3da89391229884c2592bba4ef` | `REPRODUCIBLE_FROM_PUBLIC_REPO` |
| `schemas/schema-diff-v1.0-to-v1.1.json` | 修改 | 重新生成（view_changes=4） | (本提交后填入) | `791b501eed5b2368e13cbc62f0a3dfe5c97cf0a682ebf4f1ecd36d0fe3ef8d69` | `6d44d2be4d6cab0c57f0017ee3368ba77b0b9bc4` | `INDEPENDENTLY_VERIFIED`（两次运行字节一致） |
| `tests/test_generate_schema_diff.py` | 修改 | view_changes 预期值 0→4 | (本提交后填入) | `490618ecb3c10676b7ef64b677c2975d6f975673134730bbd5d1586c37d40175` | `038ec001f17df12ae3cf7799e5f9f6922a0831b0` | `REPRODUCIBLE_FROM_PUBLIC_REPO` |
| `.gitignore` | 修改 | 添加 __pycache__/ 和 *.pyc | (本提交后填入) | `77c430bb5182727948aaebe2aa4e01ef701d9e3c7705c8a8c71d97e5b02e44c8` | `e0bd36f54f2921eb3c9f409c17e318053d111dfc` | `REPRODUCIBLE_FROM_PUBLIC_REPO` |
| `reports/phaseR2-schema-evidence-gpt-audit-package.md` | 修改 | 重写为 v2（方案 B 后） | (本提交后填入) | (本提交后填入) | (本提交后填入) | `SELF_REPORTED`（待 GPT 独立复核） |
| `config/public-execution-manifest.json` | 修改 | audit_status → R2_REVIEW_PENDING | (本提交后填入) | (本提交后填入) | (本提交后填入) | `REPRODUCIBLE_FROM_PUBLIC_REPO` |
| `PUBLIC_EXECUTION_ENTRYPOINT.md` | 修改 | 第 3 节更新 R2 完成 | (本提交后填入) | (本提交后填入) | (本提交后填入) | `REPRODUCIBLE_FROM_PUBLIC_REPO` |

### 5.3 未修改文件（仅为对账引用）

| 文件路径 | 操作 | 说明 | 文件 SHA256（raw） | 证据分级 |
|---|---|---|---|---|
| `schemas/v2-schema-v1.0.json` | 未修改 | v1.0 Schema | `213580580176c05dd8f53478465980b44c0a2eb8a923062d2623b8ac13185d97` | `REPRODUCIBLE_FROM_PUBLIC_REPO` |
| `schemas/v2-schema-v1.0.sha256` | 未修改 | v1.0 SHA256（LF 口径，已正确） | `480b02ceb39d7275be5b95fd3f00acf1f6525d2a077ca832d3dc2fce5edb563f`（文件本身 SHA256） | `REPRODUCIBLE_FROM_PUBLIC_REPO` |
| `docs/v2-view-inventory.md` | 未修改 | 视图清单（与 Schema 已一致） | `f1f2e0bffea6b6179419bd908d3233bbd37b4bdca3ee84efb468fdccbb687b45` | `REPRODUCIBLE_FROM_PUBLIC_REPO` |
| `reports/phase1b3-gpt-audit-package.md` | 未修改 | 1B-3 审计包（字段数 19 与机器 35 冲突，留待 R6） | `290ffe98a366b10180532006d1f45a511a17fbb31ed327ec8386b6ac4c97d4d5` | `REPRODUCIBLE_FROM_PUBLIC_REPO` |

## 6. 执行的测试与验证结果

### 6.1 基线核对（R2 v2 起点）

```powershell
git status --porcelain=v1   # 仅 __pycache__/ 未跟踪
git rev-parse HEAD           # 0462ea496d1bffabc93da86a5b565b76c51f9e15
git rev-parse origin/master  # 0462ea496d1bffabc93da86a5b565b76c51f9e15
```

退出码：0。基线一致（R2 v1 已推送）。

### 6.2 JSON 有效性验证（添加 4 视图后）

```powershell
python -c "import json; d = json.load(open('schemas/v2-schema-v1.1.json', encoding='utf-8-sig')); print('JSON valid'); print('customer views:', len(d['tables']['customer']['views'])); print('project views:', len(d['tables']['project']['views'])); print('resource views:', len(d['tables']['resource']['views']))"
```

输出：

```text
JSON valid
customer views: 10
project views: 12
resource views: 13
```

退出码：0。视图数量与 `docs/v2-view-inventory.md` 一致（Customer 10、Project 12、Resource 13）。

### 6.3 单元测试（方案 B 后）

```powershell
python -m unittest tests.test_generate_schema_diff -v
```

输出（节选）：

```text
test_public_v1_0_to_v1_1_machine_facts ... ok
test_render_is_byte_deterministic ... ok
test_synthetic_fixture_covers_every_change_category ... ok
----------------------------------------------------------------------
Ran 3 tests in 0.004s
OK
```

退出码：0。3/3 通过。`test_public_v1_0_to_v1_1_machine_facts` 现在验证 `view_changes=4`。

### 6.4 Schema diff 生成与确定性验证（方案 B 后）

```powershell
python scripts/generate_schema_diff.py
# 输出：{"added_fields": 35, "changed_fields": 0, "enum_changes": 1, "global_enum_changes": 1, "removed_fields": 0, "required_changes": 0, "state_machine_changes": 2, "view_changes": 4}

$firstHash = (Get-FileHash -Algorithm SHA256 -LiteralPath 'schemas/schema-diff-v1.0-to-v1.1.json').Hash
python scripts/generate_schema_diff.py | Out-Null
$secondHash = (Get-FileHash -Algorithm SHA256 -LiteralPath 'schemas/schema-diff-v1.0-to-v1.1.json').Hash
# $firstHash -eq $secondHash → True
```

- 两次退出码：0。
- `FIRST_HASH = SECOND_HASH = 791b501eed5b2368e13cbc62f0a3dfe5c97cf0a682ebf4f1ecd36d0fe3ef8d69`。
- 字节确定性：通过。

### 6.5 LF 规范化 SHA256 验证

```powershell
python -c "import hashlib; v10_raw = open('schemas/v2-schema-v1.0.json', 'rb').read(); v10_lf = v10_raw.replace(b'\r\n', b'\n'); print(hashlib.sha256(v10_lf).hexdigest())"
# 输出：71aa8a0406fbe9911a1fe3dfbcd3bca5c8308ac540d95599af39ec726ad08ec7
# 与 v1.0.sha256 文件内容一致

python -c "import hashlib; v11_raw = open('schemas/v2-schema-v1.1.json', 'rb').read(); v11_lf = v11_raw.replace(b'\r\n', b'\n'); print(hashlib.sha256(v11_lf).hexdigest())"
# 输出：f0b70e0b3e7249f6ad8ba0b020e1d1762e6d9adc6609f8e58d2ff8f917bff6a5
# 与重新生成的 v1.1.sha256 文件内容一致
```

退出码：0。LF 口径统一。

### 6.6 公开仓库安全扫描（工作树）

```powershell
python scripts/verify_public_repo.py
```

输出（节选）：

```text
PUBLIC REPOSITORY VERIFICATION
root: D:\360Downloads\Trae 项目\SOP\feishu-v2
mode: tracked (113 files)

Findings: S0=0 S1=0 S2=0
RESULT: PASS (0 warnings require review)
```

退出码：0。（注：tracked 文件数仍为 113，因为本次修改尚未暂存；暂存后将变为 113 + 新增文件数。）

### 6.7 最终验证（提交前）

```powershell
python -m unittest tests.test_generate_schema_diff -v   # 3/3 ok
python scripts/generate_schema_diff.py                   # exit 0, view_changes=4
python scripts/verify_public_repo.py                     # S0=0 S1=0 S2=0, exit 0
git diff --check                                          # 无输出
```

所有验证通过。

### 6.8 staged 安全扫描（暂存后）

```powershell
python scripts/verify_public_repo.py --staged
```

将在暂存后执行；预期 `S0=0 S1=0 S2=0`，退出码 0。

## 7. 是否满足验收条件

逐条对照 TASK-001 的 Acceptance Criteria：

1. **R1 独立复核结论已进入 `feishu-v2/` 的公开审计文件**：✅ 满足。`docs/audit/phaseR1-independent-verification-2026-07-17.md` 已在 v1 提交中入库。
2. **`config/public-execution-manifest.json`、`PUBLIC_EXECUTION_ENTRYPOINT.md` 与当前 Gate 状态一致**：✅ 满足。Manifest `gate_status.R2=R2_REVIEW_PENDING`、`gate_status.R3=NOT_STARTED`、`migration_pilot_status=NOT_APPROVED`；Entry Point 第 3 节同步更新。
3. **Schema diff 脚本可从干净仓库运行，退出码为 0**：✅ 满足。`python scripts/generate_schema_diff.py` 退出码 0。
4. **连续运行两次生成的 `schema-diff-v1.0-to-v1.1.json` SHA256 完全一致**：✅ 满足。两次均为 `791b501eed5b2368e13cbc62f0a3dfe5c97cf0a682ebf4f1ecd36d0fe3ef8d69`。
5. **Diff JSON 包含 In Scope 要求的全部分类，字段数量由代码计算，且不存在相互矛盾的人工计数**：✅ 满足。8 个分类齐全；`summary` 由 `len()` 计算；本审计包仅引用机器事实（view_changes=4），不引入新的人工计数冲突。
6. **自动化测试覆盖新增、删除、类型变化、枚举变化、必填变化和视图变化；全部通过**：✅ 满足。`test_synthetic_fixture_covers_every_change_category` 覆盖 8 类变化；3/3 通过。
7. **字段字典与机器字段差异完成核对；Schema JSON 的 `view_changes=0` 与视图清单声称新增视图的冲突被明确记录为 `SCHEMA_VIEW_DRIFT`，不得静默修复**：✅ 满足（方案 B 已解决）。v1 记录了 `SCHEMA_VIEW_DRIFT`；v2 通过方案 B（用户批准）将 4 个视图添加到 Schema，`view_changes` 现为 4，与视图清单一致。**非静默修复**——经用户明确批准方案 B 后执行。
8. **`python scripts/verify_public_repo.py` 使用工作区 Python 运行后为 `S0=0 S1=0 S2=0`，退出码为 0**：✅ 满足。详见 6.6。
9. **Gate R2 审计包符合 `.trae/rules/_gpt_audit.md` 的 8 点格式，并记录 commit SHA、blob SHA、生成命令、退出码、SHA256 和证据分级**：✅ 满足。本审计包严格按 8 点格式输出；第 5 点表格含 Git blob SHA 和文件 SHA256；第 6 点含生成命令和退出码；第 5 点含证据分级。
10. **`feishu-v2/` 最终工作树干净，提交已推送至 `origin/master`；Trae 明确声明未执行任何 Out of Scope 操作**：⏳ 进行中。提交和推送在 Task 5 Step 6 执行。Out of Scope 声明：见第 7.10 节。

### 7.10 Out of Scope 声明

Trae 明确声明本次 R2 v2 执行未进行以下 Out of Scope 操作：

- 未执行 Gate R3、R4、R5 或 R6。
- 未启动 `MIGRATION_PILOT_001`。
- 未访问或修改真实飞书 Base。
- 未应用 v1.1 Schema delta 到真实或测试 Base（方案 B 仅修改 Schema JSON 文件，不涉及真实 Base）。
- 未迁移任何真实业务记录。
- 未处理根仓库现有未提交修改。
- 未修改 `src/zehuai-app/`。
- 未部署自动化，未切换 APP 到 V2。
- 未删除旧 Base 数据、私有备份或历史记录。
- 未修改 v1.0 Schema（v1.0.json 保持不变）。
- 未修改 `docs/v2-view-inventory.md`（方案 B 以视图清单为准，将视图添加到 Schema，不修改视图清单）。
- 未修改 `reports/phase1b3-gpt-audit-package.md`（字段数冲突留待 R6）。
- 未读取任何 `config/*.local.*`、`backups/private/**`、`reports/private/**`、`.env*` 路径。
- 未使用 `git add .` 或 `git add -A`；逐文件暂存。
- **未自动进入 R3**。

## 8. 下一阶段建议

不自动执行，仅供用户决策：

1. **GPT 独立复核**：建议将本审计包交给 GPT 复核。GPT 应特别关注：
   - 方案 B 执行后，4 个视图定义是否与 `docs/v2-view-inventory.md` 完全一致。
   - LF 规范化 SHA256 口径是否统一（v1.0 和 v1.1 的 sha256 文件均用 LF 口径）。
   - 机器 diff 是否可从公开仓库独立重现（`view_changes=4`）。
   - 测试 `test_public_v1_0_to_v1_1_machine_facts` 预期值是否与机器事实一致。
   - `SCHEMA_VIEW_DRIFT` 是否真正解决（而非静默修复）。
2. **R3 启动条件**：GPT 独立复核通过（或用户批准）后，且 Manifest 中 `gate_status.R2` 推进到 `PASS`，方可启动 R3（Reproducible classifier）。R3 不得自动启动。
3. **历史审计包字段数冲突**：`reports/phase1b3-gpt-audit-package.md` line 132 的"19 字段"与机器事实"35 字段"冲突，建议在 R6 以新审计包取代。

R2 技术工作已完成。**仍停在 R2 Review Gate，等待外部审计。不进入 R3。**
