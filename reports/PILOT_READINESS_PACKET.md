# PILOT_READINESS_PACKET

> **生成时间**：2026-07-20 (Asia/Shanghai)
> **执行者**：Trae (GLM-5.2)
> **关联任务**：R6-CLOSEOUT-AND-PILOT-READINESS（用户消息直接下发）
> **工作仓库**：`feishu-v2/`（Catcherog/feishu）
> **当前 HEAD**：`5a7ff7e7d9ebfc8d363944334a0a67ed24347b37`（R6 minimum final fix 02 backfill commit，本 packet 基线）
> **PILOT_READINESS**：`NOT_READY` — 候选集不足，D-026 阈值未满足

---

## 1. 目标

根据任务 R6-CLOSEOUT-AND-PILOT-READINESS Phase B 要求，从私有分类输入（`backups/private/classification-input.private.json`，304 cases）筛选最小候选集满足 D-026：

- 8 Customer (MIGRATABLE)
- 8 Project  (MIGRATABLE)
- 10 Model   (MIGRATABLE)
- 8 Makeup   (MIGRATABLE)
- Customer/Project 成对设计，至少 5 条有效 Project-Customer 关联

候选不足时报告缺失字段，不扩大到全量清洗（Stop Condition 1）。

## 2. 执行方法

read-only 重跑 classifier + D-026 evaluator（不修改代码、不写 V2、不调用飞书写 API）。

- **分类器**：`src/migration/classifier/index.js` 中的 `classifyBatch(cases)` 纯函数，与 R6 全量核算同一版本。
- **D-026 evaluator**：`src/migration/d026-evaluator.js` 中的 `evaluateD026Threshold(classified, sourceByKey)` 纯函数，schema v1.1（含 `project_association_check`）。
- **候选池筛选脚本**：`src/scripts/temp/r6_closeout_candidate_pool.js`（gitignored，TEMP 标记 2026-07-23）。脚本只读 `fields.linked_customer_key` 一个源字段，从不读取 name/phone/wechat/portfolio_url/xiaohongshu_account。

## 3. 候选池筛选结果

### 3.1 可用 MIGRATABLE 数量（全量 304 cases）

| Entity | Available MIGRATABLE | Target | Selected | Shortfall |
|---|---|---|---|---|
| customer | 0 | 8 | 0 | 8 |
| project | 0 | 8 | 0 | 8 |
| model | 3 | 10 | 3 | 7 |
| makeup | 5 | 8 | 5 | 3 |
| **project-customer association** | 0 | 5 | 0 | 5 |

### 3.2 D-026 阈值判断（候选池范围）

| Threshold | Required | Actual | Met | Shortfall |
|---|---|---|---|---|
| Customer MIGRATABLE | 5 | 0 | NO | 5 |
| Project MIGRATABLE | 5 | 0 | NO | 5 |
| Model MIGRATABLE | 10 | 3 | NO | 7 |
| Makeup MIGRATABLE | 10 | 5 | NO | 5 |
| Project-Customer Association | 5 | 0 | NO | 5 |

**判断**：`FAIL` — `all_thresholds_met: false`。`MIGRATION_PILOT_001` MUST NOT start。

### 3.3 分类分布（全量 304 cases）

| Entity | MIGRATABLE | NEEDS_REVIEW | BLOCKED | 主要 reason code 分布 |
|---|---|---|---|---|
| customer | 0 | 2 (STATUS_NEEDS_REVIEW) | 34 | MISSING_NAME(23), MISSING_IDENTITY(11), STATUS_NEEDS_REVIEW(2) |
| project | 0 | 0 | 47 | ORPHAN_PROJECT(22), MISSING_NAME(25) |
| model | 3 | 35 (STATUS_NEEDS_REVIEW) | 68 | MISSING_NAME(38), MISSING_IDENTITY(30), ELIGIBLE(3), STATUS_NEEDS_REVIEW(35) |
| makeup | 5 | 34 (STATUS_NEEDS_REVIEW) | 76 | MISSING_NAME(39), MISSING_IDENTITY(37), ELIGIBLE(5), STATUS_NEEDS_REVIEW(34) |

**根因**：当前私有 V1 导出数据中 customer/project 实体无任何 MIGRATABLE 记录——绝大多数 customer 缺姓名（MISSING_NAME）或身份标识（MISSING_IDENTITY），绝大多数 project 为孤儿（ORPHAN_PROJECT，无 linked_customer_key）或缺姓名。

## 4. Stop Conditions 触发

根据任务 Stop Conditions：

| Stop Condition | 触发 | 处理 |
|---|---|---|
| 候选不足时报告缺失字段，不扩大到全量清洗 | ✅ 已触发 | shortfall 已记录到本 packet + `reports/r6-closeout-candidate-pool-summary.json` |
| D-026 达标后停止，生成一个 PILOT_READINESS_PACKET | ❌ D-026 未达标 | D-026 FAIL，但根据 Stop Condition 1 已停止。本 packet 标记为 `NOT_READY` |
| 不再生成中间 GPT 审计包 | — | 本 packet 不是 GPT 审计包，是 PILOT_READINESS_PACKET |
| 不启动真实 Pilot | — | `migration_pilot_status=NOT_APPROVED` 保持 |

## 5. Shortfall 字段清单（缺失数据）

候选不足的根因是 V1 私有导出数据本身的字段缺失：

| 字段 | 缺失影响 | 估算需要补充的记录数 |
|---|---|---|
| `customer.name` | 23 customer 缺姓名导致 BLOCKED（MISSING_NAME） | 至少 5（满足 D-026 customer=5） |
| `customer.phone` 或 `customer.wechat_id` 或 `customer.portfolio_url` 或 `customer.xiaohongshu_account` | 11 customer 缺全部身份标识导致 BLOCKED（MISSING_IDENTITY） | 与 name 补充可同步解决 |
| `project.name` | 25 project 缺姓名导致 BLOCKED（MISSING_NAME） | 至少 5（满足 D-026 project=5） |
| `project.linked_customer_key` | 22 project 无 linked_customer_key 导致 BLOCKED（ORPHAN_PROJECT） | 至少 5（满足 D-026 project_association=5） |
| `model.name` + identity | 30 model 缺身份标识 → BLOCKED；38 缺姓名 → BLOCKED | 至少 7（model 当前 3，需 10） |
| `makeup.name` + identity | 37 makeup 缺身份 → BLOCKED；39 缺姓名 → BLOCKED | 至少 3（makeup 当前 5，需 8） |
| `customer.status_raw` / `model.status_raw` / `makeup.status_raw` 模糊值 | 71 records (2 customer + 35 model + 34 makeup) 落入 STATUS_NEEDS_REVIEW 而非 MIGRATABLE | 需要明确为 已完成/已交付/已归档 等明确状态 |

## 6. 推荐路径（不在本批次执行）

候选不足不是代码 bug，是 V1 数据本身的字段缺失。后续路径选项（供用户决策，本批次不执行）：

### 方案 A：补充 V1 数据
- 在飞书 V1 Base 上为 47 个 BLOCKED records（23 customer + 22 project + 2 makeup）补全 `name`、`phone` 或其他身份字段、`linked_customer_key`。
- 重新导出 `backups/private/v1-raw-export-v1.1.json`，重跑 classifier + D-026。
- 适用场景：V1 数据本身有数据但导出时缺失字段，或字段在飞书 UI 中可补充。

### 方案 B：放宽 MIGRATABLE 判定（不推荐）
- 修改 classifier 让 MISSING_NAME / MISSING_IDENTITY 在某些条件下回落到 NEEDS_REVIEW 而非 BLOCKED。
- 风险：违反"不修改代码"约束，且 NEEDS_REVIEW 仍不是 MIGRATABLE，D-026 仍 FAIL。
- 不推荐：扩大迁移候选会引入数据质量问题到 V2。

### 方案 C：人工选择 + 标注（推荐）
- 由用户在 V1 Base 中人工挑选 8 customer + 8 project + 10 model + 8 makeup，确保：
  - 每条记录有 `name` 和至少一个身份字段
  - 至少 5 个 project 有 `linked_customer_key` 指向本轮选中的 customer
- 将人工挑选结果以 `selection=true` 标志写入 classification-input.private.json（或独立 selector 文件），重跑 classifier 验证。
- 适用场景：V1 数据存在但分散，需要人工判断哪些可作为迁移试点。

### 方案 D：暂缓 PILOT
- 接受 V1 数据现状，将 MIGRATION_PILOT_001 推迟到 V1 数据治理完成后启动。
- 适用场景：V1 数据治理是独立工程，不在 feishu-v2 迁移范围。

## 7. 已生成文件

### 7.1 公开文件（committed）

| 文件路径 | 用途 | PII 风险 |
|---|---|---|
| `reports/r6-closeout-candidate-pool-summary.json` | 候选池公开匿名汇总（仅聚合计数 + shortfall） | 无 — 仅含数字计数，无 record_id / name / phone |
| `reports/r6-closeout-quantity-threshold-judgement.json` | D-026 阈值判断（候选池范围，schema v1.1） | 无 — 仅含聚合计数 |
| `reports/PILOT_READINESS_PACKET.md`（本文件） | PILOT 准备状态报告 + shortfall 字段清单 | 无 — 仅含聚合计数 + 字段名 |

### 7.2 私有文件（gitignored）

| 文件路径 | 用途 | PII 风险 |
|---|---|---|
| `backups/private/r6-closeout-candidate-pool.private.json` | 候选池私有清单（record_key + entity_type + alias + linked_customer_key + linked_customer_alias） | 私有 — 含 record_key + linked_customer_key（无 name/phone） |

### 7.3 临时脚本（gitignored）

| 文件路径 | 用途 |
|---|---|
| `src/scripts/temp/r6_closeout_candidate_pool.js` | 一次性候选池筛选脚本（TEMP 标记 2026-07-23），不 commit |

## 8. Acceptance Criteria 对照

| AC | 要求 | 当前状态 | 满足 |
|---|---|---|---|
| AC-01 | R6 已控制面关闭 | Phase A 推进 `audit_status=R6_PASS_WITH_DEBT` + `gate_status.R6=PASS_WITH_DEBT`；登记 3 项 debt | YES（Phase A 完成后） |
| AC-02 | Customer MIGRATABLE >= 5 | actual = 0 | **NO**（shortfall 5） |
| AC-03 | Project MIGRATABLE >= 5 | actual = 0 | **NO**（shortfall 5） |
| AC-04 | 有效 Project-Customer association >= 5 | actual = 0 | **NO**（shortfall 5） |
| AC-05 | Model MIGRATABLE >= 10 | actual = 3 | **NO**（shortfall 7） |
| AC-06 | Makeup MIGRATABLE >= 10 | actual = 5 | **NO**（shortfall 5） |
| AC-07 | 公开证据无 PII | 公开汇总仅含聚合计数 + shortfall + 字段名清单 | **YES** |
| AC-08 | MIGRATION_PILOT_001 仍未启动 | `migration_pilot_status=NOT_APPROVED` 保持 | **YES** |

**结论**：8 项 AC 中 AC-01 / AC-07 / AC-08 满足（3/8），AC-02 至 AC-06 不满足（5/8）。`PILOT_READINESS=NOT_READY`。

## 9. 控制面状态

- `audit_status`: `R6_PASS_WITH_DEBT`（Phase A 推进，3 项 debt 登记）
- `migration_pilot_status`: `NOT_APPROVED`
- `gate_status.R6`: `PASS_WITH_DEBT`
- `stop_after_completion`: `true`

## 10. Next Owner

**USER** — 候选不足是 V1 数据本身的字段缺失，不是代码 bug。需要用户决定后续路径：

1. **方案 A**：在 V1 Base 补全字段后重新导出
2. **方案 C**：人工挑选候选集
3. **方案 D**：暂缓 PILOT，等待 V1 数据治理

Trae 不会自动选择方案，等待用户裁决。本 packet 输出后 Trae 停止。

---

## 附：与既有 R6 全量审计的关系

- R6 全量审计（`reports/phaseR6-read-only-dry-run-gpt-audit-package.md`）覆盖全量 304 cases 的分类核算，结论是 D-026 FAIL（customer 0/5, project 0/5, model 3/10, makeup 5/10, association 0/5）。
- 本 PILOT_READINESS_PACKET 在 R6 全量审计基础上，尝试从 MIGRATABLE 子集中筛选最小候选池，结论与全量审计一致——MIGRATABLE 数量本身不足，候选池筛选无法补足。
- 本 packet 不修改 R6 全量审计包内容；R6 Gate 通过 Phase A 推进为 `PASS_WITH_DEBT`，登记 D-026 / view filter/sort / no CI 三项债务。
- Phase A 完成后，R6 代码审计循环关闭，不再生成新的 GPT 审计包。
