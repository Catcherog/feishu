# Decision Log

## D-009：feishu-v2 独立 Git 仓库建立

- 日期：2026-07-15
- 状态：APPROVED
- 决策人：用户
- 背景：Phase 0 审计有条件通过，需要为 V2 项目建立独立版本控制，与 SOP 根目录和 zehuai-app 工作树隔离
- 可选方案：
  1. 在 SOP 根目录初始化 Git
  2. 复用 zehuai-app 的 Git remote
  3. 在 feishu-v2 子目录创建独立仓库
- 最终决策：方案 3 — 在 `D:\360Downloads\Trae 项目\SOP\feishu-v2` 创建独立 Git 仓库
- 原因：
  - 不污染 SOP 根目录
  - 不影响 zehuai-app 工作树
  - V2 项目有独立的版本控制需求
- 代价与风险：需要在 feishu-v2 目录单独管理 Git 历史
- 影响的表、代码和自动化：无（仅文档和配置仓库）
- 验证方式：Secret 扫描通过，本地 commit 成功
- 后续复审日期：Phase 1A Schema Review Gate 时

## D-010：不自动 push，等待用户配置 remote

- 日期：2026-07-15
- 状态：APPROVED
- 决策人：用户
- 背景：feishu-v2 仓库已创建本地 commit，但 `FEISHU_V2_GIT_REMOTE` 环境变量和 `config/git-remote.local.txt` 均未配置
- 可选方案：
  1. 自动复用 zehuai-app 的 remote
  2. 等待用户配置新 remote
- 最终决策：方案 2 — 只完成本地 commit，不执行 push
- 原因：禁止自动复用 zehuai-app 的 remote，用户需显式配置 V2 专用 remote
- 代价与风险：代码仅存本地，需用户手动配置 remote 后 push
- 影响的表、代码和自动化：无
- 验证方式：输出本地 commit SHA
- 后续复审日期：用户配置 remote 后

## D-011：Phase 0.5 授权阻塞与处理方式

- 日期：2026-07-15
- 状态：APPROVED
- 决策人：用户
- 背景：Phase 0.5 要求补全 12 条自动化执行历史、验证规则 #5 和 #12、备份用户级视图，但 lark-cli user 身份已过期（token missing），bot 身份无法读取 workflow 执行日志和视图配置
- 可选方案：
  1. 使用 bot 身份继续尝试（已确认 91403 权限错误，不可行）
  2. 等待用户完成 `lark-cli auth login` 后使用 user 身份继续
- 最终决策：方案 2 — 等待用户授权
- 原因：user 身份是读取 workflow 执行日志、视图配置和用户级数据的必要条件
- 代价与风险：Phase 0.5 进度受用户操作阻塞
- 影响的表、代码和自动化：旧自动化和旧 Base 保持只读，不修改
- 验证方式：lark-cli auth status --verify 返回 user identity: ready
- 后续复审日期：用户授权完成后立即执行

## D-012：Phase 1A Schema Review Gate 暂停

- 日期：2026-07-15
- 状态：APPROVED
- 决策人：用户
- 背景：Phase 1A 要求先生成 10 张 V2 表完整 Schema、字段字典、状态机和视图规范，到 Schema Review Gate 后暂停等待确认
- 可选方案：
  1. 直接创建 Base 并写入 [TEST] 数据
  2. 生成 Schema 文档并提交到 Review Gate，等待用户确认后再创建 Base
- 最终决策：方案 2 — 生成 Schema 后暂停
- 原因：PROJECT_GUIDE.md 和 Phase 1A 明确要求在 Schema Review Gate 暂停，避免未确认结构就创建 Base
- 代价与风险：需要一次额外评审轮次
- 影响的表、代码和自动化：暂不创建任何 V2 表，不写入真实或合成数据
- 验证方式：Schema 文档通过 Secret 扫描和结构检查
- 后续复审日期：Schema Review Gate 用户确认后

## D-013：Phase 0.5 执行历史补全与验证结论

- 日期：2026-07-15
- 状态：APPROVED
- 决策人：用户
- 背景：用户完成 `lark-cli auth login` 后，使用 user 身份读取了 V1 Base 的 12 条工作流定义、核心表记录、视图配置，并生成 Phase 0.5 执行历史报告
- 可选方案：
  1. 继续等待飞书暴露 workflow execution history API 后再补全
  2. 基于当前可获取的规则定义和记录快照生成推断报告，承认 API 限制
- 最终决策：方案 2 — 生成推断报告并公开关键结论
- 原因：
  - `lark-cli` 未提供 workflow execution history 命令（`+workflow-execution-list` 不存在）
  - 规则 #5 真实触发字段已验证为「客户状态」=「已付定金」，纠正了旧文档错误
  - 规则 #12 已验证配置存在但数据条件未命中，未触发
- 代价与风险：无法给出精确执行次数，只能给出潜在触发数和条件验证结论
- 影响的表、代码和自动化：
  - 旧自动化保持启用，未修改
  - 旧 Base 未修改
  - 完整数据备份存放于 `backups/private/`，不提交 Git
- 验证方式：
  - 12 条 workflow 配置备份完整
  - 核心表记录备份完整
  - 视图配置备份完整
  - `docs/phase05-execution-report.md` 公开版无敏感信息
- 后续复审日期：V2 迁移 Serverless 自动化设计时

## D-014：Phase 0.5 临时脚本处理

- 日期：2026-07-15
- 状态：PENDING
- 决策人：用户
- 背景：Phase 0.5 数据分析过程中产生了多个一次性调试脚本，已按 `_temp_script.md` 规则存放到 `src/scripts/temp/` 并添加 TEMP 标记
- 当前保留的临时脚本：
  - `src/scripts/temp/phase05_execution_report.py`：生成 Phase 0.5 报告
  - `src/scripts/temp/fix_json_v5.py`：修复备份 JSON 编码损坏
  - `src/scripts/temp/compute_counts.py`：计算工作流潜在触发数
- 已清理的脚本：多个中间调试版本（fix_json_v2/v3/v4.py、debug_*.py、inspect_*.py、test_*.py、decode_*.py 等）
- 可选方案：
  1. 删除全部临时脚本（Phase 0.5 已完成）
  2. 迁移到 `src/scripts/` 并移除 TEMP 标记，作为 V2 数据分析工具保留
- 最终决策：待用户确认
- 原因：脚本的未来价值取决于是否还需要对 V1 Base 进行类似分析
- 代价与风险：删除后若需复现报告需重新编写；保留会增加仓库体积
- 影响的表、代码和自动化：无
- 验证方式：用户确认后执行
- 后续复审日期：用户回复后

## D-015：Phase 1A Schema Review Gate 通过并批准创建 V2 Pilot Base

- 日期：2026-07-15
- 状态：APPROVED
- 决策人：用户
- 背景：Phase 1A Schema Review Gate 已生成 [`docs/v2-base-schema.md`](file:///D:/360Downloads/Trae%20项目/SOP/feishu-v2/docs/v2-base-schema.md)，包含 10 张 V2 表的字段字典、状态机和视图规范
- 可选方案：
  1. 继续修改 Schema 后再创建 Base
  2. 按当前 Schema 创建飞书 Base `泽怀影像_业务中台_V2_PILOT`
- 最终决策：方案 2 — 按当前 Schema 创建 V2 Pilot Base
- 原因：用户已明确批准 Schema；PROJECT_GUIDE.md 和 Phase 1A 要求 Schema 确认后再创建 Base
- 限制条件：
  - 仅写入明确标记为 `[TEST]` 的合成数据
  - 不迁移真实客户和资源
  - 不修改 APP
  - 不部署正式自动化
  - 不自动进入下一阶段
- 代价与风险：创建 Base 后若 Schema 需要大幅调整，需重新建表或迁移字段
- 影响的表、代码和自动化：将在飞书新建 10 张 V2 表，不触碰 V1 旧表
- 验证方式：Base 创建后生成 `resource-map.local.json` 并核对 Table ID / Field ID
- 后续复审日期：Phase 1B 数据写入与验证完成后

## D-016：Phase 1A V2 Pilot Base 创建与 [TEST] 数据写入完成

- 日期：2026-07-15
- 状态：COMPLETED
- 决策人：用户 / AI 执行
- 背景：D-015 已批准按 Schema 创建 V2 Pilot Base，需实际建表、建字段、写入 [TEST] 合成数据并生成资源映射
- 执行结果：
  - 飞书 Base：`泽怀影像_业务中台_V2_PILOT`
  - Base token：`TARGET_V2_BASE_ALIAS`
  - 创建 10 张业务表：Customer、Project、Resource、Project_Resource_Assignment、Planning_Document、Task、AI_Inbox、Automation_Event、Data_Quality_Issue、System_Config
  - 写入 [TEST] 合成数据：
    - Customer：3 条
    - Project：3 条
    - Resource：4 条
    - Project_Resource_Assignment：2 条
    - Planning_Document：2 条
    - Task：3 条
    - AI_Inbox：1 条
    - Automation_Event：1 条
    - Data_Quality_Issue：1 条
    - System_Config：9 条
  - 生成 `config/resource-map.local.json`（含 Base token、Table ID、Field ID 映射）
- 限制条件遵守情况：
  - 所有记录名称/手机号/摘要均带 `[TEST]` 标记
  - 未迁移真实客户和资源
  - 未修改 APP
  - 未部署正式自动化
  - 未自动进入下一阶段
- 已知遗留问题：
  - 标题解析存在 3 个同名 Base（早期重试产生），当前脚本按 `+title-resolve` 首个结果复用完整 Base（token 见上）；其余 2 个仅含默认空表，建议后续在飞书界面手动删除或重命名以避免混淆
- 验证方式：
  - `+record-list` 确认各表记录数与预期一致
  - `resource-map.local.json` 中 Table ID / Field ID 与 `+field-list` / `+table-list` 返回一致    
- 后续复审日期：Phase 1B 数据写入与验证开始时

## D-017：Phase 1B-0 资源收尾与 Schema v1.0 固化

- 日期：2026-07-16
- 状态：COMPLETED
- 决策人：用户 / AI 执行
- 背景：Phase 1A 完成后进入 Phase 1B，需先完成 Git remote 配置、重名 Base 核查、Schema 固化
- 执行结果：
  - feishu-v2 配置独立 Git remote（`https://github.com/Catcherog/feishu.git`）
  - 干净提交推送到 GitHub
  - 核查重名 V2 Base，输出清单和创建时间，未删除任何 Base（遵守"不删除重名 Base，除非已完成人工确认"约束）
  - 固化 4 份 Schema 资产：
    - `schemas/v2-schema-v1.0.json`（Schema 源文件）
    - `schemas/v2-schema-v1.0.sha256`（完整性校验）
    - `docs/v2-field-dictionary.md`（字段字典）
    - `docs/v2-view-inventory.md`（视图清单）
  - 本地资源标识保留在 `config/resource-map.local.json`（已 gitignore）
- 验证方式：commit 312354f 推送成功，4 份资产文件存在且 hash 一致
- 后续复审日期：Phase 1B-3 Acceptance Gate 时

## D-018：Phase 1B-1 写入链路验证 — 47/47 PASS

- 日期：2026-07-16
- 状态：COMPLETED
- 决策人：AI 执行 / 用户复核
- 背景：需验证 V2 10 张表的完整 CRUD 链路、跨表关联、幂等性、错误处理和 AI_Inbox 生命周期
- 执行结果：
  - 对 10 张表（Customer、Project、Resource、Project_Resource_Assignment、Planning_Document、Task、AI_Inbox、Automation_Event、Data_Quality_Issue、System_Config）完成 CRUD 验证
  - 验证跨表关联（Project↔Customer、Assignment↔Project/Resource、Planning↔Project 等）
  - 所有写操作实现 `idempotency_key = source_record_id + event_type + rule_version`
  - 测试重复事件、429、网络中断、非法枚举、缺失字段、无效关联和部分成功
  - AI_Inbox 生命周期：pending → approved/modified/rejected → writeback 全链路通过
  - 所有写入操作记录到 Automation_Event
  - 测试数据全部使用 `[TEST]` 前缀
  - 最终结果：47/47 PASS（100%）
- 关键技术决策：
  - 使用 `+record-upsert`（单条）替代 `+record-batch-create`，避免批量格式复杂性
  - `+record-get` 需加 `--format json` 标志，返回 CSV 风格二维数组需重建 fields 映射
  - `+record-delete` 需 `--yes` 标志（high-risk-write）
  - `+record-upsert` 返回 `data.record.record_id_list[0]`（非 `record_id`）
  - 飞书平台允许创建空记录（auto_number 自动生成），数据校验需在应用层实现
- 输出：`reports/phase1b-write-path-test-report.md`（commit bb87d63）
- 验证方式：测试脚本运行通过，所有 [TEST] 记录已清理
- 后续复审日期：Phase 1B-3 Acceptance Gate 时

## D-019：Phase 1B-2 只读迁移 Dry Run — Migration Review Gate 暂停

- 日期：2026-07-16
- 状态：PAUSED（等待人工确认）
- 决策人：AI 执行 / 用户待确认
- 背景：需以只读方式读取旧 Base 的客户、项目、化妆师、模特，生成迁移预览报告
- 执行结果：
  - 只读取旧 Base 4 张表，未写 V2
  - 生成完整迁移预览：字段映射、状态映射、重复候选、孤儿记录、非法枚举、缺失字段
  - 客户和资源仅名称相同未自动合并
  - 原始导出和隐私数据存入 `backups/private/`（已 gitignore）
  - 每条核心记录给出分类：MIGRATABLE / NEEDS_REVIEW / BLOCKED / SKIP
  - 最终分类统计（MIGRATABLE / NEEDS_REVIEW / BLOCKED / SKIP）：
    - 客户：0 / 13 / 23 / 0（总 36 条）
    - 项目：0 / 22 / 25 / 0（总 47 条）
    - 化妆师：76 / 0 / 39 / 0（总 115 条）
    - 模特：61 / 7 / 38 / 0（总 106 条）
- 关键发现：
  - 旧表存在大量名称为空的测试/废弃记录（客户 23、项目 25、化妆师 39、模特 38），这些 BLOCKED 记录已确认为真实空值，非字段映射问题
  - 模特表使用 "艺名/昵称" 字段（非 "姓名"），初始脚本不匹配导致 106 条全部 BLOCKED；修正后 61 条 MIGRATABLE
  - 项目表使用 "关联客户 ID" 字段（非 "关联客户"），初始脚本不匹配导致全部误判为孤儿
  - 旧项目存在 "待立项" 和 "已完成" 状态，在 V2 项目状态机中无映射，需人工确认映射规则
  - 旧客户 "已拍摄"/"拍摄完成" 状态在 V2 中均映射到 "服务中"，需人工确认
  - 旧来源渠道 "抖音"/"视频号"/"朋友圈" 聚合到 V2 "其他"，需确认是否合理
- 输出：`reports/phase1b2-migration-review-gate.md`（commit f655d95）
- 暂停状态：⏸ Migration Review Gate — 等待人工确认以下事项：
  1. 状态映射确认（已拍摄/拍摄完成 → 服务中；待立项/已完成 → ?）
  2. 来源渠道聚合确认（抖音/视频号/朋友圈 → 其他）
  3. 重复候选逐条确认
  4. 孤儿记录处理（无关联项目的客户、无关联客户的项目）
  5. 缺失字段处理（定金金额、成交金额、客户满意度等 V2 无对应字段）
  6. 预算区间拆分规则确认
- 后续复审日期：用户确认后进入 Phase 1B-3 小批量试迁移
